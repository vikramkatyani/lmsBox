using System.Text.Json;
using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace lmsBox.Server.Services;

public class CourseMoveResult
{
    public bool Moved { get; init; }
    public string CourseId { get; init; } = "";
    public string Title { get; init; } = "";
    public long SourceOrganisationId { get; init; }
    public long TargetOrganisationId { get; init; }
    public string? Message { get; init; }
    public int LessonCount { get; init; }
    public int DetachedAssignments { get; init; }
}

/// <summary>
/// Reassigns a course to another organisation. Lessons, quizzes, interactive blocks,
/// and resources stay on the course (they are keyed by CourseId). Source-org group
/// assignments and pathway links are detached so the course does not stay visible
/// in the old tenant's groups/pathways.
/// </summary>
public static class CourseOrganisationMoveService
{
    public static async Task<CourseMoveResult> MoveToOrganisationAsync(
        ApplicationDbContext db,
        string courseId,
        long targetOrganisationId,
        ILogger logger)
    {
        var course = await db.Courses
            .Include(c => c.Lessons)
            .FirstOrDefaultAsync(c => c.Id == courseId && !c.IsDeleted);

        if (course == null)
        {
            return new CourseMoveResult
            {
                Moved = false,
                CourseId = courseId,
                Message = "Course not found"
            };
        }

        var targetOrg = await db.Organisations.FirstOrDefaultAsync(o => o.Id == targetOrganisationId);
        if (targetOrg == null)
        {
            return new CourseMoveResult
            {
                Moved = false,
                CourseId = courseId,
                Title = course.Title,
                SourceOrganisationId = course.OrganisationId,
                Message = "Target organisation not found"
            };
        }

        if (course.OrganisationId == targetOrganisationId)
        {
            return new CourseMoveResult
            {
                Moved = false,
                CourseId = course.Id,
                Title = course.Title,
                SourceOrganisationId = course.OrganisationId,
                TargetOrganisationId = targetOrganisationId,
                LessonCount = course.Lessons.Count,
                Message = "Course already belongs to the target organisation"
            };
        }

        var titleTaken = await db.Courses.AnyAsync(c =>
            c.OrganisationId == targetOrganisationId
            && !c.IsDeleted
            && c.Id != course.Id
            && c.Title == course.Title);
        if (titleTaken)
        {
            return new CourseMoveResult
            {
                Moved = false,
                CourseId = course.Id,
                Title = course.Title,
                SourceOrganisationId = course.OrganisationId,
                TargetOrganisationId = targetOrganisationId,
                Message = $"A course titled '{course.Title}' already exists in the target organisation"
            };
        }

        var sourceOrganisationId = course.OrganisationId;

        var groupCourses = await db.GroupCourses.Where(gc => gc.CourseId == course.Id).ToListAsync();
        db.GroupCourses.RemoveRange(groupCourses);

        var assignments = await db.CourseAssignments.Where(a => a.CourseId == course.Id).ToListAsync();
        db.CourseAssignments.RemoveRange(assignments);

        var pathwayLinks = await db.PathwayCourses.Where(pc => pc.CourseId == course.Id).ToListAsync();
        db.PathwayCourses.RemoveRange(pathwayLinks);

        await ReassignExclusiveSurveyAsync(db, course.PreCourseSurveyId, sourceOrganisationId, targetOrganisationId, course.Id);
        await ReassignExclusiveSurveyAsync(db, course.PostCourseSurveyId, sourceOrganisationId, targetOrganisationId, course.Id);

        await StripCourseFromAutomationsAsync(db, course.Id);

        course.OrganisationId = targetOrganisationId;
        course.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        logger.LogInformation(
            "Moved course {CourseId} ({Title}) from organisation {SourceOrgId} to {TargetOrgId} with {LessonCount} lessons",
            course.Id, course.Title, sourceOrganisationId, targetOrganisationId, course.Lessons.Count);

        return new CourseMoveResult
        {
            Moved = true,
            CourseId = course.Id,
            Title = course.Title,
            SourceOrganisationId = sourceOrganisationId,
            TargetOrganisationId = targetOrganisationId,
            LessonCount = course.Lessons.Count,
            DetachedAssignments = groupCourses.Count + assignments.Count + pathwayLinks.Count,
            Message = "Course moved"
        };
    }

    private static async Task ReassignExclusiveSurveyAsync(
        ApplicationDbContext db,
        long? surveyId,
        long sourceOrganisationId,
        long targetOrganisationId,
        string courseId)
    {
        if (!surveyId.HasValue)
        {
            return;
        }

        var survey = await db.Surveys.FirstOrDefaultAsync(s => s.Id == surveyId.Value && !s.IsDeleted);
        if (survey == null || survey.OrganisationId != sourceOrganisationId)
        {
            return;
        }

        var usedByOtherCourses = await db.Courses.AnyAsync(c =>
            !c.IsDeleted
            && c.Id != courseId
            && (c.PreCourseSurveyId == survey.Id || c.PostCourseSurveyId == survey.Id));

        if (!usedByOtherCourses)
        {
            survey.OrganisationId = targetOrganisationId;
            survey.UpdatedAt = DateTime.UtcNow;
        }
    }

    private static async Task StripCourseFromAutomationsAsync(ApplicationDbContext db, string courseId)
    {
        var tasks = await db.AutomationTasks
            .Where(t => t.CourseFilterJson != null && t.CourseFilterJson.Contains(courseId))
            .ToListAsync();

        foreach (var task in tasks)
        {
            try
            {
                var ids = JsonSerializer.Deserialize<List<string>>(task.CourseFilterJson!) ?? new List<string>();
                var remaining = ids.Where(id => !string.Equals(id, courseId, StringComparison.Ordinal)).ToList();
                task.CourseFilterJson = remaining.Count == 0 ? null : JsonSerializer.Serialize(remaining);
                task.UpdatedAtUtc = DateTime.UtcNow;
            }
            catch (JsonException)
            {
                // Leave malformed JSON as-is.
            }
        }
    }
}
