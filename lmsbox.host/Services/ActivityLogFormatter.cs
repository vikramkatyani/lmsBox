using System.Text.Json;
using lmsbox.domain.Models;

namespace lmsBox.Server.Services;

public static class ActivityLogFormatter
{
    private static readonly HashSet<string> AdminEngagementEvents = new(StringComparer.Ordinal)
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

    public static string FormatEngagementAction(
        UserEngagement engagement,
        string userName,
        string? courseTitle = null,
        string? lessonTitle = null)
    {
        return engagement.EventType switch
        {
            EngagementTrackingService.EVENT_LOGIN => FormatLoginAction(userName, engagement.Metadata),
            EngagementTrackingService.EVENT_COURSE_VIEW => $"{userName} viewed course '{courseTitle ?? "Unknown"}'",
            EngagementTrackingService.EVENT_LESSON_START => $"{userName} started lesson '{lessonTitle ?? "Unknown"}'",
            EngagementTrackingService.EVENT_LESSON_COMPLETE => $"{userName} completed lesson '{lessonTitle ?? "Unknown"}'",
            EngagementTrackingService.EVENT_QUIZ_ATTEMPT => $"{userName} attempted an assessment",
            EngagementTrackingService.EVENT_AI_QUERY => $"{userName} used AI Assistant",
            EngagementTrackingService.EVENT_PREVIEW_CONTENT => $"{userName} previewed content",
            EngagementTrackingService.EVENT_COURSE_CREATED => $"{userName} created course '{courseTitle ?? "New Course"}'",
            EngagementTrackingService.EVENT_LESSON_CREATED => $"{userName} created lesson '{lessonTitle ?? "New Lesson"}'",
            EngagementTrackingService.EVENT_USER_ADDED => $"{userName} added a new user",
            EngagementTrackingService.EVENT_VIDEO_UPLOAD => $"{userName} uploaded a video",
            EngagementTrackingService.EVENT_PDF_UPLOAD => $"{userName} uploaded a PDF",
            EngagementTrackingService.EVENT_SCORM_UPLOAD => $"{userName} uploaded SCORM content",
            EngagementTrackingService.EVENT_HTML_UPLOAD => $"{userName} uploaded HTML content",
            EngagementTrackingService.EVENT_QUESTION_BANK_QUESTION_CREATED => $"{userName} created a question bank question",
            EngagementTrackingService.EVENT_QUESTION_BANK_QUESTION_UPDATED => $"{userName} updated a question bank question",
            EngagementTrackingService.EVENT_QUESTION_BANK_QUESTION_DELETED => $"{userName} deleted a question bank question",
            EngagementTrackingService.EVENT_QUESTION_BANK_QUESTION_ARCHIVED => $"{userName} archived or unarchived a question bank question",
            EngagementTrackingService.EVENT_QUESTION_BANK_CATEGORY_CREATED => $"{userName} created a question bank category",
            EngagementTrackingService.EVENT_QUESTION_BANK_CATEGORY_UPDATED => $"{userName} updated a question bank category",
            EngagementTrackingService.EVENT_QUESTION_BANK_CATEGORY_DELETED => $"{userName} deleted a question bank category",
            EngagementTrackingService.EVENT_QUESTION_BANK_QUIZ_CREATED => $"{userName} created a question bank assessment",
            EngagementTrackingService.EVENT_QUESTION_BANK_QUIZ_UPDATED => $"{userName} updated a question bank assessment",
            EngagementTrackingService.EVENT_QUESTION_BANK_QUIZ_DELETED => $"{userName} deleted a question bank assessment",
            EngagementTrackingService.EVENT_QUIZ_CREATED => $"{userName} created an assessment",
            EngagementTrackingService.EVENT_QUIZ_UPDATED => $"{userName} updated an assessment",
            EngagementTrackingService.EVENT_QUIZ_DELETED => $"{userName} deleted an assessment",
            EngagementTrackingService.EVENT_QUIZ_IMPORTED_FROM_BANK => $"{userName} imported an assessment from the question bank",
            _ => $"{userName} — {engagement.EventType}"
        };
    }

    public static string GetActorType(string source, string? eventType = null)
    {
        if (source == "audit")
        {
            return "admin";
        }

        return eventType != null && AdminEngagementEvents.Contains(eventType) ? "admin" : "learner";
    }

    public static string BuildEngagementDetails(UserEngagement engagement)
    {
        var parts = new List<string> { $"Event: {engagement.EventType}" };

        if (!string.IsNullOrEmpty(engagement.CourseId))
        {
            parts.Add($"Course ID: {engagement.CourseId}");
        }

        if (engagement.LessonId.HasValue)
        {
            parts.Add($"Lesson ID: {engagement.LessonId}");
        }

        if (engagement.QuizId.HasValue)
        {
            parts.Add($"Assessment ID: {engagement.QuizId}");
        }

        if (engagement.DurationSeconds.HasValue)
        {
            parts.Add($"Duration: {engagement.DurationSeconds}s");
        }

        if (engagement.EventType == EngagementTrackingService.EVENT_LOGIN)
        {
            var loginMethodLabel = GetLoginMethodLabel(engagement.Metadata);
            if (!string.IsNullOrWhiteSpace(loginMethodLabel))
            {
                parts.Add($"Login method: {loginMethodLabel}");
            }
        }
        else if (!string.IsNullOrWhiteSpace(engagement.Metadata))
        {
            parts.Add($"Metadata: {engagement.Metadata}");
        }

        return string.Join("; ", parts);
    }

    private static string FormatLoginAction(string userName, string? metadata)
    {
        var loginMethodLabel = GetLoginMethodLabel(metadata);
        return loginMethodLabel != null
            ? $"{userName} logged in via {loginMethodLabel}"
            : $"{userName} logged in";
    }

    private static string? GetLoginMethodLabel(string? metadata)
    {
        if (string.IsNullOrWhiteSpace(metadata))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(metadata);
            if (!doc.RootElement.TryGetProperty("loginMethod", out var methodElement))
            {
                return null;
            }

            return methodElement.GetString() switch
            {
                EngagementTrackingService.LOGIN_METHOD_MAGIC_LINK => "magic link",
                EngagementTrackingService.LOGIN_METHOD_GOOGLE => "Google SSO",
                EngagementTrackingService.LOGIN_METHOD_MICROSOFT => "Microsoft SSO",
                EngagementTrackingService.LOGIN_METHOD_DEV => "dev login",
                EngagementTrackingService.LOGIN_METHOD_EXTERNAL => "external SSO",
                EngagementTrackingService.LOGIN_METHOD_ADMIN_LINK => "admin generated link",
                _ => methodElement.GetString()
            };
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static string? TruncatePreview(string? text, int maxLength = 200)
    {
        if (string.IsNullOrEmpty(text))
        {
            return text;
        }

        return text.Length > maxLength ? text[..maxLength] + "…" : text;
    }
}
