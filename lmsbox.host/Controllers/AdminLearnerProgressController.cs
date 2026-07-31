using System.Security.Claims;
using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/admin/learner-progress")]
[Authorize(Roles = "SuperAdmin")]
public class AdminLearnerProgressController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAdminActivityTracker _activityTracker;
    private readonly IQuizFeatureService _quizFeatures;
    private readonly ILogger<AdminLearnerProgressController> _logger;

    public AdminLearnerProgressController(
        ApplicationDbContext context,
        IAdminActivityTracker activityTracker,
        IQuizFeatureService quizFeatures,
        ILogger<AdminLearnerProgressController> logger)
    {
        _context = context;
        _activityTracker = activityTracker;
        _quizFeatures = quizFeatures;
        _logger = logger;
    }

    public sealed class UpdateLessonProgressAdminRequest
    {
        public string Status { get; set; } = string.Empty;
        public DateTime? CompletedAt { get; set; }
        public UpdateQuizAttemptAdminRequest? Quiz { get; set; }
    }

    public sealed class UpdateQuizAttemptAdminRequest
    {
        public long? AttemptId { get; set; }
        public int? ScorePercent { get; set; }
        public bool? FailedCriticalSafety { get; set; }
        public int? DurationSeconds { get; set; }
        public DateTime? AttemptCompletedAt { get; set; }
    }

    [HttpGet("lessons/{progressId:int}")]
    public async Task<IActionResult> GetLessonProgressDetails(int progressId)
    {
        try
        {
            var progress = await LoadLessonProgressAsync(progressId);
            if (progress == null)
            {
                return NotFound(new { message = "Lesson progress record not found" });
            }

            return await BuildLessonProgressDetailsResponseAsync(progress);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading lesson progress details {ProgressId}", progressId);
            return StatusCode(500, new { message = "Failed to load lesson progress details", details = ex.Message });
        }
    }

    [HttpGet("users/{userId}/courses/{courseId}/lessons/{lessonId:long}")]
    public async Task<IActionResult> GetLessonProgressDetailsByAssignment(string userId, string courseId, long lessonId)
    {
        try
        {
            var progress = await LoadLessonProgressByAssignmentAsync(userId, courseId, lessonId);
            if (progress != null)
            {
                return await BuildLessonProgressDetailsResponseAsync(progress);
            }

            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            var course = await _context.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == courseId);
            var lesson = await _context.Lessons.AsNoTracking().FirstOrDefaultAsync(l => l.Id == lessonId && l.CourseId == courseId);

            if (user == null || course == null || lesson == null)
            {
                return NotFound(new { message = "Associated user, course, or lesson not found" });
            }

            if (course.IsDeleted)
            {
                return BadRequest(new { message = "Course has been deleted" });
            }

            var scope = await AdminUserScope.ResolveAsync(User, _context);
            if (!scope.CanAccessUser(user))
            {
                return Forbid();
            }

            if (scope.OrganisationId.HasValue
                && course.OrganisationId != scope.OrganisationId)
            {
                return Forbid();
            }

            var isQuizLesson = IsQuizLesson(lesson);
            var latestAttempt = isQuizLesson && !string.IsNullOrEmpty(lesson.QuizId)
                ? await GetLatestQuizAttemptAsync(userId, lesson.QuizId)
                : null;

            Quiz? quiz = null;
            if (isQuizLesson && !string.IsNullOrEmpty(lesson.QuizId))
            {
                quiz = await _context.Quizzes.AsNoTracking()
                    .FirstOrDefaultAsync(q => q.Id == lesson.QuizId);
            }

            return Ok(new
            {
                progressId = (int?)null,
                userId = user.Id,
                userName = FormatLearnerName(user),
                email = user.Email,
                courseId = course.Id,
                courseTitle = course.Title,
                lessonId = lesson.Id,
                lessonTitle = lesson.Title,
                lessonType = lesson.Type ?? "content",
                quizId = lesson.QuizId,
                isQuizLesson,
                status = isQuizLesson
                    ? (latestAttempt != null ? (latestAttempt.Passed ? "Passed" : "Failed") : "Not Started")
                    : "Not Started",
                progressPercent = 0,
                completed = false,
                completedAt = (DateTime?)null,
                startedAt = (DateTime?)null,
                lastAccessedAt = (DateTime?)null,
                quiz = quiz == null
                    ? null
                    : new
                    {
                        quizId = quiz.Id,
                        title = quiz.Title,
                        passingScore = quiz.PassingScore,
                        maxAttempts = quiz.MaxAttempts,
                        criticalSafetyEnabled = _quizFeatures.IsCriticalSafetyEnabled
                    },
                latestAttempt = latestAttempt == null
                    ? null
                    : new
                    {
                        attemptId = latestAttempt.Id,
                        scorePercent = latestAttempt.ScorePercent,
                        passed = latestAttempt.Passed,
                        failedCriticalSafety = latestAttempt.FailedCriticalSafety,
                        durationSeconds = latestAttempt.DurationSeconds,
                        startedAt = latestAttempt.StartedAt,
                        completedAt = latestAttempt.CompletedAt
                    },
                attemptCount = isQuizLesson && !string.IsNullOrEmpty(lesson.QuizId)
                    ? await _context.QuizAttempts.CountAsync(a =>
                        a.QuizId == lesson.QuizId
                        && a.UserId == userId
                        && a.IsCompleted)
                    : 0
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading lesson progress details for user {UserId} course {CourseId} lesson {LessonId}", userId, courseId, lessonId);
            return StatusCode(500, new { message = "Failed to load lesson progress details", details = ex.Message });
        }
    }

    [HttpPut("lessons/{progressId:int}")]
    public async Task<IActionResult> UpdateLessonProgress(int progressId, [FromBody] UpdateLessonProgressAdminRequest request)
    {
        try
        {
            var progress = await LoadLessonProgressAsync(progressId);
            if (progress == null)
            {
                return NotFound(new { message = "Lesson progress record not found" });
            }

            return await ApplyLessonProgressUpdateAsync(progress, request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating lesson progress {ProgressId}", progressId);
            return StatusCode(500, new { message = "Failed to update lesson progress", details = ex.Message });
        }
    }

    [HttpPut("users/{userId}/courses/{courseId}/lessons/{lessonId:long}")]
    public async Task<IActionResult> UpsertLessonProgressByAssignment(
        string userId,
        string courseId,
        long lessonId,
        [FromBody] UpdateLessonProgressAdminRequest request)
    {
        try
        {
            var progress = await GetOrCreateLessonProgressAsync(userId, courseId, lessonId);
            if (progress == null)
            {
                return NotFound(new { message = "Associated user, course, or lesson not found" });
            }

            return await ApplyLessonProgressUpdateAsync(progress, request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error upserting lesson progress for user {UserId} course {CourseId} lesson {LessonId}", userId, courseId, lessonId);
            return StatusCode(500, new { message = "Failed to update lesson progress", details = ex.Message });
        }
    }

    private async Task<IActionResult> BuildLessonProgressDetailsResponseAsync(LearnerProgress progress)
    {
        var accessError = await ValidateAccessAsync(progress);
        if (accessError != null)
        {
            return accessError;
        }

        var isQuizLesson = IsQuizLesson(progress.Lesson!);
        var latestAttempt = isQuizLesson && !string.IsNullOrEmpty(progress.Lesson!.QuizId)
            ? await GetLatestQuizAttemptAsync(progress.UserId, progress.Lesson.QuizId)
            : null;

        Quiz? quiz = null;
        if (isQuizLesson && !string.IsNullOrEmpty(progress.Lesson!.QuizId))
        {
            quiz = await _context.Quizzes.AsNoTracking()
                .FirstOrDefaultAsync(q => q.Id == progress.Lesson.QuizId);
        }

        var status = isQuizLesson
            ? GetQuizStatusLabel(progress, latestAttempt)
            : GetStatusLabel(progress);

        return Ok(new
        {
            progressId = progress.Id,
            userId = progress.UserId,
            userName = FormatLearnerName(progress.User!),
            email = progress.User?.Email,
            courseId = progress.CourseId,
            courseTitle = progress.Course?.Title,
            lessonId = progress.LessonId,
            lessonTitle = progress.Lesson?.Title,
            lessonType = progress.Lesson?.Type ?? "content",
            quizId = progress.Lesson?.QuizId,
            isQuizLesson,
            status,
            progressPercent = progress.ProgressPercent,
            completed = progress.Completed,
            completedAt = progress.CompletedAt,
            startedAt = progress.StartedAt,
            lastAccessedAt = progress.LastAccessedAt,
            quiz = quiz == null
                ? null
                : new
                {
                    quizId = quiz.Id,
                    title = quiz.Title,
                    passingScore = quiz.PassingScore,
                    maxAttempts = quiz.MaxAttempts,
                    criticalSafetyEnabled = _quizFeatures.IsCriticalSafetyEnabled
                },
            latestAttempt = latestAttempt == null
                ? null
                : new
                {
                    attemptId = latestAttempt.Id,
                    scorePercent = latestAttempt.ScorePercent,
                    passed = latestAttempt.Passed,
                    failedCriticalSafety = latestAttempt.FailedCriticalSafety,
                    durationSeconds = latestAttempt.DurationSeconds,
                    startedAt = latestAttempt.StartedAt,
                    completedAt = latestAttempt.CompletedAt
                },
            attemptCount = isQuizLesson && !string.IsNullOrEmpty(progress.Lesson!.QuizId)
                ? await _context.QuizAttempts.CountAsync(a =>
                    a.QuizId == progress.Lesson.QuizId
                    && a.UserId == progress.UserId
                    && a.IsCompleted)
                : 0
        });
    }

    private async Task<IActionResult> ApplyLessonProgressUpdateAsync(
        LearnerProgress progress,
        UpdateLessonProgressAdminRequest request)
    {
        var adminUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(adminUserId))
        {
            return Unauthorized(new { message = "User not authenticated" });
        }

        var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == adminUserId);
        if (adminUser == null)
        {
            return Unauthorized(new { message = "User not found" });
        }

        var accessError = await ValidateAccessAsync(progress);
        if (accessError != null)
        {
            return accessError;
        }

        var isQuizLesson = IsQuizLesson(progress.Lesson!);
        var previousStatus = isQuizLesson
            ? GetQuizStatusLabel(progress, await GetLatestQuizAttemptAsync(progress.UserId, progress.Lesson!.QuizId!))
            : GetStatusLabel(progress);
        var previousCompletedAt = progress.CompletedAt;
        QuizAttempt? previousAttempt = isQuizLesson && !string.IsNullOrEmpty(progress.Lesson!.QuizId)
            ? await GetLatestQuizAttemptAsync(progress.UserId, progress.Lesson.QuizId)
            : null;

        QuizAttempt? updatedAttempt = null;
        string newStatus;

        if (isQuizLesson)
        {
            var normalizedQuizStatus = NormalizeQuizStatus(request.Status);
            if (normalizedQuizStatus == null)
            {
                return BadRequest(new { message = "Status must be Not Started, In Progress, Passed, or Failed for quiz lessons" });
            }

            newStatus = normalizedQuizStatus;

            if (normalizedQuizStatus is "Passed" or "Failed")
            {
                if (request.Quiz?.ScorePercent == null)
                {
                    return BadRequest(new { message = "Score is required when quiz status is Passed or Failed" });
                }

                if (string.IsNullOrEmpty(progress.Lesson!.QuizId))
                {
                    return BadRequest(new { message = "Quiz lesson is missing an associated quiz" });
                }

                var quiz = await _context.Quizzes.AsNoTracking()
                    .FirstOrDefaultAsync(q => q.Id == progress.Lesson.QuizId);
                if (quiz == null)
                {
                    return NotFound(new { message = "Associated quiz not found" });
                }

                var scorePercent = Math.Clamp(request.Quiz.ScorePercent.Value, 0, 100);
                var failedCriticalSafety = _quizFeatures.IsCriticalSafetyEnabled
                    && (request.Quiz.FailedCriticalSafety ?? false);
                var passed = normalizedQuizStatus == "Passed"
                    && scorePercent >= quiz.PassingScore
                    && !failedCriticalSafety;

                if (normalizedQuizStatus == "Passed" && !passed)
                {
                    return BadRequest(new
                    {
                        message = failedCriticalSafety
                            ? "Quiz cannot be marked as passed when critical safety is failed"
                            : $"Score must be at least {quiz.PassingScore}% to mark as passed"
                    });
                }

                updatedAttempt = await UpsertQuizAttemptAsync(
                    progress,
                    quiz,
                    request.Quiz,
                    passed,
                    scorePercent,
                    failedCriticalSafety,
                    previousAttempt);

                if (passed)
                {
                    ApplyStatus(progress, "Completed", request.CompletedAt ?? request.Quiz.AttemptCompletedAt);
                }
                else
                {
                    ApplyStatus(progress, "In Progress", null);
                }
            }
            else if (normalizedQuizStatus == "In Progress")
            {
                ApplyStatus(progress, "In Progress", null);
            }
            else
            {
                ApplyStatus(progress, "Not Started", null);
            }
        }
        else
        {
            var normalizedStatus = NormalizeStatus(request.Status);
            if (normalizedStatus == null)
            {
                return BadRequest(new { message = "Status must be Completed, In Progress, or Not Started" });
            }

            if (normalizedStatus != "Completed" && request.CompletedAt.HasValue)
            {
                return BadRequest(new { message = "Completion date can only be set when status is Completed" });
            }

            newStatus = normalizedStatus;
            ApplyStatus(progress, normalizedStatus, request.CompletedAt);
        }

        progress.LastAccessedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        if (!string.IsNullOrEmpty(progress.CourseId))
        {
            await UpdateCourseProgressAsync(progress.UserId, progress.CourseId);
        }

        var learnerName = FormatLearnerName(progress.User!);
        var changes = BuildChangeSummary(
            previousStatus,
            newStatus,
            previousCompletedAt,
            progress.CompletedAt,
            previousAttempt,
            updatedAttempt);

        var auditDetails =
            $"Learner: {learnerName} ({progress.User?.Email ?? "N/A"}); " +
            $"Course: {progress.Course?.Title}; " +
            $"Lesson: {progress.Lesson?.Title}; " +
            $"Progress ID: {progress.Id}; " +
            changes;

        await _activityTracker.TrackAsync(
            adminUser,
            isQuizLesson ? "Quiz Lesson Progress Updated" : "Lesson Progress Updated",
            auditDetails,
            EngagementTrackingService.EVENT_LESSON_PROGRESS_UPDATED,
            courseId: progress.CourseId,
            organisationId: progress.User?.OrganisationID,
            metadata: new
            {
                progressId = progress.Id,
                learnerUserId = progress.UserId,
                learnerName,
                learnerEmail = progress.User?.Email,
                courseId = progress.CourseId,
                courseTitle = progress.Course?.Title,
                lessonId = progress.LessonId,
                lessonTitle = progress.Lesson?.Title,
                lessonType = progress.Lesson?.Type,
                quizId = progress.Lesson?.QuizId,
                previousStatus,
                newStatus,
                previousCompletedAt,
                newCompletedAt = progress.CompletedAt,
                previousAttemptId = previousAttempt?.Id,
                updatedAttemptId = updatedAttempt?.Id,
                previousScore = previousAttempt?.ScorePercent,
                newScore = updatedAttempt?.ScorePercent,
                previousPassed = previousAttempt?.Passed,
                newPassed = updatedAttempt?.Passed,
                changes
            });

        var responseLatestAttempt = isQuizLesson && !string.IsNullOrEmpty(progress.Lesson!.QuizId)
            ? await GetLatestQuizAttemptAsync(progress.UserId, progress.Lesson.QuizId)
            : null;

        return Ok(new
        {
            progressId = progress.Id,
            userId = progress.UserId,
            courseId = progress.CourseId,
            lessonId = progress.LessonId,
            lessonType = progress.Lesson?.Type,
            isQuizLesson,
            progressPercent = progress.ProgressPercent,
            completed = progress.Completed,
            status = isQuizLesson ? GetQuizStatusLabel(progress, responseLatestAttempt) : GetStatusLabel(progress),
            completedAt = progress.CompletedAt,
            startedAt = progress.StartedAt,
            lastAccessedAt = progress.LastAccessedAt,
            quizAttempt = updatedAttempt == null
                ? null
                : new
                {
                    attemptId = updatedAttempt.Id,
                    scorePercent = updatedAttempt.ScorePercent,
                    passed = updatedAttempt.Passed,
                    failedCriticalSafety = updatedAttempt.FailedCriticalSafety,
                    durationSeconds = updatedAttempt.DurationSeconds,
                    completedAt = updatedAttempt.CompletedAt
                }
        });
    }

    private async Task<LearnerProgress?> LoadLessonProgressAsync(int progressId) =>
        await _context.LearnerProgresses
            .Include(lp => lp.User)
            .Include(lp => lp.Course)
            .Include(lp => lp.Lesson)
            .FirstOrDefaultAsync(lp => lp.Id == progressId && lp.LessonId != null);

    private async Task<LearnerProgress?> LoadLessonProgressByAssignmentAsync(string userId, string courseId, long lessonId) =>
        await _context.LearnerProgresses
            .Include(lp => lp.User)
            .Include(lp => lp.Course)
            .Include(lp => lp.Lesson)
            .FirstOrDefaultAsync(lp =>
                lp.UserId == userId
                && lp.CourseId == courseId
                && lp.LessonId == lessonId);

    private async Task<LearnerProgress?> GetOrCreateLessonProgressAsync(string userId, string courseId, long lessonId)
    {
        var existing = await LoadLessonProgressByAssignmentAsync(userId, courseId, lessonId);
        if (existing != null)
        {
            return existing;
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        var course = await _context.Courses.FirstOrDefaultAsync(c => c.Id == courseId);
        var lesson = await _context.Lessons.FirstOrDefaultAsync(l => l.Id == lessonId && l.CourseId == courseId);

        if (user == null || course == null || lesson == null)
        {
            return null;
        }

        var progress = new LearnerProgress
        {
            UserId = userId,
            CourseId = courseId,
            LessonId = lessonId,
            ProgressPercent = 0,
            Completed = false,
            StartedAt = null,
            CompletedAt = null
        };

        _context.LearnerProgresses.Add(progress);
        await _context.SaveChangesAsync();

        progress.User = user;
        progress.Course = course;
        progress.Lesson = lesson;
        return progress;
    }

    private async Task<IActionResult?> ValidateAccessAsync(LearnerProgress progress)
    {
        if (progress.User == null || progress.Course == null || progress.Lesson == null)
        {
            return NotFound(new { message = "Associated user, course, or lesson not found" });
        }

        if (progress.Course.IsDeleted)
        {
            return BadRequest(new { message = "Course has been deleted" });
        }

        var scope = await AdminUserScope.ResolveAsync(User, _context);
        if (!scope.CanAccessUser(progress.User))
        {
            return Forbid();
        }

        if (scope.OrganisationId.HasValue
            && progress.Course.OrganisationId != scope.OrganisationId)
        {
            return Forbid();
        }

        return null;
    }

    private static bool IsQuizLesson(Lesson lesson) =>
        string.Equals(lesson.Type, "quiz", StringComparison.OrdinalIgnoreCase);

    private async Task<QuizAttempt?> GetLatestQuizAttemptAsync(string userId, string quizId) =>
        await _context.QuizAttempts
            .Where(a => a.QuizId == quizId && a.UserId == userId && a.IsCompleted)
            .OrderByDescending(a => a.CompletedAt)
            .ThenByDescending(a => a.Id)
            .FirstOrDefaultAsync();

    private static string GetQuizStatusLabel(LearnerProgress progress, QuizAttempt? latestAttempt)
    {
        if (latestAttempt != null)
        {
            if (latestAttempt.Passed)
            {
                return "Passed";
            }

            return "Failed";
        }

        return GetStatusLabel(progress);
    }

    private async Task<QuizAttempt> UpsertQuizAttemptAsync(
        LearnerProgress progress,
        Quiz quiz,
        UpdateQuizAttemptAdminRequest quizRequest,
        bool passed,
        int scorePercent,
        bool failedCriticalSafety,
        QuizAttempt? existingAttempt)
    {
        QuizAttempt? attempt = null;

        if (quizRequest.AttemptId.HasValue)
        {
            attempt = await _context.QuizAttempts.FirstOrDefaultAsync(a =>
                a.Id == quizRequest.AttemptId.Value
                && a.QuizId == quiz.Id
                && a.UserId == progress.UserId);
        }

        attempt ??= existingAttempt;

        var completedAt = quizRequest.AttemptCompletedAt.HasValue
            ? DateTime.SpecifyKind(quizRequest.AttemptCompletedAt.Value, DateTimeKind.Utc)
            : DateTime.UtcNow;
        var durationSeconds = Math.Max(0, quizRequest.DurationSeconds ?? attempt?.DurationSeconds ?? 0);
        var startedAt = durationSeconds > 0
            ? completedAt.AddSeconds(-durationSeconds)
            : completedAt;

        if (attempt == null)
        {
            attempt = new QuizAttempt
            {
                QuizId = quiz.Id,
                UserId = progress.UserId,
                StartedAt = startedAt,
                CompletedAt = completedAt,
                DurationSeconds = durationSeconds,
                ScorePercent = scorePercent,
                Passed = passed,
                FailedCriticalSafety = failedCriticalSafety,
                IsCompleted = true
            };
            _context.QuizAttempts.Add(attempt);
        }
        else
        {
            attempt.StartedAt = startedAt;
            attempt.CompletedAt = completedAt;
            attempt.DurationSeconds = durationSeconds;
            attempt.ScorePercent = scorePercent;
            attempt.Passed = passed;
            attempt.FailedCriticalSafety = failedCriticalSafety;
            attempt.IsCompleted = true;
        }

        return attempt;
    }

    private static string? NormalizeStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        return status.Trim().ToLowerInvariant() switch
        {
            "completed" => "Completed",
            "in progress" => "In Progress",
            "not started" => "Not Started",
            _ => null
        };
    }

    private static string? NormalizeQuizStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        return status.Trim().ToLowerInvariant() switch
        {
            "passed" => "Passed",
            "failed" => "Failed",
            "in progress" => "In Progress",
            "not started" => "Not Started",
            "completed" => "Passed",
            _ => null
        };
    }

    private static string GetStatusLabel(LearnerProgress progress) =>
        progress.Completed
            ? "Completed"
            : progress.ProgressPercent > 0
                ? "In Progress"
                : "Not Started";

    private static void ApplyStatus(LearnerProgress progress, string status, DateTime? completedAt)
    {
        switch (status)
        {
            case "Completed":
                if (progress.StartedAt == null)
                {
                    progress.StartedAt = completedAt ?? DateTime.UtcNow;
                }

                progress.Completed = true;
                progress.ProgressPercent = 100;
                progress.CompletedAt = completedAt.HasValue
                    ? DateTime.SpecifyKind(completedAt.Value.Date, DateTimeKind.Utc)
                    : DateTime.UtcNow;
                break;

            case "In Progress":
                progress.Completed = false;
                progress.CompletedAt = null;
                if (progress.ProgressPercent <= 0)
                {
                    progress.ProgressPercent = 1;
                }

                if (progress.StartedAt == null)
                {
                    progress.StartedAt = DateTime.UtcNow;
                }

                break;

            case "Not Started":
                progress.Completed = false;
                progress.ProgressPercent = 0;
                progress.CompletedAt = null;
                progress.StartedAt = null;
                break;
        }
    }

    private static string BuildChangeSummary(
        string previousStatus,
        string newStatus,
        DateTime? previousCompletedAt,
        DateTime? newCompletedAt,
        QuizAttempt? previousAttempt,
        QuizAttempt? updatedAttempt)
    {
        var parts = new List<string>();

        if (!string.Equals(previousStatus, newStatus, StringComparison.Ordinal))
        {
            parts.Add($"Status changed from '{previousStatus}' to '{newStatus}'");
        }

        var previousDate = previousCompletedAt?.ToString("yyyy-MM-dd") ?? "none";
        var newDate = newCompletedAt?.ToString("yyyy-MM-dd") ?? "none";
        if (previousDate != newDate)
        {
            parts.Add($"Completion date changed from {previousDate} to {newDate}");
        }

        if (updatedAttempt != null)
        {
            var previousScore = previousAttempt?.ScorePercent;
            if (previousScore != updatedAttempt.ScorePercent)
            {
                parts.Add($"Score changed from {previousScore?.ToString() ?? "none"}% to {updatedAttempt.ScorePercent}%");
            }

            var previousPassed = previousAttempt?.Passed;
            if (previousPassed != updatedAttempt.Passed)
            {
                parts.Add($"Quiz result changed from {(previousPassed == true ? "Passed" : previousPassed == false ? "Failed" : "none")} to {(updatedAttempt.Passed ? "Passed" : "Failed")}");
            }

            var previousCritical = previousAttempt?.FailedCriticalSafety;
            if (previousCritical != updatedAttempt.FailedCriticalSafety)
            {
                parts.Add($"Critical safety failure changed from {previousCritical?.ToString() ?? "none"} to {updatedAttempt.FailedCriticalSafety}");
            }

            var previousAttemptDate = previousAttempt?.CompletedAt.ToString("yyyy-MM-dd") ?? "none";
            var newAttemptDate = updatedAttempt.CompletedAt.ToString("yyyy-MM-dd");
            if (previousAttemptDate != newAttemptDate)
            {
                parts.Add($"Attempt date changed from {previousAttemptDate} to {newAttemptDate}");
            }

            var previousDuration = previousAttempt?.DurationSeconds;
            if (previousDuration != updatedAttempt.DurationSeconds)
            {
                parts.Add($"Duration changed from {previousDuration?.ToString() ?? "none"}s to {updatedAttempt.DurationSeconds}s");
            }
        }

        return parts.Count > 0 ? string.Join("; ", parts) : "No changes applied";
    }

    private static string FormatLearnerName(ApplicationUser user)
    {
        var name = $"{user.FirstName} {user.LastName}".Trim();
        return string.IsNullOrWhiteSpace(name) ? (user.Email ?? user.UserName ?? user.Id) : name;
    }

    private async Task UpdateCourseProgressAsync(string userId, string courseId)
    {
        var lessons = await _context.Lessons.Where(l => l.CourseId == courseId).ToListAsync();
        if (lessons.Count == 0)
        {
            return;
        }

        var totalLessons = lessons.Count;

        var lessonProgresses = await _context.LearnerProgresses
            .Where(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId != null)
            .ToListAsync();

        var completedLessons = lessonProgresses.Count(lp => lp.Completed);
        var progressPercent = (int)Math.Round((double)completedLessons / totalLessons * 100);

        var courseProgress = await _context.LearnerProgresses
            .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId == null);

        if (courseProgress == null)
        {
            courseProgress = new LearnerProgress
            {
                UserId = userId,
                CourseId = courseId,
                LessonId = null,
                ProgressPercent = progressPercent,
                Completed = false,
                CompletedAt = null
            };
            _context.LearnerProgresses.Add(courseProgress);
        }
        else
        {
            courseProgress.ProgressPercent = progressPercent;
        }

        var course = await _context.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == courseId);
        var canMarkComplete = course != null
            && CourseCompletionHelper.IsCourseCertificateEligible(
                course,
                lessons,
                lessonProgresses,
                courseProgress);

        if (canMarkComplete && !courseProgress.Completed)
        {
            courseProgress.Completed = true;
            courseProgress.CompletedAt = DateTime.UtcNow;
        }
        else if (!canMarkComplete && courseProgress.Completed)
        {
            courseProgress.Completed = false;
            courseProgress.CompletedAt = null;
        }

        await _context.SaveChangesAsync();
    }
}
