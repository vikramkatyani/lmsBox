using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Services;

public interface IContentBlobLifecycleService
{
    string ContentContainer { get; }

    Task RetainAsync(string ownerType, string ownerId, long? organisationId, IEnumerable<BlobLocator> locators);

    Task ReleaseAsync(
        IEnumerable<BlobLocator> locators,
        long? organisationId,
        BlobReferenceExclusion? exclusion = null);

    Task ReleaseReplacedAsync(
        IEnumerable<BlobLocator> previous,
        IEnumerable<BlobLocator> current,
        long? organisationId,
        BlobReferenceExclusion? exclusion = null);

    Task PurgeOwnerAsync(string ownerType, string ownerId, long? organisationId);
}

public sealed class BlobReferenceExclusion
{
    public long? LessonId { get; init; }
    public long? ResourceId { get; init; }
    public long? BlockId { get; init; }
    public string? CourseId { get; init; }
    public long? GlobalLibraryId { get; init; }
    public long? OrganisationId { get; init; }
    public long? TenantId { get; init; }
    public string? RetainedOwnerType { get; init; }
    public string? RetainedOwnerId { get; init; }
}

public static class ContentBlobOwners
{
    public const string Course = "course";
    public const string GlobalLibrary = "global-library";
}

public class ContentBlobLifecycleService : IContentBlobLifecycleService
{
    private readonly ApplicationDbContext _context;
    private readonly IAzureBlobService _blobService;
    private readonly IStorageQuotaService _storageQuotaService;
    private readonly ILogger<ContentBlobLifecycleService> _logger;
    private readonly string _contentContainer;

    public ContentBlobLifecycleService(
        ApplicationDbContext context,
        IAzureBlobService blobService,
        IStorageQuotaService storageQuotaService,
        IConfiguration configuration,
        ILogger<ContentBlobLifecycleService> logger)
    {
        _context = context;
        _blobService = blobService;
        _storageQuotaService = storageQuotaService;
        _logger = logger;
        _contentContainer = configuration["AzureStorage:ContainerName"] ?? AzureBlobPath.DefaultContentContainer;
    }

    public string ContentContainer => _contentContainer;

    public async Task RetainAsync(
        string ownerType,
        string ownerId,
        long? organisationId,
        IEnumerable<BlobLocator> locators)
    {
        var distinct = AzureBlobPath.Distinct(locators);
        if (distinct.Count == 0)
        {
            return;
        }

        var existing = await _context.RetainedContentBlobs
            .Where(b => b.OwnerType == ownerType && b.OwnerId == ownerId)
            .Select(b => b.Container + "|" + b.BlobName + "|" + (b.IsPrefix ? "1" : "0"))
            .ToListAsync();
        var existingKeys = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);

        foreach (var locator in distinct)
        {
            if (!existingKeys.Add(locator.Key))
            {
                continue;
            }

            _context.RetainedContentBlobs.Add(new RetainedContentBlob
            {
                OwnerType = ownerType,
                OwnerId = ownerId,
                OrganisationId = organisationId,
                BlobUrl = locator.OriginalUrl,
                Container = locator.Container,
                BlobName = locator.BlobName,
                IsPrefix = locator.IsPrefix,
                StorageType = locator.StorageType,
                RetainedAt = DateTime.UtcNow
            });
        }
    }

    public async Task ReleaseAsync(
        IEnumerable<BlobLocator> locators,
        long? organisationId,
        BlobReferenceExclusion? exclusion = null)
    {
        if (!_blobService.IsConfigured())
        {
            return;
        }

        foreach (var locator in AzureBlobPath.Distinct(locators))
        {
            try
            {
                if (await IsReferencedAsync(locator, exclusion))
                {
                    _logger.LogInformation(
                        "Keeping shared blob {Container}/{BlobName} because it is still referenced",
                        locator.Container, locator.BlobName);
                    continue;
                }

                var result = locator.IsPrefix
                    ? await _blobService.DeletePrefixAsync(locator.Container, locator.BlobName)
                    : await _blobService.DeleteBlobAsync(BuildUrl(locator));

                if (result.BytesDeleted > 0 && organisationId.HasValue)
                {
                    await _storageQuotaService.TrackDeletionAsync(
                        organisationId.Value,
                        result.BytesDeleted,
                        locator.StorageType);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to release blob {Container}/{BlobName}",
                    locator.Container,
                    locator.BlobName);
            }
        }
    }

    public Task ReleaseReplacedAsync(
        IEnumerable<BlobLocator> previous,
        IEnumerable<BlobLocator> current,
        long? organisationId,
        BlobReferenceExclusion? exclusion = null)
    {
        var currentKeys = new HashSet<string>(
            AzureBlobPath.Distinct(current).Select(l => l.Key),
            StringComparer.OrdinalIgnoreCase);
        var removed = AzureBlobPath.Distinct(previous).Where(l => !currentKeys.Contains(l.Key));
        return ReleaseAsync(removed, organisationId, exclusion);
    }

    public async Task PurgeOwnerAsync(string ownerType, string ownerId, long? organisationId)
    {
        var rows = await _context.RetainedContentBlobs
            .Where(b => b.OwnerType == ownerType && b.OwnerId == ownerId)
            .ToListAsync();

        var locators = rows.Select(ToLocator).ToList();
        await ReleaseAsync(
            locators,
            organisationId,
            new BlobReferenceExclusion
            {
                RetainedOwnerType = ownerType,
                RetainedOwnerId = ownerId,
                CourseId = ownerType == ContentBlobOwners.Course ? ownerId : null,
                GlobalLibraryId = ownerType == ContentBlobOwners.GlobalLibrary && long.TryParse(ownerId, out var id)
                    ? id
                    : null
            });

        _context.RetainedContentBlobs.RemoveRange(rows);
        await _context.SaveChangesAsync();
    }

    private static BlobLocator ToLocator(RetainedContentBlob row)
        => new(row.Container, row.BlobName, row.IsPrefix, row.StorageType, row.BlobUrl);

    private string BuildUrl(BlobLocator locator)
    {
        if (AzureBlobPath.IsAzureBlobUrl(locator.OriginalUrl))
        {
            return locator.OriginalUrl;
        }

        return $"https://placeholder.blob.core.windows.net/{locator.Container}/{locator.BlobName}";
    }

    private async Task<bool> IsReferencedAsync(BlobLocator locator, BlobReferenceExclusion? exclusion)
    {
        var needle = locator.BlobName;
        if (string.IsNullOrWhiteSpace(needle))
        {
            return false;
        }

        var lessons = _context.Lessons.AsNoTracking().AsQueryable();
        if (exclusion?.LessonId.HasValue == true)
        {
            lessons = lessons.Where(l => l.Id != exclusion.LessonId);
        }

        if (await lessons.AnyAsync(l =>
                (l.VideoUrl != null && l.VideoUrl.Contains(needle))
                || (l.CaptionUrl != null && l.CaptionUrl.Contains(needle))
                || (l.DocumentUrl != null && l.DocumentUrl.Contains(needle))
                || (l.HtmlUrl != null && l.HtmlUrl.Contains(needle))
                || (l.ScormUrl != null && l.ScormUrl.Contains(needle))
                || (l.ScormEntryUrl != null && l.ScormEntryUrl.Contains(needle))))
        {
            return true;
        }

        var resources = _context.CourseResources.AsNoTracking().AsQueryable();
        if (exclusion?.ResourceId.HasValue == true)
        {
            resources = resources.Where(r => r.Id != exclusion.ResourceId);
        }

        if (await resources.AnyAsync(r =>
                (r.VideoUrl != null && r.VideoUrl.Contains(needle))
                || (r.DocumentUrl != null && r.DocumentUrl.Contains(needle))
                || (r.HtmlUrl != null && r.HtmlUrl.Contains(needle))
                || (r.ThumbnailUrl != null && r.ThumbnailUrl.Contains(needle))))
        {
            return true;
        }

        var courses = _context.Courses.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(exclusion?.CourseId))
        {
            courses = courses.Where(c => c.Id != exclusion.CourseId);
        }

        if (await courses.AnyAsync(c => c.BannerUrl != null && c.BannerUrl.Contains(needle)))
        {
            return true;
        }

        var library = _context.GlobalLibraryContents.AsNoTracking().AsQueryable();
        if (exclusion?.GlobalLibraryId.HasValue == true)
        {
            library = library.Where(c => c.Id != exclusion.GlobalLibraryId);
        }

        if (await library.AnyAsync(c =>
                (c.AzureBlobPath != null && c.AzureBlobPath.Contains(needle))
                || (c.ThumbnailUrl != null && c.ThumbnailUrl.Contains(needle))))
        {
            return true;
        }

        var organisations = _context.Organisations.AsNoTracking().AsQueryable();
        if (exclusion?.OrganisationId.HasValue == true)
        {
            organisations = organisations.Where(o => o.Id != exclusion.OrganisationId);
        }

        if (await organisations.AnyAsync(o =>
                (o.BannerUrl != null && o.BannerUrl.Contains(needle))
                || (o.FaviconUrl != null && o.FaviconUrl.Contains(needle))))
        {
            return true;
        }

        var tenants = _context.Tenants.AsNoTracking().AsQueryable();
        if (exclusion?.TenantId.HasValue == true)
        {
            tenants = tenants.Where(t => t.Id != exclusion.TenantId);
        }

        if (await tenants.AnyAsync(t =>
                (t.BannerUrl != null && t.BannerUrl.Contains(needle))
                || (t.FaviconUrl != null && t.FaviconUrl.Contains(needle))
                || (t.LoginHeroUrl != null && t.LoginHeroUrl.Contains(needle))))
        {
            return true;
        }

        var blocks = _context.InteractiveBlocks.AsNoTracking().AsQueryable();
        if (exclusion?.BlockId.HasValue == true)
        {
            blocks = blocks.Where(b => b.Id != exclusion.BlockId);
        }

        if (await blocks.AnyAsync(b =>
                (b.MediaAssetsJson != null && b.MediaAssetsJson.Contains(needle))
                || (b.FormPayloadJson != null && b.FormPayloadJson.Contains(needle))
                || (b.GeneratedHtml != null && b.GeneratedHtml.Contains(needle))
                || (b.EditedHtml != null && b.EditedHtml.Contains(needle))))
        {
            return true;
        }

        if (await _context.LearnerProgresses.AsNoTracking().AnyAsync(p =>
                p.CertificateUrl != null && p.CertificateUrl.Contains(needle)))
        {
            return true;
        }

        var retained = _context.RetainedContentBlobs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(exclusion?.RetainedOwnerType) && !string.IsNullOrEmpty(exclusion?.RetainedOwnerId))
        {
            retained = retained.Where(b =>
                b.OwnerType != exclusion.RetainedOwnerType || b.OwnerId != exclusion.RetainedOwnerId);
        }

        return await retained.AnyAsync(b =>
            b.Container == locator.Container
            && (b.BlobName == needle
                || (locator.IsPrefix && b.BlobName.StartsWith(needle))
                || (b.IsPrefix && needle.StartsWith(b.BlobName))));
    }
}
