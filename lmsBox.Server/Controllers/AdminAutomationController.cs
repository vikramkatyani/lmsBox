using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/admin/automation")]
[Authorize(Roles = "OrgAdmin")]
public class AdminAutomationController : ControllerBase
{
    private static readonly HashSet<string> NotificationEvents = new(StringComparer.OrdinalIgnoreCase)
    {
        "LearningPathwayAssignment",
        "LearningPathwayCompletion"
    };

    private static readonly HashSet<string> ReminderEvents = new(StringComparer.OrdinalIgnoreCase)
    {
        "NotStarted",
        "InProgress",
        "NotCompleted"
    };

    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminAutomationController> _logger;

    public AdminAutomationController(ApplicationDbContext context, ILogger<AdminAutomationController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet("tasks")]
    public async Task<IActionResult> ListTasks(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? type = null,
        [FromQuery] string? status = null)
    {
        var access = await GetAccessContextAsync();
        if (access.ErrorResult != null) return access.ErrorResult;

        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var query = _context.AutomationTasks
            .AsNoTracking()
            .Where(t => t.OrganisationId == access.OrganisationId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(t =>
                t.Title.ToLower().Contains(term) ||
                (t.Description != null && t.Description.ToLower().Contains(term)) ||
                t.EmailSubject.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(type))
        {
            query = query.Where(t => t.Type == type);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(t => t.Status == status);
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(t => t.UpdatedAtUtc ?? t.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.Id,
                t.Type,
                t.Status,
                t.Title,
                t.Description,
                t.EventKey,
                t.AudienceType,
                t.ScheduleMode,
                t.CreatedAtUtc,
                t.UpdatedAtUtc,
                t.PublishedAtUtc,
                announcementSendAtUtc = t.AnnouncementSendAtUtc
            })
            .ToListAsync();

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        return Ok(new
        {
            items,
            pagination = new
            {
                currentPage = page,
                pageSize,
                totalPages,
                totalCount,
                hasNextPage = page < totalPages,
                hasPreviousPage = page > 1
            }
        });
    }

    [HttpGet("tasks/{id:long}")]
    public async Task<IActionResult> GetTask(long id)
    {
        var access = await GetAccessContextAsync();
        if (access.ErrorResult != null) return access.ErrorResult;

        var task = await _context.AutomationTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id && t.OrganisationId == access.OrganisationId);

        if (task == null) return NotFound(new { message = "Automation task not found" });

        return Ok(new
        {
            task.Id,
            task.Type,
            task.Status,
            task.Title,
            task.Description,
            task.EventKey,
            task.EmailSubject,
            task.EmailBodyHtml,
            task.AudienceType,
            learningPathwayIds = ParseArray(task.AudienceFilterJson),
            courseIds = ParseArray(task.CourseFilterJson),
            task.ScheduleMode,
            task.IntervalMinutes,
            task.DaysAfterAssignment,
            task.AnnouncementSendAtLocal,
            task.AnnouncementSendAtUtc,
            task.TimeZoneId,
            task.CreatedAtUtc,
            task.UpdatedAtUtc,
            task.PublishedAtUtc
        });
    }

    [HttpPost("tasks")]
    public async Task<IActionResult> CreateTask([FromBody] SaveAutomationTaskRequest request)
    {
        var access = await GetAccessContextAsync();
        if (access.ErrorResult != null) return access.ErrorResult;

        var validationError = await ValidateRequestAsync(request, access.OrganisationId, allowDraft: true);
        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        var organizationTimeZoneId = access.Organization?.TimeZoneId ?? "UTC";
        var task = new AutomationTask
        {
            OrganisationId = access.OrganisationId,
            CreatedByUserId = access.UserId,
            UpdatedByUserId = access.UserId,
            Type = request.Type,
            Status = "Draft",
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            EventKey = request.EventKey,
            EmailSubject = request.EmailSubject.Trim(),
            EmailBodyHtml = request.EmailBodyHtml,
            AudienceType = request.AudienceType ?? "AllUsers",
            AudienceFilterJson = SerializeArray(request.LearningPathwayIds),
            CourseFilterJson = SerializeArray(request.CourseIds),
            ScheduleMode = request.ScheduleMode,
            IntervalMinutes = request.IntervalMinutes,
            DaysAfterAssignment = request.DaysAfterAssignment,
            AnnouncementSendAtLocal = request.AnnouncementSendAtLocal,
            AnnouncementSendAtUtc = ConvertLocalToUtc(request.AnnouncementSendAtLocal, request.TimeZoneId ?? organizationTimeZoneId),
            TimeZoneId = request.TimeZoneId ?? organizationTimeZoneId,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        _context.AutomationTasks.Add(task);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetTask), new { id = task.Id }, new { task.Id });
    }

    [HttpPut("tasks/{id:long}")]
    public async Task<IActionResult> UpdateTask(long id, [FromBody] SaveAutomationTaskRequest request)
    {
        var access = await GetAccessContextAsync();
        if (access.ErrorResult != null) return access.ErrorResult;

        var task = await _context.AutomationTasks
            .FirstOrDefaultAsync(t => t.Id == id && t.OrganisationId == access.OrganisationId);

        if (task == null) return NotFound(new { message = "Automation task not found" });

        if (task.Status == "Archived")
        {
            return BadRequest(new { message = "Archived tasks cannot be edited" });
        }

        var validationError = await ValidateRequestAsync(request, access.OrganisationId, allowDraft: true);
        if (validationError != null)
        {
            return BadRequest(new { message = validationError });
        }

        var organizationTimeZoneId = access.Organization?.TimeZoneId ?? "UTC";
        task.Type = request.Type;
        task.Title = request.Title.Trim();
        task.Description = request.Description?.Trim();
        task.EventKey = request.EventKey;
        task.EmailSubject = request.EmailSubject.Trim();
        task.EmailBodyHtml = request.EmailBodyHtml;
        task.AudienceType = request.AudienceType ?? "AllUsers";
        task.AudienceFilterJson = SerializeArray(request.LearningPathwayIds);
        task.CourseFilterJson = SerializeArray(request.CourseIds);
        task.ScheduleMode = request.ScheduleMode;
        task.IntervalMinutes = request.IntervalMinutes;
        task.DaysAfterAssignment = request.DaysAfterAssignment;
        task.AnnouncementSendAtLocal = request.AnnouncementSendAtLocal;
        task.TimeZoneId = request.TimeZoneId ?? organizationTimeZoneId;
        task.AnnouncementSendAtUtc = ConvertLocalToUtc(task.AnnouncementSendAtLocal, task.TimeZoneId);
        task.UpdatedByUserId = access.UserId;
        task.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Automation task updated" });
    }

    [HttpPost("tasks/{id:long}/publish")]
    public async Task<IActionResult> PublishTask(long id)
    {
        var access = await GetAccessContextAsync();
        if (access.ErrorResult != null) return access.ErrorResult;

        var task = await _context.AutomationTasks
            .FirstOrDefaultAsync(t => t.Id == id && t.OrganisationId == access.OrganisationId);

        if (task == null) return NotFound(new { message = "Automation task not found" });
        if (task.Status == "Archived") return BadRequest(new { message = "Archived tasks cannot be published" });

        var publishValidationError = ValidatePublish(task);
        if (publishValidationError != null)
        {
            return BadRequest(new { message = publishValidationError });
        }

        task.Status = "Published";
        task.PublishedAtUtc = DateTime.UtcNow;
        task.UpdatedAtUtc = DateTime.UtcNow;
        task.UpdatedByUserId = access.UserId;

        if (task.Type == "Announcement")
        {
            task.AnnouncementSendAtUtc = ConvertLocalToUtc(task.AnnouncementSendAtLocal, task.TimeZoneId ?? access.Organization?.TimeZoneId ?? "UTC");
            await EnqueueAnnouncementDispatchesAsync(task, access.OrganisationId);
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = "Automation task published" });
    }

    private async Task EnqueueAnnouncementDispatchesAsync(AutomationTask task, long organisationId)
    {
        var scheduledForUtc = task.AnnouncementSendAtUtc ?? DateTime.UtcNow;
        var recipients = new List<(string UserId, string Email)>();

        if (task.AudienceType == "AllUsers")
        {
            recipients = await _context.Users
                .AsNoTracking()
                .Where(u => u.OrganisationID == organisationId && u.ActiveStatus != 0 && !string.IsNullOrWhiteSpace(u.Email))
                .Select(u => new ValueTuple<string, string>(u.Id, u.Email!))
                .ToListAsync();
        }
        else if (task.AudienceType == "LearningPathways")
        {
            var pathwayIds = ParseArray(task.AudienceFilterJson);
            if (pathwayIds.Any())
            {
                recipients = await _context.LearnerPathwayProgresses
                    .AsNoTracking()
                    .Where(lp => pathwayIds.Contains(lp.LearningPathwayId))
                    .Join(
                        _context.Users.AsNoTracking().Where(u => u.OrganisationID == organisationId && u.ActiveStatus != 0 && !string.IsNullOrWhiteSpace(u.Email)),
                        lp => lp.UserId,
                        u => u.Id,
                        (lp, u) => new ValueTuple<string, string>(u.Id, u.Email!))
                    .Distinct()
                    .ToListAsync();
            }
        }

        if (!recipients.Any())
        {
            _logger.LogInformation("No recipients resolved for automation announcement task {TaskId}", task.Id);
            return;
        }

        var userIds = recipients.Select(r => r.UserId).Distinct().ToList();
        var existingUserIds = await _context.AutomationDispatches
            .AsNoTracking()
            .Where(d => d.AutomationTaskId == task.Id && userIds.Contains(d.UserId!))
            .Select(d => d.UserId)
            .Where(id => id != null)
            .Distinct()
            .ToListAsync();

        var existingSet = new HashSet<string>(existingUserIds!);
        foreach (var recipient in recipients)
        {
            if (existingSet.Contains(recipient.UserId)) continue;

            var idempotencyKey = $"task:{task.Id}:user:{recipient.UserId}:scheduled:{scheduledForUtc:yyyyMMddHHmmss}";
            _context.AutomationDispatches.Add(new AutomationDispatch
            {
                AutomationTaskId = task.Id,
                OrganisationId = organisationId,
                UserId = recipient.UserId,
                RecipientEmail = recipient.Email,
                SubjectSnapshot = task.EmailSubject,
                BodySnapshot = task.EmailBodyHtml,
                ScheduledForUtc = scheduledForUtc,
                Status = "Pending",
                Attempts = 0,
                IdempotencyKey = idempotencyKey,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            });
        }
    }

    [HttpPost("tasks/{id:long}/pause")]
    public async Task<IActionResult> PauseTask(long id)
    {
        var access = await GetAccessContextAsync();
        if (access.ErrorResult != null) return access.ErrorResult;

        var task = await _context.AutomationTasks
            .FirstOrDefaultAsync(t => t.Id == id && t.OrganisationId == access.OrganisationId);

        if (task == null) return NotFound(new { message = "Automation task not found" });
        if (task.Status != "Published") return BadRequest(new { message = "Only published tasks can be paused" });

        task.Status = "Paused";
        task.UpdatedAtUtc = DateTime.UtcNow;
        task.UpdatedByUserId = access.UserId;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Automation task paused" });
    }

    [HttpPost("tasks/{id:long}/resume")]
    public async Task<IActionResult> ResumeTask(long id)
    {
        var access = await GetAccessContextAsync();
        if (access.ErrorResult != null) return access.ErrorResult;

        var task = await _context.AutomationTasks
            .FirstOrDefaultAsync(t => t.Id == id && t.OrganisationId == access.OrganisationId);

        if (task == null) return NotFound(new { message = "Automation task not found" });
        if (task.Status != "Paused") return BadRequest(new { message = "Only paused tasks can be resumed" });

        var publishValidationError = ValidatePublish(task);
        if (publishValidationError != null)
        {
            return BadRequest(new { message = publishValidationError });
        }

        task.Status = "Published";
        task.UpdatedAtUtc = DateTime.UtcNow;
        task.UpdatedByUserId = access.UserId;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Automation task resumed" });
    }

    [HttpPost("tasks/{id:long}/archive")]
    public async Task<IActionResult> ArchiveTask(long id)
    {
        var access = await GetAccessContextAsync();
        if (access.ErrorResult != null) return access.ErrorResult;

        var task = await _context.AutomationTasks
            .FirstOrDefaultAsync(t => t.Id == id && t.OrganisationId == access.OrganisationId);

        if (task == null) return NotFound(new { message = "Automation task not found" });

        task.Status = "Archived";
        task.UpdatedAtUtc = DateTime.UtcNow;
        task.UpdatedByUserId = access.UserId;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Automation task archived" });
    }

    [HttpGet("lookups/learning-pathways")]
    public async Task<IActionResult> LookupLearningPathways([FromQuery] string? search = null)
    {
        var access = await GetAccessContextAsync();
        if (access.ErrorResult != null) return access.ErrorResult;

        var query = _context.LearningPathways
            .AsNoTracking()
            .Where(lp => lp.OrganisationId == access.OrganisationId && lp.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(lp => lp.Title.ToLower().Contains(term));
        }

        var pathways = await query
            .OrderBy(lp => lp.Title)
            .Select(lp => new { id = lp.Id, name = lp.Title })
            .Take(200)
            .ToListAsync();

        var pathwayIds = pathways.Select(p => p.id).ToList();
        var pathwayCourses = await _context.PathwayCourses
            .AsNoTracking()
            .Where(pc => pathwayIds.Contains(pc.LearningPathwayId))
            .Select(pc => new { pc.LearningPathwayId, pc.CourseId })
            .ToListAsync();

        var courseMap = pathwayCourses
            .GroupBy(pc => pc.LearningPathwayId)
            .ToDictionary(g => g.Key, g => g.Select(item => item.CourseId).Distinct().ToList());

        var items = pathways
            .Select(pathway => new
            {
                pathway.id,
                pathway.name,
                courseIds = courseMap.TryGetValue(pathway.id, out var courseIds) ? courseIds : new List<string>()
            })
            .ToList();

        return Ok(items);
    }

    [HttpPost("audience-preview")]
    public async Task<IActionResult> PreviewAudience([FromBody] AudiencePreviewRequest request)
    {
        var access = await GetAccessContextAsync();
        if (access.ErrorResult != null) return access.ErrorResult;

        var audienceType = request.AudienceType ?? "AllUsers";
        var orgId = access.OrganisationId;

        if (audienceType == "AllUsers")
        {
            var count = await _context.Users
                .Where(u => u.OrganisationID == orgId && u.ActiveStatus != 0)
                .CountAsync();

            return Ok(new { audienceType, recipientCount = count });
        }

        if (audienceType == "LearningPathways")
        {
            var pathwayIds = request.LearningPathwayIds?.Where(id => !string.IsNullOrWhiteSpace(id)).Distinct().ToList() ?? new List<string>();
            if (!pathwayIds.Any())
            {
                return BadRequest(new { message = "Select at least one learning pathway" });
            }

            var validPathways = await _context.LearningPathways
                .Where(lp => lp.OrganisationId == orgId && pathwayIds.Contains(lp.Id))
                .Select(lp => lp.Id)
                .ToListAsync();

            if (validPathways.Count != pathwayIds.Count)
            {
                return BadRequest(new { message = "One or more selected learning pathways are invalid for this organization" });
            }

            var userIds = await _context.LearnerPathwayProgresses
                .Where(lp => validPathways.Contains(lp.LearningPathwayId))
                .Select(lp => lp.UserId)
                .Distinct()
                .ToListAsync();

            var count = await _context.Users
                .Where(u => u.OrganisationID == orgId && userIds.Contains(u.Id) && u.ActiveStatus != 0)
                .CountAsync();

            return Ok(new { audienceType, recipientCount = count });
        }

        return BadRequest(new { message = "Unsupported audience type" });
    }

    private async Task<(IActionResult? ErrorResult, string UserId, long OrganisationId, Organisation? Organization)> GetAccessContextAsync()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return (Unauthorized(new { message = "User not authenticated" }), string.Empty, 0, null);
        }

        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null || !user.OrganisationID.HasValue)
        {
            return (Unauthorized(new { message = "OrgAdmin user organization not found" }), string.Empty, 0, null);
        }

        var organization = await _context.Organisations
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == user.OrganisationID.Value);

        return (null, userId, user.OrganisationID.Value, organization);
    }

    private async Task<string?> ValidateRequestAsync(SaveAutomationTaskRequest request, long organisationId, bool allowDraft)
    {
        if (request == null) return "Request is required";

        if (string.IsNullOrWhiteSpace(request.Type)) return "Type is required";
        if (string.IsNullOrWhiteSpace(request.Title)) return "Title is required";
        if (string.IsNullOrWhiteSpace(request.EmailSubject)) return "Email subject is required";
        if (string.IsNullOrWhiteSpace(request.EmailBodyHtml)) return "Email text is required";

        if (!new[] { "Notification", "Reminder", "Announcement" }.Contains(request.Type))
        {
            return "Invalid automation type";
        }

        if (request.Type == "Notification")
        {
            if (string.IsNullOrWhiteSpace(request.EventKey) || !NotificationEvents.Contains(request.EventKey))
            {
                return "Notification event must be LearningPathwayAssignment or LearningPathwayCompletion";
            }

            if (request.ScheduleMode != "Immediate" && request.ScheduleMode != "StandardNotification" && request.ScheduleMode != "Delayed")
            {
                return "Notification schedule mode must be Immediate or StandardNotification";
            }

            if (request.ScheduleMode == "Delayed" && (!request.IntervalMinutes.HasValue || request.IntervalMinutes <= 0))
            {
                return "Notification delayed schedule requires interval minutes";
            }

            if (request.CourseIds == null || !request.CourseIds.Any())
            {
                return "Select at least one course for notification";
            }

            var validCourseCount = await _context.Courses
                .CountAsync(c => c.OrganisationId == organisationId && !c.IsDeleted && request.CourseIds.Contains(c.Id));

            if (validCourseCount != request.CourseIds.Count)
            {
                return "One or more selected courses are invalid for this organization";
            }
        }

        if (request.Type == "Reminder")
        {
            if (string.IsNullOrWhiteSpace(request.EventKey) || !ReminderEvents.Contains(request.EventKey))
            {
                return "Reminder event must be NotStarted, InProgress, or NotCompleted";
            }

            if (!request.DaysAfterAssignment.HasValue || request.DaysAfterAssignment <= 0)
            {
                return "Reminder requires number of days after assignment";
            }

            if (request.CourseIds == null || !request.CourseIds.Any())
            {
                return "Select at least one course for reminder";
            }

            var validCourseCount = await _context.Courses
                .CountAsync(c => c.OrganisationId == organisationId && !c.IsDeleted && request.CourseIds.Contains(c.Id));

            if (validCourseCount != request.CourseIds.Count)
            {
                return "One or more selected courses are invalid for this organization";
            }
        }

        if (request.Type == "Announcement")
        {
            var audienceType = request.AudienceType ?? "AllUsers";
            if (audienceType != "AllUsers" && audienceType != "LearningPathways")
            {
                return "Announcement audience must be AllUsers or LearningPathways";
            }

            if (audienceType == "LearningPathways")
            {
                if (request.LearningPathwayIds == null || !request.LearningPathwayIds.Any())
                {
                    return "Select at least one learning pathway";
                }

                var validPathwayCount = await _context.LearningPathways
                    .CountAsync(lp => lp.OrganisationId == organisationId && request.LearningPathwayIds.Contains(lp.Id));

                if (validPathwayCount != request.LearningPathwayIds.Count)
                {
                    return "One or more selected learning pathways are invalid for this organization";
                }
            }

            if (!request.AnnouncementSendAtLocal.HasValue)
            {
                return "Announcement date and time is required";
            }

            if (string.IsNullOrWhiteSpace(request.TimeZoneId))
            {
                return "Time zone is required for announcement scheduling";
            }
        }

        _ = allowDraft;
        return null;
    }

    private static string? ValidatePublish(AutomationTask task)
    {
        if (string.IsNullOrWhiteSpace(task.Title)) return "Title is required before publishing";
        if (string.IsNullOrWhiteSpace(task.EmailSubject)) return "Email subject is required before publishing";
        if (string.IsNullOrWhiteSpace(task.EmailBodyHtml)) return "Email text is required before publishing";

        if (task.Type == "Announcement")
        {
            if (!task.AnnouncementSendAtLocal.HasValue)
            {
                return "Announcement date and time is required before publishing";
            }

            if (task.AudienceType == "LearningPathways" && !ParseArray(task.AudienceFilterJson).Any())
            {
                return "Announcement targeting requires at least one learning pathway";
            }
        }

        return null;
    }

    private static DateTime? ConvertLocalToUtc(DateTime? localDateTime, string? timeZoneId)
    {
        if (!localDateTime.HasValue) return null;

        var localUnspecified = DateTime.SpecifyKind(localDateTime.Value, DateTimeKind.Unspecified);
        try
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(string.IsNullOrWhiteSpace(timeZoneId) ? "UTC" : timeZoneId);
            return TimeZoneInfo.ConvertTimeToUtc(localUnspecified, tz);
        }
        catch
        {
            return DateTime.SpecifyKind(localDateTime.Value, DateTimeKind.Utc);
        }
    }

    private static string? SerializeArray(IEnumerable<string>? values)
    {
        var list = values?.Where(v => !string.IsNullOrWhiteSpace(v)).Distinct().ToList() ?? new List<string>();
        return list.Count == 0 ? null : JsonSerializer.Serialize(list);
    }

    private static List<string> ParseArray(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<string>();
        try
        {
            var values = JsonSerializer.Deserialize<List<string>>(json);
            return values?.Where(v => !string.IsNullOrWhiteSpace(v)).Distinct().ToList() ?? new List<string>();
        }
        catch
        {
            return new List<string>();
        }
    }
}

public class SaveAutomationTaskRequest
{
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? EventKey { get; set; }
    public List<string> CourseIds { get; set; } = new();
    public string EmailSubject { get; set; } = string.Empty;
    public string EmailBodyHtml { get; set; } = string.Empty;
    public string? ScheduleMode { get; set; }
    public int? IntervalMinutes { get; set; }
    public int? DaysAfterAssignment { get; set; }
    public string? AudienceType { get; set; }
    public List<string> LearningPathwayIds { get; set; } = new();
    public DateTime? AnnouncementSendAtLocal { get; set; }
    public string? TimeZoneId { get; set; }
}

public class AudiencePreviewRequest
{
    public string? AudienceType { get; set; }
    public List<string>? LearningPathwayIds { get; set; }
}
