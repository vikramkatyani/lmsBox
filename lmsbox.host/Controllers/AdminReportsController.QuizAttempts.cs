using lmsbox.domain.Models;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace lmsBox.Server.Controllers;

public partial class AdminReportsController
{
    #region Quiz Attempts Report

    private const int QuizRecordsLookbackDays = 90;
    private const string QuizRecordScopeSinceLastLogin = "sinceLastLogin";
    private const string QuizRecordScopeLast90Days = "last90Days";
    private const string QuizRecordScopeAll = "all";

    private static DateTime GetQuizLast90DaysStart() =>
        DateTime.UtcNow.Date.AddDays(-QuizRecordsLookbackDays);

    private async Task<DateTime?> GetLastLoginUtcAsync(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return null;

        var fromEngagement = await _context.UserEngagements.AsNoTracking()
            .Where(e => e.UserId == userId && e.EventType == "Login")
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => (DateTime?)e.CreatedAt)
            .FirstOrDefaultAsync();

        if (fromEngagement.HasValue)
            return fromEngagement;

        return await _context.AuditLogs.AsNoTracking()
            .Where(a => a.Action.StartsWith("User Login") && a.Details != null && a.Details.Contains(userId))
            .OrderByDescending(a => a.PerformedAt)
            .Select(a => (DateTime?)a.PerformedAt)
            .FirstOrDefaultAsync();
    }

    private async Task<DateTime?> ResolveQuizRecordScopeStartDateAsync(string? recordScope, string userId)
    {
        if (string.IsNullOrWhiteSpace(recordScope) ||
            recordScope.Equals(QuizRecordScopeAll, StringComparison.OrdinalIgnoreCase))
            return null;

        if (recordScope.Equals(QuizRecordScopeLast90Days, StringComparison.OrdinalIgnoreCase))
            return GetQuizLast90DaysStart();

        if (recordScope.Equals(QuizRecordScopeSinceLastLogin, StringComparison.OrdinalIgnoreCase))
            return await GetLastLoginUtcAsync(userId);

        return null;
    }

    private static DateTime? MergeQuizAttemptStartDates(DateTime? scopeStart, DateTime? filterStart)
    {
        if (!scopeStart.HasValue)
            return filterStart;

        if (!filterStart.HasValue)
            return scopeStart;

        return scopeStart.Value > filterStart.Value ? scopeStart.Value : filterStart.Value;
    }

    private static object BuildQuizRecordScopeCounts(
        IReadOnlyCollection<QuizAttemptReportRow> latestRows,
        DateTime? lastLogin)
    {
        var ninetyStart = GetQuizLast90DaysStart();
        var allCount = latestRows.Count;
        var last90Count = latestRows.Count(r => r.CompletedAt >= ninetyStart);
        var sinceLoginCount = lastLogin.HasValue
            ? latestRows.Count(r => r.CompletedAt >= lastLogin.Value)
            : allCount;

        return new
        {
            sinceLastLogin = sinceLoginCount,
            last90Days = last90Count,
            all = allCount,
            sinceLastLoginSince = lastLogin,
            last90DaysStartDate = ninetyStart
        };
    }

    private async Task<object> GetQuizRecordScopeCountsAsync(AdminUserScope scope, string userId)
    {
        var lastLogin = await GetLastLoginUtcAsync(userId);
        var rows = await BuildQuizAttemptRowsInternal(
            scope, null, null, null, null, null, null, latestOnly: true);
        return BuildQuizRecordScopeCounts(rows, lastLogin);
    }

    private sealed class QuizAttemptReportRow
    {
        public long AttemptId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string UserEmail { get; set; } = string.Empty;
        public string CourseId { get; set; } = string.Empty;
        public string CourseName { get; set; } = string.Empty;
        public string QuizId { get; set; } = string.Empty;
        public string? SourceQuestionBankQuizId { get; set; }
        public string QuizTitle { get; set; } = string.Empty;
        public int AttemptNumber { get; set; }
        public int ScorePercent { get; set; }
        public bool Passed { get; set; }
        public bool FailedCriticalSafety { get; set; }
        public int DurationSeconds { get; set; }
        public int AvgResponseTimeMs { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime CompletedAt { get; set; }
        public int PassingScore { get; set; }
        public int TotalAttempts { get; set; } = 1;
    }

    private sealed class QuizAnswerAnalyticsRow
    {
        public bool IsCorrect { get; set; }
        public string UserId { get; set; } = string.Empty;
        public long QuestionId { get; set; }
        public string QuestionText { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public bool IsCriticalSafety { get; set; }
        public string QuizId { get; set; } = string.Empty;
        public string QuizTitle { get; set; } = string.Empty;
        public string CourseName { get; set; } = string.Empty;
    }

    private async Task<List<QuizAttempt>> FetchQuizAttemptsAsync(
        AdminUserScope scope,
        string? courseId,
        string? quizId,
        DateTime? startDate,
        DateTime? endDate,
        string? search,
        string? passStatus,
        bool latestOnly)
    {
        var joined =
            from attempt in _context.QuizAttempts.AsNoTracking()
            join user in _context.Users.AsNoTracking() on attempt.UserId equals user.Id
            join quiz in _context.Quizzes.AsNoTracking() on attempt.QuizId equals quiz.Id
            join course in _context.Courses.AsNoTracking() on quiz.CourseId equals course.Id
            where !course.IsDeleted && attempt.IsCompleted
            select new { attempt, quiz, course, user };

        if (scope.OrganisationId.HasValue)
            joined = joined.Where(x => x.user.OrganisationID == scope.OrganisationId.Value);

        if (!string.IsNullOrWhiteSpace(courseId))
            joined = joined.Where(x => x.course.Id == courseId);

        if (!string.IsNullOrWhiteSpace(quizId))
            joined = joined.Where(x => x.quiz.Id == quizId);

        if (startDate.HasValue)
            joined = joined.Where(x => x.attempt.CompletedAt >= startDate.Value);

        if (endDate.HasValue)
        {
            var endInclusive = endDate.Value.Date.AddDays(1);
            joined = joined.Where(x => x.attempt.CompletedAt < endInclusive);
        }

        passStatus = passStatus?.Trim().ToLowerInvariant();
        if (passStatus == "passed")
            joined = joined.Where(x => x.attempt.Passed);
        else if (passStatus == "failed")
        {
            if (_quizFeatures.IsCriticalSafetyEnabled)
                joined = joined.Where(x => !x.attempt.Passed && !x.attempt.FailedCriticalSafety);
            else
                joined = joined.Where(x => !x.attempt.Passed);
        }
        else if (passStatus == "critical" && _quizFeatures.IsCriticalSafetyEnabled)
            joined = joined.Where(x => x.attempt.FailedCriticalSafety);
        else if (passStatus == "critical")
            joined = joined.Where(_ => false);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            joined = joined.Where(x =>
                _context.Users.Any(u => u.Id == x.attempt.UserId &&
                    ((u.Email != null && u.Email.ToLower().Contains(term)) ||
                     (u.FirstName + " " + (u.LastName ?? "")).ToLower().Contains(term))));
        }

        if (latestOnly)
        {
            var latestIds = await joined
                .GroupBy(x => new { x.attempt.UserId, x.attempt.QuizId })
                .Select(g => g.OrderByDescending(x => x.attempt.CompletedAt).Select(x => x.attempt.Id).First())
                .ToListAsync();
            joined = joined.Where(x => latestIds.Contains(x.attempt.Id));
        }

        var attemptIds = await joined.Select(x => x.attempt.Id).Distinct().ToListAsync();
        if (attemptIds.Count == 0)
            return new List<QuizAttempt>();

        return await _context.QuizAttempts.AsNoTracking()
            .Include(a => a.User)
            .Include(a => a.Quiz!)
                .ThenInclude(q => q.Course)
            .Include(a => a.Answers)
            .Where(a => attemptIds.Contains(a.Id))
            .ToListAsync();
    }

    private List<QuizAttemptReportRow> MapQuizAttemptRows(
        IEnumerable<QuizAttempt> attempts,
        Dictionary<long, int> attemptNumberMap)
    {
        return attempts.Select(a =>
        {
            var avgMs = a.Answers.Any()
                ? (int)Math.Round(a.Answers.Average(ans => ans.ResponseTimeMs))
                : 0;

            return new QuizAttemptReportRow
            {
                AttemptId = a.Id,
                UserId = a.UserId,
                UserName = a.User != null
                    ? $"{a.User.FirstName} {a.User.LastName}".Trim()
                    : "Unknown user",
                UserEmail = a.User?.Email ?? string.Empty,
                CourseId = a.Quiz!.CourseId,
                CourseName = a.Quiz.Course?.Title ?? "Unknown",
                QuizId = a.QuizId,
                SourceQuestionBankQuizId = a.Quiz?.SourceQuestionBankQuizId,
                QuizTitle = a.Quiz.Title,
                AttemptNumber = attemptNumberMap.GetValueOrDefault(a.Id, 1),
                ScorePercent = a.ScorePercent,
                Passed = a.Passed,
                FailedCriticalSafety = _quizFeatures.IsCriticalSafetyEnabled && a.FailedCriticalSafety,
                DurationSeconds = a.DurationSeconds,
                AvgResponseTimeMs = avgMs,
                StartedAt = a.StartedAt,
                CompletedAt = a.CompletedAt,
                PassingScore = a.Quiz.PassingScore
            };
        }).ToList();
    }

    private static IEnumerable<QuizAttemptReportRow> ApplyQuizAttemptSort(
        IEnumerable<QuizAttemptReportRow> rows,
        string sortBy,
        string sortDirection)
    {
        var desc = sortDirection.Equals("desc", StringComparison.OrdinalIgnoreCase);
        return sortBy.ToLowerInvariant() switch
        {
            "score" => desc ? rows.OrderByDescending(r => r.ScorePercent) : rows.OrderBy(r => r.ScorePercent),
            "duration" => desc ? rows.OrderByDescending(r => r.DurationSeconds) : rows.OrderBy(r => r.DurationSeconds),
            "user" => desc ? rows.OrderByDescending(r => r.UserName) : rows.OrderBy(r => r.UserName),
            "course" => desc ? rows.OrderByDescending(r => r.CourseName) : rows.OrderBy(r => r.CourseName),
            "quiz" => desc ? rows.OrderByDescending(r => r.QuizTitle) : rows.OrderBy(r => r.QuizTitle),
            _ => desc ? rows.OrderByDescending(r => r.CompletedAt) : rows.OrderBy(r => r.CompletedAt)
        };
    }

    private async Task<Dictionary<long, int>> BuildAttemptNumberMapAsync(IReadOnlyCollection<QuizAttempt> attempts)
    {
        if (attempts.Count == 0)
            return new Dictionary<long, int>();

        var userIds = attempts.Select(a => a.UserId).Distinct().ToList();
        var quizIds = attempts.Select(a => a.QuizId).Distinct().ToList();

        var allAttempts = await _context.QuizAttempts.AsNoTracking()
            .Where(a => userIds.Contains(a.UserId) && quizIds.Contains(a.QuizId))
            .Select(a => new { a.Id, a.UserId, a.QuizId, a.CompletedAt })
            .ToListAsync();

        return allAttempts
            .GroupBy(a => new { a.UserId, a.QuizId })
            .SelectMany(g => g.OrderBy(x => x.CompletedAt).ThenBy(x => x.Id)
                .Select((x, index) => new { x.Id, AttemptNumber = index + 1 }))
            .ToDictionary(x => x.Id, x => x.AttemptNumber);
    }

    private async Task<List<QuizAttemptReportRow>> BuildQuizAttemptRowsInternal(
        AdminUserScope scope,
        string? courseId,
        string? quizId,
        DateTime? startDate,
        DateTime? endDate,
        string? search,
        string? passStatus,
        bool latestOnly)
    {
        var attempts = await FetchQuizAttemptsAsync(scope, courseId, quizId, startDate, endDate, search, passStatus, latestOnly: false);
        var attemptNumberMap = await BuildAttemptNumberMapAsync(attempts);
        var rows = MapQuizAttemptRows(attempts, attemptNumberMap);

        if (!latestOnly)
            return rows;

        return rows
            .GroupBy(r => new { r.UserId, r.QuizId })
            .Select(g =>
            {
                var latest = g.OrderByDescending(x => x.CompletedAt).ThenByDescending(x => x.AttemptId).First();
                latest.TotalAttempts = g.Count();
                return latest;
            })
            .ToList();
    }

    private async Task<List<QuizAnswerAnalyticsRow>> FetchQuizAnswerAnalyticsAsync(long? orgId, DateTime? startDate = null)
    {
        var query =
            from aa in _context.QuizAttemptAnswers.AsNoTracking()
            join att in _context.QuizAttempts.AsNoTracking() on aa.QuizAttemptId equals att.Id
            join user in _context.Users.AsNoTracking() on att.UserId equals user.Id
            join quiz in _context.Quizzes.AsNoTracking() on att.QuizId equals quiz.Id
            join course in _context.Courses.AsNoTracking() on quiz.CourseId equals course.Id
            join qq in _context.QuizQuestions.AsNoTracking() on aa.QuizQuestionId equals qq.Id
            where !course.IsDeleted
                && (!orgId.HasValue || user.OrganisationID == orgId.Value)
                && (!startDate.HasValue || att.CompletedAt >= startDate.Value)
            select new QuizAnswerAnalyticsRow
            {
                IsCorrect = aa.IsCorrect,
                UserId = att.UserId,
                QuestionId = qq.Id,
                QuestionText = qq.Question,
                Category = string.IsNullOrWhiteSpace(qq.Category) ? "Uncategorized" : qq.Category,
                IsCriticalSafety = qq.IsCriticalSafety,
                QuizId = quiz.Id,
                QuizTitle = quiz.Title,
                CourseName = course.Title
            };

        return await query.ToListAsync();
    }

    private static string GetCanonicalQuizGroupKey(QuizAttemptReportRow row) =>
        !string.IsNullOrWhiteSpace(row.SourceQuestionBankQuizId)
            ? row.SourceQuestionBankQuizId!
            : row.QuizId;

    private object BuildQuizAnalyticsPayload(
        string orgName,
        List<QuizAttemptReportRow> rows,
        List<QuizAnswerAnalyticsRow> answers,
        bool enableCriticalSafety)
    {
        var totalAttempts = rows.Count;
        var passedCount = rows.Count(r => r.Passed);
        var failedCount = enableCriticalSafety
            ? rows.Count(r => !r.Passed && !r.FailedCriticalSafety)
            : rows.Count(r => !r.Passed);
        var criticalFailCount = enableCriticalSafety
            ? rows.Count(r => r.FailedCriticalSafety)
            : 0;

        var summary = new
        {
            totalAttempts,
            uniqueLearners = rows.Select(r => r.UserId).Distinct().Count(),
            passedCount,
            failedCount,
            criticalFailCount,
            passRate = totalAttempts > 0 ? Math.Round(passedCount / (double)totalAttempts * 100, 1) : 0,
            averageScore = totalAttempts > 0 ? Math.Round(rows.Average(r => r.ScorePercent), 1) : 0,
            averageDurationSeconds = totalAttempts > 0 ? (int)Math.Round(rows.Average(r => r.DurationSeconds)) : 0
        };

        var passFailBreakdown = new[]
        {
            new { label = "Passed", count = passedCount },
            new { label = "Failed", count = failedCount },
        };
        if (enableCriticalSafety)
        {
            passFailBreakdown = passFailBreakdown
                .Append(new { label = "Critical Safety Fail", count = criticalFailCount })
                .ToArray();
        }
        passFailBreakdown = passFailBreakdown.Where(x => x.count > 0).ToArray();

        var quizHeatmap = rows
            .GroupBy(row => $"{row.CourseId}|{GetCanonicalQuizGroupKey(row)}")
            .Select(g =>
            {
                var count = g.Count();
                var passRate = count > 0 ? Math.Round(g.Count(x => x.Passed) / (double)count * 100, 1) : 0;
                var sample = g.First();
                var canonicalQuizId = g
                    .Select(r => r.SourceQuestionBankQuizId)
                    .FirstOrDefault(id => !string.IsNullOrWhiteSpace(id))
                    ?? sample.QuizId;
                return new
                {
                    quizId = canonicalQuizId,
                    courseId = sample.CourseId,
                    courseName = sample.CourseName,
                    quizTitle = sample.QuizTitle,
                    attemptCount = count,
                    passRate,
                    failRate = Math.Round(100 - passRate, 1),
                    averageScore = Math.Round(g.Average(x => x.ScorePercent), 1),
                    criticalFailCount = g.Count(x => x.FailedCriticalSafety)
                };
            })
            .OrderByDescending(x => x.failRate)
            .ThenByDescending(x => x.attemptCount)
            .ToList();

        var categoryHeatmap = answers
            .GroupBy(a => a.Category)
            .Select(g =>
            {
                var total = g.Count();
                var incorrect = g.Count(x => !x.IsCorrect);
                var incorrectRate = total > 0 ? Math.Round(incorrect / (double)total * 100, 1) : 0;
                return new
                {
                    category = g.Key,
                    answerCount = total,
                    incorrectCount = incorrect,
                    incorrectRate,
                    correctRate = Math.Round(100 - incorrectRate, 1)
                };
            })
            .Where(x => x.answerCount > 0)
            .OrderByDescending(x => x.incorrectRate)
            .Take(20)
            .ToList();

        var questionHeatmap = answers
            .GroupBy(a => new { a.QuestionId, a.QuestionText, a.Category, a.QuizId, a.QuizTitle, a.IsCriticalSafety })
            .Select(g =>
            {
                var total = g.Count();
                var incorrect = g.Count(x => !x.IsCorrect);
                var incorrectRate = total > 0 ? Math.Round(incorrect / (double)total * 100, 1) : 0;
                var usersFailed = g.Where(x => !x.IsCorrect).Select(x => x.UserId).Distinct().Count();
                return new
                {
                    questionId = g.Key.QuestionId,
                    question = g.Key.QuestionText.Length > 80 ? g.Key.QuestionText[..80] + "â€¦" : g.Key.QuestionText,
                    category = g.Key.Category,
                    quizId = g.Key.QuizId,
                    quizTitle = g.Key.QuizTitle,
                    isCriticalSafety = enableCriticalSafety && g.Key.IsCriticalSafety,
                    answerCount = total,
                    incorrectRate,
                    usersFailed
                };
            })
            .Where(x => x.answerCount >= 1)
            .OrderByDescending(x => x.incorrectRate)
            .ThenByDescending(x => x.isCriticalSafety)
            .Take(25)
            .ToList();

        object? criticalSafety = null;
        if (enableCriticalSafety)
        {
            var criticalQuestions = questionHeatmap
                .Where(q => q.isCriticalSafety)
                .OrderByDescending(q => q.usersFailed)
                .Take(15)
                .ToList();

            criticalSafety = new
            {
                criticalFailAttempts = criticalFailCount,
                uniqueUsersFailedCritical = rows.Where(r => r.FailedCriticalSafety).Select(r => r.UserId).Distinct().Count(),
                byQuiz = quizHeatmap
                    .Where(q => q.criticalFailCount > 0)
                    .Select(q => new { q.quizId, q.quizTitle, q.criticalFailCount })
                    .ToList(),
                criticalQuestions
            };
        }

        return new
        {
            organization = orgName,
            period = new
            {
                label = "All time"
            },
            summary,
            passFailBreakdown,
            quizHeatmap,
            categoryHeatmap,
            questionHeatmap,
            criticalSafety
        };
    }

    [HttpGet("quiz-attempts/analytics")]
    public async Task<IActionResult> GetQuizAttemptsAnalytics()
    {
        try
        {
            var scope = await GetUserScope();
            var orgName = await ResolveOrganizationName(scope.OrganisationId);
            var rows = await BuildQuizAttemptRowsInternal(
                scope, null, null, null, null, null, null, latestOnly: false);
            var answers = await FetchQuizAnswerAnalyticsAsync(scope.OrganisationId);
            return Ok(BuildQuizAnalyticsPayload(orgName, rows, answers, _quizFeatures.IsCriticalSafetyEnabled));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating quiz attempts analytics");
            return StatusCode(500, new { error = "Failed to generate quiz attempts analytics", details = ex.Message });
        }
    }

    private sealed class AssessmentDifficultyOverviewRow
    {
        public string QuizId { get; set; } = string.Empty;
        public string QuizTitle { get; set; } = string.Empty;
        public string CourseId { get; set; } = string.Empty;
        public string CourseTitle { get; set; } = string.Empty;
        public string? CourseCategory { get; set; }
        public int QuestionCount { get; set; }
        public int AttemptCount { get; set; }
        public int CompletionCount { get; set; }
        public int PassedCount { get; set; }
        public int FailedCount { get; set; }
        public int CriticalFailCount { get; set; }
        public int UniqueLearners { get; set; }
        public double PassRate { get; set; }
        public double FailRate { get; set; }
        public double AverageScore { get; set; }
    }

    private async Task<(List<AssessmentDifficultyOverviewRow> Rows, int GlobalUniqueLearners)> BuildAssessmentDifficultyOverviewRowsAsync(
        AdminUserScope scope,
        string? search)
    {
        var quizzesQuery =
            from quiz in _context.Quizzes.AsNoTracking()
            join course in _context.Courses.AsNoTracking() on quiz.CourseId equals course.Id
            where !quiz.IsQuestionBank
                && quiz.CourseId != null
                && !course.IsDeleted
            select new { quiz, course };

        if (scope.OrganisationId.HasValue)
        {
            var orgId = scope.OrganisationId.Value;
            quizzesQuery = quizzesQuery.Where(x =>
                x.course.OrganisationId == orgId );
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            quizzesQuery = quizzesQuery.Where(x =>
                x.quiz.Title.ToLower().Contains(term)
                || x.course.Title.ToLower().Contains(term)
                || (x.course.Category != null && x.course.Category.ToLower().Contains(term)));
        }

        var quizzes = await quizzesQuery
            .OrderBy(x => x.course.Title)
            .ThenBy(x => x.quiz.Title)
            .Select(x => new
            {
                QuizId = x.quiz.Id,
                QuizTitle = x.quiz.Title,
                CourseId = x.course.Id,
                CourseTitle = x.course.Title,
                x.course.Category,
                QuestionCount = x.quiz.Questions.Count
            })
            .ToListAsync();

        if (quizzes.Count == 0)
            return (new List<AssessmentDifficultyOverviewRow>(), 0);

        var attemptRows = await BuildQuizAttemptRowsInternal(
            scope, null, null, null, null, null, null, latestOnly: false);
        var globalUniqueLearners = attemptRows.Select(r => r.UserId).Distinct().Count();
        var attemptsByQuiz = attemptRows
            .GroupBy(r => r.QuizId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var enableCriticalSafety = _quizFeatures.IsCriticalSafetyEnabled;

        var overviewRows = quizzes.Select(q =>
        {
            attemptsByQuiz.TryGetValue(q.QuizId, out var attempts);
            attempts ??= new List<QuizAttemptReportRow>();

            var attemptCount = attempts.Count;
            var passedCount = attempts.Count(r => r.Passed);
            var criticalFailCount = enableCriticalSafety
                ? attempts.Count(r => r.FailedCriticalSafety)
                : 0;
            var failedCount = enableCriticalSafety
                ? attempts.Count(r => !r.Passed && !r.FailedCriticalSafety)
                : attempts.Count(r => !r.Passed);
            var passRate = attemptCount > 0
                ? Math.Round(passedCount / (double)attemptCount * 100, 1)
                : 0;
            var failRate = attemptCount > 0
                ? Math.Round(100 - passRate, 1)
                : 0;
            var averageScore = attemptCount > 0
                ? Math.Round(attempts.Average(r => r.ScorePercent), 1)
                : 0;

            return new AssessmentDifficultyOverviewRow
            {
                QuizId = q.QuizId,
                QuizTitle = q.QuizTitle,
                CourseId = q.CourseId,
                CourseTitle = q.CourseTitle,
                CourseCategory = q.Category,
                QuestionCount = q.QuestionCount,
                AttemptCount = attemptCount,
                CompletionCount = attemptCount,
                PassedCount = passedCount,
                FailedCount = failedCount,
                CriticalFailCount = criticalFailCount,
                UniqueLearners = attempts.Select(r => r.UserId).Distinct().Count(),
                PassRate = passRate,
                FailRate = failRate,
                AverageScore = averageScore
            };
        }).ToList();

        return (overviewRows, globalUniqueLearners);
    }

    [HttpGet("quiz-attempts/assessment-difficulty/overview")]
    public async Task<IActionResult> GetAssessmentDifficultyOverview(
        [FromQuery] string? search,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? sortBy = "quizTitle",
        [FromQuery] string? sortDirection = "asc")
    {
        try
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var scope = await GetUserScope();
            var (rows, globalUniqueLearners) = await BuildAssessmentDifficultyOverviewRowsAsync(scope, search);
            var enableCriticalSafety = _quizFeatures.IsCriticalSafetyEnabled;

            var descending = string.Equals(sortDirection, "desc", StringComparison.OrdinalIgnoreCase);
            var sorted = (sortBy ?? "quizTitle").Trim().ToLowerInvariant() switch
            {
                "course" or "coursetitle" => descending
                    ? rows.OrderByDescending(r => r.CourseTitle).ThenBy(r => r.QuizTitle)
                    : rows.OrderBy(r => r.CourseTitle).ThenBy(r => r.QuizTitle),
                "attempts" or "attemptcount" => descending
                    ? rows.OrderByDescending(r => r.AttemptCount).ThenBy(r => r.QuizTitle)
                    : rows.OrderBy(r => r.AttemptCount).ThenBy(r => r.QuizTitle),
                "completions" or "completioncount" => descending
                    ? rows.OrderByDescending(r => r.CompletionCount).ThenBy(r => r.QuizTitle)
                    : rows.OrderBy(r => r.CompletionCount).ThenBy(r => r.QuizTitle),
                "passed" or "passedcount" => descending
                    ? rows.OrderByDescending(r => r.PassedCount).ThenBy(r => r.QuizTitle)
                    : rows.OrderBy(r => r.PassedCount).ThenBy(r => r.QuizTitle),
                "failed" or "failedcount" => descending
                    ? rows.OrderByDescending(r => r.FailedCount).ThenBy(r => r.QuizTitle)
                    : rows.OrderBy(r => r.FailedCount).ThenBy(r => r.QuizTitle),
                "passrate" => descending
                    ? rows.OrderByDescending(r => r.PassRate).ThenBy(r => r.QuizTitle)
                    : rows.OrderBy(r => r.PassRate).ThenBy(r => r.QuizTitle),
                "failrate" => descending
                    ? rows.OrderByDescending(r => r.FailRate).ThenBy(r => r.QuizTitle)
                    : rows.OrderBy(r => r.FailRate).ThenBy(r => r.QuizTitle),
                "averagescore" or "avgscore" => descending
                    ? rows.OrderByDescending(r => r.AverageScore).ThenBy(r => r.QuizTitle)
                    : rows.OrderBy(r => r.AverageScore).ThenBy(r => r.QuizTitle),
                "learners" or "uniquelearners" => descending
                    ? rows.OrderByDescending(r => r.UniqueLearners).ThenBy(r => r.QuizTitle)
                    : rows.OrderBy(r => r.UniqueLearners).ThenBy(r => r.QuizTitle),
                _ => descending
                    ? rows.OrderByDescending(r => r.QuizTitle).ThenBy(r => r.CourseTitle)
                    : rows.OrderBy(r => r.QuizTitle).ThenBy(r => r.CourseTitle)
            };

            var materialized = sorted.ToList();
            var totalRows = materialized.Count;
            var totalPages = totalRows == 0 ? 1 : (int)Math.Ceiling(totalRows / (double)pageSize);
            var paged = materialized.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();

            var summary = new
            {
                totalAssessments = totalRows,
                assessmentsWithAttempts = materialized.Count(r => r.AttemptCount > 0),
                totalAttempts = materialized.Sum(r => r.AttemptCount),
                totalCompletions = materialized.Sum(r => r.CompletionCount),
                totalPassed = materialized.Sum(r => r.PassedCount),
                totalFailed = materialized.Sum(r => r.FailedCount),
                criticalFailCount = enableCriticalSafety
                    ? materialized.Sum(r => r.CriticalFailCount)
                    : (int?)null,
                uniqueLearners = globalUniqueLearners,
                averagePassRate = materialized.Any(r => r.AttemptCount > 0)
                    ? Math.Round(
                        materialized.Where(r => r.AttemptCount > 0).Average(r => r.PassRate),
                        1)
                    : 0
            };

            return Ok(new
            {
                organization = await ResolveOrganizationName(scope.OrganisationId),
                generatedAt = DateTime.UtcNow,
                summary,
                items = paged.Select(r => new
                {
                    quizId = r.QuizId,
                    quizTitle = r.QuizTitle,
                    courseId = r.CourseId,
                    courseTitle = r.CourseTitle,
                    courseCategory = r.CourseCategory,
                    questionCount = r.QuestionCount,
                    attemptCount = r.AttemptCount,
                    completionCount = r.CompletionCount,
                    passedCount = r.PassedCount,
                    failedCount = r.FailedCount,
                    criticalFailCount = enableCriticalSafety ? r.CriticalFailCount : (int?)null,
                    uniqueLearners = r.UniqueLearners,
                    passRate = r.PassRate,
                    failRate = r.FailRate,
                    averageScore = r.AverageScore
                }),
                pagination = new
                {
                    pageNumber,
                    pageSize,
                    totalItems = totalRows,
                    totalPages,
                    hasPreviousPage = pageNumber > 1,
                    hasNextPage = pageNumber < totalPages
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating assessment difficulty overview");
            return StatusCode(500, new { error = "Failed to generate assessment difficulty overview", details = ex.Message });
        }
    }

    private sealed class QuizQuestionOptionIncorrectCountRow
    {
        public long OptionId { get; set; }
        public string Text { get; set; } = string.Empty;
        public int Count { get; set; }
    }

    private sealed class QuizQuestionAnswerStatsRow
    {
        public long QuizQuestionId { get; set; }
        public long? QuestionBankQuestionId { get; set; }
        public bool IsCorrect { get; set; }
        public long? SelectedOptionId { get; set; }
        public string? SelectedOptionIdsJson { get; set; }
        public string? SelectedQuestionBankOptionIdsJson { get; set; }
    }

    private sealed class QuizQuestionCountStats
    {
        public int PresentedCount { get; set; }
        public int CorrectCount { get; set; }
        public int IncorrectCount { get; set; }
        public List<QuizQuestionOptionIncorrectCountRow> IncorrectOptionCounts { get; set; } = new();
    }

    private sealed class QuizQuestionStatsRow
    {
        public long QuestionId { get; set; }
        public string QuestionText { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public bool IsCriticalSafety { get; set; }
        public string Type { get; set; } = string.Empty;
        public QuizQuestionCountStats Organisation { get; set; } = new();
        public QuizQuestionCountStats Global { get; set; } = new();
    }

    private static List<long> ParseQuizAnswerOptionIdList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<long>();
        try
        {
            var ids = JsonSerializer.Deserialize<List<long>>(json);
            return ids ?? new List<long>();
        }
        catch
        {
            return new List<long>();
        }
    }

    private async Task<List<QuizQuestionAnswerStatsRow>> FetchQuizQuestionAnswerStatsAsync(
        string quizId,
        IReadOnlySet<long> questionIdSet,
        long? orgId)
    {
        var answerQuery =
            from aa in _context.QuizAttemptAnswers.AsNoTracking()
            join att in _context.QuizAttempts.AsNoTracking() on aa.QuizAttemptId equals att.Id
            join attemptUser in _context.Users.AsNoTracking() on att.UserId equals attemptUser.Id
            where att.IsCompleted
                && att.QuizId == quizId
                && questionIdSet.Contains(aa.QuizQuestionId)
                && (orgId == null || attemptUser.OrganisationID == orgId.Value)
            select new QuizQuestionAnswerStatsRow
            {
                QuizQuestionId = aa.QuizQuestionId,
                QuestionBankQuestionId = aa.QuestionBankQuestionId,
                IsCorrect = aa.IsCorrect,
                SelectedOptionId = aa.SelectedOptionId,
                SelectedOptionIdsJson = aa.SelectedOptionIdsJson,
                SelectedQuestionBankOptionIdsJson = aa.SelectedQuestionBankOptionIdsJson
            };

        return await answerQuery.ToListAsync();
    }

    private async Task<Dictionary<long, QuestionBankQuestionStatsGlobal>> FetchGlobalBankQuestionStatsAsync(
        IReadOnlyCollection<long> bankQuestionIds)
    {
        if (bankQuestionIds.Count == 0)
            return new Dictionary<long, QuestionBankQuestionStatsGlobal>();

        return await _context.QuestionBankQuestionStatsGlobal.AsNoTracking()
            .Where(s => bankQuestionIds.Contains(s.QuestionBankQuestionId))
            .ToDictionaryAsync(s => s.QuestionBankQuestionId);
    }

    private async Task<List<QuizQuestionAnswerStatsRow>> FetchGlobalBankQuestionAnswersAsync(
        IReadOnlyCollection<long> bankQuestionIds)
    {
        if (bankQuestionIds.Count == 0)
            return new List<QuizQuestionAnswerStatsRow>();

        return await (
            from aa in _context.QuizAttemptAnswers.AsNoTracking()
            join att in _context.QuizAttempts.AsNoTracking() on aa.QuizAttemptId equals att.Id
            where att.IsCompleted
                && aa.QuestionBankQuestionId != null
                && bankQuestionIds.Contains(aa.QuestionBankQuestionId.Value)
            select new QuizQuestionAnswerStatsRow
            {
                QuizQuestionId = aa.QuizQuestionId,
                QuestionBankQuestionId = aa.QuestionBankQuestionId,
                IsCorrect = aa.IsCorrect,
                SelectedOptionId = aa.SelectedOptionId,
                SelectedOptionIdsJson = aa.SelectedOptionIdsJson,
                SelectedQuestionBankOptionIdsJson = aa.SelectedQuestionBankOptionIdsJson
            }).ToListAsync();
    }

    private static QuizQuestionCountStats BuildQuizQuestionCountStats(
        QuizQuestion question,
        IReadOnlyList<QuizQuestionAnswerStatsRow> answers,
        IReadOnlyDictionary<long, QuizQuestionOption> quizOptionByBankId)
    {
        var presented = answers.Count;
        var correct = answers.Count(a => a.IsCorrect);
        var incorrect = presented - correct;

        var incorrectOptionCounts = new Dictionary<long, int>();
        foreach (var answer in answers.Where(x => !x.IsCorrect))
        {
            if (answer.SelectedOptionId.HasValue)
            {
                incorrectOptionCounts[answer.SelectedOptionId.Value] =
                    incorrectOptionCounts.GetValueOrDefault(answer.SelectedOptionId.Value, 0) + 1;
                continue;
            }

            var optionIds = ParseQuizAnswerOptionIdList(answer.SelectedOptionIdsJson);
            if (optionIds.Count > 0)
            {
                foreach (var id in optionIds)
                    incorrectOptionCounts[id] = incorrectOptionCounts.GetValueOrDefault(id, 0) + 1;
                continue;
            }

            var bankIds = ParseQuizAnswerOptionIdList(answer.SelectedQuestionBankOptionIdsJson);
            foreach (var bankId in bankIds)
            {
                if (!quizOptionByBankId.TryGetValue(bankId, out var opt)) continue;
                incorrectOptionCounts[opt.Id] = incorrectOptionCounts.GetValueOrDefault(opt.Id, 0) + 1;
            }
        }

        var optionRows = question.Options
            .OrderBy(o => o.Order)
            .Select(o => new QuizQuestionOptionIncorrectCountRow
            {
                OptionId = o.Id,
                Text = o.Text,
                Count = incorrectOptionCounts.GetValueOrDefault(o.Id, 0)
            })
            .Where(r => r.Count > 0)
            .OrderByDescending(r => r.Count)
            .ToList();

        return new QuizQuestionCountStats
        {
            PresentedCount = presented,
            CorrectCount = correct,
            IncorrectCount = incorrect,
            IncorrectOptionCounts = optionRows
        };
    }

    private static QuizQuestionCountStats BuildGlobalQuizQuestionCountStats(
        QuizQuestion question,
        IReadOnlyList<QuizQuestionAnswerStatsRow> globalQuizAnswers,
        IReadOnlyDictionary<long, QuestionBankQuestionStatsGlobal> globalBankStats,
        IReadOnlyList<QuizQuestionAnswerStatsRow> globalBankAnswers,
        IReadOnlyDictionary<long, QuizQuestionOption> quizOptionByBankId)
    {
        if (question.QuestionBankQuestionId.HasValue)
        {
            var bankAnswers = globalBankAnswers
                .Where(a => a.QuestionBankQuestionId == question.QuestionBankQuestionId.Value)
                .ToList();

            if (globalBankStats.TryGetValue(question.QuestionBankQuestionId.Value, out var bankStats)
                && bankStats.PresentedCount > 0)
            {
                return new QuizQuestionCountStats
                {
                    PresentedCount = (int)bankStats.PresentedCount,
                    CorrectCount = (int)bankStats.CorrectCount,
                    IncorrectCount = (int)bankStats.IncorrectCount,
                    IncorrectOptionCounts = BuildQuizQuestionCountStats(
                        question,
                        bankAnswers,
                        quizOptionByBankId).IncorrectOptionCounts
                };
            }

            if (bankAnswers.Count > 0)
                return BuildQuizQuestionCountStats(question, bankAnswers, quizOptionByBankId);
        }

        var quizScopedAnswers = globalQuizAnswers.Where(a => a.QuizQuestionId == question.Id).ToList();
        return BuildQuizQuestionCountStats(question, quizScopedAnswers, quizOptionByBankId);
    }

    private static object MapQuizQuestionCountStatsDto(QuizQuestionCountStats stats) => new
    {
        presentedCount = stats.PresentedCount,
        correctCount = stats.CorrectCount,
        incorrectCount = stats.IncorrectCount,
        incorrectOptionCounts = stats.IncorrectOptionCounts.Select(o => new
        {
            optionId = o.OptionId,
            text = o.Text,
            count = o.Count
        }).ToList()
    };

    private object MapQuizQuestionStatsDto(QuizQuestionStatsRow row) => new
    {
        questionId = row.QuestionId,
        questionText = row.QuestionText,
        category = row.Category,
        isCriticalSafety = _quizFeatures.ResolveCriticalSafety(row.IsCriticalSafety),
        type = row.Type,
        organisation = MapQuizQuestionCountStatsDto(row.Organisation),
        global = MapQuizQuestionCountStatsDto(row.Global)
    };

    private static List<QuizQuestionStatsRow> BuildQuizQuestionStatsRows(
        IEnumerable<QuizQuestion> questions,
        IReadOnlyList<QuizQuestionAnswerStatsRow> organisationAnswers,
        IReadOnlyList<QuizQuestionAnswerStatsRow> globalQuizAnswers,
        IReadOnlyDictionary<long, QuestionBankQuestionStatsGlobal> globalBankStats,
        IReadOnlyList<QuizQuestionAnswerStatsRow> globalBankAnswers,
        IReadOnlyDictionary<long, QuizQuestionOption> quizOptionByBankId)
    {
        return questions
            .OrderBy(q => q.Order)
            .Select(q =>
            {
                var orgQuestionAnswers = organisationAnswers.Where(a => a.QuizQuestionId == q.Id).ToList();

                return new QuizQuestionStatsRow
                {
                    QuestionId = q.Id,
                    QuestionText = q.Question,
                    Category = string.IsNullOrWhiteSpace(q.Category) ? "Uncategorized" : q.Category,
                    IsCriticalSafety = q.IsCriticalSafety,
                    Type = q.Type,
                    Organisation = BuildQuizQuestionCountStats(q, orgQuestionAnswers, quizOptionByBankId),
                    Global = BuildGlobalQuizQuestionCountStats(
                        q,
                        globalQuizAnswers,
                        globalBankStats,
                        globalBankAnswers,
                        quizOptionByBankId)
                };
            })
            .ToList();
    }

    [HttpGet("quiz-attempts/quizzes/{quizId}/question-stats")]
    public async Task<IActionResult> GetQuizQuestionStats([FromRoute] string quizId)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(quizId))
                return BadRequest(new { error = "quizId is required" });

            var orgId = await GetOrgIdFilter();
            var orgName = await ResolveOrganizationName(orgId);

            // Load quiz + questions + options for mapping option text.
            var quiz = await _context.Quizzes.AsNoTracking()
                .Include(q => q.Course)
                .Include(q => q.Questions)
                    .ThenInclude(qq => qq.Options)
                .FirstOrDefaultAsync(q => q.Id == quizId);

            if (quiz == null)
                return NotFound(new { error = "Assessment not found" });

            if (orgId.HasValue && quiz.CourseId != null && quiz.Course != null)
            {
                var viewerOrgId = (await GetUserScope()).OrganisationId;
                var role = User.FindFirstValue(ClaimTypes.Role);
                if (!OrganisationContentAccess.CanViewCourse(
                        quiz.Course.OrganisationId,
                        role,
                        viewerOrgId))
                    return Forbid();
            }

            var questionIdSet = quiz.Questions.Select(q => q.Id).ToHashSet();
            if (questionIdSet.Count == 0)
            {
                return Ok(new
                {
                    quizId = quiz.Id,
                    quizTitle = quiz.Title,
                    courseName = quiz.Course?.Title ?? string.Empty,
                    organization = orgName,
                    generatedAt = DateTime.UtcNow,
                    questions = Array.Empty<object>()
                });
            }

            var globalQuizAnswers = await FetchQuizQuestionAnswerStatsAsync(quizId, questionIdSet, orgId: null);
            var organisationAnswers = orgId.HasValue
                ? await FetchQuizQuestionAnswerStatsAsync(quizId, questionIdSet, orgId)
                : globalQuizAnswers;

            var bankQuestionIds = quiz.Questions
                .Where(q => q.QuestionBankQuestionId.HasValue)
                .Select(q => q.QuestionBankQuestionId!.Value)
                .Distinct()
                .ToList();
            var globalBankStats = await FetchGlobalBankQuestionStatsAsync(bankQuestionIds);
            var globalBankAnswers = await FetchGlobalBankQuestionAnswersAsync(bankQuestionIds);

            var quizOptionByBankId = quiz.Questions
                .SelectMany(q => q.Options)
                .Where(o => o.QuestionBankQuestionOptionId.HasValue)
                .GroupBy(o => o.QuestionBankQuestionOptionId!.Value)
                .ToDictionary(g => g.Key, g => g.First());

            var stats = BuildQuizQuestionStatsRows(
                quiz.Questions,
                organisationAnswers,
                globalQuizAnswers,
                globalBankStats,
                globalBankAnswers,
                quizOptionByBankId);

            return Ok(new
            {
                quizId = quiz.Id,
                quizTitle = quiz.Title,
                courseName = quiz.Course?.Title ?? string.Empty,
                organization = orgName,
                generatedAt = DateTime.UtcNow,
                questions = stats.Select(MapQuizQuestionStatsDto).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating quiz question stats for quiz {QuizId}", quizId);
            return StatusCode(500, new { error = "Failed to generate quiz question stats", details = ex.Message });
        }
    }

    [HttpGet("quiz-attempts/summary")]
    public Task<IActionResult> GetQuizAttemptsSummary() => GetQuizAttemptsAnalytics();

    [HttpGet("quiz-attempts/record-scopes")]
    public async Task<IActionResult> GetQuizAttemptRecordScopes()
    {
        try
        {
            var scope = await GetUserScope();
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
            return Ok(await GetQuizRecordScopeCountsAsync(scope, userId));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating quiz attempt record scope counts");
            return StatusCode(500, new { error = "Failed to generate quiz attempt record scope counts", details = ex.Message });
        }
    }

    [HttpGet("quiz-attempts")]
    public async Task<IActionResult> GetQuizAttempts(
        [FromQuery] string? courseId,
        [FromQuery] string? quizId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? search,
        [FromQuery] string? passStatus,
        [FromQuery] string? recordScope,
        [FromQuery] bool includeScopeCounts = false,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? sortBy = "completedAt",
        [FromQuery] string? sortDirection = "desc")
    {
        try
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);

            var scope = await GetUserScope();
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
            var scopeStart = await ResolveQuizRecordScopeStartDateAsync(recordScope, userId);
            var effectiveStart = MergeQuizAttemptStartDates(scopeStart, startDate);

            var rows = await BuildQuizAttemptRowsInternal(
                scope, courseId, quizId, effectiveStart, endDate, search, passStatus, latestOnly: true);

            var sorted = ApplyQuizAttemptSort(rows, sortBy ?? "completedAt", sortDirection ?? "desc").ToList();
            var totalRows = sorted.Count;
            var totalPages = totalRows == 0 ? 1 : (int)Math.Ceiling(totalRows / (double)pageSize);
            var paged = sorted.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();

            object? scopeCounts = null;
            if (includeScopeCounts)
                scopeCounts = await GetQuizRecordScopeCountsAsync(scope, userId);

            return Ok(new
            {
                attempts = paged,
                pagination = new
                {
                    pageNumber,
                    pageSize,
                    totalAttempts = totalRows,
                    totalPages,
                    hasPreviousPage = pageNumber > 1,
                    hasNextPage = pageNumber < totalPages
                },
                scopeCounts
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating quiz attempts list");
            return StatusCode(500, new { error = "Failed to generate quiz attempts list", details = ex.Message });
        }
    }

    [HttpGet("quiz-attempts/history")]
    public async Task<IActionResult> GetQuizAttemptHistory(
        [FromQuery] string userId,
        [FromQuery] string quizId)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(quizId))
                return BadRequest(new { error = "userId and quizId are required" });

            var scope = await GetUserScope();
            var attempts = await FetchQuizAttemptsAsync(scope, null, quizId, null, null, null, null, latestOnly: false);
            attempts = attempts.Where(a => a.UserId == userId).ToList();

            if (attempts.Count == 0)
                return Ok(new { attempts = Array.Empty<object>() });

            var attemptNumberMap = await BuildAttemptNumberMapAsync(attempts);
            var rows = MapQuizAttemptRows(attempts, attemptNumberMap)
                .OrderByDescending(r => r.CompletedAt)
                .ToList();

            var latestId = rows.OrderByDescending(r => r.CompletedAt).ThenByDescending(r => r.AttemptId).First().AttemptId;

            return Ok(new
            {
                attempts = rows.Select(r => new
                {
                    r.AttemptId,
                    r.AttemptNumber,
                    r.ScorePercent,
                    r.Passed,
                    r.FailedCriticalSafety,
                    r.DurationSeconds,
                    r.CompletedAt,
                    isLatest = r.AttemptId == latestId
                })
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating quiz attempt history for user {UserId} quiz {QuizId}", userId, quizId);
            return StatusCode(500, new { error = "Failed to generate quiz attempt history", details = ex.Message });
        }
    }

    [HttpGet("quiz-attempts/{attemptId:long}")]
    public async Task<IActionResult> GetQuizAttemptDetail(long attemptId)
    {
        try
        {
            var scope = await GetUserScope();

            var attempt = await _context.QuizAttempts.AsNoTracking()
                .AsSplitQuery()
                .Include(a => a.User)
                .Include(a => a.Quiz!)
                    .ThenInclude(q => q!.Course)
                .Include(a => a.AttemptQuestions)
                .Include(a => a.Answers)
                .FirstOrDefaultAsync(a => a.Id == attemptId);

            if (attempt?.Quiz?.Course == null)
                return NotFound(new { error = "Assessment attempt not found" });

            if (scope.OrganisationId.HasValue && attempt.User?.OrganisationID != scope.OrganisationId)
                return Forbid();

            IReadOnlyList<long> questionIds;
            if (attempt.AttemptQuestions.Count > 0)
            {
                questionIds = attempt.AttemptQuestions
                    .OrderBy(aq => aq.DisplayOrder)
                    .Select(aq => aq.QuizQuestionId)
                    .ToList();
            }
            else
            {
                questionIds = await _context.QuizQuestions.AsNoTracking()
                    .Where(q => q.QuizId == attempt.QuizId)
                    .OrderBy(q => q.Order)
                    .Select(q => q.Id)
                    .ToListAsync();
            }

            var completedAttemptIds = await _context.QuizAttempts.AsNoTracking()
                .Where(a => a.QuizId == attempt.QuizId && a.UserId == attempt.UserId && a.IsCompleted)
                .OrderBy(a => a.CompletedAt).ThenBy(a => a.Id)
                .Select(a => a.Id)
                .ToListAsync();

            var questionsLoaded = questionIds.Count == 0
                ? new List<QuizQuestion>()
                : await _context.QuizQuestions.AsNoTracking()
                    .Where(q => questionIds.Contains(q.Id))
                    .Include(q => q.Options)
                    .ToListAsync();

            var attemptNumber = completedAttemptIds.FindIndex(id => id == attemptId) + 1;
            if (attemptNumber <= 0)
                attemptNumber = 1;
            var totalAttempts = completedAttemptIds.Count;

            var questionsById = questionsLoaded.ToDictionary(q => q.Id);
            var questions = attempt.AttemptQuestions.Count > 0
                ? questionIds.Where(questionsById.ContainsKey).Select(id => questionsById[id]).ToList()
                : questionsById.Values.OrderBy(q => q.Order).ToList();

            var answersByQuestionId = attempt.Answers
                .GroupBy(a => a.QuizQuestionId)
                .ToDictionary(g => g.Key, g => g.First());

            var questionDetails = new List<QuizAttemptQuestionDetailDto>(questions.Count);
            foreach (var question in questions)
            {
                answersByQuestionId.TryGetValue(question.Id, out var answer);

                var selectedIds = new List<long>();
                if (answer?.SelectedOptionId != null)
                    selectedIds.Add(answer.SelectedOptionId.Value);
                else if (!string.IsNullOrEmpty(answer?.SelectedOptionIdsJson))
                {
                    try
                    {
                        selectedIds = JsonSerializer.Deserialize<List<long>>(answer.SelectedOptionIdsJson) ?? new List<long>();
                    }
                    catch
                    {
                        selectedIds = new List<long>();
                    }
                }

                HashSet<long>? selectedIdSet = selectedIds.Count > 0 ? selectedIds.ToHashSet() : null;

                var selectedTexts = selectedIdSet == null
                    ? new List<string>()
                    : question.Options
                        .Where(o => selectedIdSet.Contains(o.Id))
                        .OrderBy(o => o.Order)
                        .Select(o => o.Text)
                        .ToList();

                var correctTexts = question.Options
                    .Where(o => o.IsCorrect)
                    .OrderBy(o => o.Order)
                    .Select(o => o.Text)
                    .ToList();

                questionDetails.Add(new QuizAttemptQuestionDetailDto
                {
                    QuestionId = question.Id,
                    Order = question.Order,
                    Question = question.Question,
                    Type = question.Type,
                    Category = string.IsNullOrWhiteSpace(question.Category) ? "Uncategorized" : question.Category,
                    Points = question.Points,
                    IsCriticalSafety = _quizFeatures.ResolveCriticalSafety(question.IsCriticalSafety),
                    Explanation = question.Explanation,
                    IsCorrect = answer?.IsCorrect ?? false,
                    WasAnswered = answer != null,
                    SelectedAnswerTexts = selectedTexts,
                    CorrectAnswerTexts = correctTexts,
                    ResponseTimeMs = answer?.ResponseTimeMs ?? 0,
                    ResponseTimeSeconds = Math.Round((answer?.ResponseTimeMs ?? 0) / 1000.0, 1)
                });
            }

            var categories = questionDetails
                .GroupBy(q => q.Category)
                .Select(g =>
                {
                    var items = g.ToList();
                    var total = items.Count;
                    var correct = items.Count(q => q.IsCorrect);
                    var pointsPossible = items.Sum(q => q.Points);
                    var pointsEarned = items.Where(q => q.IsCorrect).Sum(q => q.Points);
                    return new
                    {
                        category = g.Key,
                        questionCount = total,
                        correctCount = correct,
                        percentCorrect = total > 0 ? Math.Round(correct / (double)total * 100, 1) : 0,
                        pointsEarned,
                        pointsPossible
                    };
                })
                .OrderByDescending(c => c.pointsPossible)
                .ToList();

            var earnedPoints = questionDetails.Where(q => q.IsCorrect).Sum(q => q.Points);
            var totalPoints = questionDetails.Sum(q => q.Points);

            return Ok(new
            {
                attempt = new
                {
                    attemptId = attempt.Id,
                    attemptNumber,
                    totalAttempts,
                    userId = attempt.UserId,
                    userName = $"{attempt.User!.FirstName} {attempt.User.LastName}".Trim(),
                    userEmail = attempt.User.Email,
                    courseId = attempt.Quiz.CourseId,
                    courseName = attempt.Quiz.Course.Title,
                    quizId = attempt.QuizId,
                    quizTitle = attempt.Quiz.Title,
                    quizDescription = attempt.Quiz.Description,
                    passingScore = attempt.Quiz.PassingScore,
                    scorePercent = attempt.ScorePercent,
                    earnedPoints,
                    totalPoints,
                    passed = attempt.Passed,
                    failedCriticalSafety = _quizFeatures.IsCriticalSafetyEnabled && attempt.FailedCriticalSafety,
                    durationSeconds = attempt.DurationSeconds,
                    startedAt = attempt.StartedAt,
                    completedAt = attempt.CompletedAt,
                    isTimed = attempt.Quiz.IsTimed,
                    timeLimitMinutes = attempt.Quiz.TimeLimit
                },
                categories,
                questions = questionDetails,
                timing = new
                {
                    averageResponseTimeMs = questionDetails.Any()
                        ? (int)Math.Round(questionDetails.Average(q => q.ResponseTimeMs))
                        : 0,
                    slowestQuestion = questionDetails.OrderByDescending(q => q.ResponseTimeMs).FirstOrDefault(),
                    fastestQuestion = questionDetails.Where(q => q.ResponseTimeMs > 0)
                        .OrderBy(q => q.ResponseTimeMs).FirstOrDefault()
                },
                generatedAt = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating quiz attempt detail for {AttemptId}", attemptId);
            return StatusCode(500, new { error = "Failed to generate quiz attempt detail", details = ex.Message });
        }
    }

    #endregion
}

internal sealed class QuizAttemptQuestionDetailDto
{
    public long QuestionId { get; set; }
    public int Order { get; set; }
    public string Question { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int Points { get; set; }
    public bool IsCriticalSafety { get; set; }
    public string? Explanation { get; set; }
    public bool IsCorrect { get; set; }
    public bool WasAnswered { get; set; }
    public List<string> SelectedAnswerTexts { get; set; } = new();
    public List<string> CorrectAnswerTexts { get; set; } = new();
    public int ResponseTimeMs { get; set; }
    public double ResponseTimeSeconds { get; set; }
}
