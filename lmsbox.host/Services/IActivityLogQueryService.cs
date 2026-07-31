namespace lmsBox.Server.Services;

public interface IActivityLogQueryService
{
    Task<ActivityLogRecentResult> GetRecentAsync(int limit, long? organisationId, bool includeAuditLogs, CancellationToken cancellationToken = default);

    Task<ActivityLogPageResult> ListAsync(
        ActivityLogQueryFilter filter,
        long? organisationId,
        bool includeAuditLogs,
        CancellationToken cancellationToken = default);

    Task<ActivityLogSummaryResult> GetSummaryAsync(
        ActivityLogQueryFilter filter,
        long? organisationId,
        bool includeAuditLogs,
        CancellationToken cancellationToken = default);

    Task<ActivityLogDetailDto?> GetByIdAsync(string compositeId, long? organisationId, bool includeAuditLogs, CancellationToken cancellationToken = default);
}

public class ActivityLogQueryFilter
{
    public string? Search { get; set; }
    public DateTime? DateFrom { get; set; }
    public DateTime? DateTo { get; set; }
    public string? ActionContains { get; set; }
    public string? PerformedBy { get; set; }
    public string? ActorType { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
}

public class ActivityLogListItemDto
{
    public string Id { get; set; } = null!;
    public string Source { get; set; } = null!;
    public string ActorType { get; set; } = null!;
    public string Action { get; set; } = null!;
    public string PerformedBy { get; set; } = string.Empty;
    public DateTime PerformedAt { get; set; }
    public string? DetailsPreview { get; set; }
}

public class ActivityLogDetailDto : ActivityLogListItemDto
{
    public string? Details { get; set; }
}

public class ActivityLogRecentResult
{
    public List<ActivityLogListItemDto> Items { get; set; } = new();
    public int Limit { get; set; }
}

public class ActivityLogPageResult
{
    public List<ActivityLogListItemDto> Items { get; set; } = new();
    public int Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}

public class ActivityLogSummaryResult
{
    public int Total { get; set; }
    public int Last24Hours { get; set; }
    public int AdminCount { get; set; }
    public int LearnerCount { get; set; }
    public Dictionary<string, int> TopActions { get; set; } = new();
}
