using lmsbox.domain.Models;

namespace lmsBox.Server.Services;

public static class ContentBlobCollector
{
    public static IReadOnlyList<BlobLocator> FromLesson(Lesson lesson, string contentContainer)
    {
        var locators = new List<BlobLocator>();
        AddUrls(locators, lesson.VideoUrl, lesson.CaptionUrl, lesson.DocumentUrl, lesson.HtmlUrl);

        foreach (var url in AzureBlobPath.ExtractUrls(lesson.ScormUrl, lesson.ScormEntryUrl))
        {
            var parsed = AzureBlobPath.TryParse(url, contentContainer);
            if (parsed != null)
            {
                locators.Add(AzureBlobPath.PromoteScormPrefix(parsed));
            }
        }

        if (string.Equals(lesson.Type, "interactive", StringComparison.OrdinalIgnoreCase)
            || lesson.InteractiveLessonSettings?.Blocks.Count > 0)
        {
            locators.Add(AzureBlobPath.InteractiveLessonPrefix(lesson.Id, contentContainer));
            if (lesson.InteractiveLessonSettings?.Blocks != null)
            {
                foreach (var block in lesson.InteractiveLessonSettings.Blocks)
                {
                    locators.AddRange(FromBlock(block, lesson.Id, contentContainer));
                }
            }
        }

        return AzureBlobPath.Distinct(locators);
    }

    public static IReadOnlyList<BlobLocator> FromBlock(InteractiveBlock block, long lessonId, string contentContainer)
    {
        var locators = new List<BlobLocator>
        {
            AzureBlobPath.InteractiveBlockPrefix(lessonId, block.Id, contentContainer)
        };

        AddUrls(
            locators,
            block.MediaAssetsJson,
            block.FormPayloadJson,
            block.GeneratedHtml,
            block.EditedHtml);

        return AzureBlobPath.Distinct(locators);
    }

    public static IReadOnlyList<BlobLocator> FromResource(CourseResource resource)
    {
        var locators = new List<BlobLocator>();
        AddUrls(locators, resource.VideoUrl, resource.DocumentUrl, resource.HtmlUrl, resource.ThumbnailUrl);
        return AzureBlobPath.Distinct(locators);
    }

    public static IReadOnlyList<BlobLocator> FromCourseSurface(Course course)
    {
        var locators = new List<BlobLocator>();
        AddUrls(locators, course.BannerUrl);
        return AzureBlobPath.Distinct(locators);
    }

    public static IReadOnlyList<BlobLocator> FromGlobalLibrary(GlobalLibraryContent content, string contentContainer)
    {
        var locators = new List<BlobLocator>();
        AddUrls(locators, content.ThumbnailUrl);

        foreach (var url in AzureBlobPath.ExtractUrls(content.AzureBlobPath))
        {
            var parsed = AzureBlobPath.TryParse(url, contentContainer);
            if (parsed == null)
            {
                continue;
            }

            locators.Add(
                string.Equals(content.ContentType, "scorm", StringComparison.OrdinalIgnoreCase)
                    ? AzureBlobPath.PromoteScormPrefix(parsed)
                    : parsed);
        }

        return AzureBlobPath.Distinct(locators);
    }

    public static IReadOnlyList<BlobLocator> FromOrganisation(Organisation organisation)
    {
        var locators = new List<BlobLocator>();
        AddUrls(locators, organisation.BannerUrl, organisation.FaviconUrl);
        return AzureBlobPath.Distinct(locators);
    }

    public static IReadOnlyList<BlobLocator> FromTenant(Tenant tenant)
    {
        var locators = new List<BlobLocator>();
        AddUrls(locators, tenant.BannerUrl, tenant.FaviconUrl, tenant.LoginHeroUrl);
        return AzureBlobPath.Distinct(locators);
    }

    public static IReadOnlyList<BlobLocator> FromUrls(params string?[] values)
    {
        var locators = new List<BlobLocator>();
        AddUrls(locators, values);
        return AzureBlobPath.Distinct(locators);
    }

    private static void AddUrls(List<BlobLocator> locators, params string?[] values)
    {
        foreach (var url in AzureBlobPath.ExtractUrls(values))
        {
            var parsed = AzureBlobPath.TryParse(url);
            if (parsed != null)
            {
                locators.Add(parsed);
            }
        }
    }
}
