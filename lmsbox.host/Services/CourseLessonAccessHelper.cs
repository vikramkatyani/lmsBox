using lmsbox.domain.Models;

namespace lmsBox.Server.Services;

public static class CourseLessonAccessHelper
{
    public static bool AreLessonsLockedByPreSurvey(Course course, LearnerProgress? courseProgress)
    {
        return course.IsPreSurveyMandatory
            && course.PreCourseSurveyId.HasValue
            && !(courseProgress?.PreSurveyCompleted ?? false);
    }

    public static bool IsLessonLocked(
        Course course,
        Lesson lesson,
        IReadOnlyList<Lesson> orderedLessons,
        IReadOnlyDictionary<long, bool> lessonCompletedById,
        LearnerProgress? courseProgress)
    {
        if (AreLessonsLockedByPreSurvey(course, courseProgress))
        {
            return true;
        }

        if (!course.RequireSequentialLessons)
        {
            return false;
        }

        if (lessonCompletedById.GetValueOrDefault(lesson.Id))
        {
            return false;
        }

        var previousLesson = orderedLessons
            .Where(l => l.Ordinal < lesson.Ordinal)
            .OrderByDescending(l => l.Ordinal)
            .FirstOrDefault();

        if (previousLesson == null)
        {
            return false;
        }

        return !lessonCompletedById.GetValueOrDefault(previousLesson.Id);
    }

    public static Dictionary<long, bool> BuildLessonCompletionMap(IEnumerable<LearnerProgress> lessonProgresses)
    {
        return lessonProgresses
            .Where(lp => lp.LessonId.HasValue)
            .GroupBy(lp => lp.LessonId!.Value)
            .ToDictionary(g => g.Key, g => g.Any(lp => lp.Completed));
    }
}
