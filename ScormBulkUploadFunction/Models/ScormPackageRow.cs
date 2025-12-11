namespace ScormBulkUploadFunction.Models;

public class ScormPackageRow
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Tags { get; set; } = string.Empty;
    public string ThumbnailUrl { get; set; } = string.Empty;
    public string ContentFileUrl { get; set; } = string.Empty;
    public int RowNumber { get; set; }
    public string Status { get; set; } = "Pending";
    public string? ErrorMessage { get; set; }
}

public class BulkUploadResult
{
    public int TotalRows { get; set; }
    public int SuccessCount { get; set; }
    public int FailureCount { get; set; }
    public int SkippedCount { get; set; }
    public List<UploadResultDetail> Results { get; set; } = new();
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public TimeSpan Duration => EndTime - StartTime;
}

public class UploadResultDetail
{
    public int RowNumber { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? ErrorMessage { get; set; }
    public long? ContentId { get; set; }
    public string? LaunchUrl { get; set; }
    public long? FileSizeBytes { get; set; }
    public int? FileCount { get; set; }
}

public class ScormPackageInfo
{
    public string PackageName { get; set; } = string.Empty;
    public string LaunchUrl { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public string ManifestPath { get; set; } = string.Empty;
    public long TotalSize { get; set; }
    public int FileCount { get; set; }
}
