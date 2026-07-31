namespace lmsBox.Server.Models;

public class CustomReportRequest
{
    public string EntityType { get; set; } = "users"; // users, courses, pathways, progress
    public List<string> Metrics { get; set; } = new(); // Selected metrics to include
    public string? GroupBy { get; set; } // Field to group by
    public string? SortBy { get; set; } // Field to sort by
    public bool? SortDescending { get; set; } = true; // Sort direction
    public string? FilterBy { get; set; } // Field to filter by
    public object? FilterValue { get; set; } // Filter value
    public DateTime? StartDate { get; set; } // Date range start
    public DateTime? EndDate { get; set; } // Date range end
    public int? Limit { get; set; } = 100; // Max records to return
}
