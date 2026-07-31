namespace ScormBulkUploadFunction.Services;

public interface IAutomationDispatchService
{
    Task<AutomationDispatchCycleResult> ProcessPendingDispatchesAsync();
    Task<AutomationDispatchHealthSummary> GetHealthSummaryAsync();
}

public class AutomationDispatchCycleResult
{
    public int PickedCount { get; set; }
    public int SentCount { get; set; }
    public int FailedCount { get; set; }
}

public class AutomationDispatchHealthSummary
{
    public DateTime GeneratedAtUtc { get; set; }
    public int PendingCount { get; set; }
    public int DueNowCount { get; set; }
    public int ProcessingCount { get; set; }
    public int FailedCount { get; set; }
    public int SentLast24Hours { get; set; }
    public int FailedLast24Hours { get; set; }
    public DateTime? NextScheduledForUtc { get; set; }
    public List<AutomationDispatchTypeHealth> TypeBreakdown { get; set; } = new();
}

public class AutomationDispatchTypeHealth
{
    public string Type { get; set; } = string.Empty;
    public int PendingCount { get; set; }
    public int DueNowCount { get; set; }
    public int ProcessingCount { get; set; }
    public int FailedCount { get; set; }
    public int SentLast24Hours { get; set; }
}
