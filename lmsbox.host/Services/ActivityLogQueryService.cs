using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Services;

public class ActivityLogQueryService : IActivityLogQueryService
{
    private static readonly string[] AdminEngagementEventTypes =
    {
        EngagementTrackingService.EVENT_COURSE_CREATED,
        EngagementTrackingService.EVENT_LESSON_CREATED,
        EngagementTrackingService.EVENT_USER_ADDED,
        EngagementTrackingService.EVENT_VIDEO_UPLOAD,
        EngagementTrackingService.EVENT_PDF_UPLOAD,
        EngagementTrackingService.EVENT_SCORM_UPLOAD,
        EngagementTrackingService.EVENT_HTML_UPLOAD,
        EngagementTrackingService.EVENT_QUESTION_BANK_QUESTION_CREATED,
        EngagementTrackingService.EVENT_QUESTION_BANK_QUESTION_UPDATED,
        EngagementTrackingService.EVENT_QUESTION_BANK_QUESTION_DELETED,
        EngagementTrackingService.EVENT_QUESTION_BANK_QUESTION_ARCHIVED,
        EngagementTrackingService.EVENT_QUESTION_BANK_CATEGORY_CREATED,
        EngagementTrackingService.EVENT_QUESTION_BANK_CATEGORY_UPDATED,
        EngagementTrackingService.EVENT_QUESTION_BANK_CATEGORY_DELETED,
        EngagementTrackingService.EVENT_QUESTION_BANK_QUIZ_CREATED,
        EngagementTrackingService.EVENT_QUESTION_BANK_QUIZ_UPDATED,
        EngagementTrackingService.EVENT_QUESTION_BANK_QUIZ_DELETED,
        EngagementTrackingService.EVENT_QUIZ_CREATED,
        EngagementTrackingService.EVENT_QUIZ_UPDATED,
        EngagementTrackingService.EVENT_QUIZ_DELETED,
        EngagementTrackingService.EVENT_QUIZ_IMPORTED_FROM_BANK,
        EngagementTrackingService.EVENT_PREVIEW_CONTENT,
    };

    private readonly ApplicationDbContext _context;

    public ActivityLogQueryService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ActivityLogRecentResult> GetRecentAsync(
        int limit,
        long? organisationId,
        bool includeAuditLogs,
        CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 50);
        var includeAudit = includeAuditLogs;

        var auditKeys = includeAudit
            ? await _context.AuditLogs.AsNoTracking()
                .OrderByDescending(a => a.PerformedAt)
                .ThenByDescending(a => a.Id)
                .Take(limit)
                .Select(a => new ActivityKey("audit", a.Id, a.PerformedAt))
                .ToListAsync(cancellationToken)
            : new List<ActivityKey>();

        var engagementQuery = ApplyEngagementFilters(_context.UserEngagements.AsNoTracking(), new ActivityLogQueryFilter(), organisationId, _context);
        var engagementKeys = await engagementQuery
            .OrderByDescending(e => e.CreatedAt)
            .ThenByDescending(e => e.Id)
            .Take(limit)
            .Select(e => new ActivityKey("engagement", e.Id, e.CreatedAt))
            .ToListAsync(cancellationToken);

        var pageKeys = auditKeys
            .Concat(engagementKeys)
            .OrderByDescending(k => k.PerformedAt)
            .ThenByDescending(k => k.Id)
            .Take(limit)
            .ToList();

        var items = await LoadItemsAsync(pageKeys, cancellationToken);

        return new ActivityLogRecentResult
        {
            Items = items,
            Limit = limit
        };
    }

    public async Task<ActivityLogPageResult> ListAsync(
        ActivityLogQueryFilter filter,
        long? organisationId,
        bool includeAuditLogs,
        CancellationToken cancellationToken = default)
    {
        var page = filter.Page < 1 ? 1 : filter.Page;
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var includeAudit = includeAuditLogs && !IsLearnerOnly(filter.ActorType);

        var auditQuery = includeAudit ? ApplyAuditFilters(_context.AuditLogs.AsNoTracking(), filter) : null;
        var engagementQuery = ApplyEngagementFilters(_context.UserEngagements.AsNoTracking(), filter, organisationId, _context);

        if (IsAdminOnly(filter.ActorType))
        {
            engagementQuery = engagementQuery.Where(e => AdminEngagementEventTypes.Contains(e.EventType));
        }
        else if (IsLearnerOnly(filter.ActorType))
        {
            engagementQuery = engagementQuery.Where(e => !AdminEngagementEventTypes.Contains(e.EventType));
        }

        var auditCount = auditQuery != null ? await auditQuery.CountAsync(cancellationToken) : 0;
        var engagementCount = await engagementQuery.CountAsync(cancellationToken);
        var total = auditCount + engagementCount;

        var auditKeys = auditQuery != null
            ? await auditQuery
                .OrderByDescending(a => a.PerformedAt)
                .ThenByDescending(a => a.Id)
                .Select(a => new ActivityKey("audit", a.Id, a.PerformedAt))
                .ToListAsync(cancellationToken)
            : new List<ActivityKey>();

        var engagementFetch = page * pageSize;
        var engagementKeys = await engagementQuery
            .OrderByDescending(e => e.CreatedAt)
            .ThenByDescending(e => e.Id)
            .Take(engagementFetch)
            .Select(e => new ActivityKey("engagement", e.Id, e.CreatedAt))
            .ToListAsync(cancellationToken);

        var pageKeys = auditKeys
            .Concat(engagementKeys)
            .OrderByDescending(k => k.PerformedAt)
            .ThenByDescending(k => k.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var items = await LoadItemsAsync(pageKeys, cancellationToken);

        return new ActivityLogPageResult
        {
            Items = items,
            Total = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = total == 0 ? 1 : (int)Math.Ceiling(total / (double)pageSize)
        };
    }

    public async Task<ActivityLogSummaryResult> GetSummaryAsync(
        ActivityLogQueryFilter filter,
        long? organisationId,
        bool includeAuditLogs,
        CancellationToken cancellationToken = default)
    {
        var includeAudit = includeAuditLogs && !IsLearnerOnly(filter.ActorType);

        var auditQuery = includeAudit ? ApplyAuditFilters(_context.AuditLogs.AsNoTracking(), filter) : null;
        var engagementQuery = ApplyEngagementFilters(_context.UserEngagements.AsNoTracking(), filter, organisationId, _context);

        if (IsAdminOnly(filter.ActorType))
        {
            engagementQuery = engagementQuery.Where(e => AdminEngagementEventTypes.Contains(e.EventType));
        }
        else if (IsLearnerOnly(filter.ActorType))
        {
            engagementQuery = engagementQuery.Where(e => !AdminEngagementEventTypes.Contains(e.EventType));
        }

        var auditCount = auditQuery != null ? await auditQuery.CountAsync(cancellationToken) : 0;
        var engagementCount = await engagementQuery.CountAsync(cancellationToken);
        var total = auditCount + engagementCount;

        var since24h = DateTime.UtcNow.AddHours(-24);
        var auditLast24 = auditQuery != null
            ? await auditQuery.CountAsync(a => a.PerformedAt >= since24h, cancellationToken)
            : 0;
        var engagementLast24 = await engagementQuery.CountAsync(e => e.CreatedAt >= since24h, cancellationToken);

        var adminEngagementCount = await engagementQuery
            .CountAsync(e => AdminEngagementEventTypes.Contains(e.EventType), cancellationToken);
        var learnerEngagementCount = engagementCount - adminEngagementCount;

        var topActions = new Dictionary<string, int>();

        if (auditQuery != null)
        {
            var auditTop = await auditQuery
                .GroupBy(a => a.Action)
                .Select(g => new { Action = g.Key, Count = g.Count() })
                .OrderByDescending(x => x.Count)
                .Take(5)
                .ToListAsync(cancellationToken);

            foreach (var row in auditTop)
            {
                topActions[row.Action] = row.Count;
            }
        }

        var engagementTop = await engagementQuery
            .GroupBy(e => e.EventType)
            .Select(g => new { EventType = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .Take(5)
            .ToListAsync(cancellationToken);

        foreach (var row in engagementTop)
        {
            var label = row.EventType;
            topActions[label] = topActions.GetValueOrDefault(label) + row.Count;
        }

        var topActionsSorted = topActions
            .OrderByDescending(x => x.Value)
            .Take(8)
            .ToDictionary(x => x.Key, x => x.Value);

        return new ActivityLogSummaryResult
        {
            Total = total,
            Last24Hours = auditLast24 + engagementLast24,
            AdminCount = auditCount + adminEngagementCount,
            LearnerCount = learnerEngagementCount,
            TopActions = topActionsSorted
        };
    }

    public async Task<ActivityLogDetailDto?> GetByIdAsync(
        string compositeId,
        long? organisationId,
        bool includeAuditLogs,
        CancellationToken cancellationToken = default)
    {
        if (!TryParseCompositeId(compositeId, out var source, out var id))
        {
            return null;
        }

        if (source == "audit")
        {
            if (!includeAuditLogs)
            {
                return null;
            }

            var log = await _context.AuditLogs.AsNoTracking()
                .FirstOrDefaultAsync(l => l.Id == id, cancellationToken);

            return log == null ? null : MapAuditLog(log);
        }

        var engagement = await _context.UserEngagements.AsNoTracking()
            .Include(e => e.User)
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        if (engagement == null)
        {
            return null;
        }

        if (organisationId.HasValue && engagement.OrganisationId != organisationId.Value)
        {
            return null;
        }

        return await MapEngagementAsync(engagement, cancellationToken);
    }

    private async Task<List<ActivityLogListItemDto>> LoadItemsAsync(
        List<ActivityKey> keys,
        CancellationToken cancellationToken)
    {
        if (keys.Count == 0)
        {
            return new List<ActivityLogListItemDto>();
        }

        var auditIds = keys.Where(k => k.Source == "audit").Select(k => k.Id).ToList();
        var engagementIds = keys.Where(k => k.Source == "engagement").Select(k => k.Id).ToList();

        var auditLogs = auditIds.Count > 0
            ? await _context.AuditLogs.AsNoTracking()
                .Where(a => auditIds.Contains(a.Id))
                .ToDictionaryAsync(a => a.Id, cancellationToken)
            : new Dictionary<long, AuditLog>();

        var engagements = engagementIds.Count > 0
            ? await _context.UserEngagements.AsNoTracking()
                .Include(e => e.User)
                .Where(e => engagementIds.Contains(e.Id))
                .ToListAsync(cancellationToken)
            : new List<UserEngagement>();

        var engagementMap = engagements.ToDictionary(e => e.Id);
        var items = new List<ActivityLogListItemDto>();

        foreach (var key in keys)
        {
            if (key.Source == "audit" && auditLogs.TryGetValue(key.Id, out var audit))
            {
                items.Add(MapAuditLog(audit));
            }
            else if (key.Source == "engagement" && engagementMap.TryGetValue(key.Id, out var engagement))
            {
                items.Add(await MapEngagementAsync(engagement, cancellationToken));
            }
        }

        return items;
    }

    private async Task<ActivityLogDetailDto> MapEngagementAsync(
        UserEngagement engagement,
        CancellationToken cancellationToken)
    {
        var userName = engagement.User != null
            ? $"{engagement.User.FirstName} {engagement.User.LastName}".Trim()
            : "User";

        if (string.IsNullOrWhiteSpace(userName))
        {
            userName = engagement.User?.Email ?? engagement.UserId;
        }

        string? courseTitle = null;
        if (!string.IsNullOrEmpty(engagement.CourseId))
        {
            courseTitle = await _context.Courses.AsNoTracking()
                .Where(c => c.Id == engagement.CourseId)
                .Select(c => c.Title)
                .FirstOrDefaultAsync(cancellationToken);
        }

        string? lessonTitle = null;
        if (engagement.LessonId.HasValue)
        {
            lessonTitle = await _context.Lessons.AsNoTracking()
                .Where(l => l.Id == engagement.LessonId.Value)
                .Select(l => l.Title)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var details = ActivityLogFormatter.BuildEngagementDetails(engagement);
        var action = ActivityLogFormatter.FormatEngagementAction(engagement, userName, courseTitle, lessonTitle);

        return new ActivityLogDetailDto
        {
            Id = BuildCompositeId("engagement", engagement.Id),
            Source = "engagement",
            ActorType = ActivityLogFormatter.GetActorType("engagement", engagement.EventType),
            Action = action,
            PerformedBy = userName,
            PerformedAt = engagement.CreatedAt,
            Details = details,
            DetailsPreview = ActivityLogFormatter.TruncatePreview(details)
        };
    }

    private static ActivityLogDetailDto MapAuditLog(AuditLog log)
    {
        return new ActivityLogDetailDto
        {
            Id = BuildCompositeId("audit", log.Id),
            Source = "audit",
            ActorType = "admin",
            Action = log.Action,
            PerformedBy = log.PerformedBy,
            PerformedAt = log.PerformedAt,
            Details = log.Details,
            DetailsPreview = ActivityLogFormatter.TruncatePreview(log.Details)
        };
    }

    private static IQueryable<AuditLog> ApplyAuditFilters(IQueryable<AuditLog> query, ActivityLogQueryFilter filter)
    {
        if (filter.DateFrom.HasValue)
        {
            var from = NormalizeUtc(filter.DateFrom.Value);
            query = query.Where(l => l.PerformedAt >= from);
        }

        if (filter.DateTo.HasValue)
        {
            var to = NormalizeUtcEndOfDay(filter.DateTo.Value);
            query = query.Where(l => l.PerformedAt <= to);
        }

        if (!string.IsNullOrWhiteSpace(filter.ActionContains))
        {
            var actionFilter = filter.ActionContains.Trim();
            query = query.Where(l => l.Action.Contains(actionFilter));
        }

        if (!string.IsNullOrWhiteSpace(filter.PerformedBy))
        {
            var by = filter.PerformedBy.Trim();
            query = query.Where(l => l.PerformedBy.Contains(by));
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var term = filter.Search.Trim();
            query = query.Where(l =>
                l.Action.Contains(term) ||
                l.PerformedBy.Contains(term) ||
                (l.Details != null && l.Details.Contains(term)));
        }

        return query;
    }

    private static IQueryable<UserEngagement> ApplyEngagementFilters(
        IQueryable<UserEngagement> query,
        ActivityLogQueryFilter filter,
        long? organisationId,
        ApplicationDbContext context)
    {
        if (organisationId.HasValue)
        {
            query = query.Where(e => e.OrganisationId == organisationId.Value);
        }

        if (filter.DateFrom.HasValue)
        {
            var from = NormalizeUtc(filter.DateFrom.Value);
            query = query.Where(e => e.CreatedAt >= from);
        }

        if (filter.DateTo.HasValue)
        {
            var to = NormalizeUtcEndOfDay(filter.DateTo.Value);
            query = query.Where(e => e.CreatedAt <= to);
        }

        if (!string.IsNullOrWhiteSpace(filter.ActionContains))
        {
            var actionFilter = filter.ActionContains.Trim();
            query = query.Where(e => e.EventType.Contains(actionFilter));
        }

        if (!string.IsNullOrWhiteSpace(filter.PerformedBy))
        {
            var by = filter.PerformedBy.Trim();
            query = query.Where(e => context.Users.Any(u =>
                u.Id == e.UserId && (
                    (u.FirstName != null && u.FirstName.Contains(by)) ||
                    (u.LastName != null && u.LastName.Contains(by)) ||
                    (u.Email != null && u.Email.Contains(by)))));
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var term = filter.Search.Trim();
            query = query.Where(e =>
                e.EventType.Contains(term) ||
                (e.Metadata != null && e.Metadata.Contains(term)) ||
                context.Users.Any(u =>
                    u.Id == e.UserId && (
                        (u.FirstName != null && u.FirstName.Contains(term)) ||
                        (u.LastName != null && u.LastName.Contains(term)) ||
                        (u.Email != null && u.Email.Contains(term)))));
        }

        return query;
    }

    private static DateTime NormalizeUtc(DateTime value) =>
        value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
            : value.ToUniversalTime();

    private static DateTime NormalizeUtcEndOfDay(DateTime value)
    {
        var to = NormalizeUtc(value);
        return to.TimeOfDay == TimeSpan.Zero ? to.AddDays(1).AddTicks(-1) : to;
    }

    private static bool IsAdminOnly(string? actorType) =>
        string.Equals(actorType, "admin", StringComparison.OrdinalIgnoreCase);

    private static bool IsLearnerOnly(string? actorType) =>
        string.Equals(actorType, "learner", StringComparison.OrdinalIgnoreCase);

    private static string BuildCompositeId(string source, long id) => $"{source}-{id}";

    private static bool TryParseCompositeId(string compositeId, out string source, out long id)
    {
        source = string.Empty;
        id = 0;

        var dash = compositeId.IndexOf('-', StringComparison.Ordinal);
        if (dash <= 0 || dash >= compositeId.Length - 1)
        {
            return false;
        }

        source = compositeId[..dash];
        return long.TryParse(compositeId[(dash + 1)..], out id)
               && (source == "audit" || source == "engagement");
    }

    private sealed record ActivityKey(string Source, long Id, DateTime PerformedAt);
}
