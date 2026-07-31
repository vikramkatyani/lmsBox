using lmsBox.Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Controllers;

public partial class AdminReportsController
{
    #region User-Lesson Progress Report

    private sealed class UserLessonProgressReportRow
    {
        public int? ProgressId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string UserName { get; set; } = "Unknown User";
        public string Email { get; set; } = "N/A";
        public string CourseId { get; set; } = string.Empty;
        public string CourseTitle { get; set; } = "Unknown Course";
        public long LessonId { get; set; }
        public string LessonTitle { get; set; } = "Unknown Lesson";
        public string LessonType { get; set; } = "content";
        public string? QuizId { get; set; }
        public int LessonOrdinal { get; set; }
        public int ProgressPercent { get; set; }
        public bool Completed { get; set; }
        public string Status { get; set; } = "Not Started";
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime? LastAccessedAt { get; set; }
        public int TotalTimeSpentSeconds { get; set; }
        public int DaysSinceLastActivity { get; set; }
    }

    private static object BuildUserLessonProgressHeader(
        string orgName,
        string? search,
        string? courseId,
        long? lessonId,
        string? lessonType,
        string? status,
        DateTime? startDate,
        DateTime? endDate,
        int? pageNumber = null,
        int? pageSize = null,
        string? sortBy = null,
        string? sortDirection = null)
    {
        return new
        {
            reportName = "User-Lesson Progress Report",
            generatedAt = DateTime.UtcNow,
            dateRange = startDate.HasValue || endDate.HasValue ? new
            {
                start = startDate,
                end = endDate
            } : null,
            organization = orgName,
            filters = new
            {
                search,
                courseId,
                lessonId,
                lessonType,
                status,
                startDate,
                endDate,
                pageNumber,
                pageSize,
                sortBy,
                sortDirection
            }
        };
    }

    private static (string SortBy, string SortDirection) NormalizeUserLessonProgressSort(string? sortBy, string? sortDirection)
    {
        var normalizedDirection = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase)
            ? "asc"
            : "desc";

        var requested = (sortBy ?? string.Empty).Trim().ToLowerInvariant();
        var normalizedSortBy = requested switch
        {
            "username" => "userName",
            "email" => "email",
            "coursetitle" => "courseTitle",
            "lessontitle" => "lessonTitle",
            "lessontype" => "lessonType",
            "lessonordinal" => "lessonOrdinal",
            "progresspercent" => "progressPercent",
            "status" => "status",
            "startedat" => "startedAt",
            "completedat" => "completedAt",
            "lastaccessedat" => "lastAccessedAt",
            "totaltimespentseconds" => "totalTimeSpentSeconds",
            "dayssincelastactivity" => "daysSinceLastActivity",
            _ => "lastAccessedAt"
        };

        return (normalizedSortBy, normalizedDirection);
    }

    private sealed class UserLessonAssignedCourse
    {
        public string UserId { get; set; } = string.Empty;
        public string CourseId { get; set; } = string.Empty;
    }

    private IQueryable<UserLessonAssignedCourse> BuildUserLessonAssignedCoursesQuery(
        AdminUserScope scope,
        string? courseId)
    {
        // Restrict assignments to scoped users first so pathway/group joins stay org-sized.
        var scopedUserIds = scope.ApplyToUsers(_context.Users.AsNoTracking()).Select(u => u.Id);

        var pathwayAssignments =
            from lpp in _context.LearnerPathwayProgresses.AsNoTracking()
            where scopedUserIds.Contains(lpp.UserId)
            join pc in _context.PathwayCourses.AsNoTracking() on lpp.LearningPathwayId equals pc.LearningPathwayId
            select new UserLessonAssignedCourse { UserId = lpp.UserId, CourseId = pc.CourseId };

        var groupAssignments =
            from lg in _context.LearnerGroups.AsNoTracking()
            where lg.IsActive && scopedUserIds.Contains(lg.UserId)
            join gc in _context.GroupCourses.AsNoTracking() on lg.LearningGroupId equals gc.LearningGroupId
            select new UserLessonAssignedCourse { UserId = lg.UserId, CourseId = gc.CourseId };

        var assigned = pathwayAssignments.Union(groupAssignments);

        if (!string.IsNullOrWhiteSpace(courseId))
        {
            assigned = assigned.Where(x => x.CourseId == courseId);
        }

        return assigned;
    }

    private IQueryable<UserLessonProgressReportRow> BuildUserLessonProgressBaseQuery(
        AdminUserScope scope,
        string? search,
        string? courseId,
        long? lessonId,
        string? lessonType,
        string? status,
        DateTime? startDate,
        DateTime? endDate)
    {
        var normalizedStatus = status?.Trim().ToLowerInvariant();
        var utcNow = DateTime.UtcNow;

        // Completed / In Progress only need existing lesson progress rows (much smaller than
        // assigned-courses × lessons). Not Started / unfiltered still expand assignments.
        var useProgressFirstPath = normalizedStatus is "completed" or "in progress";

        IQueryable<UserLessonProgressReportRow> query;

        if (useProgressFirstPath)
        {
            var assignedUserCourses = BuildUserLessonAssignedCoursesQuery(scope, courseId);

            var progressRows = _context.LearnerProgresses.AsNoTracking()
                .Where(p => p.LessonId != null && p.CourseId != null);

            if (normalizedStatus == "completed")
            {
                progressRows = progressRows.Where(p => p.Completed);
            }
            else
            {
                progressRows = progressRows.Where(p =>
                    !p.Completed && (p.ProgressPercent > 0 || p.StartedAt != null || p.LastAccessedAt != null));
            }

            if (lessonId.HasValue)
            {
                progressRows = progressRows.Where(p => p.LessonId == lessonId.Value);
            }

            query =
                from lp in progressRows
                join ac in assignedUserCourses on new { lp.UserId, CourseId = lp.CourseId! }
                    equals new { ac.UserId, ac.CourseId }
                join u in _context.Users.AsNoTracking() on lp.UserId equals u.Id
                join c in _context.Courses.AsNoTracking() on lp.CourseId equals c.Id
                join l in _context.Lessons.AsNoTracking() on lp.LessonId equals l.Id
                where !c.IsDeleted
                where !scope.OrganisationId.HasValue
                    || (u.OrganisationID == scope.OrganisationId && c.OrganisationId == scope.OrganisationId)
                select new UserLessonProgressReportRow
                {
                    ProgressId = lp.Id,
                    UserId = lp.UserId,
                    UserName = ((u.FirstName ?? string.Empty) + " " + (u.LastName ?? string.Empty)).Trim() == string.Empty
                        ? "Unknown User"
                        : ((u.FirstName ?? string.Empty) + " " + (u.LastName ?? string.Empty)).Trim(),
                    Email = u.Email ?? "N/A",
                    CourseId = c.Id,
                    CourseTitle = c.Title,
                    LessonId = l.Id,
                    LessonTitle = l.Title,
                    LessonType = l.Type ?? "content",
                    QuizId = l.QuizId,
                    LessonOrdinal = l.Ordinal,
                    ProgressPercent = lp.ProgressPercent,
                    Completed = lp.Completed,
                    Status = lp.Completed
                        ? "Completed"
                        : (lp.ProgressPercent > 0 || lp.StartedAt != null || lp.LastAccessedAt != null
                            ? "In Progress"
                            : "Not Started"),
                    StartedAt = lp.StartedAt,
                    CompletedAt = lp.CompletedAt,
                    LastAccessedAt = lp.LastAccessedAt ?? lp.CompletedAt ?? lp.StartedAt,
                    TotalTimeSpentSeconds = lp.TotalTimeSpentSeconds,
                    DaysSinceLastActivity = EF.Functions.DateDiffDay(
                        lp.LastAccessedAt ?? lp.CompletedAt ?? lp.StartedAt ?? l.CreatedAt,
                        utcNow)
                };

            if (!string.IsNullOrWhiteSpace(lessonType))
            {
                var normalizedLessonType = lessonType.Trim().ToLowerInvariant();
                query = query.Where(x => x.LessonType.ToLower() == normalizedLessonType);
            }
        }
        else
        {
            // One row per assigned course lesson (group or pathway), left-joined to any existing progress.
            // Progress rows are created lazily on lesson access, so starting from LearnerProgress alone
            // under-reports Not Started lessons.
            var assignedUserCourses = BuildUserLessonAssignedCoursesQuery(scope, courseId);

            var lessons = _context.Lessons.AsNoTracking().AsQueryable();
            if (lessonId.HasValue)
            {
                lessons = lessons.Where(l => l.Id == lessonId.Value);
            }

            if (!string.IsNullOrWhiteSpace(lessonType))
            {
                var normalizedLessonType = lessonType.Trim().ToLowerInvariant();
                lessons = lessons.Where(l => (l.Type ?? "content").ToLower() == normalizedLessonType);
            }

            query =
                from ac in assignedUserCourses
                join u in _context.Users.AsNoTracking() on ac.UserId equals u.Id
                join c in _context.Courses.AsNoTracking() on ac.CourseId equals c.Id
                join l in lessons on c.Id equals l.CourseId
                where !c.IsDeleted
                where !scope.OrganisationId.HasValue
                    || (u.OrganisationID == scope.OrganisationId && c.OrganisationId == scope.OrganisationId)
                join lp in _context.LearnerProgresses.AsNoTracking()
                        .Where(p => p.LessonId != null && p.CourseId != null)
                    on new { ac.UserId, CourseId = ac.CourseId, LessonId = l.Id }
                    equals new { lp.UserId, CourseId = lp.CourseId!, LessonId = lp.LessonId!.Value }
                    into lpJoin
                from lp in lpJoin.DefaultIfEmpty()
                select new UserLessonProgressReportRow
                {
                    ProgressId = lp != null ? lp.Id : null,
                    UserId = ac.UserId,
                    UserName = ((u.FirstName ?? string.Empty) + " " + (u.LastName ?? string.Empty)).Trim() == string.Empty
                        ? "Unknown User"
                        : ((u.FirstName ?? string.Empty) + " " + (u.LastName ?? string.Empty)).Trim(),
                    Email = u.Email ?? "N/A",
                    CourseId = c.Id,
                    CourseTitle = c.Title,
                    LessonId = l.Id,
                    LessonTitle = l.Title,
                    LessonType = l.Type ?? "content",
                    QuizId = l.QuizId,
                    LessonOrdinal = l.Ordinal,
                    ProgressPercent = lp != null ? lp.ProgressPercent : 0,
                    Completed = lp != null && lp.Completed,
                    Status = lp != null && lp.Completed
                        ? "Completed"
                        : (lp != null && (lp.ProgressPercent > 0 || lp.StartedAt != null || lp.LastAccessedAt != null)
                            ? "In Progress"
                            : "Not Started"),
                    StartedAt = lp != null ? lp.StartedAt : null,
                    CompletedAt = lp != null ? lp.CompletedAt : null,
                    LastAccessedAt = lp != null ? (lp.LastAccessedAt ?? lp.CompletedAt ?? lp.StartedAt) : null,
                    TotalTimeSpentSeconds = lp != null ? lp.TotalTimeSpentSeconds : 0,
                    DaysSinceLastActivity = EF.Functions.DateDiffDay(
                        lp != null
                            ? (lp.LastAccessedAt ?? lp.CompletedAt ?? lp.StartedAt ?? l.CreatedAt)
                            : l.CreatedAt,
                        utcNow)
                };

            if (normalizedStatus == "not started")
            {
                query = query.Where(x =>
                    !x.Completed
                    && x.ProgressPercent == 0
                    && x.StartedAt == null
                    && x.LastAccessedAt == null);
            }
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchTerm = search.Trim();
            query = query.Where(x =>
                x.UserName.Contains(searchTerm) ||
                x.Email.Contains(searchTerm) ||
                x.CourseTitle.Contains(searchTerm) ||
                x.LessonTitle.Contains(searchTerm) ||
                x.LessonType.Contains(searchTerm));
        }

        if (startDate.HasValue && endDate.HasValue)
        {
            query = query.Where(x =>
                !x.Completed
                || (x.CompletedAt.HasValue && x.CompletedAt >= startDate.Value && x.CompletedAt <= endDate.Value));
        }
        else if (startDate.HasValue)
        {
            query = query.Where(x => !x.Completed || (x.CompletedAt.HasValue && x.CompletedAt >= startDate.Value));
        }
        else if (endDate.HasValue)
        {
            query = query.Where(x => !x.Completed || (x.CompletedAt.HasValue && x.CompletedAt <= endDate.Value));
        }

        return query;
    }

    private static IQueryable<UserLessonProgressReportRow> ApplyUserLessonProgressSorting(
        IQueryable<UserLessonProgressReportRow> query,
        string sortBy,
        string sortDirection)
    {
        return (sortBy, sortDirection) switch
        {
            ("userName", "asc") => query.OrderBy(x => x.UserName).ThenBy(x => x.CourseTitle).ThenBy(x => x.LessonOrdinal),
            ("userName", _) => query.OrderByDescending(x => x.UserName).ThenBy(x => x.CourseTitle).ThenBy(x => x.LessonOrdinal),
            ("email", "asc") => query.OrderBy(x => x.Email).ThenBy(x => x.CourseTitle).ThenBy(x => x.LessonOrdinal),
            ("email", _) => query.OrderByDescending(x => x.Email).ThenBy(x => x.CourseTitle).ThenBy(x => x.LessonOrdinal),
            ("courseTitle", "asc") => query.OrderBy(x => x.CourseTitle).ThenBy(x => x.LessonOrdinal).ThenBy(x => x.UserName),
            ("courseTitle", _) => query.OrderByDescending(x => x.CourseTitle).ThenBy(x => x.LessonOrdinal).ThenBy(x => x.UserName),
            ("lessonTitle", "asc") => query.OrderBy(x => x.LessonTitle).ThenBy(x => x.UserName),
            ("lessonTitle", _) => query.OrderByDescending(x => x.LessonTitle).ThenBy(x => x.UserName),
            ("lessonType", "asc") => query.OrderBy(x => x.LessonType).ThenBy(x => x.CourseTitle).ThenBy(x => x.LessonOrdinal),
            ("lessonType", _) => query.OrderByDescending(x => x.LessonType).ThenBy(x => x.CourseTitle).ThenBy(x => x.LessonOrdinal),
            ("lessonOrdinal", "asc") => query.OrderBy(x => x.LessonOrdinal).ThenBy(x => x.CourseTitle).ThenBy(x => x.UserName),
            ("lessonOrdinal", _) => query.OrderByDescending(x => x.LessonOrdinal).ThenBy(x => x.CourseTitle).ThenBy(x => x.UserName),
            ("progressPercent", "asc") => query.OrderBy(x => x.ProgressPercent).ThenBy(x => x.UserName),
            ("progressPercent", _) => query.OrderByDescending(x => x.ProgressPercent).ThenBy(x => x.UserName),
            ("status", "asc") => query.OrderBy(x => x.Status).ThenBy(x => x.UserName),
            ("status", _) => query.OrderByDescending(x => x.Status).ThenBy(x => x.UserName),
            ("startedAt", "asc") => query.OrderBy(x => x.StartedAt).ThenBy(x => x.UserName),
            ("startedAt", _) => query.OrderByDescending(x => x.StartedAt).ThenBy(x => x.UserName),
            ("completedAt", "asc") => query.OrderBy(x => x.CompletedAt).ThenBy(x => x.UserName),
            ("completedAt", _) => query.OrderByDescending(x => x.CompletedAt).ThenBy(x => x.UserName),
            ("totalTimeSpentSeconds", "asc") => query.OrderBy(x => x.TotalTimeSpentSeconds).ThenBy(x => x.UserName),
            ("totalTimeSpentSeconds", _) => query.OrderByDescending(x => x.TotalTimeSpentSeconds).ThenBy(x => x.UserName),
            ("daysSinceLastActivity", "asc") => query.OrderBy(x => x.DaysSinceLastActivity).ThenBy(x => x.UserName),
            ("daysSinceLastActivity", _) => query.OrderByDescending(x => x.DaysSinceLastActivity).ThenBy(x => x.UserName),
            ("lastAccessedAt", "asc") => query.OrderBy(x => x.LastAccessedAt).ThenBy(x => x.UserName),
            _ => query.OrderByDescending(x => x.LastAccessedAt).ThenBy(x => x.UserName)
        };
    }

    [HttpGet("user-lesson-progress/summary")]
    public async Task<IActionResult> GetUserLessonProgressSummary(
        [FromQuery] string? search,
        [FromQuery] string? courseId,
        [FromQuery] long? lessonId,
        [FromQuery] string? lessonType,
        [FromQuery] string? status,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        try
        {
            var scope = await GetUserScope();
            var orgId = scope.OrganisationId;
            var orgName = await ResolveOrganizationName(orgId);

            var baseQuery = BuildUserLessonProgressBaseQuery(scope, search, courseId, lessonId, lessonType, status, startDate, endDate);

            // Single pass for card metrics instead of many Count/Average/Sum round-trips.
            var summaryAggregate = await baseQuery
                .GroupBy(_ => 1)
                .Select(g => new
                {
                    totalRecords = g.Count(),
                    totalCompleted = g.Count(x => x.Completed),
                    totalInProgress = g.Count(x => !x.Completed && x.Status == "In Progress"),
                    totalNotStarted = g.Count(x => x.Status == "Not Started"),
                    averageProgressPercent = Math.Round(g.Average(x => (double)x.ProgressPercent), 2),
                    totalTimeSpentSeconds = g.Sum(x => (long)x.TotalTimeSpentSeconds)
                })
                .FirstOrDefaultAsync();

            var totalRecords = summaryAggregate?.totalRecords ?? 0;
            var totalCompleted = summaryAggregate?.totalCompleted ?? 0;
            var totalInProgress = summaryAggregate?.totalInProgress ?? 0;
            var totalNotStarted = summaryAggregate?.totalNotStarted ?? 0;
            var averageProgressPercent = totalRecords > 0 ? (summaryAggregate?.averageProgressPercent ?? 0) : 0;
            var totalTimeSpentSeconds = summaryAggregate?.totalTimeSpentSeconds ?? 0;
            var overallCompletionRate = totalRecords > 0
                ? Math.Round((totalCompleted / (double)totalRecords) * 100, 2)
                : 0;

            var activeUsers = totalRecords == 0
                ? 0
                : await baseQuery.Select(x => x.UserId).Distinct().CountAsync();

            var statusBreakdown = new List<object>
            {
                new { status = "Completed", count = totalCompleted, percentage = totalRecords > 0 ? Math.Round((totalCompleted / (double)totalRecords) * 100, 2) : 0 },
                new { status = "In Progress", count = totalInProgress, percentage = totalRecords > 0 ? Math.Round((totalInProgress / (double)totalRecords) * 100, 2) : 0 },
                new { status = "Not Started", count = totalNotStarted, percentage = totalRecords > 0 ? Math.Round((totalNotStarted / (double)totalRecords) * 100, 2) : 0 }
            };

            var lessonTypeBreakdown = totalRecords == 0
                ? new List<object>()
                : (await baseQuery
                    .GroupBy(x => x.LessonType)
                    .Select(g => new
                    {
                        lessonType = g.Key,
                        count = g.Count(),
                        completed = g.Count(x => x.Completed),
                        averageProgress = Math.Round(g.Average(x => (double)x.ProgressPercent), 2)
                    })
                    .OrderByDescending(x => x.count)
                    .ToListAsync())
                    .Cast<object>()
                    .ToList();

            var courseStats = totalRecords == 0
                ? new List<object>()
                : (await baseQuery
                    .GroupBy(x => new { x.CourseId, x.CourseTitle })
                    .Select(g => new
                    {
                        courseId = g.Key.CourseId,
                        courseTitle = g.Key.CourseTitle,
                        totalRecords = g.Count(),
                        completed = g.Count(x => x.Completed),
                        inProgress = g.Count(x => !x.Completed && x.Status == "In Progress"),
                        notStarted = g.Count(x => x.Status == "Not Started"),
                        averageProgress = Math.Round(g.Average(x => (double)x.ProgressPercent), 2),
                        completionRate = g.Count() > 0
                            ? Math.Round((g.Count(x => x.Completed) / (double)g.Count()) * 100, 2)
                            : 0
                    })
                    .OrderByDescending(x => x.totalRecords)
                    .Take(10)
                    .ToListAsync())
                    .Cast<object>()
                    .ToList();

            var totalCoursesQuery = _context.Courses.AsNoTracking().Where(c => !c.IsDeleted);
            if (orgId.HasValue)
                totalCoursesQuery = totalCoursesQuery.Where(c => c.OrganisationId == orgId);

            var courseOptions = await totalCoursesQuery
                .Select(c => new { id = c.Id, title = c.Title })
                .OrderBy(c => c.title)
                .ToListAsync();

            var lessonTypeOptions = await _context.Lessons.AsNoTracking()
                .Select(l => l.Type ?? "content")
                .Distinct()
                .OrderBy(t => t)
                .ToListAsync();

            var summary = new
            {
                totalRecords,
                totalCompleted,
                totalInProgress,
                totalNotStarted,
                averageProgressPercent,
                overallCompletionRate,
                activeUsers,
                totalTimeSpentSeconds
            };

            var header = BuildUserLessonProgressHeader(orgName, search, courseId, lessonId, lessonType, status, startDate, endDate);

            return Ok(new
            {
                header,
                summary,
                statusBreakdown,
                lessonTypeBreakdown,
                courseStats,
                courseOptions,
                lessonTypeOptions
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating user-lesson progress summary");
            return StatusCode(500, new { error = "Failed to generate user-lesson progress summary", details = ex.Message });
        }
    }

    [HttpGet("user-lesson-progress/records")]
    public async Task<IActionResult> GetUserLessonProgressRecords(
        [FromQuery] string? search,
        [FromQuery] string? courseId,
        [FromQuery] long? lessonId,
        [FromQuery] string? lessonType,
        [FromQuery] string? status,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDirection = null)
    {
        try
        {
            var scope = await GetUserScope();
            var orgName = await ResolveOrganizationName(scope.OrganisationId);

            pageNumber = Math.Max(1, pageNumber);
            pageSize = Math.Clamp(pageSize, 1, 500);

            var normalizedSort = NormalizeUserLessonProgressSort(sortBy, sortDirection);
            var baseQuery = BuildUserLessonProgressBaseQuery(scope, search, courseId, lessonId, lessonType, status, startDate, endDate);

            // Count without ORDER BY — sorting only the page is cheaper.
            var totalRows = await baseQuery.CountAsync();
            var totalPages = totalRows == 0 ? 1 : (int)Math.Ceiling(totalRows / (double)pageSize);
            if (pageNumber > totalPages)
            {
                pageNumber = totalPages;
            }

            var sortedQuery = ApplyUserLessonProgressSorting(baseQuery, normalizedSort.SortBy, normalizedSort.SortDirection);
            var rows = totalRows == 0
                ? new List<UserLessonProgressReportRow>()
                : await sortedQuery
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

            var header = BuildUserLessonProgressHeader(
                orgName,
                search,
                courseId,
                lessonId,
                lessonType,
                status,
                startDate,
                endDate,
                pageNumber,
                pageSize,
                normalizedSort.SortBy,
                normalizedSort.SortDirection);

            var pagination = new
            {
                pageNumber,
                pageSize,
                totalRows,
                totalPages,
                hasPreviousPage = pageNumber > 1,
                hasNextPage = pageNumber < totalPages
            };

            return Ok(new
            {
                header,
                records = rows,
                pagination
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating user-lesson progress records");
            return StatusCode(500, new { error = "Failed to generate user-lesson progress records", details = ex.Message });
        }
    }

    #endregion
}
