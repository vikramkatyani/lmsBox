using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Services;

public class StorageQuotaService : IStorageQuotaService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<StorageQuotaService> _logger;

    public StorageQuotaService(ApplicationDbContext context, ILogger<StorageQuotaService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<(bool HasQuota, string Message, long AvailableBytes)> CheckQuotaAsync(long organisationId, long fileSizeBytes, string storageType = "content")
    {
        var organisation = await _context.Organisations.FindAsync(organisationId);
        if (organisation == null)
        {
            return (false, "Organisation not found", 0);
        }

        var allocatedBytes = organisation.AllocatedStorageGB * 1024L * 1024L * 1024L; // Convert GB to bytes

        // Treat zero/undefined allocation as unlimited to avoid blocking small uploads in dev/seeded orgs
        if (allocatedBytes <= 0)
        {
            _logger.LogInformation("Storage quota bypassed for Org {OrgId}: allocation not configured (AllocatedStorageGB={AllocatedGB})", organisationId, organisation.AllocatedStorageGB);
            return (true, "No storage limit configured", long.MaxValue);
        }

        var currentUsage = organisation.StorageUsedBytes;
        var availableBytes = allocatedBytes - currentUsage;

        if (fileSizeBytes > availableBytes)
        {
            var usedGB = Math.Round(currentUsage / (1024.0 * 1024.0 * 1024.0), 2);
            var requiredGB = Math.Round(fileSizeBytes / (1024.0 * 1024.0 * 1024.0), 2);
            var availableGB = Math.Round(availableBytes / (1024.0 * 1024.0 * 1024.0), 2);

            return (false, 
                $"Storage quota exceeded. Used: {usedGB} GB / {organisation.AllocatedStorageGB} GB. " +
                $"Required: {requiredGB} GB, Available: {availableGB} GB. Please contact support to increase your quota.",
                availableBytes);
        }

        return (true, "Quota available", availableBytes);
    }

    public async Task TrackUploadAsync(long organisationId, long fileSizeBytes, string storageType = "content")
    {
        var organisation = await _context.Organisations.FindAsync(organisationId);
        if (organisation == null)
        {
            _logger.LogWarning("Organisation {OrgId} not found for storage tracking", organisationId);
            return;
        }

        organisation.StorageUsedBytes += fileSizeBytes;
        
        if (storageType.ToLower() == "branding")
        {
            organisation.BrandingStorageUsedBytes += fileSizeBytes;
        }
        else
        {
            organisation.ContentStorageUsedBytes += fileSizeBytes;
        }

        organisation.StorageLastCalculated = DateTime.UtcNow;
        organisation.UpdatedOn = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Storage tracked for Organisation {OrgId}: +{FileSize} bytes ({Type}). Total: {TotalUsed} bytes",
            organisationId, fileSizeBytes, storageType, organisation.StorageUsedBytes);
    }

    public async Task TrackDeletionAsync(long organisationId, long fileSizeBytes, string storageType = "content")
    {
        var organisation = await _context.Organisations.FindAsync(organisationId);
        if (organisation == null)
        {
            _logger.LogWarning("Organisation {OrgId} not found for storage tracking", organisationId);
            return;
        }

        organisation.StorageUsedBytes = Math.Max(0, organisation.StorageUsedBytes - fileSizeBytes);
        
        if (storageType.ToLower() == "branding")
        {
            organisation.BrandingStorageUsedBytes = Math.Max(0, organisation.BrandingStorageUsedBytes - fileSizeBytes);
        }
        else
        {
            organisation.ContentStorageUsedBytes = Math.Max(0, organisation.ContentStorageUsedBytes - fileSizeBytes);
        }

        organisation.StorageLastCalculated = DateTime.UtcNow;
        organisation.UpdatedOn = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Storage deletion tracked for Organisation {OrgId}: -{FileSize} bytes ({Type}). Total: {TotalUsed} bytes",
            organisationId, fileSizeBytes, storageType, organisation.StorageUsedBytes);
    }

    public async Task<long> RecalculateStorageUsageAsync(long organisationId)
    {
        // This would require accessing Azure Blob Storage to calculate actual usage
        // For now, we'll rely on tracked usage
        // TODO: Implement Azure Blob Storage size calculation
        var organisation = await _context.Organisations.FindAsync(organisationId);
        if (organisation == null)
        {
            return 0;
        }

        organisation.StorageLastCalculated = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return organisation.StorageUsedBytes;
    }

    public async Task<StorageUsageInfo> GetStorageUsageAsync(long organisationId)
    {
        var organisation = await _context.Organisations.FindAsync(organisationId);
        if (organisation == null)
        {
            return new StorageUsageInfo();
        }

        var allocatedBytes = organisation.AllocatedStorageGB * 1024L * 1024L * 1024L;
        var usedBytes = organisation.StorageUsedBytes;
        var availableBytes = Math.Max(0, allocatedBytes - usedBytes);
        var usagePercentage = allocatedBytes > 0 ? (usedBytes * 100.0 / allocatedBytes) : 0;

        return new StorageUsageInfo
        {
            AllocatedBytes = allocatedBytes,
            UsedBytes = usedBytes,
            BrandingUsedBytes = organisation.BrandingStorageUsedBytes,
            ContentUsedBytes = organisation.ContentStorageUsedBytes,
            AvailableBytes = availableBytes,
            UsagePercentage = Math.Round(usagePercentage, 2),
            AllocatedFormatted = FormatBytes(allocatedBytes),
            UsedFormatted = FormatBytes(usedBytes),
            AvailableFormatted = FormatBytes(availableBytes),
            AllocatedGB = Math.Round((double)organisation.AllocatedStorageGB, 2),
            UsedGB = Math.Round(usedBytes / (1024.0 * 1024.0 * 1024.0), 2),
            AvailableGB = Math.Round(availableBytes / (1024.0 * 1024.0 * 1024.0), 2),
            BrandingUsedGB = Math.Round(organisation.BrandingStorageUsedBytes / (1024.0 * 1024.0 * 1024.0), 2),
            ContentUsedGB = Math.Round(organisation.ContentStorageUsedBytes / (1024.0 * 1024.0 * 1024.0), 2)
        };
    }

    private static string FormatBytes(long bytes)
    {
        string[] sizes = { "B", "KB", "MB", "GB", "TB" };
        double len = bytes;
        int order = 0;
        while (len >= 1024 && order < sizes.Length - 1)
        {
            order++;
            len = len / 1024;
        }
        return $"{len:0.##} {sizes[order]}";
    }
}
