using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/admin/automation")]
[Authorize(Roles = "OrgAdmin")]
public class AdminAutomationController : ControllerBase
{
    private static readonly Regex TemplateVariableRegex = new(@"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", RegexOptions.Compiled);

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

        var taskIds = items.Select(t => t.Id).ToList();
        var dispatchSummaryByTaskId = await _context.AutomationDispatches
            .AsNoTracking()
            .Where(d => taskIds.Contains(d.AutomationTaskId) && d.OrganisationId == access.OrganisationId)
            .GroupBy(d => d.AutomationTaskId)
            .Select(g => new
            {
                taskId = g.Key,
                pending = g.Count(d => d.Status == "Pending"),
                failed = g.Count(d => d.Status == "Failed"),
                sent = g.Count(d => d.Status == "Sent")
            })
            .ToDictionaryAsync(x => x.taskId);

        var itemsWithSummary = items.Select(t =>
        {
            var hasSummary = dispatchSummaryByTaskId.TryGetValue(t.Id, out var summary);
            return new
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
                t.announcementSendAtUtc,
                dispatchSummary = new
                {
                    pending = hasSummary ? summary!.pending : 0,
                    failed = hasSummary ? summary!.failed : 0,
                    sent = hasSummary ? summary!.sent : 0
                }
            };
        }).ToList();

        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
        return Ok(new
        {
            items = itemsWithSummary,
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
            IntervalMinutes = request.Type == "Notification" ? null : request.IntervalMinutes,
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
        task.IntervalMinutes = request.Type == "Notification" ? null : request.IntervalMinutes;
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
        var recipients = new List<(string UserId, string Email, string FirstName, string? LastName)>();

        if (task.AudienceType == "AllUsers")
        {
            recipients = await _context.Users
                .AsNoTracking()
                .Where(u => u.OrganisationID == organisationId && u.ActiveStatus != 0 && !string.IsNullOrWhiteSpace(u.Email))
                .Select(u => new ValueTuple<string, string, string, string?>(u.Id, u.Email!, u.FirstName, u.LastName))
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
                        (lp, u) => new ValueTuple<string, string, string, string?>(u.Id, u.Email!, u.FirstName, u.LastName))
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

            var variables = BuildTemplateVariables(
                recipient.FirstName,
                recipient.LastName,
                null,
                null,
                null);

            var idempotencyKey = $"task:{task.Id}:user:{recipient.UserId}:scheduled:{scheduledForUtc:yyyyMMddHHmmss}";
            _context.AutomationDispatches.Add(new AutomationDispatch
            {
                AutomationTaskId = task.Id,
                OrganisationId = organisationId,
                UserId = recipient.UserId,
                RecipientEmail = recipient.Email,
                SubjectSnapshot = RenderTemplate(task.EmailSubject, variables),
                BodySnapshot = RenderTemplate(task.EmailBodyHtml, variables),
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

        var cancellableDispatches = await _context.AutomationDispatches
            .Where(d => d.AutomationTaskId == id && (d.Status == "Pending" || d.Status == "Processing"))
            .ToListAsync();

        foreach (var dispatch in cancellableDispatches)
        {
            dispatch.Status = "Cancelled";
            dispatch.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = "Automation task archived", cancelledDispatches = cancellableDispatches.Count });
    }

    [HttpGet("tasks/{id:long}/dispatches")]
    public async Task<IActionResult> GetTaskDispatches(
        long id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null)
    {
        var access = await GetAccessContextAsync();
        if (access.ErrorResult != null) return access.ErrorResult;

        var taskExists = await _context.AutomationTasks
            .AsNoTracking()
            .AnyAsync(t => t.Id == id && t.OrganisationId == access.OrganisationId);

        if (!taskExists)
        {
            return NotFound(new { message = "Automation task not found" });
        }

        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var query = _context.AutomationDispatches
            .AsNoTracking()
            .Where(d => d.AutomationTaskId == id && d.OrganisationId == access.OrganisationId);

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(d => d.Status == status);
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(d => d.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(d => new
            {
                d.Id,
                d.UserId,
                d.RecipientEmail,
                d.Status,
                d.Attempts,
                d.LastError,
                d.ScheduledForUtc,
                d.SentAtUtc,
                d.CreatedAtUtc,
                d.UpdatedAtUtc
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

    [HttpPost("dispatches/{dispatchId:long}/retry")]
    public async Task<IActionResult> RetryDispatch(long dispatchId)
    {
        var access = await GetAccessContextAsync();
        if (access.ErrorResult != null) return access.ErrorResult;

        var dispatch = await _context.AutomationDispatches
            .Include(d => d.AutomationTask)
            .FirstOrDefaultAsync(d => d.Id == dispatchId && d.OrganisationId == access.OrganisationId);

        if (dispatch == null)
        {
            return NotFound(new { message = "Dispatch not found" });
        }

        if (dispatch.AutomationTask == null)
        {
            return BadRequest(new { message = "Dispatch task reference is missing" });
        }

        if (dispatch.AutomationTask.Status != "Published")
        {
            return BadRequest(new { message = "Only dispatches for published tasks can be retried" });
        }

        if (dispatch.Status != "Failed" && dispatch.Status != "Cancelled")
        {
            return BadRequest(new { message = "Only failed or cancelled dispatches can be retried" });
        }

        dispatch.Status = "Pending";
        dispatch.Attempts = 0;
        dispatch.LastError = null;
        dispatch.SentAtUtc = null;
        dispatch.ScheduledForUtc = DateTime.UtcNow;
        dispatch.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Dispatch queued for retry" });
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
            var recipientsQuery = _context.Users
                .AsNoTracking()
                .Where(u => u.OrganisationID == orgId && u.ActiveStatus != 0 && !string.IsNullOrWhiteSpace(u.Email));

            var count = await recipientsQuery.CountAsync();
            var recipientRows = await recipientsQuery
                .OrderBy(u => u.FirstName)
                .ThenBy(u => u.LastName)
                .Take(200)
                .Select(u => new
                {
                    userId = u.Id,
                    firstName = u.FirstName,
                    lastName = u.LastName,
                    email = u.Email
                })
                .ToListAsync();

            var recipients = recipientRows.Select(r => new
            {
                r.userId,
                name = string.Join(" ", new[] { r.firstName, r.lastName }.Where(v => !string.IsNullOrWhiteSpace(v))),
                r.email
            }).ToList();

            return Ok(new { audienceType, recipientCount = count, recipients });
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

            var recipientsQuery = _context.Users
                .AsNoTracking()
                .Where(u => u.OrganisationID == orgId && userIds.Contains(u.Id) && u.ActiveStatus != 0 && !string.IsNullOrWhiteSpace(u.Email));

            var count = await recipientsQuery.CountAsync();
            var recipientRows = await recipientsQuery
                .OrderBy(u => u.FirstName)
                .ThenBy(u => u.LastName)
                .Take(200)
                .Select(u => new
                {
                    userId = u.Id,
                    firstName = u.FirstName,
                    lastName = u.LastName,
                    email = u.Email
                })
                .ToListAsync();

            var recipients = recipientRows.Select(r => new
            {
                r.userId,
                name = string.Join(" ", new[] { r.firstName, r.lastName }.Where(v => !string.IsNullOrWhiteSpace(v))),
                r.email
            }).ToList();

            return Ok(new { audienceType, recipientCount = count, recipients });
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

            if (string.IsNullOrWhiteSpace(request.ScheduleMode))
            {
                return "Notification schedule mode is required";
            }

            if (request.ScheduleMode != "Immediate" && request.ScheduleMode != "StandardNotification")
            {
                return "Notification schedule mode must be Immediate or StandardNotification";
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

    private static Dictionary<string, string> BuildTemplateVariables(
        string firstName,
        string? lastName,
        DateTime? pathwayAssignmentDateUtc,
        string? pathwayName,
        string? pathwayStatus)
    {
        var fullName = string.Join(" ", new[] { firstName?.Trim(), lastName?.Trim() }
            .Where(v => !string.IsNullOrWhiteSpace(v)));
        var recipientName = string.IsNullOrWhiteSpace(fullName) ? "Learner" : fullName;

        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["recipient_name"] = recipientName
        };

        if (pathwayAssignmentDateUtc.HasValue)
        {
            var assignmentDate = pathwayAssignmentDateUtc.Value.ToString("yyyy-MM-dd");
            values["assignment_date"] = assignmentDate;
            values["pathway_assignment_date"] = assignmentDate;
        }

        if (!string.IsNullOrWhiteSpace(pathwayStatus))
        {
            values["pathway_status"] = pathwayStatus;
            values["current_pathway_status"] = pathwayStatus;
        }

        if (!string.IsNullOrWhiteSpace(pathwayName))
        {
            values["pathway_name"] = pathwayName;
        }

        return values;
    }

    private static string RenderTemplate(string? template, IReadOnlyDictionary<string, string> variables)
    {
        if (string.IsNullOrEmpty(template)) return string.Empty;

        return TemplateVariableRegex.Replace(template, match =>
        {
            var key = match.Groups[1].Value;
            return variables.TryGetValue(key, out var value) ? value : match.Value;
        });
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
