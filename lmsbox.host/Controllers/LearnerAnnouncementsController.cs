using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/learner/announcements")]
[Authorize]
public class LearnerAnnouncementsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<LearnerAnnouncementsController> _logger;

    public LearnerAnnouncementsController(
        ApplicationDbContext context,
        ILogger<LearnerAnnouncementsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult> ListAnnouncements(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized(new { message = "User not authenticated" });
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var nowUtc = DateTime.UtcNow;

        var eligible = await ResolveEligibleAnnouncements(userId, nowUtc);
        var total = eligible.Count;

        if (total == 0)
        {
            return Ok(new { items = Array.Empty<object>(), total = 0, unreadCount = 0, page, pageSize });
        }

        var taskIds = eligible.Select(x => x.Id).ToList();
        var readSet = await _context.AnnouncementReadReceipts
            .AsNoTracking()
            .Where(r => r.UserId == userId && taskIds.Contains(r.AutomationTaskId))
            .Select(r => r.AutomationTaskId)
            .ToHashSetAsync();

        var unreadCount = eligible.Count(x => !readSet.Contains(x.Id));

        var paged = eligible
            .OrderByDescending(x => x.AnnouncementSendAtUtc ?? x.CreatedAtUtc)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                id = x.Id,
                title = x.EmailSubject,
                bodyHtml = x.EmailBodyHtml,
                scheduledForUtc = x.AnnouncementSendAtUtc,
                isRead = readSet.Contains(x.Id),
                readAtUtc = (DateTime?)null
            })
            .ToList();

        return Ok(new { items = paged, total, unreadCount, page, pageSize });
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult> GetUnreadCount()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized(new { message = "User not authenticated" });
        }

        var nowUtc = DateTime.UtcNow;

        var eligible = await ResolveEligibleAnnouncements(userId, nowUtc);
        if (eligible.Count == 0) return Ok(new { unreadCount = 0 });

        var taskIds = eligible.Select(x => x.Id).ToList();
        var readCount = await _context.AnnouncementReadReceipts
            .AsNoTracking()
            .Where(r => r.UserId == userId && taskIds.Contains(r.AutomationTaskId))
            .CountAsync();

        var unreadCount = Math.Max(0, eligible.Count - readCount);
        return Ok(new { unreadCount });
    }

    [HttpPost("{id:long}/read")]
    public async Task<ActionResult> MarkAsRead(long id)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized(new { message = "User not authenticated" });
        }

        var nowUtc = DateTime.UtcNow;
        var eligible = await ResolveEligibleAnnouncements(userId, nowUtc);
        if (!eligible.Any(t => t.Id == id))
        {
            return NotFound(new { message = "Announcement not found" });
        }

        var existing = await _context.AnnouncementReadReceipts
            .FirstOrDefaultAsync(r => r.UserId == userId && r.AutomationTaskId == id);

        if (existing == null)
        {
            _context.AnnouncementReadReceipts.Add(new lmsbox.domain.Models.AnnouncementReadReceipt
            {
                AutomationTaskId = id,
                UserId = userId,
                ReadAtUtc = nowUtc,
                CreatedAtUtc = nowUtc
            });
            await _context.SaveChangesAsync();
        }

        return Ok(new { id, isRead = true, readAtUtc = nowUtc });
    }

    private async Task<List<dynamic>> ResolveEligibleAnnouncements(string userId, DateTime nowUtc)
    {
        var user = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.OrganisationID, u.ActiveStatus })
            .FirstOrDefaultAsync();

        if (user == null || user.ActiveStatus == 0)
        {
            return new List<dynamic>();
        }

        var orgId = user.OrganisationID;
        if (orgId == null)
        {
            return new List<dynamic>();
        }

        var candidate = await _context.AutomationTasks
            .AsNoTracking()
            .Where(t =>
                t.Type == "Announcement" &&
                t.Status == "Published" &&
                t.AnnouncementSendAtUtc != null &&
                t.AnnouncementSendAtUtc <= nowUtc &&
                t.OrganisationId == orgId.Value)
            .Select(t => new
            {
                t.Id,
                t.OrganisationId,
                t.AudienceType,
                t.AudienceFilterJson,
                t.EmailSubject,
                t.EmailBodyHtml,
                t.AnnouncementSendAtUtc,
                t.CreatedAtUtc
            })
            .ToListAsync();

        if (!candidate.Any()) return new List<dynamic>();

        var result = new List<dynamic>();
        foreach (var t in candidate)
        {
            if (t.AudienceType == "AllUsers")
            {
                result.Add(t);
                continue;
            }

            if (t.AudienceType == "LearningPathways")
            {
                var ids = ParseStringArray(t.AudienceFilterJson);
                if (ids.Count == 0) continue;

                var hasPathway = await _context.LearnerPathwayProgresses
                    .AsNoTracking()
                    .AnyAsync(lp => lp.UserId == userId && ids.Contains(lp.LearningPathwayId));

                if (hasPathway) result.Add(t);
            }
        }

        return result;
    }

    private static HashSet<string> ParseStringArray(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new HashSet<string>();
        try
        {
            var strings = JsonSerializer.Deserialize<List<string>>(json);
            if (strings != null)
            {
                return strings
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .Select(s => s.Trim())
                    .ToHashSet();
            }
        }
        catch
        {
            // fall through
        }

        try
        {
            var numbers = JsonSerializer.Deserialize<List<long>>(json);
            if (numbers != null) return numbers.Select(n => n.ToString()).ToHashSet();
        }
        catch
        {
            // ignore
        }

        return new HashSet<string>();
    }
}
