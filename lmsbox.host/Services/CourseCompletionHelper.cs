using lmsbox.domain.Models;

namespace lmsBox.Server.Services;

/// <summary>
/// Shared rules for post-survey unlock and certificate / course completion.
/// Survey unlock: all lessons done; practical counts when status is passed or failed.
/// Certificate (courses with practical): survey completed (if linked) and practical passed.
/// </summary>
public static class CourseCompletionHelper
{
    public static bool IsExternalLesson(Lesson lesson) =>
        string.Equals(lesson.Type, "external", StringComparison.OrdinalIgnoreCase);

    public static bool IsPracticalOutcomeRecorded(string? status)
    {
        var normalized = status?.Trim().ToLowerInvariant();
        return normalized is "passed" or "failed";
    }

    public static bool IsPracticalPassed(string? status) =>
        string.Equals(status?.Trim(), "passed", StringComparison.OrdinalIgnoreCase);

    public static bool IsLessonSatisfiedForSurveyUnlock(Lesson lesson, LearnerProgress? progress)
    {
        if (IsExternalLesson(lesson))
        {
            return IsPracticalOutcomeRecorded(progress?.ScormLessonStatus) || progress?.Completed == true;
        }

        return progress?.Completed == true;
    }

    public static bool AreLessonsReadyForPostSurvey(
        IReadOnlyList<Lesson> lessons,
        IReadOnlyList<LearnerProgress> lessonProgresses)
    {
        if (lessons.Count == 0)
        {
            return true;
        }

        var progressByLessonId = BuildLatestProgressByLessonId(lessonProgresses);

        return lessons.All(lesson =>
            IsLessonSatisfiedForSurveyUnlock(lesson, progressByLessonId.GetValueOrDefault(lesson.Id)));
    }

    public static bool IsCourseCertificateEligible(
        Course course,
        IReadOnlyList<Lesson> lessons,
        IReadOnlyList<LearnerProgress> lessonProgresses,
        LearnerProgress? courseProgress)
    {
        if (lessons.Count == 0)
        {
            return courseProgress?.Completed == true;
        }

        var progressByLessonId = BuildLatestProgressByLessonId(lessonProgresses);
        var hasPractical = lessons.Any(IsExternalLesson);

        foreach (var lesson in lessons)
        {
            var progress = progressByLessonId.GetValueOrDefault(lesson.Id);

            if (IsExternalLesson(lesson))
            {
                // Failed practical never unlocks certificate.
                if (string.Equals(progress?.ScormLessonStatus?.Trim(), "failed", StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }

                if (!IsPracticalPassed(progress?.ScormLessonStatus) && progress?.Completed != true)
                {
                    return false;
                }
            }
            else if (progress?.Completed != true)
            {
                return false;
            }
        }

        if (hasPractical)
        {
            // Courses with a practical require the linked post-course survey before certificate.
            if (course.PostCourseSurveyId.HasValue && !(courseProgress?.PostSurveyCompleted ?? false))
            {
                return false;
            }

            return true;
        }

        var postSurveyRequired = course.IsPostSurveyMandatory && course.PostCourseSurveyId.HasValue;
        return !postSurveyRequired || (courseProgress?.PostSurveyCompleted ?? false);
    }

    private static Dictionary<long, LearnerProgress> BuildLatestProgressByLessonId(
        IReadOnlyList<LearnerProgress> lessonProgresses)
    {
        return lessonProgresses
            .Where(lp => lp.LessonId.HasValue)
            .GroupBy(lp => lp.LessonId!.Value)
            .ToDictionary(
                g => g.Key,
                g => g
                    .OrderByDescending(lp => lp.Completed)
                    .ThenByDescending(lp => lp.CompletedAt)
                    .First());
    }
}
