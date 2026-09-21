using System.Text.RegularExpressions;

namespace lmsBox.Server.Services;

public sealed record BlobLocator(
    string Container,
    string BlobName,
    bool IsPrefix,
    string StorageType,
    string OriginalUrl)
{
    public string Key => $"{Container}|{BlobName}|{(IsPrefix ? "1" : "0")}";
}

public static class AzureBlobPath
{
    public const string BrandingContainer = "lms-content-brandui";
    public const string DefaultContentContainer = "lms-content";

    private static readonly Regex AzureBlobUrlRegex = new(
        @"https://[a-z0-9\-]+\.blob\.core\.windows\.net/[^\s""'<>\\]+",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static bool IsAzureBlobUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return false;
        }

        return url.Contains(".blob.core.windows.net/", StringComparison.OrdinalIgnoreCase);
    }

    public static IEnumerable<string> ExtractUrls(params string?[] values)
    {
        foreach (var value in values)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                continue;
            }

            if (IsAzureBlobUrl(value) && !value.TrimStart().StartsWith("{", StringComparison.Ordinal)
                && !value.Contains('<', StringComparison.Ordinal))
            {
                yield return StripSas(value.Trim());
                continue;
            }

            foreach (Match match in AzureBlobUrlRegex.Matches(value))
            {
                yield return StripSas(match.Value);
            }
        }
    }

    public static string StripSas(string url)
    {
        var query = url.IndexOf('?', StringComparison.Ordinal);
        return query >= 0 ? url[..query] : url;
    }

    public static BlobLocator? TryParse(string? url, string contentContainer, bool asPrefix = false, bool promoteScorm = true)
    {
        if (string.IsNullOrWhiteSpace(url) || !IsAzureBlobUrl(url))
        {
            return null;
        }

        if (!Uri.TryCreate(StripSas(url.Trim()), UriKind.Absolute, out var uri))
        {
            return null;
        }

        var segments = uri.AbsolutePath.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length < 2)
        {
            return null;
        }

        var container = Uri.UnescapeDataString(segments[0]);
        var blobName = string.Join("/", segments.Skip(1).Select(Uri.UnescapeDataString));
        if (string.IsNullOrWhiteSpace(blobName))
        {
            return null;
        }

        var storageType = string.Equals(container, BrandingContainer, StringComparison.OrdinalIgnoreCase)
            ? "branding"
            : "content";

        var locator = new BlobLocator(container, blobName, asPrefix, storageType, StripSas(url.Trim()));
        return asPrefix || !promoteScorm ? locator : PromoteScormPrefix(locator);
    }

    public static BlobLocator? TryParse(string? url, bool asPrefix = false)
        => TryParse(url, DefaultContentContainer, asPrefix);

    public static BlobLocator PromoteScormPrefix(BlobLocator locator)
    {
        if (locator.IsPrefix)
        {
            return locator;
        }

        const string marker = "/scorm/";
        var index = locator.BlobName.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (index < 0)
        {
            return locator;
        }

        var after = locator.BlobName[(index + marker.Length)..];
        var package = after.Split('/', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        if (string.IsNullOrWhiteSpace(package))
        {
            return locator;
        }

        var prefix = locator.BlobName[..(index + marker.Length + package.Length)];
        return locator with { BlobName = prefix, IsPrefix = true };
    }

    public static BlobLocator InteractiveBlockPrefix(long lessonId, long blockId, string contentContainer)
    {
        var blobName = $"interactive-lessons/{lessonId}/blocks/{blockId}";
        return new BlobLocator(
            contentContainer,
            blobName,
            true,
            "content",
            blobName);
    }

    public static BlobLocator InteractiveLessonPrefix(long lessonId, string contentContainer)
    {
        var blobName = $"interactive-lessons/{lessonId}";
        return new BlobLocator(
            contentContainer,
            blobName,
            true,
            "content",
            blobName);
    }

    public static bool Matches(BlobLocator target, string? storedUrl)
    {
        var stored = TryParse(storedUrl);
        if (stored == null)
        {
            if (string.IsNullOrWhiteSpace(storedUrl))
            {
                return false;
            }

            return storedUrl.Contains(target.BlobName, StringComparison.OrdinalIgnoreCase);
        }

        if (!string.Equals(stored.Container, target.Container, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (target.IsPrefix)
        {
            return stored.BlobName.Equals(target.BlobName, StringComparison.OrdinalIgnoreCase)
                || stored.BlobName.StartsWith(target.BlobName + "/", StringComparison.OrdinalIgnoreCase);
        }

        if (stored.IsPrefix)
        {
            return target.BlobName.Equals(stored.BlobName, StringComparison.OrdinalIgnoreCase)
                || target.BlobName.StartsWith(stored.BlobName + "/", StringComparison.OrdinalIgnoreCase);
        }

        return stored.BlobName.Equals(target.BlobName, StringComparison.OrdinalIgnoreCase);
    }

    public static IReadOnlyList<BlobLocator> Distinct(IEnumerable<BlobLocator> locators)
    {
        var map = new Dictionary<string, BlobLocator>(StringComparer.OrdinalIgnoreCase);
        foreach (var locator in locators)
        {
            map[locator.Key] = locator;
        }

        return map.Values.ToList();
    }
}
