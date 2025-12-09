namespace lmsBox.Server.Services;

public interface IStorageQuotaService
{
    /// <summary>
    /// Check if organization has enough quota for file upload
    /// </summary>
    Task<(bool HasQuota, string Message, long AvailableBytes)> CheckQuotaAsync(long organisationId, long fileSizeBytes, string storageType = "content");

    /// <summary>
    /// Track storage usage after upload
    /// </summary>
    Task TrackUploadAsync(long organisationId, long fileSizeBytes, string storageType = "content");

    /// <summary>
    /// Track storage usage after deletion
    /// </summary>
    Task TrackDeletionAsync(long organisationId, long fileSizeBytes, string storageType = "content");

    /// <summary>
    /// Calculate and update total storage usage for an organization
    /// </summary>
    Task<long> RecalculateStorageUsageAsync(long organisationId);

    /// <summary>
    /// Get storage usage details for an organization
    /// </summary>
    Task<StorageUsageInfo> GetStorageUsageAsync(long organisationId);
}

public class StorageUsageInfo
{
    public long AllocatedBytes { get; set; }
    public long UsedBytes { get; set; }
    public long BrandingUsedBytes { get; set; }
    public long ContentUsedBytes { get; set; }
    public long AvailableBytes { get; set; }
    public double UsagePercentage { get; set; }
    public string AllocatedFormatted { get; set; } = string.Empty;
    public string UsedFormatted { get; set; } = string.Empty;
    public string AvailableFormatted { get; set; } = string.Empty;
    public double AllocatedGB { get; set; }
    public double UsedGB { get; set; }
    public double AvailableGB { get; set; }
    public double BrandingUsedGB { get; set; }
    public double ContentUsedGB { get; set; }
}
