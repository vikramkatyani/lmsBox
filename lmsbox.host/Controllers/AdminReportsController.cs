using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/admin/reports")]
[Authorize(Roles = "Admin,OrgAdmin,SuperAdmin")]
public partial class AdminReportsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminReportsController> _logger;
    private readonly IMemoryCache _cache;
    private readonly IQuizFeatureService _quizFeatures;

    public AdminReportsController(
        ApplicationDbContext context,
        ILogger<AdminReportsController> logger,
        IMemoryCache cache,
        IQuizFeatureService quizFeatures)
    {
        _context = context;
        _logger = logger;
        _cache = cache;
        _quizFeatures = quizFeatures;
    }

    private Task<AdminUserScope> GetUserScope() =>
        AdminUserScope.ResolveAsync(User, _context);

    // Helper to get org filter
    private async Task<long?> GetOrgIdFilter()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        
        if (User.IsInRole("OrgAdmin") && user != null)
            return user.OrganisationID;
        
        return null;
    }

    #region User Activity Report

    private sealed class UserActivityReportRow
    {
        public string UserId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedOn { get; set; }
        public DateTime LastActivityDate { get; set; }
        public int DaysSinceLastActivity { get; set; }
        public double EngagementScore { get; set; }
        public bool IsDormant { get; set; }
        public int Enrollments { get; set; }
        public int Completions { get; set; }
        public int InProgress { get; set; }
        public double AverageProgress { get; set; }
        public int TotalTimeSpentMinutes { get; set; }
        public double TotalTimeSpentHours { get; set; }
    }

    private static object BuildUserActivitySummary(IReadOnlyCollection<UserActivityReportRow> rows)
    {
        return new
        {
            totalUsers = rows.Count,
            activeUsers = rows.Count(u => u.Status == "Active"),
            inactiveUsers = rows.Count(u => u.Status == "Inactive"),
            suspendedUsers = rows.Count(u => u.Status == "Suspended"),
            dormantUsers = rows.Count(u => u.IsDormant),
            averageEngagementScore = rows.Any() ? Math.Round(rows.Average(u => u.EngagementScore), 2) : 0,
            highlyEngagedUsers = rows.Count(u => u.EngagementScore >= 70),
            moderatelyEngagedUsers = rows.Count(u => u.EngagementScore >= 40 && u.EngagementScore < 70),
            lowEngagementUsers = rows.Count(u => u.EngagementScore < 40),
            totalTimeSpentHours = rows.Any() ? Math.Round(rows.Sum(u => u.TotalTimeSpentHours), 2) : 0,
            averageTimeSpentPerUserHours = rows.Any() ? Math.Round(rows.Average(u => u.TotalTimeSpentHours), 2) : 0
        };
    }

    private static object BuildUserActivityHeader(
        string orgName,
        DateTime start,
        DateTime end,
        DateTime? startDate,
        DateTime? endDate,
        int minDaysDormant,
        int? pageNumber = null,
        int? pageSize = null,
        string? search = null,
        string? sortBy = null,
        string? sortDirection = null)
    {
        return new
        {
            reportName = "User Activity Report",
            generatedAt = DateTime.UtcNow,
            dateRange = new
            {
                start,
                end
            },
            organization = orgName,
            filters = new
            {
                startDate,
                endDate,
                minDaysDormant,
                pageNumber,
                pageSize,
                search,
                sortBy,
                sortDirection
            }
        };
    }

    private static (string SortBy, string SortDirection) NormalizeUserActivityUsersSort(string? sortBy, string? sortDirection)
    {
        var normalizedDirection = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase)
            ? "asc"
            : "desc";

        var normalizedSortBy = (sortBy ?? "engagement").Trim().ToLowerInvariant() switch
        {
            "name" => "name",
            "email" => "email",
            "status" => "status",
            "lastactivity" => "lastActivity",
            "enrollments" => "enrollments",
            "completions" => "completions",
            "avgprogress" => "avgProgress",
            "idle" => "idle",
            "createdon" => "createdOn",
            _ => "engagement"
        };

        return (normalizedSortBy, normalizedDirection);
    }

    private static IEnumerable<UserActivityReportRow> ApplyUserActivityUsersSearchAndSort(
        IEnumerable<UserActivityReportRow> rows,
        string? search,
        string? sortBy,
        string? sortDirection)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            rows = rows.Where(u =>
                u.Name.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                u.Email.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                u.Status.Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        var (normalizedSortBy, normalizedSortDirection) = NormalizeUserActivityUsersSort(sortBy, sortDirection);
        var sortKey = normalizedSortBy.ToLowerInvariant();
        var isAsc = normalizedSortDirection == "asc";

        return (sortKey, isAsc) switch
        {
            ("name", true) => rows.OrderBy(u => u.Name),
            ("name", false) => rows.OrderByDescending(u => u.Name),
            ("email", true) => rows.OrderBy(u => u.Email),
            ("email", false) => rows.OrderByDescending(u => u.Email),
            ("status", true) => rows.OrderBy(u => u.Status),
            ("status", false) => rows.OrderByDescending(u => u.Status),
            ("lastactivity", true) => rows.OrderBy(u => u.LastActivityDate),
            ("lastactivity", false) => rows.OrderByDescending(u => u.LastActivityDate),
            ("enrollments", true) => rows.OrderBy(u => u.Enrollments),
            ("enrollments", false) => rows.OrderByDescending(u => u.Enrollments),
            ("completions", true) => rows.OrderBy(u => u.Completions),
            ("completions", false) => rows.OrderByDescending(u => u.Completions),
            ("avgprogress", true) => rows.OrderBy(u => u.AverageProgress),
            ("avgprogress", false) => rows.OrderByDescending(u => u.AverageProgress),
            ("idle", true) => rows.OrderBy(u => u.IsDormant),
            ("idle", false) => rows.OrderByDescending(u => u.IsDormant),
            ("createdon", true) => rows.OrderBy(u => u.CreatedOn),
            ("createdon", false) => rows.OrderByDescending(u => u.CreatedOn),
            ("engagement", true) => rows.OrderBy(u => u.EngagementScore),
            _ => rows.OrderByDescending(u => u.EngagementScore)
        };
    }

    private async Task<(string OrgName, DateTime Start, DateTime End, List<UserActivityReportRow> Rows)> BuildUserActivityRows(
        DateTime? startDate,
        DateTime? endDate,
        int minDaysDormant)
    {
        var orgId = await GetOrgIdFilter();
        var hasDateFilter = startDate.HasValue || endDate.HasValue;
        var filterStart = startDate ?? DateTime.MinValue;
        var filterEnd = endDate ?? DateTime.MaxValue;

        var orgName = "All Organizations";
        if (orgId.HasValue)
        {
            var org = await _context.Organisations.FindAsync(orgId.Value);
            orgName = org?.Name ?? "Unknown Organization";
        }

        var usersQuery = _context.Users.AsNoTracking();
        if (orgId.HasValue)
            usersQuery = usersQuery.Where(u => u.OrganisationID == orgId);

        var scopedUserIds = usersQuery.Select(u => u.Id);

        // Aggregate learner progress in SQL for scoped users to avoid huge in-memory joins.
        var progressData = await _context.LearnerProgresses
            .AsNoTracking()
            .Where(lp => scopedUserIds.Contains(lp.UserId))
            .GroupBy(lp => lp.UserId)
            .Select(g => new
            {
                userId = g.Key,
                totalEnrollments = g.Count(),
                completedCourses = g.Count(lp => lp.Completed),
                inProgressCourses = g.Count(lp => !lp.Completed && lp.ProgressPercent > 0),
                avgProgress = g.Average(lp => (double?)lp.ProgressPercent) ?? 0,
                lastActivityDate = g.Max(lp => lp.LastAccessedAt) ?? g.Max(lp => lp.CompletedAt) ?? DateTime.UtcNow,
                totalTimeSpentMinutes = g.Sum(lp => lp.TotalTimeSpentSeconds) / 60
            })
            .ToListAsync();

        var progressByUserId = progressData.ToDictionary(p => p.userId, StringComparer.OrdinalIgnoreCase);

        var users = await usersQuery
            .Select(u => new
            {
                userId = u.Id,
                name = u.FirstName + " " + u.LastName,
                email = u.Email ?? "",
                status = u.ActiveStatus == 1 ? "Active" : u.ActiveStatus == 0 ? "Inactive" : "Suspended",
                createdOn = u.CreatedOn
            })
            .ToListAsync();

        var projectedRows = users.Select(u =>
        {
            progressByUserId.TryGetValue(u.userId, out var progress);
            var lastActivity = progress?.lastActivityDate ?? u.createdOn;
            var daysSinceLastActivity = (DateTime.UtcNow - lastActivity).Days;

            // Engagement score formula:
            // - Average progress contributes 0-50 points
            // - Each completion adds 5 points (max 50)
            // - Active enrollments add 10 points (max 50)
            // - Recency penalty: lose 1 point per day inactive (max -50)
            var baseScore = (progress?.avgProgress ?? 0) * 0.5;
            var completionBonus = Math.Min(progress?.completedCourses ?? 0, 10) * 5;
            var enrollmentBonus = Math.Min(progress?.totalEnrollments ?? 0, 5) * 10;
            var recencyPenalty = Math.Min(daysSinceLastActivity, 50);
            var engagementScore = Math.Max(0, Math.Round(baseScore + completionBonus + enrollmentBonus - recencyPenalty, 2));

            var isDormant = daysSinceLastActivity > minDaysDormant;

            return new UserActivityReportRow
            {
                UserId = u.userId,
                Name = u.name,
                Email = u.email,
                Status = u.status,
                CreatedOn = u.createdOn,
                LastActivityDate = lastActivity,
                DaysSinceLastActivity = daysSinceLastActivity,
                EngagementScore = engagementScore,
                IsDormant = isDormant,
                Enrollments = progress?.totalEnrollments ?? 0,
                Completions = progress?.completedCourses ?? 0,
                InProgress = progress?.inProgressCourses ?? 0,
                AverageProgress = progress != null ? Math.Round(progress.avgProgress, 2) : 0,
                TotalTimeSpentMinutes = progress?.totalTimeSpentMinutes ?? 0,
                TotalTimeSpentHours = progress != null ? Math.Round(progress.totalTimeSpentMinutes / 60.0, 2) : 0
            };
        });

        if (hasDateFilter)
        {
            projectedRows = projectedRows.Where(u =>
                (u.CreatedOn >= filterStart && u.CreatedOn <= filterEnd) ||
                (u.LastActivityDate >= filterStart && u.LastActivityDate <= filterEnd));
        }

        var rows = projectedRows
            .OrderByDescending(u => u.EngagementScore)
            .ToList();

        var headerStart = startDate ?? (rows.Any() ? rows.Min(r => r.CreatedOn) : DateTime.UtcNow);
        var headerEnd = endDate ?? (rows.Any() ? rows.Max(r => r.LastActivityDate) : DateTime.UtcNow);

        return (orgName, headerStart, headerEnd, rows);
    }

    [HttpGet("user-activity/summary")]
    public async Task<IActionResult> GetUserActivitySummary(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int minDaysDormant = 30)
    {
        try
        {
            var (orgName, start, end, rows) = await BuildUserActivityRows(startDate, endDate, minDaysDormant);
            var summary = BuildUserActivitySummary(rows);
            var header = BuildUserActivityHeader(orgName, start, end, startDate, endDate, minDaysDormant);
            return Ok(new { header, summary });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating user activity summary");
            return StatusCode(500, new { error = "Failed to generate user activity summary", details = ex.Message });
        }
    }

    [HttpGet("user-activity/users")]
    public async Task<IActionResult> GetUserActivityUsers(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int minDaysDormant = 30,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = "engagement",
        [FromQuery] string? sortDirection = "desc")
    {
        try
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);
            var normalizedSort = NormalizeUserActivityUsersSort(sortBy, sortDirection);

            var (orgName, start, end, rows) = await BuildUserActivityRows(startDate, endDate, minDaysDormant);
            var filteredRows = ApplyUserActivityUsersSearchAndSort(rows, search, normalizedSort.SortBy, normalizedSort.SortDirection).ToList();

            var totalUsers = filteredRows.Count;
            var totalPages = totalUsers == 0 ? 1 : (int)Math.Ceiling(totalUsers / (double)pageSize);
            var usersPage = filteredRows
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var header = BuildUserActivityHeader(orgName, start, end, startDate, endDate, minDaysDormant, pageNumber, pageSize, search, normalizedSort.SortBy, normalizedSort.SortDirection);

            var pagination = new
            {
                pageNumber,
                pageSize,
                totalUsers,
                totalPages,
                hasPreviousPage = pageNumber > 1,
                hasNextPage = pageNumber < totalPages
            };

            return Ok(new { header, users = usersPage, pagination });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating user activity users list");
            return StatusCode(500, new { error = "Failed to generate user activity users list", details = ex.Message });
        }
    }

    [HttpGet("user-activity")]
    public async Task<IActionResult> GetUserActivityReport(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int minDaysDormant = 30,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = "engagement",
        [FromQuery] string? sortDirection = "desc")
    {
        try
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);
            var normalizedSort = NormalizeUserActivityUsersSort(sortBy, sortDirection);

            var (orgName, start, end, result) = await BuildUserActivityRows(startDate, endDate, minDaysDormant);
            var summary = BuildUserActivitySummary(result);
            var filteredRows = ApplyUserActivityUsersSearchAndSort(result, search, normalizedSort.SortBy, normalizedSort.SortDirection).ToList();

            var totalUsers = filteredRows.Count;
            var totalPages = totalUsers == 0 ? 1 : (int)Math.Ceiling(totalUsers / (double)pageSize);
            var usersPage = filteredRows
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var header = BuildUserActivityHeader(orgName, start, end, startDate, endDate, minDaysDormant, pageNumber, pageSize, search, normalizedSort.SortBy, normalizedSort.SortDirection);

            var pagination = new
            {
                pageNumber,
                pageSize,
                totalUsers,
                totalPages,
                hasPreviousPage = pageNumber > 1,
                hasNextPage = pageNumber < totalPages
            };

            return Ok(new { header, users = usersPage, summary, pagination });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating user activity report");
            return StatusCode(500, new { error = "Failed to generate user activity report", details = ex.Message });
        }
    }

    #endregion

    #region User Progress Report

    private sealed class UserProgressReportRow
    {
        public string UserId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public int CoursesEnrolled { get; set; }
        public int CoursesCompleted { get; set; }
        public int CoursesInProgress { get; set; }
        public double OverallProgress { get; set; }
        public double AverageCompletionTime { get; set; }
        public double LearningVelocity { get; set; }
        public double TotalTimeSpentMinutes { get; set; }
        public double TotalTimeSpentHours { get; set; }
        public DateTime? LastAccessedAt { get; set; }
        public double AverageTimePerCourse { get; set; }
    }

    [HttpGet("user-progress")]
    public async Task<IActionResult> GetUserProgressReport(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = "name",
        [FromQuery] string? sortDirection = "asc")
    {
        try
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);

            var normalizedSortDirection = string.Equals(sortDirection, "desc", StringComparison.OrdinalIgnoreCase)
                ? "desc"
                : "asc";

            var normalizedSortBy = (sortBy ?? "name").Trim().ToLowerInvariant() switch
            {
                "user" => "name",
                "name" => "name",
                "enrolled" => "enrolled",
                "completed" => "completed",
                "inprogress" => "inprogress",
                "overallprogress" => "overallprogress",
                "avgtime" => "avgtime",
                "velocity" => "velocity",
                _ => "name"
            };

            var orgId = await GetOrgIdFilter();
            var start = startDate ?? DateTime.UtcNow.AddMonths(-3);
            var end = endDate ?? DateTime.UtcNow;

            // Get organization info for header
            var orgName = "All Organizations";
            if (orgId.HasValue)
            {
                var org = await _context.Organisations.FindAsync(orgId.Value);
                orgName = org?.Name ?? "Unknown Organization";
            }

            var utcNow = DateTime.UtcNow;

            var usersQuery = _context.Users.AsNoTracking();
            if (orgId.HasValue)
                usersQuery = usersQuery.Where(u => u.OrganisationID == orgId);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchTerm = search.Trim();
                var pattern = $"%{searchTerm}%";
                usersQuery = usersQuery.Where(u =>
                    EF.Functions.Like((u.FirstName ?? "") + " " + (u.LastName ?? ""), pattern) ||
                    EF.Functions.Like(u.Email ?? "", pattern));
            }

            var learnerProgresses = _context.LearnerProgresses.AsNoTracking();

            var metricsQuery = usersQuery.Select(u => new UserProgressReportRow
            {
                UserId = u.Id,
                Name = (u.FirstName ?? "") + " " + (u.LastName ?? ""),
                Email = u.Email ?? "",
                CoursesEnrolled = learnerProgresses.Count(lp => lp.UserId == u.Id),
                CoursesCompleted = learnerProgresses.Count(lp => lp.UserId == u.Id && lp.Completed),
                CoursesInProgress = learnerProgresses.Count(lp => lp.UserId == u.Id && !lp.Completed && lp.ProgressPercent > 0),
                OverallProgress = learnerProgresses
                    .Where(lp => lp.UserId == u.Id)
                    .Select(lp => (double?)lp.ProgressPercent)
                    .Average() ?? 0,
                AverageCompletionTime = learnerProgresses
                    .Where(lp => lp.UserId == u.Id && lp.Completed && lp.CompletedAt.HasValue)
                    .Select(lp => (double?)EF.Functions.DateDiffDay(lp.CompletedAt!.Value, utcNow))
                    .Average() ?? 0,
                LearningVelocity =
                    learnerProgresses.Count(lp => lp.UserId == u.Id && lp.Completed) /
                    (((double)((EF.Functions.DateDiffDay(u.CreatedOn, utcNow) < 30 ? 30 : EF.Functions.DateDiffDay(u.CreatedOn, utcNow)))) / 30.0),
                TotalTimeSpentMinutes = (learnerProgresses
                    .Where(lp => lp.UserId == u.Id)
                    .Select(lp => (double?)lp.TotalTimeSpentSeconds)
                    .Sum() ?? 0) / 60.0,
                TotalTimeSpentHours = (learnerProgresses
                    .Where(lp => lp.UserId == u.Id)
                    .Select(lp => (double?)lp.TotalTimeSpentSeconds)
                    .Sum() ?? 0) / 3600.0,
                LastAccessedAt = learnerProgresses
                    .Where(lp => lp.UserId == u.Id)
                    .Select(lp => lp.LastAccessedAt)
                    .Max(),
                AverageTimePerCourse =
                    learnerProgresses.Count(lp => lp.UserId == u.Id) > 0
                        ? ((learnerProgresses
                            .Where(lp => lp.UserId == u.Id)
                            .Select(lp => (double?)lp.TotalTimeSpentSeconds)
                            .Sum() ?? 0) / 60.0) / learnerProgresses.Count(lp => lp.UserId == u.Id)
                        : 0
            });

            var sortedQuery = (normalizedSortBy, normalizedSortDirection) switch
            {
                ("name", "desc") => metricsQuery.OrderByDescending(r => r.Name),
                ("name", _) => metricsQuery.OrderBy(r => r.Name),
                ("enrolled", "desc") => metricsQuery.OrderByDescending(r => r.CoursesEnrolled),
                ("enrolled", _) => metricsQuery.OrderBy(r => r.CoursesEnrolled),
                ("completed", "desc") => metricsQuery.OrderByDescending(r => r.CoursesCompleted),
                ("completed", _) => metricsQuery.OrderBy(r => r.CoursesCompleted),
                ("inprogress", "desc") => metricsQuery.OrderByDescending(r => r.CoursesInProgress),
                ("inprogress", _) => metricsQuery.OrderBy(r => r.CoursesInProgress),
                ("overallprogress", "desc") => metricsQuery.OrderByDescending(r => r.OverallProgress),
                ("overallprogress", _) => metricsQuery.OrderBy(r => r.OverallProgress),
                ("avgtime", "desc") => metricsQuery.OrderByDescending(r => r.AverageCompletionTime),
                ("avgtime", _) => metricsQuery.OrderBy(r => r.AverageCompletionTime),
                ("velocity", "desc") => metricsQuery.OrderByDescending(r => r.LearningVelocity),
                ("velocity", _) => metricsQuery.OrderBy(r => r.LearningVelocity),
                _ => metricsQuery.OrderBy(r => r.Name)
            };

            var totalUsers = await metricsQuery.CountAsync();
            var totalPages = totalUsers == 0 ? 1 : (int)Math.Ceiling(totalUsers / (double)pageSize);
            var pagedUsers = await sortedQuery
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var roundedPagedUsers = pagedUsers.Select(u => new UserProgressReportRow
            {
                UserId = u.UserId,
                Name = u.Name,
                Email = u.Email,
                CoursesEnrolled = u.CoursesEnrolled,
                CoursesCompleted = u.CoursesCompleted,
                CoursesInProgress = u.CoursesInProgress,
                OverallProgress = Math.Round(u.OverallProgress, 2),
                AverageCompletionTime = Math.Round(u.AverageCompletionTime, 1),
                LearningVelocity = Math.Round(u.LearningVelocity, 2),
                TotalTimeSpentMinutes = Math.Round(u.TotalTimeSpentMinutes, 2),
                TotalTimeSpentHours = Math.Round(u.TotalTimeSpentHours, 2),
                LastAccessedAt = u.LastAccessedAt,
                AverageTimePerCourse = Math.Round(u.AverageTimePerCourse, 2)
            }).ToList();

            var summaryAggregate = await metricsQuery
                .GroupBy(_ => 1)
                .Select(g => new
                {
                    averageProgress = Math.Round(g.Average(r => r.OverallProgress), 2),
                    averageCompletionTime = Math.Round(g.Average(r => r.AverageCompletionTime), 2),
                    averageLearningVelocity = Math.Round(g.Average(r => r.LearningVelocity), 2),
                    totalEnrollments = g.Sum(r => r.CoursesEnrolled),
                    totalCompletions = g.Sum(r => r.CoursesCompleted),
                    totalTimeSpentHours = Math.Round(g.Sum(r => r.TotalTimeSpentHours), 2),
                    averageTimeSpentPerLearnerHours = Math.Round(g.Average(r => r.TotalTimeSpentHours), 2),
                    averageTimePerCourseMinutes = Math.Round(g.Average(r => r.AverageTimePerCourse), 2)
                })
                .FirstOrDefaultAsync();

            var summary = new
            {
                totalLearners = totalUsers,
                averageProgress = summaryAggregate?.averageProgress ?? 0,
                averageCompletionTime = summaryAggregate?.averageCompletionTime ?? 0,
                averageLearningVelocity = summaryAggregate?.averageLearningVelocity ?? 0,
                totalEnrollments = summaryAggregate?.totalEnrollments ?? 0,
                totalCompletions = summaryAggregate?.totalCompletions ?? 0,
                totalTimeSpentHours = summaryAggregate?.totalTimeSpentHours ?? 0,
                averageTimeSpentPerLearnerHours = summaryAggregate?.averageTimeSpentPerLearnerHours ?? 0,
                averageTimePerCourseMinutes = summaryAggregate?.averageTimePerCourseMinutes ?? 0
            };

            var header = new
            {
                reportName = "User Progress Report",
                generatedAt = DateTime.UtcNow,
                dateRange = new
                {
                    start,
                    end
                },
                organization = orgName,
                filters = new
                {
                    startDate,
                    endDate,
                    pageNumber,
                    pageSize,
                    search,
                    sortBy = normalizedSortBy,
                    sortDirection = normalizedSortDirection
                }
            };

            var pagination = new
            {
                pageNumber,
                pageSize,
                totalUsers,
                totalPages,
                hasPreviousPage = pageNumber > 1,
                hasNextPage = pageNumber < totalPages
            };

            return Ok(new { header, users = roundedPagedUsers, summary, pagination });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating user progress report");
            return StatusCode(500, new { error = "Failed to generate user progress report", details = ex.Message });
        }
    }

    #endregion

    #region Course Enrollment Report

    private sealed class CourseEnrollmentReportRow
    {
        public string CourseId { get; set; } = string.Empty;
        public string CourseTitle { get; set; } = string.Empty;
        public string? Category { get; set; }
        public string? Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public int TotalEnrollments { get; set; }
        public int ActiveEnrollments { get; set; }
        public int CompletedEnrollments { get; set; }
        public double CompletionRate { get; set; }
        public int DroppedEnrollments { get; set; }
        public double DropoffRate { get; set; }
        public string Popularity { get; set; } = "Low";
    }

    private static (string SortBy, string SortDirection) NormalizeCourseEnrollmentSort(string? sortBy, string? sortDirection)
    {
        var normalizedDirection = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase)
            ? "asc"
            : "desc";

        var normalizedSortBy = (sortBy ?? "totalEnrollments").Trim().ToLowerInvariant() switch
        {
            "coursetitle" => "courseTitle",
            "category" => "category",
            "status" => "status",
            "enrollments" => "totalEnrollments",
            "totalenrollments" => "totalEnrollments",
            "active" => "activeEnrollments",
            "activeenrollments" => "activeEnrollments",
            "completed" => "completedEnrollments",
            "completedenrollments" => "completedEnrollments",
            "completionrate" => "completionRate",
            "dropoffrate" => "dropoffRate",
            "popularity" => "popularity",
            "createdat" => "createdAt",
            _ => "totalEnrollments"
        };

        return (normalizedSortBy, normalizedDirection);
    }

    private static object BuildCourseEnrollmentHeader(
        string orgName,
        DateTime? startDate,
        DateTime? endDate,
        int? pageNumber = null,
        int? pageSize = null,
        string? search = null,
        string? category = null,
        string? sortBy = null,
        string? sortDirection = null)
    {
        return new
        {
            reportName = "Course Enrollment Report",
            generatedAt = DateTime.UtcNow,
            dateRange = startDate.HasValue || endDate.HasValue ? new
            {
                start = startDate,
                end = endDate
            } : null,
            organization = orgName,
            filters = new
            {
                startDate,
                endDate,
                pageNumber,
                pageSize,
                search,
                category,
                sortBy,
                sortDirection
            }
        };
    }

    private async Task<(string OrgName, List<CourseEnrollmentReportRow> Rows)> BuildCourseEnrollmentRows(
        DateTime? startDate,
        DateTime? endDate)
    {
        var orgId = await GetOrgIdFilter();

        var orgName = "All Organizations";
        if (orgId.HasValue)
        {
            var org = await _context.Organisations.FindAsync(orgId.Value);
            orgName = org?.Name ?? "Unknown Organization";
        }

        var coursesQuery = _context.Courses.AsNoTracking();
        if (orgId.HasValue)
            coursesQuery = coursesQuery.Where(c => c.OrganisationId == orgId);

        var courses = await coursesQuery
            .Select(c => new
            {
                c.Id,
                c.Title,
                c.Category,
                c.Status,
                c.CreatedAt
            })
            .ToListAsync();

        var courseIds = courses.Select(c => c.Id).ToList();

        var progressByCourse = await _context.LearnerProgresses
            .AsNoTracking()
            .Where(lp => lp.LessonId == null && lp.CourseId != null && courseIds.Contains(lp.CourseId))
            .GroupBy(lp => lp.CourseId!)
            .Select(g => new
            {
                courseId = g.Key,
                totalEnrollments = g.Count(),
                activeEnrollments = g.Count(lp => !lp.Completed && lp.ProgressPercent > 0),
                completedEnrollments = g.Count(lp => lp.Completed),
                droppedEnrollments = g.Count(lp => !lp.Completed && lp.ProgressPercent == 0)
            })
            .ToDictionaryAsync(x => x.courseId, StringComparer.OrdinalIgnoreCase);

        var rows = courses.Select(c =>
        {
            progressByCourse.TryGetValue(c.Id, out var progress);

            var totalEnrollments = progress?.totalEnrollments ?? 0;
            var activeEnrollments = progress?.activeEnrollments ?? 0;
            var completedEnrollments = progress?.completedEnrollments ?? 0;
            var droppedEnrollments = progress?.droppedEnrollments ?? 0;
            var completionRate = totalEnrollments > 0
                ? Math.Round((completedEnrollments / (double)totalEnrollments) * 100, 2)
                : 0;
            var dropoffRate = totalEnrollments > 0
                ? Math.Round((droppedEnrollments / (double)totalEnrollments) * 100, 2)
                : 0;

            return new CourseEnrollmentReportRow
            {
                CourseId = c.Id,
                CourseTitle = c.Title,
                Category = c.Category,
                Status = c.Status,
                CreatedAt = c.CreatedAt,
                TotalEnrollments = totalEnrollments,
                ActiveEnrollments = activeEnrollments,
                CompletedEnrollments = completedEnrollments,
                CompletionRate = completionRate,
                DroppedEnrollments = droppedEnrollments,
                DropoffRate = dropoffRate,
                Popularity = totalEnrollments > 50
                    ? "High"
                    : totalEnrollments > 20
                        ? "Medium"
                        : "Low"
            };
        }).ToList();

        return (orgName, rows);
    }

    private static IQueryable<CourseEnrollmentReportRow> ApplyCourseEnrollmentTableFiltersAndSort(
        IQueryable<CourseEnrollmentReportRow> query,
        string? search,
        string? category,
        string sortBy,
        string sortDirection)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(c =>
                c.CourseTitle.Contains(term) ||
                (c.Category ?? string.Empty).Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(category) && !string.Equals(category, "all", StringComparison.OrdinalIgnoreCase))
        {
            var requestedCategory = category.Trim();
            query = query.Where(c => (c.Category ?? "Uncategorized") == requestedCategory);
        }

        var isAsc = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);

        return (sortBy, isAsc) switch
        {
            ("courseTitle", true) => query.OrderBy(c => c.CourseTitle),
            ("courseTitle", false) => query.OrderByDescending(c => c.CourseTitle),
            ("category", true) => query.OrderBy(c => c.Category),
            ("category", false) => query.OrderByDescending(c => c.Category),
            ("status", true) => query.OrderBy(c => c.Status),
            ("status", false) => query.OrderByDescending(c => c.Status),
            ("activeEnrollments", true) => query.OrderBy(c => c.ActiveEnrollments),
            ("activeEnrollments", false) => query.OrderByDescending(c => c.ActiveEnrollments),
            ("completedEnrollments", true) => query.OrderBy(c => c.CompletedEnrollments),
            ("completedEnrollments", false) => query.OrderByDescending(c => c.CompletedEnrollments),
            ("completionRate", true) => query.OrderBy(c => c.CompletionRate),
            ("completionRate", false) => query.OrderByDescending(c => c.CompletionRate),
            ("dropoffRate", true) => query.OrderBy(c => c.DropoffRate),
            ("dropoffRate", false) => query.OrderByDescending(c => c.DropoffRate),
            ("popularity", true) => query.OrderBy(c => c.Popularity),
            ("popularity", false) => query.OrderByDescending(c => c.Popularity),
            ("createdAt", true) => query.OrderBy(c => c.CreatedAt),
            ("createdAt", false) => query.OrderByDescending(c => c.CreatedAt),
            ("totalEnrollments", true) => query.OrderBy(c => c.TotalEnrollments),
            _ => query.OrderByDescending(c => c.TotalEnrollments)
        };
    }

    private static object BuildCourseEnrollmentSummary(IReadOnlyCollection<CourseEnrollmentReportRow> rows)
    {
        var orderedByEnrollment = rows
            .OrderByDescending(r => r.TotalEnrollments)
            .ThenBy(r => r.CourseTitle)
            .ToList();

        return new
        {
            totalCourses = rows.Count,
            totalEnrollments = rows.Sum(c => c.TotalEnrollments),
            activeEnrollments = rows.Sum(c => c.ActiveEnrollments),
            completedEnrollments = rows.Sum(c => c.CompletedEnrollments),
            averageEnrollmentPerCourse = rows.Any() ? Math.Round(rows.Average(c => c.TotalEnrollments), 2) : 0,
            averageDropoffRate = rows.Any() ? Math.Round(rows.Average(c => c.DropoffRate), 2) : 0,
            averageCompletionRate = rows.Any() ? Math.Round(rows.Average(c => c.CompletionRate), 2) : 0,
            mostPopularCourse = orderedByEnrollment.FirstOrDefault()?.CourseTitle ?? "N/A",
            leastPopularCourse = orderedByEnrollment.LastOrDefault()?.CourseTitle ?? "N/A"
        };
    }

    [HttpGet("course-enrollment/summary")]
    public async Task<IActionResult> GetCourseEnrollmentSummary(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        try
        {
            var (orgName, rows) = await BuildCourseEnrollmentRows(startDate, endDate);

            var categoryBreakdown = rows
                .GroupBy(c => c.Category ?? "Uncategorized")
                .Select(g => new
                {
                    category = g.Key,
                    courses = g.Count(),
                    totalEnrollments = g.Sum(c => c.TotalEnrollments)
                })
                .OrderByDescending(c => c.totalEnrollments)
                .ToList();

            var topCoursesByEnrollment = rows
                .OrderByDescending(c => c.TotalEnrollments)
                .ThenBy(c => c.CourseTitle)
                .Take(10)
                .Select(c => new
                {
                    courseTitle = c.CourseTitle,
                    totalEnrollments = c.TotalEnrollments,
                    completedEnrollments = c.CompletedEnrollments
                })
                .ToList();

            var popularityDistribution = new
            {
                high = rows.Count(c => c.Popularity == "High"),
                medium = rows.Count(c => c.Popularity == "Medium"),
                low = rows.Count(c => c.Popularity == "Low")
            };

            var summary = BuildCourseEnrollmentSummary(rows);
            var header = BuildCourseEnrollmentHeader(orgName, startDate, endDate);

            return Ok(new
            {
                header,
                summary,
                categoryBreakdown,
                topCoursesByEnrollment,
                popularityDistribution
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating course enrollment summary");
            return StatusCode(500, new { error = "Failed to generate course enrollment summary", details = ex.Message });
        }
    }

    [HttpGet("course-enrollment/courses")]
    public async Task<IActionResult> GetCourseEnrollmentCourses(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? category = null,
        [FromQuery] string? sortBy = "totalEnrollments",
        [FromQuery] string? sortDirection = "desc")
    {
        try
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);
            var normalizedSort = NormalizeCourseEnrollmentSort(sortBy, sortDirection);

            var (orgName, rows) = await BuildCourseEnrollmentRows(startDate, endDate);
            var filteredQuery = ApplyCourseEnrollmentTableFiltersAndSort(
                rows.AsQueryable(),
                search,
                category,
                normalizedSort.SortBy,
                normalizedSort.SortDirection);

            var totalCourses = filteredQuery.Count();
            var totalPages = totalCourses == 0 ? 1 : (int)Math.Ceiling(totalCourses / (double)pageSize);
            var pagedCourses = filteredQuery
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var header = BuildCourseEnrollmentHeader(
                orgName,
                startDate,
                endDate,
                pageNumber,
                pageSize,
                search,
                category,
                normalizedSort.SortBy,
                normalizedSort.SortDirection);

            var pagination = new
            {
                pageNumber,
                pageSize,
                totalCourses,
                totalPages,
                hasPreviousPage = pageNumber > 1,
                hasNextPage = pageNumber < totalPages
            };

            return Ok(new { header, courses = pagedCourses, pagination });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating course enrollment users list");
            return StatusCode(500, new { error = "Failed to generate course enrollment users list", details = ex.Message });
        }
    }

    [HttpGet("course-enrollment")]
    public async Task<IActionResult> GetCourseEnrollmentReport(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? category = null,
        [FromQuery] string? sortBy = "totalEnrollments",
        [FromQuery] string? sortDirection = "desc")
    {
        try
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);
            var normalizedSort = NormalizeCourseEnrollmentSort(sortBy, sortDirection);

            var (orgName, rows) = await BuildCourseEnrollmentRows(startDate, endDate);

            var filteredCoursesQuery = ApplyCourseEnrollmentTableFiltersAndSort(
                rows.AsQueryable(),
                search,
                category,
                normalizedSort.SortBy,
                normalizedSort.SortDirection);

            var totalCourses = filteredCoursesQuery.Count();
            var totalPages = totalCourses == 0 ? 1 : (int)Math.Ceiling(totalCourses / (double)pageSize);
            var pagedCourses = filteredCoursesQuery
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var categoryBreakdown = rows
                .GroupBy(c => c.Category ?? "Uncategorized")
                .Select(g => new
                {
                    category = g.Key,
                    courses = g.Count(),
                    totalEnrollments = g.Sum(c => c.TotalEnrollments)
                })
                .OrderByDescending(c => c.totalEnrollments)
                .ToList();

            var topCoursesByEnrollment = rows
                .OrderByDescending(c => c.TotalEnrollments)
                .ThenBy(c => c.CourseTitle)
                .Take(10)
                .Select(c => new
                {
                    courseTitle = c.CourseTitle,
                    totalEnrollments = c.TotalEnrollments,
                    completedEnrollments = c.CompletedEnrollments
                })
                .ToList();

            var popularityDistribution = new
            {
                high = rows.Count(c => c.Popularity == "High"),
                medium = rows.Count(c => c.Popularity == "Medium"),
                low = rows.Count(c => c.Popularity == "Low")
            };

            var summary = BuildCourseEnrollmentSummary(rows);

            var header = BuildCourseEnrollmentHeader(
                orgName,
                startDate,
                endDate,
                pageNumber,
                pageSize,
                search,
                category,
                normalizedSort.SortBy,
                normalizedSort.SortDirection);

            var pagination = new
            {
                pageNumber,
                pageSize,
                totalCourses,
                totalPages,
                hasPreviousPage = pageNumber > 1,
                hasNextPage = pageNumber < totalPages
            };

            return Ok(new
            {
                header,
                courses = pagedCourses,
                summary,
                categoryBreakdown,
                topCoursesByEnrollment,
                popularityDistribution,
                pagination
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating course enrollment report");
            return StatusCode(500, new { error = "Failed to generate course enrollment report", details = ex.Message });
        }
    }

    #endregion

    #region Course Completion Report

    private sealed class CourseCompletionReportRow
    {
        public string CourseId { get; set; } = string.Empty;
        public string CourseTitle { get; set; } = string.Empty;
        public string? Category { get; set; }
        public DateTime CreatedAt { get; set; }
        public int TotalEnrollments { get; set; }
        public int CompletedCount { get; set; }
        public int IncompleteCount { get; set; }
        public int InProgressCount { get; set; }
        public int NotStartedCount { get; set; }
        public double CompletionRate { get; set; }
        public double AverageCompletionTime { get; set; }
        public string Performance { get; set; } = "Poor";
    }

    private static (string SortBy, string SortDirection) NormalizeCourseCompletionSort(string? sortBy, string? sortDirection)
    {
        var normalizedDirection = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase)
            ? "asc"
            : "desc";

        var normalizedSortBy = (sortBy ?? "completionRate").Trim().ToLowerInvariant() switch
        {
            "coursetitle" => "courseTitle",
            "category" => "category",
            "enrolled" => "totalEnrollments",
            "totalenrollments" => "totalEnrollments",
            "completed" => "completedCount",
            "completedcount" => "completedCount",
            "inprogress" => "inProgressCount",
            "inprogresscount" => "inProgressCount",
            "completionrate" => "completionRate",
            "avgtime" => "averageCompletionTime",
            "averagecompletiontime" => "averageCompletionTime",
            "performance" => "performance",
            "createdat" => "createdAt",
            _ => "completionRate"
        };

        return (normalizedSortBy, normalizedDirection);
    }

    private static object BuildCourseCompletionHeader(
        string orgName,
        DateTime start,
        DateTime end,
        DateTime? startDate,
        DateTime? endDate,
        int? pageNumber = null,
        int? pageSize = null,
        string? search = null,
        string? category = null,
        string? performance = null,
        string? sortBy = null,
        string? sortDirection = null)
    {
        return new
        {
            reportName = "Course Completion Report",
            generatedAt = DateTime.UtcNow,
            dateRange = new
            {
                start,
                end
            },
            organization = orgName,
            filters = new
            {
                startDate,
                endDate,
                pageNumber,
                pageSize,
                search,
                category,
                performance,
                sortBy,
                sortDirection
            }
        };
    }

    private async Task<(string OrgName, DateTime Start, DateTime End, List<CourseCompletionReportRow> Rows, List<object> CompletionTrends)> BuildCourseCompletionData(
        DateTime? startDate,
        DateTime? endDate)
    {
        var orgId = await GetOrgIdFilter();
        var start = startDate ?? DateTime.UtcNow.AddMonths(-3);
        var end = endDate ?? DateTime.UtcNow;

        var orgName = "All Organizations";
        if (orgId.HasValue)
        {
            var org = await _context.Organisations.FindAsync(orgId.Value);
            orgName = org?.Name ?? "Unknown Organization";
        }

        var coursesQuery = _context.Courses.AsNoTracking();
        if (orgId.HasValue)
            coursesQuery = coursesQuery.Where(c => c.OrganisationId == orgId);

        var courses = await coursesQuery
            .Select(c => new
            {
                c.Id,
                c.Title,
                c.Category,
                c.CreatedAt
            })
            .ToListAsync();

        var courseIds = courses.Select(c => c.Id).ToList();

        if (!courseIds.Any())
        {
            return (orgName, start, end, new List<CourseCompletionReportRow>(), new List<object>());
        }

        var scopedProgress = _context.LearnerProgresses
            .AsNoTracking()
            .Where(lp => lp.CourseId != null && courseIds.Contains(lp.CourseId) && lp.LessonId == null);

        var dateFilteredProgress = scopedProgress
            .Where(lp => !lp.CompletedAt.HasValue || (lp.CompletedAt >= start && lp.CompletedAt <= end));

        var completionCountsByCourse = await dateFilteredProgress
            .GroupBy(lp => lp.CourseId!)
            .Select(g => new
            {
                courseId = g.Key,
                totalEnrollments = g.Count(),
                completedCount = g.Count(lp => lp.Completed),
                incompleteCount = g.Count(lp => !lp.Completed),
                inProgressCount = g.Count(lp => !lp.Completed && lp.ProgressPercent > 0),
                notStartedCount = g.Count(lp => !lp.Completed && lp.ProgressPercent == 0)
            })
            .ToDictionaryAsync(x => x.courseId, StringComparer.OrdinalIgnoreCase);

        // Derive learner-course assignment date from group membership and group-course assignment.
        // Effective assignment is the later of learner join date and course assignment date.
        var effectiveAssignments =
            from lg in _context.LearnerGroups.AsNoTracking()
            join gc in _context.GroupCourses.AsNoTracking() on lg.LearningGroupId equals gc.LearningGroupId
            where lg.IsActive && courseIds.Contains(gc.CourseId)
            let effectiveAssignedAt = lg.JoinedAt >= gc.AssignedAt ? lg.JoinedAt : gc.AssignedAt
            group effectiveAssignedAt by new { lg.UserId, gc.CourseId } into g
            select new
            {
                g.Key.UserId,
                g.Key.CourseId,
                AssignedAt = g.Min()
            };

        var completionTimeByCourse = await (
            from lp in dateFilteredProgress
            join a in effectiveAssignments
                on new { lp.UserId, CourseId = lp.CourseId! }
                equals new { a.UserId, a.CourseId }
            where lp.Completed && lp.CompletedAt.HasValue
            let daysToComplete = EF.Functions.DateDiffDay(a.AssignedAt, lp.CompletedAt!.Value)
            where daysToComplete >= 0
            group daysToComplete by lp.CourseId! into g
            select new
            {
                courseId = g.Key,
                averageCompletionTime = Math.Round(g.Average(x => (double)x), 1)
            }
        ).ToDictionaryAsync(x => x.courseId, StringComparer.OrdinalIgnoreCase);

        var rows = courses.Select(c =>
        {
            completionCountsByCourse.TryGetValue(c.Id, out var counts);
            completionTimeByCourse.TryGetValue(c.Id, out var avgTime);

            var totalEnrollments = counts?.totalEnrollments ?? 0;
            var completedCount = counts?.completedCount ?? 0;
            var completionRate = totalEnrollments > 0
                ? Math.Round((completedCount / (double)totalEnrollments) * 100, 2)
                : 0;

            return new CourseCompletionReportRow
            {
                CourseId = c.Id,
                CourseTitle = c.Title,
                Category = c.Category,
                CreatedAt = c.CreatedAt,
                TotalEnrollments = totalEnrollments,
                CompletedCount = completedCount,
                IncompleteCount = counts?.incompleteCount ?? 0,
                InProgressCount = counts?.inProgressCount ?? 0,
                NotStartedCount = counts?.notStartedCount ?? 0,
                CompletionRate = completionRate,
                AverageCompletionTime = avgTime?.averageCompletionTime ?? 0,
                Performance = completionRate >= 75 ? "Excellent" : completionRate >= 50 ? "Good" : completionRate >= 25 ? "Fair" : "Poor"
            };
        }).ToList();

        var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
        var completionTrendsRaw = await scopedProgress
            .Where(lp => lp.Completed && lp.CompletedAt.HasValue && lp.CompletedAt.Value >= thirtyDaysAgo)
            .GroupBy(lp => lp.CompletedAt!.Value.Date)
            .Select(g => new
            {
                date = g.Key,
                count = g.Count()
            })
            .OrderBy(x => x.date)
            .ToListAsync();

        var completionTrends = completionTrendsRaw
            .Select(t => (object)new
            {
                date = t.date.ToString("MMM dd"),
                count = t.count
            })
            .ToList();

        return (orgName, start, end, rows, completionTrends);
    }

    private static IEnumerable<CourseCompletionReportRow> ApplyCourseCompletionTableFiltersAndSort(
        IEnumerable<CourseCompletionReportRow> rows,
        string? search,
        string? category,
        string? performance,
        string sortBy,
        string sortDirection)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            rows = rows.Where(c =>
                c.CourseTitle.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                (c.Category ?? string.Empty).Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(category) && !string.Equals(category, "all", StringComparison.OrdinalIgnoreCase))
        {
            var requestedCategory = category.Trim();
            rows = rows.Where(c => string.Equals(c.Category ?? "Uncategorized", requestedCategory, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(performance) && !string.Equals(performance, "all", StringComparison.OrdinalIgnoreCase))
        {
            var requestedPerformance = performance.Trim();
            rows = rows.Where(c => string.Equals(c.Performance, requestedPerformance, StringComparison.OrdinalIgnoreCase));
        }

        var isAsc = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);
        return (sortBy, isAsc) switch
        {
            ("courseTitle", true) => rows.OrderBy(c => c.CourseTitle),
            ("courseTitle", false) => rows.OrderByDescending(c => c.CourseTitle),
            ("category", true) => rows.OrderBy(c => c.Category),
            ("category", false) => rows.OrderByDescending(c => c.Category),
            ("totalEnrollments", true) => rows.OrderBy(c => c.TotalEnrollments),
            ("totalEnrollments", false) => rows.OrderByDescending(c => c.TotalEnrollments),
            ("completedCount", true) => rows.OrderBy(c => c.CompletedCount),
            ("completedCount", false) => rows.OrderByDescending(c => c.CompletedCount),
            ("inProgressCount", true) => rows.OrderBy(c => c.InProgressCount),
            ("inProgressCount", false) => rows.OrderByDescending(c => c.InProgressCount),
            ("averageCompletionTime", true) => rows.OrderBy(c => c.AverageCompletionTime),
            ("averageCompletionTime", false) => rows.OrderByDescending(c => c.AverageCompletionTime),
            ("performance", true) => rows.OrderBy(c => c.Performance),
            ("performance", false) => rows.OrderByDescending(c => c.Performance),
            ("createdAt", true) => rows.OrderBy(c => c.CreatedAt),
            ("createdAt", false) => rows.OrderByDescending(c => c.CreatedAt),
            ("completionRate", true) => rows.OrderBy(c => c.CompletionRate),
            _ => rows.OrderByDescending(c => c.CompletionRate)
        };
    }

    private static object BuildCourseCompletionSummary(IReadOnlyCollection<CourseCompletionReportRow> rows)
    {
        var orderedByRate = rows
            .OrderByDescending(c => c.CompletionRate)
            .ThenBy(c => c.CourseTitle)
            .ToList();

        return new
        {
            totalCourses = rows.Count,
            averageCompletionRate = rows.Any() ? Math.Round(rows.Average(c => c.CompletionRate), 2) : 0,
            averageCompletionTime = rows.Any()
                ? Math.Round(rows.Where(c => c.AverageCompletionTime > 0).Select(c => c.AverageCompletionTime).DefaultIfEmpty(0).Average(), 2)
                : 0,
            totalCompletions = rows.Sum(c => c.CompletedCount),
            totalIncomplete = rows.Sum(c => c.IncompleteCount),
            totalInProgress = rows.Sum(c => c.InProgressCount),
            bestPerforming = orderedByRate.FirstOrDefault()?.CourseTitle ?? "N/A",
            worstPerforming = orderedByRate.LastOrDefault()?.CourseTitle ?? "N/A"
        };
    }

    [HttpGet("course-completion/summary")]
    public async Task<IActionResult> GetCourseCompletionSummary(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        try
        {
            var (orgName, start, end, rows, completionTrends) = await BuildCourseCompletionData(startDate, endDate);

            var categoryBreakdown = rows
                .GroupBy(c => c.Category ?? "Uncategorized")
                .Select(g => new
                {
                    category = g.Key,
                    courses = g.Count(),
                    totalCompletions = g.Sum(c => c.CompletedCount),
                    averageCompletionRate = Math.Round(g.Average(c => c.CompletionRate), 2)
                })
                .OrderByDescending(c => c.totalCompletions)
                .ToList();

            var topCoursesByCompletionRate = rows
                .OrderByDescending(c => c.CompletionRate)
                .ThenBy(c => c.CourseTitle)
                .Take(10)
                .Select(c => new
                {
                    courseTitle = c.CourseTitle,
                    completionRate = c.CompletionRate,
                    completedCount = c.CompletedCount
                })
                .ToList();

            var performanceDistribution = new
            {
                excellent = rows.Count(c => c.Performance == "Excellent"),
                good = rows.Count(c => c.Performance == "Good"),
                fair = rows.Count(c => c.Performance == "Fair"),
                poor = rows.Count(c => c.Performance == "Poor")
            };

            var summary = BuildCourseCompletionSummary(rows);
            var header = BuildCourseCompletionHeader(orgName, start, end, startDate, endDate);

            return Ok(new
            {
                header,
                summary,
                completionTrends,
                categoryBreakdown,
                topCoursesByCompletionRate,
                performanceDistribution
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating course completion summary");
            return StatusCode(500, new { error = "Failed to generate course completion summary", details = ex.Message });
        }
    }

    [HttpGet("course-completion/courses")]
    public async Task<IActionResult> GetCourseCompletionCourses(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? category = null,
        [FromQuery] string? performance = null,
        [FromQuery] string? sortBy = "completionRate",
        [FromQuery] string? sortDirection = "desc")
    {
        try
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);
            var normalizedSort = NormalizeCourseCompletionSort(sortBy, sortDirection);

            var (orgName, start, end, rows, _) = await BuildCourseCompletionData(startDate, endDate);

            var filteredRows = ApplyCourseCompletionTableFiltersAndSort(
                rows,
                search,
                category,
                performance,
                normalizedSort.SortBy,
                normalizedSort.SortDirection).ToList();

            var totalCourses = filteredRows.Count;
            var totalPages = totalCourses == 0 ? 1 : (int)Math.Ceiling(totalCourses / (double)pageSize);
            var pagedCourses = filteredRows
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var header = BuildCourseCompletionHeader(
                orgName,
                start,
                end,
                startDate,
                endDate,
                pageNumber,
                pageSize,
                search,
                category,
                performance,
                normalizedSort.SortBy,
                normalizedSort.SortDirection);

            var pagination = new
            {
                pageNumber,
                pageSize,
                totalCourses,
                totalPages,
                hasPreviousPage = pageNumber > 1,
                hasNextPage = pageNumber < totalPages
            };

            return Ok(new { header, courses = pagedCourses, pagination });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating course completion courses list");
            return StatusCode(500, new { error = "Failed to generate course completion courses list", details = ex.Message });
        }
    }

    [HttpGet("course-completion")]
    public async Task<IActionResult> GetCourseCompletionReport(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? category = null,
        [FromQuery] string? performance = null,
        [FromQuery] string? sortBy = "completionRate",
        [FromQuery] string? sortDirection = "desc")
    {
        try
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);
            var normalizedSort = NormalizeCourseCompletionSort(sortBy, sortDirection);

            var (orgName, start, end, rows, completionTrends) = await BuildCourseCompletionData(startDate, endDate);

            var filteredRows = ApplyCourseCompletionTableFiltersAndSort(
                rows,
                search,
                category,
                performance,
                normalizedSort.SortBy,
                normalizedSort.SortDirection).ToList();

            var totalCourses = filteredRows.Count;
            var totalPages = totalCourses == 0 ? 1 : (int)Math.Ceiling(totalCourses / (double)pageSize);
            var pagedCourses = filteredRows
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var categoryBreakdown = rows
                .GroupBy(c => c.Category ?? "Uncategorized")
                .Select(g => new
                {
                    category = g.Key,
                    courses = g.Count(),
                    totalCompletions = g.Sum(c => c.CompletedCount),
                    averageCompletionRate = Math.Round(g.Average(c => c.CompletionRate), 2)
                })
                .OrderByDescending(c => c.totalCompletions)
                .ToList();

            var topCoursesByCompletionRate = rows
                .OrderByDescending(c => c.CompletionRate)
                .ThenBy(c => c.CourseTitle)
                .Take(10)
                .Select(c => new
                {
                    courseTitle = c.CourseTitle,
                    completionRate = c.CompletionRate,
                    completedCount = c.CompletedCount
                })
                .ToList();

            var performanceDistribution = new
            {
                excellent = rows.Count(c => c.Performance == "Excellent"),
                good = rows.Count(c => c.Performance == "Good"),
                fair = rows.Count(c => c.Performance == "Fair"),
                poor = rows.Count(c => c.Performance == "Poor")
            };

            var summary = BuildCourseCompletionSummary(rows);

            var header = BuildCourseCompletionHeader(
                orgName,
                start,
                end,
                startDate,
                endDate,
                pageNumber,
                pageSize,
                search,
                category,
                performance,
                normalizedSort.SortBy,
                normalizedSort.SortDirection);

            var pagination = new
            {
                pageNumber,
                pageSize,
                totalCourses,
                totalPages,
                hasPreviousPage = pageNumber > 1,
                hasNextPage = pageNumber < totalPages
            };

            return Ok(new
            {
                header,
                courses = pagedCourses,
                summary,
                completionTrends,
                categoryBreakdown,
                topCoursesByCompletionRate,
                performanceDistribution,
                pagination
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating course completion report");
            return StatusCode(500, new { error = "Failed to generate course completion report", details = ex.Message });
        }
    }

    #endregion

    #region Lesson Analytics Report

    private sealed class LessonAnalyticsReportRow
    {
        public long LessonId { get; set; }
        public string LessonTitle { get; set; } = string.Empty;
        public string LessonType { get; set; } = "Unknown";
        public string CourseTitle { get; set; } = "N/A";
        public string CourseId { get; set; } = string.Empty;
        public int Order { get; set; }
        public double? Duration { get; set; }
        public int TotalEnrollments { get; set; }
        public int Completions { get; set; }
        public int InProgress { get; set; }
        public int NotStarted { get; set; }
        public double CompletionRate { get; set; }
        public double AverageProgress { get; set; }
        public double TotalTimeSpentHours { get; set; }
        public double AverageTimeSpentMinutes { get; set; }
        public double VideoBookmarkUsagePercent { get; set; }
        public DateTime? LastAccessedAt { get; set; }
        public int? DaysSinceLastAccess { get; set; }
        public string EngagementLevel { get; set; } = "Very Low";
        public string Difficulty { get; set; } = "Very Challenging";
        public bool IsPopular { get; set; }
    }

    private static (string SortBy, string SortDirection) NormalizeLessonAnalyticsSort(string? sortBy, string? sortDirection)
    {
        var normalizedDirection = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase)
            ? "asc"
            : "desc";

        var normalizedSortBy = (sortBy ?? "order").Trim().ToLowerInvariant() switch
        {
            "lessontitle" => "lessonTitle",
            "coursetitle" => "courseTitle",
            "lessontype" => "lessonType",
            "order" => "order",
            "duration" => "duration",
            "totalenrollments" => "totalEnrollments",
            "completions" => "completions",
            "inprogress" => "inProgress",
            "notstarted" => "notStarted",
            "completionrate" => "completionRate",
            "averageprogress" => "averageProgress",
            "engagementlevel" => "engagementLevel",
            "difficulty" => "difficulty",
            _ => "order"
        };

        return (normalizedSortBy, normalizedDirection);
    }

    private static object BuildLessonAnalyticsHeader(
        string orgName,
        string? courseId,
        string? lessonType,
        DateTime? startDate,
        DateTime? endDate,
        int? pageNumber = null,
        int? pageSize = null,
        string? search = null,
        string? engagement = null,
        string? sortBy = null,
        string? sortDirection = null)
    {
        return new
        {
            reportName = "Lesson Analytics Report",
            generatedAt = DateTime.UtcNow,
            dateRange = startDate.HasValue || endDate.HasValue ? new
            {
                start = startDate,
                end = endDate
            } : null,
            organization = orgName,
            filters = new
            {
                courseId,
                lessonType,
                startDate,
                endDate,
                pageNumber,
                pageSize,
                search,
                engagement,
                sortBy,
                sortDirection
            }
        };
    }

    private static IEnumerable<LessonAnalyticsReportRow> ApplyLessonAnalyticsTableFiltersAndSort(
        IEnumerable<LessonAnalyticsReportRow> rows,
        string? search,
        string? engagement,
        string sortBy,
        string sortDirection)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            rows = rows.Where(l =>
                l.LessonTitle.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                l.CourseTitle.Contains(term, StringComparison.OrdinalIgnoreCase) ||
                l.LessonType.Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(engagement) && !string.Equals(engagement, "all", StringComparison.OrdinalIgnoreCase))
        {
            var requestedEngagement = engagement.Trim();
            rows = rows.Where(l => string.Equals(l.EngagementLevel, requestedEngagement, StringComparison.OrdinalIgnoreCase));
        }

        var isAsc = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);

        return (sortBy, isAsc) switch
        {
            ("lessonTitle", true) => rows.OrderBy(l => l.LessonTitle),
            ("lessonTitle", false) => rows.OrderByDescending(l => l.LessonTitle),
            ("courseTitle", true) => rows.OrderBy(l => l.CourseTitle),
            ("courseTitle", false) => rows.OrderByDescending(l => l.CourseTitle),
            ("lessonType", true) => rows.OrderBy(l => l.LessonType),
            ("lessonType", false) => rows.OrderByDescending(l => l.LessonType),
            ("duration", true) => rows.OrderBy(l => l.Duration),
            ("duration", false) => rows.OrderByDescending(l => l.Duration),
            ("totalEnrollments", true) => rows.OrderBy(l => l.TotalEnrollments),
            ("totalEnrollments", false) => rows.OrderByDescending(l => l.TotalEnrollments),
            ("completions", true) => rows.OrderBy(l => l.Completions),
            ("completions", false) => rows.OrderByDescending(l => l.Completions),
            ("inProgress", true) => rows.OrderBy(l => l.InProgress),
            ("inProgress", false) => rows.OrderByDescending(l => l.InProgress),
            ("notStarted", true) => rows.OrderBy(l => l.NotStarted),
            ("notStarted", false) => rows.OrderByDescending(l => l.NotStarted),
            ("completionRate", true) => rows.OrderBy(l => l.CompletionRate),
            ("completionRate", false) => rows.OrderByDescending(l => l.CompletionRate),
            ("averageProgress", true) => rows.OrderBy(l => l.AverageProgress),
            ("averageProgress", false) => rows.OrderByDescending(l => l.AverageProgress),
            ("engagementLevel", true) => rows.OrderBy(l => l.EngagementLevel),
            ("engagementLevel", false) => rows.OrderByDescending(l => l.EngagementLevel),
            ("difficulty", true) => rows.OrderBy(l => l.Difficulty),
            ("difficulty", false) => rows.OrderByDescending(l => l.Difficulty),
            ("order", true) => rows.OrderBy(l => l.Order),
            _ => rows.OrderByDescending(l => l.Order)
        };
    }

    private static object BuildLessonAnalyticsSummary(IReadOnlyCollection<LessonAnalyticsReportRow> rows)
    {
        var popularLessons = rows.Where(l => l.IsPopular).Take(5).ToList();
        var problematicLessons = rows.Where(l => l.CompletionRate < 25).OrderBy(l => l.CompletionRate).Take(5).ToList();

        return new
        {
            totalLessons = rows.Count,
            totalEnrollments = rows.Sum(l => l.TotalEnrollments),
            totalCompletions = rows.Sum(l => l.Completions),
            averageCompletionRate = rows.Any() ? Math.Round(rows.Average(l => l.CompletionRate), 2) : 0,
            averageProgress = rows.Any() ? Math.Round(rows.Average(l => l.AverageProgress), 2) : 0,
            totalTimeSpentHours = rows.Sum(l => l.TotalTimeSpentHours),
            averageTimePerLessonMinutes = rows.Any() ? Math.Round(rows.Average(l => l.AverageTimeSpentMinutes), 2) : 0,
            mostPopularLesson = rows.OrderByDescending(l => l.TotalEnrollments).FirstOrDefault()?.LessonTitle ?? "N/A",
            highestCompletionLesson = rows.OrderByDescending(l => l.CompletionRate).FirstOrDefault()?.LessonTitle ?? "N/A",
            lowestCompletionLesson = rows.OrderBy(l => l.CompletionRate).FirstOrDefault()?.LessonTitle ?? "N/A",
            mostTimeConsuming = rows.OrderByDescending(l => l.AverageTimeSpentMinutes).FirstOrDefault()?.LessonTitle ?? "N/A",
            videoLessonsWithBookmarks = rows.Count(l => l.LessonType == "video" && l.VideoBookmarkUsagePercent > 0),
            popularLessonsCount = popularLessons.Count,
            problematicLessonsCount = problematicLessons.Count
        };
    }

    private async Task<(string OrgName, List<LessonAnalyticsReportRow> Rows)> BuildLessonAnalyticsRows(
        string? courseId,
        string? lessonType,
        DateTime? startDate,
        DateTime? endDate)
    {
        var orgId = await GetOrgIdFilter();

        var orgName = "All Organizations";
        if (orgId.HasValue)
        {
            var org = await _context.Organisations.FindAsync(orgId.Value);
            orgName = org?.Name ?? "Unknown Organization";
        }

        var lessonsQuery = _context.Lessons.AsNoTracking();

        if (!string.IsNullOrEmpty(courseId))
            lessonsQuery = lessonsQuery.Where(l => l.CourseId == courseId);

        if (!string.IsNullOrEmpty(lessonType))
            lessonsQuery = lessonsQuery.Where(l => l.Type == lessonType);

        if (orgId.HasValue)
            lessonsQuery = lessonsQuery.Where(l => l.Course!.OrganisationId == orgId);

        var lessons = await lessonsQuery
            .Select(l => new
            {
                l.Id,
                l.Title,
                l.Type,
                l.CourseId,
                l.Ordinal,
                l.DurationSeconds,
                courseTitle = l.Course != null ? l.Course.Title : "N/A"
            })
            .ToListAsync();

        var lessonIds = lessons.Select(l => l.Id).ToList();
        if (!lessonIds.Any())
        {
            return (orgName, new List<LessonAnalyticsReportRow>());
        }

        var allProgressQuery = _context.LearnerProgresses
            .AsNoTracking()
            .Where(lp => lp.LessonId != null && lessonIds.Contains(lp.LessonId.Value));

        if (startDate.HasValue)
            allProgressQuery = allProgressQuery.Where(lp => lp.LastAccessedAt >= startDate.Value || lp.CompletedAt >= startDate.Value || (lp.LastAccessedAt == null && lp.CompletedAt == null));
        if (endDate.HasValue)
            allProgressQuery = allProgressQuery.Where(lp => lp.LastAccessedAt <= endDate.Value || lp.CompletedAt <= endDate.Value || (lp.LastAccessedAt == null && lp.CompletedAt == null));

        var allProgress = await allProgressQuery.ToListAsync();

        var rows = lessons.Select(l =>
        {
            var lessonProgress = allProgress.Where(lp => lp.LessonId == l.Id).ToList();
            var totalEnrollments = lessonProgress.Count;
            var completions = lessonProgress.Count(lp => lp.Completed);
            var inProgress = lessonProgress.Count(lp => !lp.Completed && lp.ProgressPercent > 0);
            var notStarted = lessonProgress.Count(lp => lp.ProgressPercent == 0);

            var completionRate = totalEnrollments > 0
                ? Math.Round((completions / (double)totalEnrollments) * 100, 2)
                : 0;

            var avgProgress = lessonProgress.Any()
                ? Math.Round(lessonProgress.Average(lp => lp.ProgressPercent), 2)
                : 0;

            var totalTimeSpentSeconds = lessonProgress.Sum(lp => lp.TotalTimeSpentSeconds);
            var avgTimeSpentMinutes = totalEnrollments > 0
                ? Math.Round(totalTimeSpentSeconds / 60.0 / totalEnrollments, 2)
                : 0;

            var normalizedType = l.Type ?? "Unknown";
            var videoBookmarkUsage = normalizedType == "video" && totalEnrollments > 0
                ? Math.Round((lessonProgress.Count(lp => lp.VideoTimestamp.HasValue && lp.VideoTimestamp > 0) / (double)totalEnrollments) * 100, 2)
                : 0;

            var lastAccessed = lessonProgress
                .Where(lp => lp.LastAccessedAt.HasValue)
                .OrderByDescending(lp => lp.LastAccessedAt)
                .FirstOrDefault()?.LastAccessedAt;

            var daysSinceLastAccess = lastAccessed.HasValue
                ? (DateTime.UtcNow - lastAccessed.Value).Days
                : (int?)null;

            string engagementLevel;
            if (completionRate >= 75) engagementLevel = "High";
            else if (completionRate >= 50) engagementLevel = "Medium";
            else if (completionRate >= 25) engagementLevel = "Low";
            else engagementLevel = "Very Low";

            string difficulty;
            if (completionRate >= 75 && avgProgress >= 80) difficulty = "Easy";
            else if (completionRate >= 50 && avgProgress >= 60) difficulty = "Moderate";
            else if (completionRate >= 25) difficulty = "Challenging";
            else difficulty = "Very Challenging";

            return new LessonAnalyticsReportRow
            {
                LessonId = l.Id,
                LessonTitle = l.Title,
                LessonType = normalizedType,
                CourseTitle = l.courseTitle,
                CourseId = l.CourseId,
                Order = l.Ordinal,
                Duration = l.DurationSeconds.HasValue ? Math.Round(l.DurationSeconds.Value / 60.0, 1) : (double?)null,
                TotalEnrollments = totalEnrollments,
                Completions = completions,
                InProgress = inProgress,
                NotStarted = notStarted,
                CompletionRate = completionRate,
                AverageProgress = avgProgress,
                TotalTimeSpentHours = Math.Round(totalTimeSpentSeconds / 3600.0, 2),
                AverageTimeSpentMinutes = avgTimeSpentMinutes,
                VideoBookmarkUsagePercent = videoBookmarkUsage,
                LastAccessedAt = lastAccessed,
                DaysSinceLastAccess = daysSinceLastAccess,
                EngagementLevel = engagementLevel,
                Difficulty = difficulty,
                IsPopular = totalEnrollments > 10 && completionRate >= 60
            };
        }).ToList();

        return (orgName, rows);
    }

    [HttpGet("lesson-analytics/summary")]
    public async Task<IActionResult> GetLessonAnalyticsSummary(
        [FromQuery] string? courseId,
        [FromQuery] string? lessonType,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        try
        {
            var (orgName, rows) = await BuildLessonAnalyticsRows(courseId, lessonType, startDate, endDate);

            var typeBreakdown = rows.GroupBy(l => l.LessonType)
                .Select(g => new
                {
                    type = g.Key,
                    count = g.Count(),
                    totalEnrollments = g.Sum(l => l.TotalEnrollments),
                    averageCompletionRate = g.Any() ? Math.Round(g.Average(l => l.CompletionRate), 2) : 0,
                    averageProgress = g.Any() ? Math.Round(g.Average(l => l.AverageProgress), 2) : 0,
                    totalTimeSpentHours = g.Sum(l => l.TotalTimeSpentHours),
                    averageTimeSpentMinutes = g.Any() ? Math.Round(g.Average(l => l.AverageTimeSpentMinutes), 2) : 0
                })
                .OrderByDescending(t => t.count)
                .ToList();

            var engagementBreakdown = rows.GroupBy(l => l.EngagementLevel)
                .Select(g => new
                {
                    level = g.Key,
                    count = g.Count(),
                    percentage = rows.Count > 0 ? Math.Round((g.Count() / (double)rows.Count) * 100, 2) : 0
                })
                .ToList();

            var difficultyBreakdown = rows.GroupBy(l => l.Difficulty)
                .Select(g => new
                {
                    level = g.Key,
                    count = g.Count(),
                    percentage = rows.Count > 0 ? Math.Round((g.Count() / (double)rows.Count) * 100, 2) : 0
                })
                .ToList();

            var topLessonsByCompletionRate = rows
                .OrderByDescending(l => l.CompletionRate)
                .ThenBy(l => l.LessonTitle)
                .Take(10)
                .Select(l => new
                {
                    lessonTitle = l.LessonTitle,
                    completionRate = l.CompletionRate,
                    completions = l.Completions
                })
                .ToList();

            var popularLessons = rows.Where(l => l.IsPopular).Take(5).ToList();
            var problematicLessons = rows.Where(l => l.CompletionRate < 25).OrderBy(l => l.CompletionRate).Take(5).ToList();

            var summary = BuildLessonAnalyticsSummary(rows);
            var header = BuildLessonAnalyticsHeader(orgName, courseId, lessonType, startDate, endDate);

            return Ok(new
            {
                header,
                summary,
                typeBreakdown,
                engagementBreakdown,
                difficultyBreakdown,
                topLessonsByCompletionRate,
                popularLessons,
                problematicLessons
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating lesson analytics summary");
            return StatusCode(500, new { error = "Failed to generate lesson analytics summary", details = ex.Message });
        }
    }

    [HttpGet("lesson-analytics/lessons")]
    public async Task<IActionResult> GetLessonAnalyticsLessons(
        [FromQuery] string? courseId,
        [FromQuery] string? lessonType,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? engagement = null,
        [FromQuery] string? sortBy = "order",
        [FromQuery] string? sortDirection = "desc")
    {
        try
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);
            var normalizedSort = NormalizeLessonAnalyticsSort(sortBy, sortDirection);

            var (orgName, rows) = await BuildLessonAnalyticsRows(courseId, lessonType, startDate, endDate);
            var filteredRows = ApplyLessonAnalyticsTableFiltersAndSort(rows, search, engagement, normalizedSort.SortBy, normalizedSort.SortDirection).ToList();

            var totalLessons = filteredRows.Count;
            var totalPages = totalLessons == 0 ? 1 : (int)Math.Ceiling(totalLessons / (double)pageSize);
            var pagedLessons = filteredRows
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var header = BuildLessonAnalyticsHeader(
                orgName,
                courseId,
                lessonType,
                startDate,
                endDate,
                pageNumber,
                pageSize,
                search,
                engagement,
                normalizedSort.SortBy,
                normalizedSort.SortDirection);

            var pagination = new
            {
                pageNumber,
                pageSize,
                totalLessons,
                totalPages,
                hasPreviousPage = pageNumber > 1,
                hasNextPage = pageNumber < totalPages
            };

            return Ok(new { header, lessons = pagedLessons, pagination });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating lesson analytics lessons list");
            return StatusCode(500, new { error = "Failed to generate lesson analytics lessons list", details = ex.Message });
        }
    }

    [HttpGet("lesson-analytics")]
    public async Task<IActionResult> GetLessonAnalyticsReport(
        [FromQuery] string? courseId,
        [FromQuery] string? lessonType,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? engagement = null,
        [FromQuery] string? sortBy = "order",
        [FromQuery] string? sortDirection = "desc")
    {
        try
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);
            var normalizedSort = NormalizeLessonAnalyticsSort(sortBy, sortDirection);

            var (orgName, rows) = await BuildLessonAnalyticsRows(courseId, lessonType, startDate, endDate);
            var filteredRows = ApplyLessonAnalyticsTableFiltersAndSort(rows, search, engagement, normalizedSort.SortBy, normalizedSort.SortDirection).ToList();

            var typeBreakdown = rows.GroupBy(l => l.LessonType)
                .Select(g => new
                {
                    type = g.Key,
                    count = g.Count(),
                    totalEnrollments = g.Sum(l => l.TotalEnrollments),
                    averageCompletionRate = g.Any() ? Math.Round(g.Average(l => l.CompletionRate), 2) : 0,
                    averageProgress = g.Any() ? Math.Round(g.Average(l => l.AverageProgress), 2) : 0,
                    totalTimeSpentHours = g.Sum(l => l.TotalTimeSpentHours),
                    averageTimeSpentMinutes = g.Any() ? Math.Round(g.Average(l => l.AverageTimeSpentMinutes), 2) : 0
                })
                .OrderByDescending(t => t.count)
                .ToList();

            var engagementBreakdown = rows.GroupBy(l => l.EngagementLevel)
                .Select(g => new
                {
                    level = g.Key,
                    count = g.Count(),
                    percentage = rows.Count > 0 ? Math.Round((g.Count() / (double)rows.Count) * 100, 2) : 0
                })
                .ToList();

            var difficultyBreakdown = rows.GroupBy(l => l.Difficulty)
                .Select(g => new
                {
                    level = g.Key,
                    count = g.Count(),
                    percentage = rows.Count > 0 ? Math.Round((g.Count() / (double)rows.Count) * 100, 2) : 0
                })
                .ToList();

            var topLessonsByCompletionRate = rows
                .OrderByDescending(l => l.CompletionRate)
                .ThenBy(l => l.LessonTitle)
                .Take(10)
                .Select(l => new
                {
                    lessonTitle = l.LessonTitle,
                    completionRate = l.CompletionRate,
                    completions = l.Completions
                })
                .ToList();

            var popularLessons = rows.Where(l => l.IsPopular).Take(5).ToList();
            var problematicLessons = rows.Where(l => l.CompletionRate < 25).OrderBy(l => l.CompletionRate).Take(5).ToList();

            var summary = BuildLessonAnalyticsSummary(rows);

            var totalLessons = filteredRows.Count;
            var totalPages = totalLessons == 0 ? 1 : (int)Math.Ceiling(totalLessons / (double)pageSize);
            var pagedLessons = filteredRows
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var header = BuildLessonAnalyticsHeader(
                orgName,
                courseId,
                lessonType,
                startDate,
                endDate,
                pageNumber,
                pageSize,
                search,
                engagement,
                normalizedSort.SortBy,
                normalizedSort.SortDirection);

            var pagination = new
            {
                pageNumber,
                pageSize,
                totalLessons,
                totalPages,
                hasPreviousPage = pageNumber > 1,
                hasNextPage = pageNumber < totalPages
            };

            return Ok(new
            {
                header,
                lessons = pagedLessons,
                summary,
                typeBreakdown,
                engagementBreakdown,
                difficultyBreakdown,
                topLessonsByCompletionRate,
                popularLessons,
                problematicLessons,
                pagination
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating lesson analytics report");
            return StatusCode(500, new { error = "Failed to generate lesson analytics report", details = ex.Message });
        }
    }

    #endregion

    #region Time Tracking & Engagement Analytics

    private sealed class TimeTrackingUserRow
    {
        public string UserId { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public double TotalTimeSpentHours { get; set; }
        public int CoursesAccessed { get; set; }
        public int LessonsAccessed { get; set; }
        public DateTime? LastActivityDate { get; set; }
        public double AverageSessionMinutes { get; set; }
        public int ActiveDays { get; set; }
    }

    private sealed class TimeTrackingCourseRow
    {
        public string? CourseId { get; set; }
        public string CourseTitle { get; set; } = string.Empty;
        public double TotalTimeSpentHours { get; set; }
        public int UniqueLearners { get; set; }
        public double AverageTimePerLearnerMinutes { get; set; }
        public int TotalLessons { get; set; }
        public int CompletedLessons { get; set; }
    }

    private sealed class TimeTrackingLessonRow
    {
        public long? LessonId { get; set; }
        public string LessonTitle { get; set; } = string.Empty;
        public string LessonType { get; set; } = string.Empty;
        public string? CourseId { get; set; }
        public string CourseTitle { get; set; } = string.Empty;
        public double TotalTimeSpentHours { get; set; }
        public int UniqueLearners { get; set; }
        public double AverageTimePerLearnerMinutes { get; set; }
        public int Completions { get; set; }
        public double CompletionRate { get; set; }
        public int VideoBookmarkCount { get; set; }
        public DateTime? LastAccessedAt { get; set; }
    }

    private sealed class TimeTrackingDailyRow
    {
        public DateTime Date { get; set; }
        public double TotalTimeSpentHours { get; set; }
        public int UniqueLearners { get; set; }
        public int LessonsAccessed { get; set; }
        public int CoursesAccessed { get; set; }
    }

    private static object BuildTimeTrackingHeader(
        string orgName,
        DateTime start,
        DateTime end,
        string? userId,
        string? courseId,
        DateTime? startDate,
        DateTime? endDate,
        string? table = null,
        int? pageNumber = null,
        int? pageSize = null,
        string? sortBy = null,
        string? sortDirection = null)
    {
        return new
        {
            reportName = "Time Tracking & Engagement Report",
            generatedAt = DateTime.UtcNow,
            dateRange = new
            {
                start,
                end
            },
            organization = orgName,
            filters = new
            {
                userId,
                courseId,
                startDate,
                endDate,
                table,
                pageNumber,
                pageSize,
                sortBy,
                sortDirection
            }
        };
    }

    private static (string SortBy, string SortDirection) NormalizeTimeTrackingSort(string table, string? sortBy, string? sortDirection)
    {
        var normalizedDirection = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase)
            ? "asc"
            : "desc";

        var requested = (sortBy ?? string.Empty).Trim().ToLowerInvariant();
        var normalizedSortBy = table switch
        {
            "courses" => requested switch
            {
                "coursetitle" => "courseTitle",
                "totaltimespenthours" => "totalTimeSpentHours",
                "uniquelearners" => "uniqueLearners",
                "averagetimeperlearnerminutes" => "averageTimePerLearnerMinutes",
                "totallessons" => "totalLessons",
                "completedlessons" => "completedLessons",
                _ => "totalTimeSpentHours"
            },
            "lessons" => requested switch
            {
                "lessontitle" => "lessonTitle",
                "lessontype" => "lessonType",
                "coursetitle" => "courseTitle",
                "totaltimespenthours" => "totalTimeSpentHours",
                "uniquelearners" => "uniqueLearners",
                "averagetimeperlearnerminutes" => "averageTimePerLearnerMinutes",
                "completions" => "completions",
                "completionrate" => "completionRate",
                "videobookmarkcount" => "videoBookmarkCount",
                "lastaccessedat" => "lastAccessedAt",
                _ => "totalTimeSpentHours"
            },
            "daily" => requested switch
            {
                "date" => "date",
                "totaltimespenthours" => "totalTimeSpentHours",
                "uniquelearners" => "uniqueLearners",
                "lessonsaccessed" => "lessonsAccessed",
                "coursesaccessed" => "coursesAccessed",
                _ => "date"
            },
            _ => requested switch
            {
                "username" => "userName",
                "email" => "email",
                "totaltimespenthours" => "totalTimeSpentHours",
                "coursesaccessed" => "coursesAccessed",
                "lessonsaccessed" => "lessonsAccessed",
                "averagesessionminutes" => "averageSessionMinutes",
                "activedays" => "activeDays",
                "lastactivitydate" => "lastActivityDate",
                _ => "totalTimeSpentHours"
            }
        };

        return (normalizedSortBy, normalizedDirection);
    }

    private async Task<(string OrgName, DateTime Start, DateTime End, List<TimeTrackingUserRow> Users, List<TimeTrackingCourseRow> Courses, List<TimeTrackingLessonRow> Lessons, List<TimeTrackingDailyRow> Daily, List<object> TimeByLessonType, object Summary)> BuildTimeTrackingData(
        string? userId,
        string? courseId,
        DateTime? startDate,
        DateTime? endDate)
    {
        var orgId = await GetOrgIdFilter();
        var start = startDate ?? DateTime.UtcNow.AddMonths(-1);
        var end = endDate ?? DateTime.UtcNow;

        var orgName = "All Organizations";
        if (orgId.HasValue)
        {
            var org = await _context.Organisations.FindAsync(orgId.Value);
            orgName = org?.Name ?? "Unknown Organization";
        }

        var progressQuery = _context.LearnerProgresses
            .AsNoTracking()
            .Include(lp => lp.User)
            .Include(lp => lp.Course)
            .Include(lp => lp.Lesson)
            .Where(lp => lp.TotalTimeSpentSeconds > 0);

        if (!string.IsNullOrEmpty(userId))
            progressQuery = progressQuery.Where(lp => lp.UserId == userId);

        if (!string.IsNullOrEmpty(courseId))
            progressQuery = progressQuery.Where(lp => lp.CourseId == courseId);

        if (orgId.HasValue)
            progressQuery = progressQuery.Where(lp => lp.Course != null && lp.Course.OrganisationId == orgId);

        progressQuery = progressQuery.Where(lp =>
            lp.LastAccessedAt.HasValue && lp.LastAccessedAt.Value >= start && lp.LastAccessedAt.Value <= end);

        var progressData = await progressQuery.ToListAsync();

        var userTimeAnalytics = progressData
            .GroupBy(lp => new { lp.UserId, lp.User!.FirstName, lp.User.LastName, lp.User.Email })
            .Select(g => new TimeTrackingUserRow
            {
                UserId = g.Key.UserId,
                UserName = $"{g.Key.FirstName} {g.Key.LastName}",
                Email = g.Key.Email ?? string.Empty,
                TotalTimeSpentHours = Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 3600.0, 2),
                CoursesAccessed = g.Select(lp => lp.CourseId).Distinct().Count(),
                LessonsAccessed = g.Count(lp => lp.LessonId != null),
                LastActivityDate = g.Max(lp => lp.LastAccessedAt),
                AverageSessionMinutes = g.Any() ? Math.Round(g.Average(lp => lp.TotalTimeSpentSeconds) / 60.0, 2) : 0,
                ActiveDays = g.Where(lp => lp.LastAccessedAt.HasValue)
                    .Select(lp => lp.LastAccessedAt!.Value.Date)
                    .Distinct()
                    .Count()
            })
            .ToList();

        var courseTimeAnalytics = progressData
            .Where(lp => lp.CourseId != null)
            .GroupBy(lp => new { lp.CourseId, CourseTitle = lp.Course!.Title })
            .Select(g => new TimeTrackingCourseRow
            {
                CourseId = g.Key.CourseId,
                CourseTitle = g.Key.CourseTitle,
                TotalTimeSpentHours = Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 3600.0, 2),
                UniqueLearners = g.Select(lp => lp.UserId).Distinct().Count(),
                AverageTimePerLearnerMinutes = g.Any()
                    ? Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 60.0 / g.Select(lp => lp.UserId).Distinct().Count(), 2)
                    : 0,
                TotalLessons = g.Count(lp => lp.LessonId != null),
                CompletedLessons = g.Count(lp => lp.LessonId != null && lp.Completed)
            })
            .ToList();

        var lessonTimeAnalytics = progressData
            .Where(lp => lp.LessonId != null)
            .GroupBy(lp => new { lp.LessonId, LessonTitle = lp.Lesson!.Title, lp.Lesson.Type, lp.CourseId, CourseTitle = lp.Course!.Title })
            .Select(g => new TimeTrackingLessonRow
            {
                LessonId = g.Key.LessonId,
                LessonTitle = g.Key.LessonTitle,
                LessonType = g.Key.Type ?? "Unknown",
                CourseId = g.Key.CourseId,
                CourseTitle = g.Key.CourseTitle,
                TotalTimeSpentHours = Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 3600.0, 2),
                UniqueLearners = g.Select(lp => lp.UserId).Distinct().Count(),
                AverageTimePerLearnerMinutes = g.Any()
                    ? Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 60.0 / g.Select(lp => lp.UserId).Distinct().Count(), 2)
                    : 0,
                Completions = g.Count(lp => lp.Completed),
                CompletionRate = g.Any() ? Math.Round((g.Count(lp => lp.Completed) / (double)g.Count()) * 100, 2) : 0,
                VideoBookmarkCount = g.Count(lp => lp.VideoTimestamp.HasValue && lp.VideoTimestamp > 0),
                LastAccessedAt = g.Max(lp => lp.LastAccessedAt)
            })
            .ToList();

        var dailyTimeBreakdown = progressData
            .Where(lp => lp.LastAccessedAt.HasValue)
            .GroupBy(lp => lp.LastAccessedAt!.Value.Date)
            .Select(g => new TimeTrackingDailyRow
            {
                Date = g.Key,
                TotalTimeSpentHours = Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 3600.0, 2),
                UniqueLearners = g.Select(lp => lp.UserId).Distinct().Count(),
                LessonsAccessed = g.Count(lp => lp.LessonId != null),
                CoursesAccessed = g.Select(lp => lp.CourseId).Distinct().Count()
            })
            .ToList();

        var timeByLessonType = progressData
            .Where(lp => lp.LessonId != null && lp.Lesson != null)
            .GroupBy(lp => lp.Lesson!.Type ?? "Unknown")
            .Select(g => (object)new
            {
                lessonType = g.Key,
                totalTimeSpentHours = Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 3600.0, 2),
                lessonCount = g.Select(lp => lp.LessonId).Distinct().Count(),
                averageTimePerLessonMinutes = g.Any()
                    ? Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 60.0 / g.Select(lp => lp.LessonId).Distinct().Count(), 2)
                    : 0
            })
            .ToList();

        var summary = new
        {
            totalTimeSpentHours = Math.Round(progressData.Sum(lp => lp.TotalTimeSpentSeconds) / 3600.0, 2),
            totalUniqueLearners = progressData.Select(lp => lp.UserId).Distinct().Count(),
            totalCoursesAccessed = progressData.Select(lp => lp.CourseId).Distinct().Count(),
            totalLessonsAccessed = progressData.Count(lp => lp.LessonId != null),
            averageTimePerLearnerHours = userTimeAnalytics.Any() ? Math.Round(userTimeAnalytics.Average(u => u.TotalTimeSpentHours), 2) : 0,
            averageTimePerCourseHours = courseTimeAnalytics.Any() ? Math.Round(courseTimeAnalytics.Average(c => c.TotalTimeSpentHours), 2) : 0,
            averageTimePerLessonMinutes = lessonTimeAnalytics.Any() ? Math.Round(lessonTimeAnalytics.Average(l => l.AverageTimePerLearnerMinutes), 2) : 0,
            mostActiveDay = dailyTimeBreakdown.OrderByDescending(d => d.TotalTimeSpentHours).FirstOrDefault()?.Date.ToString("yyyy-MM-dd") ?? "N/A",
            mostTimeConsuming = courseTimeAnalytics.OrderByDescending(c => c.TotalTimeSpentHours).FirstOrDefault()?.CourseTitle ?? "N/A",
            peakActivityHours = Math.Round(dailyTimeBreakdown.OrderByDescending(d => d.TotalTimeSpentHours).FirstOrDefault()?.TotalTimeSpentHours ?? 0, 2)
        };

        return (orgName, start, end, userTimeAnalytics, courseTimeAnalytics, lessonTimeAnalytics, dailyTimeBreakdown, timeByLessonType, summary);
    }

    [HttpGet("time-tracking/summary")]
    public async Task<IActionResult> GetTimeTrackingSummary(
        [FromQuery] string? userId,
        [FromQuery] string? courseId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        try
        {
            var (orgName, start, end, users, courses, lessons, daily, timeByLessonType, summary) = await BuildTimeTrackingData(userId, courseId, startDate, endDate);

            var header = BuildTimeTrackingHeader(orgName, start, end, userId, courseId, startDate, endDate);

            return Ok(new
            {
                header,
                summary,
                dailyTimeBreakdown = daily.OrderBy(d => d.Date).ToList(),
                timeByLessonType,
                topUsers = users.OrderByDescending(u => u.TotalTimeSpentHours).Take(10).ToList(),
                topCourses = courses.OrderByDescending(c => c.TotalTimeSpentHours).Take(10).ToList(),
                topLessons = lessons.OrderByDescending(l => l.TotalTimeSpentHours).Take(20).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating time tracking summary");
            return StatusCode(500, new { error = "Failed to generate time tracking summary", details = ex.Message });
        }
    }

    [HttpGet("time-tracking/table")]
    public async Task<IActionResult> GetTimeTrackingTable(
        [FromQuery] string? table = "users",
        [FromQuery] string? userId = null,
        [FromQuery] string? courseId = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDirection = null)
    {
        try
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);

            var tableName = (table ?? "users").Trim().ToLowerInvariant() switch
            {
                "courses" => "courses",
                "lessons" => "lessons",
                "daily" => "daily",
                _ => "users"
            };

            var normalizedSort = NormalizeTimeTrackingSort(tableName, sortBy, sortDirection);
            var (orgName, start, end, users, courses, lessons, daily, _, _) = await BuildTimeTrackingData(userId, courseId, startDate, endDate);

            object items;
            int totalRows;

            switch (tableName)
            {
                case "courses":
                {
                    var sorted = (normalizedSort.SortBy, normalizedSort.SortDirection) switch
                    {
                        ("courseTitle", "asc") => courses.OrderBy(c => c.CourseTitle),
                        ("courseTitle", _) => courses.OrderByDescending(c => c.CourseTitle),
                        ("uniqueLearners", "asc") => courses.OrderBy(c => c.UniqueLearners),
                        ("uniqueLearners", _) => courses.OrderByDescending(c => c.UniqueLearners),
                        ("averageTimePerLearnerMinutes", "asc") => courses.OrderBy(c => c.AverageTimePerLearnerMinutes),
                        ("averageTimePerLearnerMinutes", _) => courses.OrderByDescending(c => c.AverageTimePerLearnerMinutes),
                        ("totalLessons", "asc") => courses.OrderBy(c => c.TotalLessons),
                        ("totalLessons", _) => courses.OrderByDescending(c => c.TotalLessons),
                        ("completedLessons", "asc") => courses.OrderBy(c => c.CompletedLessons),
                        ("completedLessons", _) => courses.OrderByDescending(c => c.CompletedLessons),
                        ("totalTimeSpentHours", "asc") => courses.OrderBy(c => c.TotalTimeSpentHours),
                        _ => courses.OrderByDescending(c => c.TotalTimeSpentHours)
                    };
                    totalRows = sorted.Count();
                    items = sorted.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();
                    break;
                }
                case "lessons":
                {
                    var sorted = (normalizedSort.SortBy, normalizedSort.SortDirection) switch
                    {
                        ("lessonTitle", "asc") => lessons.OrderBy(l => l.LessonTitle),
                        ("lessonTitle", _) => lessons.OrderByDescending(l => l.LessonTitle),
                        ("lessonType", "asc") => lessons.OrderBy(l => l.LessonType),
                        ("lessonType", _) => lessons.OrderByDescending(l => l.LessonType),
                        ("courseTitle", "asc") => lessons.OrderBy(l => l.CourseTitle),
                        ("courseTitle", _) => lessons.OrderByDescending(l => l.CourseTitle),
                        ("uniqueLearners", "asc") => lessons.OrderBy(l => l.UniqueLearners),
                        ("uniqueLearners", _) => lessons.OrderByDescending(l => l.UniqueLearners),
                        ("averageTimePerLearnerMinutes", "asc") => lessons.OrderBy(l => l.AverageTimePerLearnerMinutes),
                        ("averageTimePerLearnerMinutes", _) => lessons.OrderByDescending(l => l.AverageTimePerLearnerMinutes),
                        ("completions", "asc") => lessons.OrderBy(l => l.Completions),
                        ("completions", _) => lessons.OrderByDescending(l => l.Completions),
                        ("completionRate", "asc") => lessons.OrderBy(l => l.CompletionRate),
                        ("completionRate", _) => lessons.OrderByDescending(l => l.CompletionRate),
                        ("videoBookmarkCount", "asc") => lessons.OrderBy(l => l.VideoBookmarkCount),
                        ("videoBookmarkCount", _) => lessons.OrderByDescending(l => l.VideoBookmarkCount),
                        ("lastAccessedAt", "asc") => lessons.OrderBy(l => l.LastAccessedAt),
                        ("lastAccessedAt", _) => lessons.OrderByDescending(l => l.LastAccessedAt),
                        ("totalTimeSpentHours", "asc") => lessons.OrderBy(l => l.TotalTimeSpentHours),
                        _ => lessons.OrderByDescending(l => l.TotalTimeSpentHours)
                    };
                    totalRows = sorted.Count();
                    items = sorted.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();
                    break;
                }
                case "daily":
                {
                    var sorted = (normalizedSort.SortBy, normalizedSort.SortDirection) switch
                    {
                        ("totalTimeSpentHours", "asc") => daily.OrderBy(d => d.TotalTimeSpentHours),
                        ("totalTimeSpentHours", _) => daily.OrderByDescending(d => d.TotalTimeSpentHours),
                        ("uniqueLearners", "asc") => daily.OrderBy(d => d.UniqueLearners),
                        ("uniqueLearners", _) => daily.OrderByDescending(d => d.UniqueLearners),
                        ("lessonsAccessed", "asc") => daily.OrderBy(d => d.LessonsAccessed),
                        ("lessonsAccessed", _) => daily.OrderByDescending(d => d.LessonsAccessed),
                        ("coursesAccessed", "asc") => daily.OrderBy(d => d.CoursesAccessed),
                        ("coursesAccessed", _) => daily.OrderByDescending(d => d.CoursesAccessed),
                        ("date", "asc") => daily.OrderBy(d => d.Date),
                        _ => daily.OrderByDescending(d => d.Date)
                    };
                    totalRows = sorted.Count();
                    items = sorted.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();
                    break;
                }
                default:
                {
                    var sorted = (normalizedSort.SortBy, normalizedSort.SortDirection) switch
                    {
                        ("userName", "asc") => users.OrderBy(u => u.UserName),
                        ("userName", _) => users.OrderByDescending(u => u.UserName),
                        ("email", "asc") => users.OrderBy(u => u.Email),
                        ("email", _) => users.OrderByDescending(u => u.Email),
                        ("coursesAccessed", "asc") => users.OrderBy(u => u.CoursesAccessed),
                        ("coursesAccessed", _) => users.OrderByDescending(u => u.CoursesAccessed),
                        ("lessonsAccessed", "asc") => users.OrderBy(u => u.LessonsAccessed),
                        ("lessonsAccessed", _) => users.OrderByDescending(u => u.LessonsAccessed),
                        ("averageSessionMinutes", "asc") => users.OrderBy(u => u.AverageSessionMinutes),
                        ("averageSessionMinutes", _) => users.OrderByDescending(u => u.AverageSessionMinutes),
                        ("activeDays", "asc") => users.OrderBy(u => u.ActiveDays),
                        ("activeDays", _) => users.OrderByDescending(u => u.ActiveDays),
                        ("lastActivityDate", "asc") => users.OrderBy(u => u.LastActivityDate),
                        ("lastActivityDate", _) => users.OrderByDescending(u => u.LastActivityDate),
                        ("totalTimeSpentHours", "asc") => users.OrderBy(u => u.TotalTimeSpentHours),
                        _ => users.OrderByDescending(u => u.TotalTimeSpentHours)
                    };
                    totalRows = sorted.Count();
                    items = sorted.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();
                    break;
                }
            }

            var totalPages = totalRows == 0 ? 1 : (int)Math.Ceiling(totalRows / (double)pageSize);
            var header = BuildTimeTrackingHeader(orgName, start, end, userId, courseId, startDate, endDate, tableName, pageNumber, pageSize, normalizedSort.SortBy, normalizedSort.SortDirection);

            var pagination = new
            {
                pageNumber,
                pageSize,
                totalRows,
                totalPages,
                hasPreviousPage = pageNumber > 1,
                hasNextPage = pageNumber < totalPages
            };

            return Ok(new { header, table = tableName, rows = items, pagination });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating time tracking table");
            return StatusCode(500, new { error = "Failed to generate time tracking table", details = ex.Message });
        }
    }

    [HttpGet("time-tracking")]
    public async Task<IActionResult> GetTimeTrackingReport(
        [FromQuery] string? userId,
        [FromQuery] string? courseId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? table = "users",
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDirection = null)
    {
        try
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Clamp(pageSize, 1, 500);
            var tableName = (table ?? "users").Trim().ToLowerInvariant() switch
            {
                "courses" => "courses",
                "lessons" => "lessons",
                "daily" => "daily",
                _ => "users"
            };

            var normalizedSort = NormalizeTimeTrackingSort(tableName, sortBy, sortDirection);
            var (orgName, start, end, users, courses, lessons, daily, timeByLessonType, summary) = await BuildTimeTrackingData(userId, courseId, startDate, endDate);

            object rows;
            int totalRows;
            switch (tableName)
            {
                case "courses":
                {
                    var sorted = (normalizedSort.SortBy, normalizedSort.SortDirection) switch
                    {
                        ("courseTitle", "asc") => courses.OrderBy(c => c.CourseTitle),
                        ("courseTitle", _) => courses.OrderByDescending(c => c.CourseTitle),
                        ("uniqueLearners", "asc") => courses.OrderBy(c => c.UniqueLearners),
                        ("uniqueLearners", _) => courses.OrderByDescending(c => c.UniqueLearners),
                        ("averageTimePerLearnerMinutes", "asc") => courses.OrderBy(c => c.AverageTimePerLearnerMinutes),
                        ("averageTimePerLearnerMinutes", _) => courses.OrderByDescending(c => c.AverageTimePerLearnerMinutes),
                        ("totalLessons", "asc") => courses.OrderBy(c => c.TotalLessons),
                        ("totalLessons", _) => courses.OrderByDescending(c => c.TotalLessons),
                        ("completedLessons", "asc") => courses.OrderBy(c => c.CompletedLessons),
                        ("completedLessons", _) => courses.OrderByDescending(c => c.CompletedLessons),
                        ("totalTimeSpentHours", "asc") => courses.OrderBy(c => c.TotalTimeSpentHours),
                        _ => courses.OrderByDescending(c => c.TotalTimeSpentHours)
                    };
                    totalRows = sorted.Count();
                    rows = sorted.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();
                    break;
                }
                case "lessons":
                {
                    var sorted = (normalizedSort.SortBy, normalizedSort.SortDirection) switch
                    {
                        ("lessonTitle", "asc") => lessons.OrderBy(l => l.LessonTitle),
                        ("lessonTitle", _) => lessons.OrderByDescending(l => l.LessonTitle),
                        ("lessonType", "asc") => lessons.OrderBy(l => l.LessonType),
                        ("lessonType", _) => lessons.OrderByDescending(l => l.LessonType),
                        ("courseTitle", "asc") => lessons.OrderBy(l => l.CourseTitle),
                        ("courseTitle", _) => lessons.OrderByDescending(l => l.CourseTitle),
                        ("uniqueLearners", "asc") => lessons.OrderBy(l => l.UniqueLearners),
                        ("uniqueLearners", _) => lessons.OrderByDescending(l => l.UniqueLearners),
                        ("averageTimePerLearnerMinutes", "asc") => lessons.OrderBy(l => l.AverageTimePerLearnerMinutes),
                        ("averageTimePerLearnerMinutes", _) => lessons.OrderByDescending(l => l.AverageTimePerLearnerMinutes),
                        ("completions", "asc") => lessons.OrderBy(l => l.Completions),
                        ("completions", _) => lessons.OrderByDescending(l => l.Completions),
                        ("completionRate", "asc") => lessons.OrderBy(l => l.CompletionRate),
                        ("completionRate", _) => lessons.OrderByDescending(l => l.CompletionRate),
                        ("videoBookmarkCount", "asc") => lessons.OrderBy(l => l.VideoBookmarkCount),
                        ("videoBookmarkCount", _) => lessons.OrderByDescending(l => l.VideoBookmarkCount),
                        ("lastAccessedAt", "asc") => lessons.OrderBy(l => l.LastAccessedAt),
                        ("lastAccessedAt", _) => lessons.OrderByDescending(l => l.LastAccessedAt),
                        ("totalTimeSpentHours", "asc") => lessons.OrderBy(l => l.TotalTimeSpentHours),
                        _ => lessons.OrderByDescending(l => l.TotalTimeSpentHours)
                    };
                    totalRows = sorted.Count();
                    rows = sorted.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();
                    break;
                }
                case "daily":
                {
                    var sorted = (normalizedSort.SortBy, normalizedSort.SortDirection) switch
                    {
                        ("totalTimeSpentHours", "asc") => daily.OrderBy(d => d.TotalTimeSpentHours),
                        ("totalTimeSpentHours", _) => daily.OrderByDescending(d => d.TotalTimeSpentHours),
                        ("uniqueLearners", "asc") => daily.OrderBy(d => d.UniqueLearners),
                        ("uniqueLearners", _) => daily.OrderByDescending(d => d.UniqueLearners),
                        ("lessonsAccessed", "asc") => daily.OrderBy(d => d.LessonsAccessed),
                        ("lessonsAccessed", _) => daily.OrderByDescending(d => d.LessonsAccessed),
                        ("coursesAccessed", "asc") => daily.OrderBy(d => d.CoursesAccessed),
                        ("coursesAccessed", _) => daily.OrderByDescending(d => d.CoursesAccessed),
                        ("date", "asc") => daily.OrderBy(d => d.Date),
                        _ => daily.OrderByDescending(d => d.Date)
                    };
                    totalRows = sorted.Count();
                    rows = sorted.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();
                    break;
                }
                default:
                {
                    var sorted = (normalizedSort.SortBy, normalizedSort.SortDirection) switch
                    {
                        ("userName", "asc") => users.OrderBy(u => u.UserName),
                        ("userName", _) => users.OrderByDescending(u => u.UserName),
                        ("email", "asc") => users.OrderBy(u => u.Email),
                        ("email", _) => users.OrderByDescending(u => u.Email),
                        ("coursesAccessed", "asc") => users.OrderBy(u => u.CoursesAccessed),
                        ("coursesAccessed", _) => users.OrderByDescending(u => u.CoursesAccessed),
                        ("lessonsAccessed", "asc") => users.OrderBy(u => u.LessonsAccessed),
                        ("lessonsAccessed", _) => users.OrderByDescending(u => u.LessonsAccessed),
                        ("averageSessionMinutes", "asc") => users.OrderBy(u => u.AverageSessionMinutes),
                        ("averageSessionMinutes", _) => users.OrderByDescending(u => u.AverageSessionMinutes),
                        ("activeDays", "asc") => users.OrderBy(u => u.ActiveDays),
                        ("activeDays", _) => users.OrderByDescending(u => u.ActiveDays),
                        ("lastActivityDate", "asc") => users.OrderBy(u => u.LastActivityDate),
                        ("lastActivityDate", _) => users.OrderByDescending(u => u.LastActivityDate),
                        ("totalTimeSpentHours", "asc") => users.OrderBy(u => u.TotalTimeSpentHours),
                        _ => users.OrderByDescending(u => u.TotalTimeSpentHours)
                    };
                    totalRows = sorted.Count();
                    rows = sorted.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();
                    break;
                }
            }

            var totalPages = totalRows == 0 ? 1 : (int)Math.Ceiling(totalRows / (double)pageSize);
            var header = BuildTimeTrackingHeader(orgName, start, end, userId, courseId, startDate, endDate, tableName, pageNumber, pageSize, normalizedSort.SortBy, normalizedSort.SortDirection);

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
                summary,
                dailyTimeBreakdown = daily.OrderBy(d => d.Date).ToList(),
                timeByLessonType,
                table = tableName,
                rows,
                pagination
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating time tracking report");
            return StatusCode(500, new { error = "Failed to generate time tracking report", details = ex.Message });
        }
    }

    #endregion

    #region Learning Pathway Reports

    private sealed class PathwayProgressReportRow
    {
        public string PathwayId { get; set; } = string.Empty;
        public string PathwayTitle { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsActive { get; set; }
        public int CourseCount { get; set; }
        public int TotalEnrollments { get; set; }
        public int Completions { get; set; }
        public int InProgress { get; set; }
        public int NotStarted { get; set; }
        public double CompletionRate { get; set; }
        public double AverageProgress { get; set; }
        public double AverageCompletionTime { get; set; }
        public double DropoutRate { get; set; }
        public string EngagementLevel { get; set; } = "No Data";
        public int RecentEnrollments { get; set; }
        public bool IsPopular { get; set; }
    }

    private static object BuildPathwayProgressHeader(
        string orgName,
        DateTime? startDate,
        DateTime? endDate,
        bool? activeOnly,
        int? pageNumber = null,
        int? pageSize = null,
        string? search = null,
        string? sortBy = null,
        string? sortDirection = null)
    {
        return new
        {
            reportName = "Learning Pathway Progress Report",
            generatedAt = DateTime.UtcNow,
            dateRange = startDate.HasValue || endDate.HasValue ? new
            {
                start = startDate,
                end = endDate
            } : null,
            organization = orgName,
            filters = new
            {
                startDate,
                endDate,
                activeOnly,
                pageNumber,
                pageSize,
                search,
                sortBy,
                sortDirection
            }
        };
    }

    private static (string SortBy, string SortDirection) NormalizePathwayProgressSort(string? sortBy, string? sortDirection)
    {
        var normalizedDirection = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase)
            ? "asc"
            : "desc";

        var requested = (sortBy ?? string.Empty).Trim().ToLowerInvariant();
        var normalizedSortBy = requested switch
        {
            "pathwaytitle" => "pathwayTitle",
            "isactive" => "isActive",
            "coursecount" => "courseCount",
            "totalenrollments" => "totalEnrollments",
            "completions" => "completions",
            "inprogress" => "inProgress",
            "notstarted" => "notStarted",
            "completionrate" => "completionRate",
            "averageprogress" => "averageProgress",
            "averagecompletiontime" => "averageCompletionTime",
            "engagementlevel" => "engagementLevel",
            "recentenrollments" => "recentEnrollments",
            _ => "totalEnrollments"
        };

        return (normalizedSortBy, normalizedDirection);
    }

    private async Task<(string OrgName, List<PathwayProgressReportRow> Rows, List<object> CompletionTrends)> BuildPathwayProgressData(
        DateTime? startDate,
        DateTime? endDate,
        bool? activeOnly,
        bool includeCompletionTrends)
    {
        var orgId = await GetOrgIdFilter();

        var orgName = "All Organizations";
        if (orgId.HasValue)
        {
            var org = await _context.Organisations.FindAsync(orgId.Value);
            orgName = org?.Name ?? "Unknown Organization";
        }

        var pathwaysQuery = _context.LearningPathways.AsNoTracking();
        if (orgId.HasValue)
            pathwaysQuery = pathwaysQuery.Where(p => p.OrganisationId == orgId);

        if (activeOnly == true)
            pathwaysQuery = pathwaysQuery.Where(p => p.IsActive);

        var pathways = await pathwaysQuery
            .Select(p => new { p.Id, p.Title, p.Description, p.IsActive })
            .ToListAsync();

        var pathwayIds = pathways.Select(p => p.Id).ToList();
        if (pathwayIds.Count == 0)
        {
            return (orgName, new List<PathwayProgressReportRow>(), new List<object>());
        }

        var progressQuery = _context.LearnerPathwayProgresses
            .AsNoTracking()
            .Where(lpp => pathwayIds.Contains(lpp.LearningPathwayId));

        if (startDate.HasValue)
            progressQuery = progressQuery.Where(lpp => lpp.EnrolledAt >= startDate.Value);
        if (endDate.HasValue)
            progressQuery = progressQuery.Where(lpp => lpp.EnrolledAt <= endDate.Value);

        var recentThreshold = DateTime.UtcNow.AddDays(-30);

        var pathwayStats = await progressQuery
            .GroupBy(lpp => lpp.LearningPathwayId)
            .Select(g => new
            {
                PathwayId = g.Key,
                TotalEnrollments = g.Count(),
                Completions = g.Count(lpp => lpp.IsCompleted),
                InProgress = g.Count(lpp => !lpp.IsCompleted && lpp.ProgressPercent > 0),
                NotStarted = g.Count(lpp => lpp.ProgressPercent == 0),
                AverageProgress = g.Average(lpp => (double?)lpp.ProgressPercent) ?? 0,
                AverageCompletionTime = g.Average(lpp => lpp.IsCompleted && lpp.CompletedAt.HasValue
                    ? (double?)EF.Functions.DateDiffDay(lpp.EnrolledAt, lpp.CompletedAt.Value)
                    : null) ?? 0,
                RecentEnrollments = g.Count(lpp => lpp.EnrolledAt >= recentThreshold)
            })
            .ToListAsync();

        var courseCounts = await _context.PathwayCourses
            .AsNoTracking()
            .Where(pc => pathwayIds.Contains(pc.LearningPathwayId))
            .GroupBy(pc => pc.LearningPathwayId)
            .Select(g => new { PathwayId = g.Key, CourseCount = g.Count() })
            .ToDictionaryAsync(x => x.PathwayId, x => x.CourseCount);

        var statsByPathway = pathwayStats.ToDictionary(x => x.PathwayId, x => x);

        var rows = pathways
            .Select(p =>
            {
                statsByPathway.TryGetValue(p.Id, out var stats);

                var totalEnrollments = stats?.TotalEnrollments ?? 0;
                var completions = stats?.Completions ?? 0;
                var inProgress = stats?.InProgress ?? 0;
                var notStarted = stats?.NotStarted ?? 0;
                var averageProgress = Math.Round(stats?.AverageProgress ?? 0, 2);
                var averageCompletionTime = Math.Round(stats?.AverageCompletionTime ?? 0, 1);
                var completionRate = totalEnrollments > 0
                    ? Math.Round((completions / (double)totalEnrollments) * 100, 2)
                    : 0;

                string engagementLevel;
                if (totalEnrollments > 50 && completionRate >= 60) engagementLevel = "Excellent";
                else if (totalEnrollments > 20 && completionRate >= 40) engagementLevel = "Good";
                else if (totalEnrollments > 0 && completionRate >= 20) engagementLevel = "Fair";
                else if (totalEnrollments > 0) engagementLevel = "Poor";
                else engagementLevel = "No Data";

                return new PathwayProgressReportRow
                {
                    PathwayId = p.Id,
                    PathwayTitle = p.Title,
                    Description = p.Description,
                    IsActive = p.IsActive,
                    CourseCount = courseCounts.TryGetValue(p.Id, out var count) ? count : 0,
                    TotalEnrollments = totalEnrollments,
                    Completions = completions,
                    InProgress = inProgress,
                    NotStarted = notStarted,
                    CompletionRate = completionRate,
                    AverageProgress = averageProgress,
                    AverageCompletionTime = averageCompletionTime,
                    DropoutRate = totalEnrollments > 0 ? Math.Round(100 - completionRate, 2) : 0,
                    EngagementLevel = engagementLevel,
                    RecentEnrollments = stats?.RecentEnrollments ?? 0,
                    IsPopular = totalEnrollments > 20 && completionRate >= 50
                };
            })
            .OrderByDescending(p => p.TotalEnrollments)
            .ToList();

        var completionTrends = new List<object>();
        if (includeCompletionTrends)
        {
            var sixMonthsAgo = DateTime.UtcNow.AddMonths(-6);
            var trendRows = await progressQuery
                .Where(lpp => lpp.IsCompleted && lpp.CompletedAt.HasValue && lpp.CompletedAt >= sixMonthsAgo)
                .GroupBy(lpp => new { Year = lpp.CompletedAt!.Value.Year, Month = lpp.CompletedAt.Value.Month })
                .Select(g => new
                {
                    year = g.Key.Year,
                    month = g.Key.Month,
                    completions = g.Count()
                })
                .OrderBy(t => t.year)
                .ThenBy(t => t.month)
                .ToListAsync();

            completionTrends = trendRows
                .Select(t => (object)new
                {
                    month = $"{t.year}-{t.month:D2}",
                    completions = t.completions
                })
                .ToList();
        }

        return (orgName, rows, completionTrends);
    }

    [HttpGet("pathway-progress")]
    public async Task<IActionResult> GetPathwayProgressReport(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] bool? activeOnly)
    {
        try
        {
            var (orgName, rows, completionTrends) = await BuildPathwayProgressData(startDate, endDate, activeOnly, includeCompletionTrends: true);

            var engagementBreakdown = rows.GroupBy(p => p.EngagementLevel)
                .Select(g => new
                {
                    level = g.Key,
                    count = g.Count(),
                    percentage = rows.Count > 0 ? Math.Round((g.Count() / (double)rows.Count) * 100, 2) : 0
                })
                .ToList();

            var topPathways = rows
                .Where(p => p.TotalEnrollments > 0)
                .OrderByDescending(p => p.CompletionRate)
                .Take(5)
                .ToList();

            var strugglingPathways = rows
                .Where(p => p.TotalEnrollments > 5 && p.CompletionRate < 30)
                .OrderBy(p => p.CompletionRate)
                .Take(5)
                .ToList();

            var popularPathways = rows
                .Where(p => p.IsPopular)
                .OrderByDescending(p => p.TotalEnrollments)
                .Take(5)
                .ToList();

            var summary = new
            {
                totalPathways = rows.Count,
                activePathways = rows.Count(p => p.IsActive),
                totalEnrollments = rows.Sum(p => p.TotalEnrollments),
                totalCompletions = rows.Sum(p => p.Completions),
                averageCompletionRate = rows.Any() ? Math.Round(rows.Average(p => p.CompletionRate), 2) : 0,
                averageCompletionTime = rows.Where(p => p.AverageCompletionTime > 0).Any()
                    ? Math.Round(rows.Where(p => p.AverageCompletionTime > 0).Average(p => p.AverageCompletionTime), 2)
                    : 0,
                mostSuccessfulPathway = rows.OrderByDescending(p => p.CompletionRate).FirstOrDefault()?.PathwayTitle ?? "N/A",
                mostPopularPathway = rows.OrderByDescending(p => p.TotalEnrollments).FirstOrDefault()?.PathwayTitle ?? "N/A",
                pathwaysWithNoEnrollments = rows.Count(p => p.TotalEnrollments == 0),
                totalInProgress = rows.Sum(p => p.InProgress)
            };

            var header = BuildPathwayProgressHeader(orgName, startDate, endDate, activeOnly);

            return Ok(new
            {
                header,
                pathways = rows,
                summary,
                engagementBreakdown,
                topPathways,
                strugglingPathways,
                popularPathways,
                completionTrends
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating pathway progress report");
            return StatusCode(500, new { error = "Failed to generate pathway progress report", details = ex.Message });
        }
    }

    [HttpGet("pathway-progress/summary")]
    public async Task<IActionResult> GetPathwayProgressSummary(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] bool? activeOnly)
    {
        try
        {
            var (orgName, rows, completionTrends) = await BuildPathwayProgressData(startDate, endDate, activeOnly, includeCompletionTrends: true);

            var engagementBreakdown = rows.GroupBy(p => p.EngagementLevel)
                .Select(g => new
                {
                    level = g.Key,
                    count = g.Count(),
                    percentage = rows.Count > 0 ? Math.Round((g.Count() / (double)rows.Count) * 100, 2) : 0
                })
                .ToList();

            var topPathways = rows
                .Where(p => p.TotalEnrollments > 0)
                .OrderByDescending(p => p.CompletionRate)
                .Take(5)
                .ToList();

            var strugglingPathways = rows
                .Where(p => p.TotalEnrollments > 5 && p.CompletionRate < 30)
                .OrderBy(p => p.CompletionRate)
                .Take(5)
                .ToList();

            var popularPathways = rows
                .Where(p => p.IsPopular)
                .OrderByDescending(p => p.TotalEnrollments)
                .Take(5)
                .ToList();

            var summary = new
            {
                totalPathways = rows.Count,
                activePathways = rows.Count(p => p.IsActive),
                totalEnrollments = rows.Sum(p => p.TotalEnrollments),
                totalCompletions = rows.Sum(p => p.Completions),
                averageCompletionRate = rows.Any() ? Math.Round(rows.Average(p => p.CompletionRate), 2) : 0,
                averageCompletionTime = rows.Where(p => p.AverageCompletionTime > 0).Any()
                    ? Math.Round(rows.Where(p => p.AverageCompletionTime > 0).Average(p => p.AverageCompletionTime), 2)
                    : 0,
                mostSuccessfulPathway = rows.OrderByDescending(p => p.CompletionRate).FirstOrDefault()?.PathwayTitle ?? "N/A",
                mostPopularPathway = rows.OrderByDescending(p => p.TotalEnrollments).FirstOrDefault()?.PathwayTitle ?? "N/A",
                pathwaysWithNoEnrollments = rows.Count(p => p.TotalEnrollments == 0),
                totalInProgress = rows.Sum(p => p.InProgress)
            };

            var header = BuildPathwayProgressHeader(orgName, startDate, endDate, activeOnly);

            return Ok(new
            {
                header,
                summary,
                engagementBreakdown,
                topPathways,
                strugglingPathways,
                popularPathways,
                completionTrends
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating pathway progress summary");
            return StatusCode(500, new { error = "Failed to generate pathway progress summary", details = ex.Message });
        }
    }

    [HttpGet("pathway-progress/pathways")]
    public async Task<IActionResult> GetPathwayProgressPathways(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] bool? activeOnly,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDirection = null)
    {
        try
        {
            pageNumber = Math.Max(1, pageNumber);
            pageSize = Math.Clamp(pageSize, 1, 500);

            var normalizedSort = NormalizePathwayProgressSort(sortBy, sortDirection);
            var (orgName, rows, _) = await BuildPathwayProgressData(startDate, endDate, activeOnly, includeCompletionTrends: false);

            IEnumerable<PathwayProgressReportRow> query = rows;

            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchTerm = search.Trim();
                query = query.Where(p =>
                    p.PathwayTitle.Contains(searchTerm, StringComparison.OrdinalIgnoreCase) ||
                    (!string.IsNullOrWhiteSpace(p.Description) && p.Description.Contains(searchTerm, StringComparison.OrdinalIgnoreCase)) ||
                    p.EngagementLevel.Contains(searchTerm, StringComparison.OrdinalIgnoreCase));
            }

            query = (normalizedSort.SortBy, normalizedSort.SortDirection) switch
            {
                ("pathwayTitle", "asc") => query.OrderBy(p => p.PathwayTitle),
                ("pathwayTitle", _) => query.OrderByDescending(p => p.PathwayTitle),
                ("isActive", "asc") => query.OrderBy(p => p.IsActive),
                ("isActive", _) => query.OrderByDescending(p => p.IsActive),
                ("courseCount", "asc") => query.OrderBy(p => p.CourseCount),
                ("courseCount", _) => query.OrderByDescending(p => p.CourseCount),
                ("completions", "asc") => query.OrderBy(p => p.Completions),
                ("completions", _) => query.OrderByDescending(p => p.Completions),
                ("inProgress", "asc") => query.OrderBy(p => p.InProgress),
                ("inProgress", _) => query.OrderByDescending(p => p.InProgress),
                ("notStarted", "asc") => query.OrderBy(p => p.NotStarted),
                ("notStarted", _) => query.OrderByDescending(p => p.NotStarted),
                ("completionRate", "asc") => query.OrderBy(p => p.CompletionRate),
                ("completionRate", _) => query.OrderByDescending(p => p.CompletionRate),
                ("averageProgress", "asc") => query.OrderBy(p => p.AverageProgress),
                ("averageProgress", _) => query.OrderByDescending(p => p.AverageProgress),
                ("averageCompletionTime", "asc") => query.OrderBy(p => p.AverageCompletionTime),
                ("averageCompletionTime", _) => query.OrderByDescending(p => p.AverageCompletionTime),
                ("engagementLevel", "asc") => query.OrderBy(p => p.EngagementLevel),
                ("engagementLevel", _) => query.OrderByDescending(p => p.EngagementLevel),
                ("recentEnrollments", "asc") => query.OrderBy(p => p.RecentEnrollments),
                ("recentEnrollments", _) => query.OrderByDescending(p => p.RecentEnrollments),
                ("totalEnrollments", "asc") => query.OrderBy(p => p.TotalEnrollments),
                _ => query.OrderByDescending(p => p.TotalEnrollments)
            };

            var totalPathways = query.Count();
            var totalPages = totalPathways == 0 ? 1 : (int)Math.Ceiling(totalPathways / (double)pageSize);
            if (pageNumber > totalPages)
            {
                pageNumber = totalPages;
            }

            var pathways = query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var header = BuildPathwayProgressHeader(orgName, startDate, endDate, activeOnly, pageNumber, pageSize, search, normalizedSort.SortBy, normalizedSort.SortDirection);
            var pagination = new
            {
                pageNumber,
                pageSize,
                totalPathways,
                totalPages,
                hasPreviousPage = pageNumber > 1,
                hasNextPage = pageNumber < totalPages
            };

            return Ok(new
            {
                header,
                pathways,
                pagination
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating pathway progress pathways table");
            return StatusCode(500, new { error = "Failed to generate pathway progress pathways table", details = ex.Message });
        }
    }

    [HttpGet("pathway-assignments")]
    public async Task<IActionResult> GetPathwayAssignmentsReport(
        [FromQuery] string? pathwayId,
        [FromQuery] bool? activeOnly)
    {
        try
        {
            var orgId = await GetOrgIdFilter();

            // Get organization info for header
            var orgName = "All Organizations";
            if (orgId.HasValue)
            {
                var org = await _context.Organisations.FindAsync(orgId.Value);
                orgName = org?.Name ?? "Unknown Organization";
            }

            var pathwaysQuery = _context.LearningPathways.AsNoTracking();
            if (orgId.HasValue)
                pathwaysQuery = pathwaysQuery.Where(p => p.OrganisationId == orgId);

            if (activeOnly == true)
                pathwaysQuery = pathwaysQuery.Where(p => p.IsActive);

            if (!string.IsNullOrEmpty(pathwayId))
                pathwaysQuery = pathwaysQuery.Where(p => p.Id == pathwayId);

            var pathways = await pathwaysQuery.ToListAsync();
            var pathwayIds = pathways.Select(p => p.Id).ToList();

            // Get all progress records
            var allProgress = await _context.LearnerPathwayProgresses
                .AsNoTracking()
                .Where(lpp => pathwayIds.Contains(lpp.LearningPathwayId))
                .ToListAsync();

            // Get user details
            var userIds = allProgress.Select(lpp => lpp.UserId).Distinct().ToList();
            var users = await _context.Users
                .AsNoTracking()
                .Where(u => userIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FirstName, u.LastName, u.Email })
                .ToListAsync();

            var result = pathways.Select(p =>
            {
                var pathwayProgress = allProgress.Where(lpp => lpp.LearningPathwayId == p.Id).ToList();
                var assignedUsers = pathwayProgress.Select(lpp => lpp.UserId).Distinct().Count();
                var completed = pathwayProgress.Count(lpp => lpp.IsCompleted);
                var inProgress = pathwayProgress.Count(lpp => !lpp.IsCompleted && lpp.ProgressPercent > 0);
                var notStarted = pathwayProgress.Count(lpp => lpp.ProgressPercent == 0);
                var recentAssignments = pathwayProgress.Count(lpp => lpp.EnrolledAt >= DateTime.UtcNow.AddDays(-30));

                // Get user assignments for this pathway
                var userAssignments = pathwayProgress.Select(lpp =>
                {
                    var user = users.FirstOrDefault(u => u.Id == lpp.UserId);
                    return new
                    {
                        userId = lpp.UserId,
                        userName = user != null ? $"{user.FirstName} {user.LastName}" : "Unknown User",
                        email = user?.Email ?? "N/A",
                        enrolledAt = lpp.EnrolledAt,
                        progressPercent = lpp.ProgressPercent,
                        isCompleted = lpp.IsCompleted,
                        completedAt = lpp.CompletedAt,
                        status = lpp.IsCompleted ? "Completed" : 
                                lpp.ProgressPercent > 0 ? "In Progress" : "Not Started"
                    };
                }).OrderByDescending(ua => ua.enrolledAt).ToList();

                return new
                {
                    pathwayId = p.Id,
                    pathwayTitle = p.Title,
                    description = p.Description,
                    isActive = p.IsActive,
                    assignedUsers,
                    completed,
                    inProgress,
                    notStarted,
                    recentAssignments,
                    completionRate = assignedUsers > 0 
                        ? Math.Round((completed / (double)assignedUsers) * 100, 2) 
                        : 0,
                    userAssignments
                };
            }).OrderByDescending(p => p.assignedUsers).ToList();

            // Assignment trends (last 6 months)
            var sixMonthsAgo = DateTime.UtcNow.AddMonths(-6);
            var assignmentTrends = allProgress
                .Where(lpp => lpp.EnrolledAt >= sixMonthsAgo)
                .GroupBy(lpp => new { Year = lpp.EnrolledAt.Year, Month = lpp.EnrolledAt.Month })
                .Select(g => new
                {
                    month = $"{g.Key.Year}-{g.Key.Month:D2}",
                    assignments = g.Count()
                })
                .OrderBy(t => t.month)
                .ToList();

            // Top assigned pathways
            var topAssigned = result
                .Where(p => p.assignedUsers > 0)
                .OrderByDescending(p => p.assignedUsers)
                .Take(5)
                .ToList();

            // Pathways with no assignments
            var unassignedPathways = result
                .Where(p => p.assignedUsers == 0)
                .Select(p => new { p.pathwayId, p.pathwayTitle, p.isActive })
                .ToList();

            var summary = new
            {
                totalPathways = result.Count,
                activePathways = result.Count(p => p.isActive),
                totalAssignments = result.Sum(p => p.assignedUsers),
                totalCompleted = result.Sum(p => p.completed),
                totalInProgress = result.Sum(p => p.inProgress),
                totalNotStarted = result.Sum(p => p.notStarted),
                recentAssignments = result.Sum(p => p.recentAssignments),
                averageCompletionRate = result.Any() ? Math.Round(result.Average(p => p.completionRate), 2) : 0,
                mostAssignedPathway = result.OrderByDescending(p => p.assignedUsers).FirstOrDefault()?.pathwayTitle ?? "N/A",
                unassignedPathwaysCount = unassignedPathways.Count
            };

            var header = new
            {
                reportName = "Learning Pathway Assignments Report",
                generatedAt = DateTime.UtcNow,
                organization = orgName,
                filters = new
                {
                    pathwayId,
                    activeOnly
                }
            };

            return Ok(new
            {
                header,
                pathways = result,
                summary,
                assignmentTrends,
                topAssigned,
                unassignedPathways
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating pathway assignments report");
            return StatusCode(500, new { error = "Failed to generate pathway assignments report", details = ex.Message });
        }
    }

    #endregion

    #region User-Course Progress Report

    private sealed class UserCourseProgressReportRow
    {
        public string UserId { get; set; } = string.Empty;
        public string UserName { get; set; } = "Unknown User";
        public string Email { get; set; } = "N/A";
        public string CourseId { get; set; } = string.Empty;
        public string CourseTitle { get; set; } = "Unknown Course";
        public string CourseCategory { get; set; } = "Uncategorized";
        public int ProgressPercent { get; set; }
        public bool Completed { get; set; }
        public string Status { get; set; } = "Not Started";
        public DateTime? CompletedAt { get; set; }
        public DateTime? LastActivityAt { get; set; }
        public int? DaysToComplete { get; set; }
        public int DaysSinceLastActivity { get; set; }
        public bool IsStale { get; set; }
        public string Performance { get; set; } = "N/A";
    }

    private static object BuildUserCourseProgressHeader(
        string orgName,
        string? search,
        string? courseId,
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
            reportName = "User-Course Progress Report",
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

    private static (string SortBy, string SortDirection) NormalizeUserCourseProgressSort(string? sortBy, string? sortDirection)
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
            "coursecategory" => "courseCategory",
            "progresspercent" => "progressPercent",
            "status" => "status",
            "performance" => "performance",
            "completedat" => "completedAt",
            "daystocomplete" => "daysToComplete",
            "dayssincelastactivity" => "daysSinceLastActivity",
            "isstale" => "isStale",
            _ => "progressPercent"
        };

        return (normalizedSortBy, normalizedDirection);
    }

    private async Task<string> ResolveOrganizationName(long? orgId)
    {
        if (!orgId.HasValue)
        {
            return "All Organizations";
        }

        var org = await _context.Organisations.FindAsync(orgId.Value);
        return org?.Name ?? "Unknown Organization";
    }

    private IQueryable<UserCourseProgressReportRow> BuildUserCourseProgressBaseQuery(
        long? orgId,
        string? search,
        string? courseId,
        string? status,
        DateTime? startDate,
        DateTime? endDate)
    {
        var query =
            from lp in _context.LearnerProgresses.AsNoTracking()
            where lp.LessonId == null && lp.CourseId != null
            join u in _context.Users.AsNoTracking() on lp.UserId equals u.Id
            join c in _context.Courses.AsNoTracking() on lp.CourseId equals c.Id
            where !orgId.HasValue || (u.OrganisationID == orgId && c.OrganisationId == orgId)
            select new UserCourseProgressReportRow
            {
                UserId = lp.UserId,
                UserName = ((u.FirstName ?? string.Empty) + " " + (u.LastName ?? string.Empty)).Trim() == string.Empty
                    ? "Unknown User"
                    : ((u.FirstName ?? string.Empty) + " " + (u.LastName ?? string.Empty)).Trim(),
                Email = u.Email ?? "N/A",
                CourseId = c.Id,
                CourseTitle = c.Title,
                CourseCategory = c.Category ?? "Uncategorized",
                ProgressPercent = lp.ProgressPercent,
                Completed = lp.Completed,
                Status = lp.Completed
                    ? "Completed"
                    : (lp.ProgressPercent > 0 ? "In Progress" : "Not Started"),
                CompletedAt = lp.CompletedAt,
                LastActivityAt = lp.LastAccessedAt ?? lp.CompletedAt ?? lp.StartedAt,
                DaysToComplete = lp.Completed && lp.CompletedAt.HasValue && lp.StartedAt.HasValue
                    ? EF.Functions.DateDiffDay(lp.StartedAt.Value, lp.CompletedAt.Value)
                    : null,
                DaysSinceLastActivity = EF.Functions.DateDiffDay(lp.LastAccessedAt ?? lp.CompletedAt ?? lp.StartedAt ?? c.CreatedAt, DateTime.UtcNow),
                IsStale = !lp.Completed && lp.ProgressPercent < 50,
                Performance = lp.Completed && lp.CompletedAt.HasValue && lp.StartedAt.HasValue
                    ? (EF.Functions.DateDiffDay(lp.StartedAt.Value, lp.CompletedAt.Value) <= 7
                        ? "Excellent"
                        : (EF.Functions.DateDiffDay(lp.StartedAt.Value, lp.CompletedAt.Value) <= 14
                            ? "Good"
                            : (EF.Functions.DateDiffDay(lp.StartedAt.Value, lp.CompletedAt.Value) <= 30
                                ? "Average"
                                : "Slow")))
                    : "N/A"
            };

        if (!string.IsNullOrWhiteSpace(courseId))
        {
            query = query.Where(x => x.CourseId == courseId);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();
            query = normalizedStatus switch
            {
                "completed" => query.Where(x => x.Completed),
                "in progress" => query.Where(x => !x.Completed && x.ProgressPercent > 0),
                "not started" => query.Where(x => !x.Completed && x.ProgressPercent == 0),
                _ => query
            };
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchTerm = search.Trim();
            query = query.Where(x =>
                x.UserName.Contains(searchTerm) ||
                x.Email.Contains(searchTerm) ||
                x.CourseTitle.Contains(searchTerm) ||
                x.CourseCategory.Contains(searchTerm));
        }

        if (startDate.HasValue && endDate.HasValue)
        {
            query = query.Where(x => !x.Completed || (x.CompletedAt.HasValue && x.CompletedAt >= startDate.Value && x.CompletedAt <= endDate.Value));
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

    private static IQueryable<UserCourseProgressReportRow> ApplyUserCourseProgressSorting(
        IQueryable<UserCourseProgressReportRow> query,
        string sortBy,
        string sortDirection)
    {
        return (sortBy, sortDirection) switch
        {
            ("userName", "asc") => query.OrderBy(x => x.UserName),
            ("userName", _) => query.OrderByDescending(x => x.UserName),
            ("email", "asc") => query.OrderBy(x => x.Email),
            ("email", _) => query.OrderByDescending(x => x.Email),
            ("courseTitle", "asc") => query.OrderBy(x => x.CourseTitle),
            ("courseTitle", _) => query.OrderByDescending(x => x.CourseTitle),
            ("courseCategory", "asc") => query.OrderBy(x => x.CourseCategory),
            ("courseCategory", _) => query.OrderByDescending(x => x.CourseCategory),
            ("status", "asc") => query.OrderBy(x => x.Status),
            ("status", _) => query.OrderByDescending(x => x.Status),
            ("performance", "asc") => query.OrderBy(x => x.Performance),
            ("performance", _) => query.OrderByDescending(x => x.Performance),
            ("completedAt", "asc") => query.OrderBy(x => x.CompletedAt),
            ("completedAt", _) => query.OrderByDescending(x => x.CompletedAt),
            ("daysToComplete", "asc") => query.OrderBy(x => x.DaysToComplete),
            ("daysToComplete", _) => query.OrderByDescending(x => x.DaysToComplete),
            ("daysSinceLastActivity", "asc") => query.OrderBy(x => x.DaysSinceLastActivity),
            ("daysSinceLastActivity", _) => query.OrderByDescending(x => x.DaysSinceLastActivity),
            ("isStale", "asc") => query.OrderBy(x => x.IsStale),
            ("isStale", _) => query.OrderByDescending(x => x.IsStale),
            ("progressPercent", "asc") => query.OrderBy(x => x.ProgressPercent),
            _ => query.OrderByDescending(x => x.ProgressPercent)
        };
    }

    [HttpGet("user-course-progress/summary")]
    public async Task<IActionResult> GetUserCourseProgressSummary(
        [FromQuery] string? search,
        [FromQuery] string? courseId,
        [FromQuery] string? status,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        try
        {
            var orgId = await GetOrgIdFilter();
            var orgName = await ResolveOrganizationName(orgId);

            var baseQuery = BuildUserCourseProgressBaseQuery(orgId, search, courseId, status, startDate, endDate);

            var totalEnrollments = await baseQuery.CountAsync();
            var totalCompleted = await baseQuery.CountAsync(x => x.Completed);
            var totalInProgress = await baseQuery.CountAsync(x => !x.Completed && x.ProgressPercent > 0);
            var totalNotStarted = await baseQuery.CountAsync(x => !x.Completed && x.ProgressPercent == 0);
            var staleEnrollmentsCount = await baseQuery.CountAsync(x => x.IsStale);
            var activeUsers = await baseQuery.Select(x => x.UserId).Distinct().CountAsync();
            var averageProgressPercent = totalEnrollments > 0 ? Math.Round(await baseQuery.AverageAsync(x => (double)x.ProgressPercent), 2) : 0;
            var overallCompletionRate = totalEnrollments > 0 ? Math.Round((totalCompleted / (double)totalEnrollments) * 100, 2) : 0;

            var totalUsersQuery = _context.Users.AsNoTracking();
            var totalCoursesQuery = _context.Courses.AsNoTracking();
            if (orgId.HasValue)
            {
                totalUsersQuery = totalUsersQuery.Where(u => u.OrganisationID == orgId);
                totalCoursesQuery = totalCoursesQuery.Where(c => c.OrganisationId == orgId);
            }

            var totalUsers = await totalUsersQuery.CountAsync();
            var totalCourses = await totalCoursesQuery.CountAsync();

            var statusBreakdown = new List<object>
            {
                new { status = "Completed", count = totalCompleted, percentage = totalEnrollments > 0 ? Math.Round((totalCompleted / (double)totalEnrollments) * 100, 2) : 0 },
                new { status = "In Progress", count = totalInProgress, percentage = totalEnrollments > 0 ? Math.Round((totalInProgress / (double)totalEnrollments) * 100, 2) : 0 },
                new { status = "Not Started", count = totalNotStarted, percentage = totalEnrollments > 0 ? Math.Round((totalNotStarted / (double)totalEnrollments) * 100, 2) : 0 }
            };

            var excellentCount = await baseQuery.CountAsync(x => x.Performance == "Excellent");
            var goodCount = await baseQuery.CountAsync(x => x.Performance == "Good");
            var averageCount = await baseQuery.CountAsync(x => x.Performance == "Average");
            var slowCount = await baseQuery.CountAsync(x => x.Performance == "Slow");

            var performanceBreakdown = new List<object>
            {
                new { performance = "Excellent", count = excellentCount },
                new { performance = "Good", count = goodCount },
                new { performance = "Average", count = averageCount },
                new { performance = "Slow", count = slowCount }
            };

            var courseStats = await baseQuery
                .GroupBy(x => new { x.CourseId, x.CourseTitle, x.CourseCategory })
                .Select(g => new
                {
                    courseId = g.Key.CourseId,
                    courseTitle = g.Key.CourseTitle,
                    category = g.Key.CourseCategory,
                    totalEnrolled = g.Count(),
                    completed = g.Count(x => x.Completed),
                    inProgress = g.Count(x => !x.Completed && x.ProgressPercent > 0),
                    notStarted = g.Count(x => !x.Completed && x.ProgressPercent == 0),
                    averageProgress = Math.Round(g.Average(x => (double)x.ProgressPercent), 2),
                    completionRate = g.Count() > 0 ? Math.Round((g.Count(x => x.Completed) / (double)g.Count()) * 100, 2) : 0,
                    averageCompletionTime = g.Any(x => x.DaysToComplete.HasValue)
                        ? g.Where(x => x.DaysToComplete.HasValue).Average(x => (double?)x.DaysToComplete) ?? 0
                        : 0
                })
                .OrderByDescending(x => x.totalEnrolled)
                .ToListAsync();

            var staleEnrollments = await baseQuery
                .Where(x => x.IsStale)
                .OrderByDescending(x => x.DaysSinceLastActivity)
                .ThenBy(x => x.ProgressPercent)
                .Take(10)
                .ToListAsync();

            var topPerformers = await baseQuery
                .GroupBy(x => new { x.UserId, x.UserName, x.Email })
                .Select(g => new
                {
                    userId = g.Key.UserId,
                    userName = g.Key.UserName,
                    email = g.Key.Email,
                    totalCourses = g.Count(),
                    completed = g.Count(x => x.Completed),
                    inProgress = g.Count(x => !x.Completed && x.ProgressPercent > 0),
                    notStarted = g.Count(x => !x.Completed && x.ProgressPercent == 0),
                    averageProgress = Math.Round(g.Average(x => (double)x.ProgressPercent), 2),
                    completionRate = g.Count() > 0 ? Math.Round((g.Count(x => x.Completed) / (double)g.Count()) * 100, 2) : 0
                })
                .Where(x => x.totalCourses >= 3)
                .OrderByDescending(x => x.completionRate)
                .ThenByDescending(x => x.completed)
                .Take(10)
                .ToListAsync();

            var courseOptions = await totalCoursesQuery
                .Select(c => new { id = c.Id, title = c.Title })
                .OrderBy(c => c.title)
                .ToListAsync();

            var summary = new
            {
                totalUsers,
                totalCourses,
                totalEnrollments,
                totalCompleted,
                totalInProgress,
                totalNotStarted,
                averageProgressPercent,
                overallCompletionRate,
                staleEnrollmentsCount,
                activeUsers,
                averageCoursesPerUser = totalUsers > 0 ? Math.Round(totalEnrollments / (double)totalUsers, 2) : 0
            };

            var header = BuildUserCourseProgressHeader(orgName, search, courseId, status, startDate, endDate);

            return Ok(new
            {
                header,
                summary,
                statusBreakdown,
                performanceBreakdown,
                courseStats,
                staleEnrollments,
                topPerformers,
                courseOptions
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating user-course progress summary");
            return StatusCode(500, new { error = "Failed to generate user-course progress summary", details = ex.Message });
        }
    }

    [HttpGet("user-course-progress/records")]
    public async Task<IActionResult> GetUserCourseProgressRecords(
        [FromQuery] string? search,
        [FromQuery] string? courseId,
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
            var orgId = await GetOrgIdFilter();
            var orgName = await ResolveOrganizationName(orgId);

            pageNumber = Math.Max(1, pageNumber);
            pageSize = Math.Clamp(pageSize, 1, 500);

            var normalizedSort = NormalizeUserCourseProgressSort(sortBy, sortDirection);
            var baseQuery = BuildUserCourseProgressBaseQuery(orgId, search, courseId, status, startDate, endDate);
            var sortedQuery = ApplyUserCourseProgressSorting(baseQuery, normalizedSort.SortBy, normalizedSort.SortDirection);

            var totalRows = await sortedQuery.CountAsync();
            var totalPages = totalRows == 0 ? 1 : (int)Math.Ceiling(totalRows / (double)pageSize);
            if (pageNumber > totalPages)
            {
                pageNumber = totalPages;
            }

            var rows = await sortedQuery
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var header = BuildUserCourseProgressHeader(
                orgName,
                search,
                courseId,
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
            _logger.LogError(ex, "Error generating user-course progress records");
            return StatusCode(500, new { error = "Failed to generate user-course progress records", details = ex.Message });
        }
    }

    [HttpGet("user-course-progress")]
    public async Task<IActionResult> GetUserCourseProgressReport(
        [FromQuery] string? search,
        [FromQuery] string? courseId,
        [FromQuery] string? status,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 100,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDirection = null)
    {
        try
        {
            var orgId = await GetOrgIdFilter();
            var orgName = await ResolveOrganizationName(orgId);

            pageNumber = Math.Max(1, pageNumber);
            pageSize = Math.Clamp(pageSize, 1, 500);

            var normalizedSort = NormalizeUserCourseProgressSort(sortBy, sortDirection);
            var baseQuery = BuildUserCourseProgressBaseQuery(orgId, search, courseId, status, startDate, endDate);

            var totalEnrollments = await baseQuery.CountAsync();
            var totalCompleted = await baseQuery.CountAsync(x => x.Completed);
            var totalInProgress = await baseQuery.CountAsync(x => !x.Completed && x.ProgressPercent > 0);
            var totalNotStarted = await baseQuery.CountAsync(x => !x.Completed && x.ProgressPercent == 0);
            var staleEnrollmentsCount = await baseQuery.CountAsync(x => x.IsStale);
            var activeUsers = await baseQuery.Select(x => x.UserId).Distinct().CountAsync();
            var averageProgressPercent = totalEnrollments > 0 ? Math.Round(await baseQuery.AverageAsync(x => (double)x.ProgressPercent), 2) : 0;
            var overallCompletionRate = totalEnrollments > 0 ? Math.Round((totalCompleted / (double)totalEnrollments) * 100, 2) : 0;

            var totalUsersQuery = _context.Users.AsNoTracking();
            var totalCoursesQuery = _context.Courses.AsNoTracking();
            if (orgId.HasValue)
            {
                totalUsersQuery = totalUsersQuery.Where(u => u.OrganisationID == orgId);
                totalCoursesQuery = totalCoursesQuery.Where(c => c.OrganisationId == orgId);
            }

            var totalUsers = await totalUsersQuery.CountAsync();
            var totalCourses = await totalCoursesQuery.CountAsync();

            var sortedQuery = ApplyUserCourseProgressSorting(baseQuery, normalizedSort.SortBy, normalizedSort.SortDirection);
            var totalPages = totalEnrollments == 0 ? 1 : (int)Math.Ceiling(totalEnrollments / (double)pageSize);
            if (pageNumber > totalPages)
            {
                pageNumber = totalPages;
            }

            var userCourseProgress = await sortedQuery
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var userStats = await baseQuery
                .GroupBy(x => new { x.UserId, x.UserName, x.Email })
                .Select(g => new
                {
                    userId = g.Key.UserId,
                    userName = g.Key.UserName,
                    email = g.Key.Email,
                    totalCourses = g.Count(),
                    completed = g.Count(x => x.Completed),
                    inProgress = g.Count(x => !x.Completed && x.ProgressPercent > 0),
                    notStarted = g.Count(x => !x.Completed && x.ProgressPercent == 0),
                    averageProgress = Math.Round(g.Average(x => (double)x.ProgressPercent), 2),
                    completionRate = g.Count() > 0 ? Math.Round((g.Count(x => x.Completed) / (double)g.Count()) * 100, 2) : 0
                })
                .OrderByDescending(x => x.completionRate)
                .Take(200)
                .ToListAsync();

            var courseStats = await baseQuery
                .GroupBy(x => new { x.CourseId, x.CourseTitle, x.CourseCategory })
                .Select(g => new
                {
                    courseId = g.Key.CourseId,
                    courseTitle = g.Key.CourseTitle,
                    category = g.Key.CourseCategory,
                    totalEnrolled = g.Count(),
                    completed = g.Count(x => x.Completed),
                    inProgress = g.Count(x => !x.Completed && x.ProgressPercent > 0),
                    notStarted = g.Count(x => !x.Completed && x.ProgressPercent == 0),
                    averageProgress = Math.Round(g.Average(x => (double)x.ProgressPercent), 2),
                    completionRate = g.Count() > 0 ? Math.Round((g.Count(x => x.Completed) / (double)g.Count()) * 100, 2) : 0,
                    averageCompletionTime = g.Any(x => x.DaysToComplete.HasValue)
                        ? g.Where(x => x.DaysToComplete.HasValue).Average(x => (double?)x.DaysToComplete) ?? 0
                        : 0
                })
                .OrderByDescending(x => x.totalEnrolled)
                .ToListAsync();

            var statusBreakdown = new List<object>
            {
                new { status = "Completed", count = totalCompleted, percentage = totalEnrollments > 0 ? Math.Round((totalCompleted / (double)totalEnrollments) * 100, 2) : 0 },
                new { status = "In Progress", count = totalInProgress, percentage = totalEnrollments > 0 ? Math.Round((totalInProgress / (double)totalEnrollments) * 100, 2) : 0 },
                new { status = "Not Started", count = totalNotStarted, percentage = totalEnrollments > 0 ? Math.Round((totalNotStarted / (double)totalEnrollments) * 100, 2) : 0 }
            };

            var excellentCount = await baseQuery.CountAsync(x => x.Performance == "Excellent");
            var goodCount = await baseQuery.CountAsync(x => x.Performance == "Good");
            var averageCount = await baseQuery.CountAsync(x => x.Performance == "Average");
            var slowCount = await baseQuery.CountAsync(x => x.Performance == "Slow");
            var performanceBreakdown = new List<object>
            {
                new { performance = "Excellent", count = excellentCount },
                new { performance = "Good", count = goodCount },
                new { performance = "Average", count = averageCount },
                new { performance = "Slow", count = slowCount }
            };

            var staleEnrollments = await baseQuery
                .Where(x => x.IsStale)
                .OrderByDescending(x => x.DaysSinceLastActivity)
                .ThenBy(x => x.ProgressPercent)
                .Take(10)
                .ToListAsync();

            var topPerformers = await baseQuery
                .GroupBy(x => new { x.UserId, x.UserName, x.Email })
                .Select(g => new
                {
                    userId = g.Key.UserId,
                    userName = g.Key.UserName,
                    email = g.Key.Email,
                    totalCourses = g.Count(),
                    completed = g.Count(x => x.Completed),
                    inProgress = g.Count(x => !x.Completed && x.ProgressPercent > 0),
                    notStarted = g.Count(x => !x.Completed && x.ProgressPercent == 0),
                    averageProgress = Math.Round(g.Average(x => (double)x.ProgressPercent), 2),
                    completionRate = g.Count() > 0 ? Math.Round((g.Count(x => x.Completed) / (double)g.Count()) * 100, 2) : 0
                })
                .Where(x => x.totalCourses >= 3)
                .OrderByDescending(x => x.completionRate)
                .ThenByDescending(x => x.completed)
                .Take(10)
                .ToListAsync();

            var summary = new
            {
                totalUsers,
                totalCourses,
                totalEnrollments,
                totalCompleted,
                totalInProgress,
                totalNotStarted,
                averageProgressPercent,
                overallCompletionRate,
                staleEnrollmentsCount,
                activeUsers,
                averageCoursesPerUser = totalUsers > 0 ? Math.Round(totalEnrollments / (double)totalUsers, 2) : 0
            };

            var header = BuildUserCourseProgressHeader(
                orgName,
                search,
                courseId,
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
                totalRows = totalEnrollments,
                totalPages,
                hasPreviousPage = pageNumber > 1,
                hasNextPage = pageNumber < totalPages
            };

            return Ok(new
            {
                header,
                userCourseProgress,
                userStats,
                courseStats,
                statusBreakdown,
                performanceBreakdown,
                staleEnrollments,
                topPerformers,
                summary,
                pagination
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating user-course progress report");
            return StatusCode(500, new { error = "Failed to generate user-course progress report", details = ex.Message });
        }
    }

    #endregion

    #region Content Usage Report

    private sealed class ContentUsageReportRow
    {
        public string ContentId { get; set; } = string.Empty;
        public string ContentTitle { get; set; } = "Untitled";
        public string ContentType { get; set; } = "Course";
        public string Category { get; set; } = "Uncategorized";
        public int AccessCount { get; set; }
        public int UniqueUsers { get; set; }
        public int Completions { get; set; }
        public double CompletionRate { get; set; }
        public double AverageProgress { get; set; }
        public string EngagementLevel { get; set; } = "None";
        public int LessonCount { get; set; }
        public DateTime? LastAccessDate { get; set; }
        public int? DaysSinceLastAccess { get; set; }
        public bool IsUnused { get; set; }
        public int UsageScore { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    private static object BuildContentUsageHeader(
        string orgName,
        string? category,
        DateTime? startDate,
        DateTime? endDate,
        string? search = null,
        string? engagement = null,
        int? pageNumber = null,
        int? pageSize = null,
        string? sortBy = null,
        string? sortDirection = null)
    {
        return new
        {
            reportName = "Content Usage Report",
            generatedAt = DateTime.UtcNow,
            dateRange = startDate.HasValue || endDate.HasValue ? new
            {
                start = startDate,
                end = endDate
            } : null,
            organization = orgName,
            filters = new
            {
                category,
                startDate,
                endDate,
                search,
                engagement,
                pageNumber,
                pageSize,
                sortBy,
                sortDirection
            }
        };
    }

    private static (string SortBy, string SortDirection) NormalizeContentUsageSort(string? sortBy, string? sortDirection)
    {
        var normalizedDirection = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase)
            ? "asc"
            : "desc";

        var requested = (sortBy ?? string.Empty).Trim().ToLowerInvariant();
        var normalizedSortBy = requested switch
        {
            "contenttitle" => "contentTitle",
            "category" => "category",
            "acccesscount" => "accessCount",
            "accesscount" => "accessCount",
            "uniqueusers" => "uniqueUsers",
            "completions" => "completions",
            "completionrate" => "completionRate",
            "averageprogress" => "averageProgress",
            "engagementlevel" => "engagementLevel",
            "lessoncount" => "lessonCount",
            "lastaccessdate" => "lastAccessDate",
            "dayssincelastaccess" => "daysSinceLastAccess",
            "status" => "status",
            "usagescore" => "usageScore",
            "createdat" => "createdAt",
            _ => "usageScore"
        };

        return (normalizedSortBy, normalizedDirection);
    }

    private static string BuildContentUsageSummaryCacheKey(long? orgId, string? category, DateTime? startDate, DateTime? endDate)
    {
        var normalizedCategory = string.IsNullOrWhiteSpace(category) ? "all" : category.Trim().ToLowerInvariant();
        var start = startDate?.ToString("O") ?? "null";
        var end = endDate?.ToString("O") ?? "null";
        return $"reports:content-usage:summary:org:{orgId?.ToString() ?? "all"}:cat:{normalizedCategory}:start:{start}:end:{end}";
    }

    private async Task<List<ContentUsageReportRow>> BuildContentUsageRowsAsync(
        long? orgId,
        string? category,
        DateTime? startDate,
        DateTime? endDate,
        string? search,
        string? engagement)
    {
        var coursesQuery = _context.Courses.AsNoTracking();
        if (orgId.HasValue)
        {
            coursesQuery = coursesQuery.Where(c => c.OrganisationId == orgId);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            coursesQuery = coursesQuery.Where(c => c.Category == category);
        }

        var progressQuery = _context.LearnerProgresses
            .AsNoTracking()
            .Where(lp => lp.LessonId == null && lp.CourseId != null);

        if (startDate.HasValue)
        {
            progressQuery = progressQuery.Where(lp =>
                (lp.LastAccessedAt.HasValue && lp.LastAccessedAt.Value >= startDate.Value) ||
                (lp.CompletedAt.HasValue && lp.CompletedAt.Value >= startDate.Value) ||
                (lp.StartedAt.HasValue && lp.StartedAt.Value >= startDate.Value));
        }

        if (endDate.HasValue)
        {
            progressQuery = progressQuery.Where(lp =>
                (lp.LastAccessedAt.HasValue && lp.LastAccessedAt.Value <= endDate.Value) ||
                (lp.CompletedAt.HasValue && lp.CompletedAt.Value <= endDate.Value) ||
                (lp.StartedAt.HasValue && lp.StartedAt.Value <= endDate.Value));
        }

        var progressByCourse = await progressQuery
            .GroupBy(lp => lp.CourseId!)
            .Select(g => new
            {
                CourseId = g.Key,
                AccessCount = g.Count(),
                UniqueUsers = g.Select(x => x.UserId).Distinct().Count(),
                Completions = g.Count(x => x.Completed),
                AverageProgress = g.Average(x => (double)x.ProgressPercent),
                LastAccessDate = g.Max(x => x.LastAccessedAt ?? x.CompletedAt ?? x.StartedAt)
            })
            .ToListAsync();

        var lessonCounts = await _context.Lessons
            .AsNoTracking()
            .GroupBy(l => l.CourseId)
            .Select(g => new
            {
                CourseId = g.Key,
                LessonCount = g.Count()
            })
            .ToListAsync();

        var progressMap = progressByCourse.ToDictionary(x => x.CourseId, x => x);
        var lessonMap = lessonCounts.ToDictionary(x => x.CourseId, x => x.LessonCount);
        var courses = await coursesQuery.ToListAsync();

        var rows = courses.Select(c =>
        {
            progressMap.TryGetValue(c.Id, out var p);
            lessonMap.TryGetValue(c.Id, out var lessonCount);

            var accessCount = p?.AccessCount ?? 0;
            var uniqueUsers = p?.UniqueUsers ?? 0;
            var completions = p?.Completions ?? 0;
            var averageProgress = p?.AverageProgress ?? 0;

            return new ContentUsageReportRow
            {
                ContentId = c.Id,
                ContentTitle = c.Title,
                ContentType = "Course",
                Category = c.Category ?? "Uncategorized",
                AccessCount = accessCount,
                UniqueUsers = uniqueUsers,
                Completions = completions,
                CompletionRate = accessCount > 0 ? Math.Round((completions / (double)accessCount) * 100, 2) : 0,
                AverageProgress = Math.Round(averageProgress, 2),
                EngagementLevel = accessCount == 0
                    ? "None"
                    : (accessCount > 100 ? "High" : (accessCount > 30 ? "Medium" : "Low")),
                LessonCount = lessonCount,
                LastAccessDate = p?.LastAccessDate,
                DaysSinceLastAccess = p?.LastAccessDate.HasValue == true
                    ? (int)(DateTime.UtcNow - p.LastAccessDate.Value).TotalDays
                    : null,
                IsUnused = accessCount == 0,
                UsageScore = accessCount + (uniqueUsers * 2) + (completions * 3),
                CreatedAt = c.CreatedAt
            };
        }).ToList();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchTerm = search.Trim();
            rows = rows.Where(x =>
                x.ContentTitle.Contains(searchTerm, StringComparison.OrdinalIgnoreCase) ||
                x.Category.Contains(searchTerm, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        if (!string.IsNullOrWhiteSpace(engagement) && !string.Equals(engagement, "all", StringComparison.OrdinalIgnoreCase))
        {
            var filterValue = engagement.Trim().ToLowerInvariant() switch
            {
                "none" => "None",
                "low" => "Low",
                "medium" => "Medium",
                "high" => "High",
                _ => string.Empty
            };

            if (!string.IsNullOrEmpty(filterValue))
            {
                rows = rows.Where(x => x.EngagementLevel == filterValue).ToList();
            }
        }

        return rows;
    }

    private static IQueryable<ContentUsageReportRow> ApplyContentUsageSorting(
        IQueryable<ContentUsageReportRow> query,
        string sortBy,
        string sortDirection)
    {
        return (sortBy, sortDirection) switch
        {
            ("contentTitle", "asc") => query.OrderBy(x => x.ContentTitle),
            ("contentTitle", _) => query.OrderByDescending(x => x.ContentTitle),
            ("category", "asc") => query.OrderBy(x => x.Category),
            ("category", _) => query.OrderByDescending(x => x.Category),
            ("accessCount", "asc") => query.OrderBy(x => x.AccessCount),
            ("accessCount", _) => query.OrderByDescending(x => x.AccessCount),
            ("uniqueUsers", "asc") => query.OrderBy(x => x.UniqueUsers),
            ("uniqueUsers", _) => query.OrderByDescending(x => x.UniqueUsers),
            ("completions", "asc") => query.OrderBy(x => x.Completions),
            ("completions", _) => query.OrderByDescending(x => x.Completions),
            ("completionRate", "asc") => query.OrderBy(x => x.CompletionRate),
            ("completionRate", _) => query.OrderByDescending(x => x.CompletionRate),
            ("averageProgress", "asc") => query.OrderBy(x => x.AverageProgress),
            ("averageProgress", _) => query.OrderByDescending(x => x.AverageProgress),
            ("engagementLevel", "asc") => query.OrderBy(x => x.EngagementLevel),
            ("engagementLevel", _) => query.OrderByDescending(x => x.EngagementLevel),
            ("lessonCount", "asc") => query.OrderBy(x => x.LessonCount),
            ("lessonCount", _) => query.OrderByDescending(x => x.LessonCount),
            ("lastAccessDate", "asc") => query.OrderBy(x => x.LastAccessDate),
            ("lastAccessDate", _) => query.OrderByDescending(x => x.LastAccessDate),
            ("daysSinceLastAccess", "asc") => query.OrderBy(x => x.DaysSinceLastAccess),
            ("daysSinceLastAccess", _) => query.OrderByDescending(x => x.DaysSinceLastAccess),
            ("status", "asc") => query.OrderBy(x => x.IsUnused),
            ("status", _) => query.OrderByDescending(x => x.IsUnused),
            ("createdAt", "asc") => query.OrderBy(x => x.CreatedAt),
            ("createdAt", _) => query.OrderByDescending(x => x.CreatedAt),
            ("usageScore", "asc") => query.OrderBy(x => x.UsageScore),
            _ => query.OrderByDescending(x => x.UsageScore)
        };
    }

    [HttpGet("content-usage/summary")]
    public async Task<IActionResult> GetContentUsageReportSummary(
        [FromQuery] string? category,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        try
        {
            var orgId = await GetOrgIdFilter();
            var cacheKey = BuildContentUsageSummaryCacheKey(orgId, category, startDate, endDate);

            if (_cache.TryGetValue(cacheKey, out object? cachedResult) && cachedResult != null)
            {
                return Ok(cachedResult);
            }

            var orgName = await ResolveOrganizationName(orgId);

            var result = await BuildContentUsageRowsAsync(orgId, category, startDate, endDate, null, null);

            var categoryBreakdown = result
                .GroupBy(c => c.Category)
                .Select(g => new
                {
                    category = g.Key,
                    contentCount = g.Count(),
                    totalAccesses = g.Sum(c => c.AccessCount),
                    totalUsers = g.Sum(c => c.UniqueUsers),
                    averageEngagement = g.Any() ? g.Average(c => c.AccessCount) : 0,
                    unusedContent = g.Count(c => c.IsUnused)
                })
                .OrderByDescending(c => c.totalAccesses)
                .ToList();

            var engagementBreakdown = result
                .GroupBy(c => c.EngagementLevel)
                .Select(g => new
                {
                    level = g.Key,
                    count = g.Count(),
                    percentage = result.Count > 0 ? Math.Round((g.Count() / (double)result.Count) * 100, 2) : 0
                })
                .ToList();

            var topContent = result.Where(c => !c.IsUnused).OrderByDescending(c => c.UsageScore).Take(10).ToList();
            var unusedContent = result.Where(c => c.IsUnused).Take(10).ToList();
            var underutilizedContent = result
                .Where(c => c.AccessCount > 0 && c.AccessCount < 10)
                .OrderBy(c => c.AccessCount)
                .Take(10)
                .ToList();

            var usageTrends = categoryBreakdown
                .Select(c => new
                {
                    category = c.category,
                    accessCount = c.totalAccesses
                })
                .ToList();

            var summary = new
            {
                totalContent = result.Count,
                totalAccesses = result.Sum(c => c.AccessCount),
                totalUniqueUsers = result.Sum(c => c.UniqueUsers),
                unusedContent = result.Count(c => c.IsUnused),
                underutilizedContent = result.Count(c => c.AccessCount > 0 && c.AccessCount < 10),
                highEngagement = result.Count(c => c.EngagementLevel == "High"),
                mediumEngagement = result.Count(c => c.EngagementLevel == "Medium"),
                lowEngagement = result.Count(c => c.EngagementLevel == "Low"),
                averageAccessPerContent = result.Count > 0 ? Math.Round(result.Average(c => c.AccessCount), 2) : 0,
                mostAccessedContent = result.OrderByDescending(c => c.AccessCount).FirstOrDefault()?.ContentTitle ?? "N/A",
                leastAccessedContent = result.Where(c => !c.IsUnused).OrderBy(c => c.AccessCount).FirstOrDefault()?.ContentTitle ?? "N/A"
            };

            var categoryOptions = await _context.Courses
                .AsNoTracking()
                .Where(c => !orgId.HasValue || c.OrganisationId == orgId)
                .Select(c => c.Category)
                .Where(c => !string.IsNullOrEmpty(c))
                .Distinct()
                .OrderBy(c => c)
                .ToListAsync();

            var header = BuildContentUsageHeader(orgName, category, startDate, endDate);

            var response = new
            {
                header,
                summary,
                categoryBreakdown,
                engagementBreakdown,
                topContent,
                unusedContent,
                underutilizedContent,
                usageTrends,
                categoryOptions
            };

            _cache.Set(cacheKey, response, TimeSpan.FromSeconds(60));

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating content usage report summary");
            return StatusCode(500, new { error = "Failed to generate content usage report summary", details = ex.Message });
        }
    }

    [HttpGet("content-usage/content")]
    public async Task<IActionResult> GetContentUsageReportContent(
        [FromQuery] string? category,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? search,
        [FromQuery] string? engagement,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDirection = null)
    {
        try
        {
            var orgId = await GetOrgIdFilter();
            var orgName = await ResolveOrganizationName(orgId);

            pageNumber = Math.Max(1, pageNumber);
            pageSize = Math.Clamp(pageSize, 1, 500);

            var normalizedSort = NormalizeContentUsageSort(sortBy, sortDirection);
            var rows = await BuildContentUsageRowsAsync(orgId, category, startDate, endDate, search, engagement);
            var sortedQuery = ApplyContentUsageSorting(rows.AsQueryable(), normalizedSort.SortBy, normalizedSort.SortDirection);

            var totalRows = rows.Count;
            var totalPages = totalRows == 0 ? 1 : (int)Math.Ceiling(totalRows / (double)pageSize);
            if (pageNumber > totalPages)
            {
                pageNumber = totalPages;
            }

            var pagedRows = sortedQuery
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var header = BuildContentUsageHeader(
                orgName,
                category,
                startDate,
                endDate,
                search,
                engagement,
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
                content = pagedRows,
                pagination
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating content usage report content rows");
            return StatusCode(500, new { error = "Failed to generate content usage report content rows", details = ex.Message });
        }
    }

    [HttpGet("content-usage")]
    public async Task<IActionResult> GetContentUsageReport(
        [FromQuery] string? category,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? search,
        [FromQuery] string? engagement,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 100,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDirection = null)
    {
        try
        {
            var orgId = await GetOrgIdFilter();
            var orgName = await ResolveOrganizationName(orgId);

            pageNumber = Math.Max(1, pageNumber);
            pageSize = Math.Clamp(pageSize, 1, 500);

            var normalizedSort = NormalizeContentUsageSort(sortBy, sortDirection);
            var result = await BuildContentUsageRowsAsync(orgId, category, startDate, endDate, search, engagement);
            var categoryBreakdown = result
                .GroupBy(c => c.Category)
                .Select(g => new
                {
                    category = g.Key,
                    contentCount = g.Count(),
                    totalAccesses = g.Sum(c => c.AccessCount),
                    totalUsers = g.Sum(c => c.UniqueUsers),
                    averageEngagement = g.Any() ? g.Average(c => c.AccessCount) : 0,
                    unusedContent = g.Count(c => c.IsUnused)
                })
                .OrderByDescending(c => c.totalAccesses)
                .ToList();

            var engagementBreakdown = result
                .GroupBy(c => c.EngagementLevel)
                .Select(g => new
                {
                    level = g.Key,
                    count = g.Count(),
                    percentage = result.Count > 0 ? Math.Round((g.Count() / (double)result.Count) * 100, 2) : 0
                })
                .ToList();

            var topContent = result.Where(c => !c.IsUnused).OrderByDescending(c => c.UsageScore).Take(10).ToList();
            var unusedContent = result.Where(c => c.IsUnused).Take(10).ToList();
            var underutilizedContent = result
                .Where(c => c.AccessCount > 0 && c.AccessCount < 10)
                .OrderBy(c => c.AccessCount)
                .Take(10)
                .ToList();

            var usageTrends = categoryBreakdown
                .Select(c => new
                {
                    category = c.category,
                    accessCount = c.totalAccesses
                })
                .ToList();

            var summary = new
            {
                totalContent = result.Count,
                totalAccesses = result.Sum(c => c.AccessCount),
                totalUniqueUsers = result.Sum(c => c.UniqueUsers),
                unusedContent = result.Count(c => c.IsUnused),
                underutilizedContent = result.Count(c => c.AccessCount > 0 && c.AccessCount < 10),
                highEngagement = result.Count(c => c.EngagementLevel == "High"),
                mediumEngagement = result.Count(c => c.EngagementLevel == "Medium"),
                lowEngagement = result.Count(c => c.EngagementLevel == "Low"),
                averageAccessPerContent = result.Count > 0 ? Math.Round(result.Average(c => c.AccessCount), 2) : 0,
                mostAccessedContent = result.OrderByDescending(c => c.AccessCount).FirstOrDefault()?.ContentTitle ?? "N/A",
                leastAccessedContent = result.Where(c => !c.IsUnused).OrderBy(c => c.AccessCount).FirstOrDefault()?.ContentTitle ?? "N/A"
            };

            var sortedQuery = ApplyContentUsageSorting(result.AsQueryable(), normalizedSort.SortBy, normalizedSort.SortDirection);
            var totalRows = result.Count;
            var totalPages = totalRows == 0 ? 1 : (int)Math.Ceiling(totalRows / (double)pageSize);
            if (pageNumber > totalPages)
            {
                pageNumber = totalPages;
            }

            var pagedRows = sortedQuery
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var categoryOptions = await _context.Courses
                .AsNoTracking()
                .Where(c => !orgId.HasValue || c.OrganisationId == orgId)
                .Select(c => c.Category)
                .Where(c => !string.IsNullOrEmpty(c))
                .Distinct()
                .OrderBy(c => c)
                .ToListAsync();

            var header = BuildContentUsageHeader(
                orgName,
                category,
                startDate,
                endDate,
                search,
                engagement,
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
                content = pagedRows,
                summary,
                categoryBreakdown,
                engagementBreakdown,
                topContent,
                unusedContent,
                underutilizedContent,
                usageTrends,
                categoryOptions,
                pagination
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating content usage report");
            return StatusCode(500, new { error = "Failed to generate content usage report", details = ex.Message });
        }
    }

    #endregion

    #region Custom Report Builder

    [HttpPost("custom-report")]
    public async Task<IActionResult> GenerateCustomReport([FromBody] CustomReportRequest request)
    {
        try
        {
            var orgId = await GetOrgIdFilter();

            // Validate request
            if (request.Metrics == null || !request.Metrics.Any())
                return BadRequest(new { error = "At least one metric must be selected" });

            var reportData = new Dictionary<string, object>();
            var dataPoints = new List<object>();

            // Build query based on selected entity type
            switch (request.EntityType?.ToLower())
            {
                case "users":
                    dataPoints = await BuildUserReport(request, orgId);
                    break;
                case "courses":
                    dataPoints = await BuildCourseReport(request, orgId);
                    break;
                case "pathways":
                    dataPoints = await BuildPathwayReport(request, orgId);
                    break;
                case "progress":
                    dataPoints = await BuildProgressReport(request, orgId);
                    break;
                default:
                    return BadRequest(new { error = "Invalid entity type. Supported: users, courses, pathways, progress" });
            }

            // Apply filters
            if (!string.IsNullOrEmpty(request.FilterBy) && request.FilterValue != null)
            {
                dataPoints = ApplyCustomFilters(dataPoints, request.FilterBy, request.FilterValue);
            }

            // Apply sorting
            if (!string.IsNullOrEmpty(request.SortBy))
            {
                dataPoints = ApplySorting(dataPoints, request.SortBy, request.SortDescending ?? true);
            }

            // Apply grouping
            Dictionary<string, object>? groupedData = null;
            if (!string.IsNullOrEmpty(request.GroupBy))
            {
                groupedData = ApplyGrouping(dataPoints, request.GroupBy, request.Metrics);
            }

            // Calculate summary statistics
            var summary = CalculateSummary(dataPoints, request.Metrics);

            return Ok(new
            {
                entityType = request.EntityType,
                metrics = request.Metrics,
                dataPoints = dataPoints.Take(request.Limit ?? 100),
                totalRecords = dataPoints.Count,
                groupedData,
                summary,
                generatedAt = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating custom report");
            return StatusCode(500, new { error = "Failed to generate custom report", details = ex.Message });
        }
    }

    private async Task<List<object>> BuildUserReport(CustomReportRequest request, long? orgId)
    {
        var usersQuery = _context.Users.AsNoTracking();
        if (orgId.HasValue)
            usersQuery = usersQuery.Where(u => u.OrganisationID == orgId);

        // Apply date filters
        if (request.StartDate.HasValue)
            usersQuery = usersQuery.Where(u => u.CreatedOn >= request.StartDate.Value);
        if (request.EndDate.HasValue)
            usersQuery = usersQuery.Where(u => u.CreatedOn <= request.EndDate.Value);

        var users = await usersQuery.ToListAsync();
        var userIds = users.Select(u => u.Id).ToList();

        // Get progress data
        var progressData = await _context.LearnerProgresses
            .AsNoTracking()
            .Where(lp => userIds.Contains(lp.UserId))
            .ToListAsync();

        var result = users.Select(u =>
        {
            var userProgress = progressData.Where(lp => lp.UserId == u.Id).ToList();
            var fullName = $"{u.FirstName} {u.LastName}".Trim();
            var data = new Dictionary<string, object>
            {
                ["userId"] = u.Id,
                ["name"] = !string.IsNullOrEmpty(fullName) ? fullName : "Unknown",
                ["email"] = u.Email ?? "N/A",
                ["status"] = u.ActiveStatus == 1 ? "Active" : "Inactive",
                ["createdAt"] = u.CreatedOn
            };

            // Add metrics based on selection
            if (request.Metrics.Contains("enrollments"))
                data["enrollments"] = userProgress.Count;
            if (request.Metrics.Contains("completions"))
                data["completions"] = userProgress.Count(lp => lp.Completed);
            if (request.Metrics.Contains("averageProgress"))
                data["averageProgress"] = userProgress.Any() ? Math.Round(userProgress.Average(lp => lp.ProgressPercent), 2) : 0;
            if (request.Metrics.Contains("lastActivity"))
            {
                var lastActivity = userProgress.Where(lp => lp.CompletedAt.HasValue)
                    .OrderByDescending(lp => lp.CompletedAt)
                    .FirstOrDefault();
                data["lastActivity"] = lastActivity?.CompletedAt ?? u.CreatedOn;
            }
            if (request.Metrics.Contains("engagementScore"))
            {
                var completions = userProgress.Count(lp => lp.Completed);
                var avgProgress = userProgress.Any() ? userProgress.Average(lp => lp.ProgressPercent) : 0;
                data["engagementScore"] = Math.Round((completions * 10) + (avgProgress * 0.5), 2);
            }

            return (object)data;
        }).ToList();

        return result;
    }

    private async Task<List<object>> BuildCourseReport(CustomReportRequest request, long? orgId)
    {
        var coursesQuery = _context.Courses.AsNoTracking();
        if (orgId.HasValue)
            coursesQuery = coursesQuery.Where(c => c.OrganisationId == orgId);

        // Apply date filters
        if (request.StartDate.HasValue)
            coursesQuery = coursesQuery.Where(c => c.CreatedAt >= request.StartDate.Value);
        if (request.EndDate.HasValue)
            coursesQuery = coursesQuery.Where(c => c.CreatedAt <= request.EndDate.Value);

        var courses = await coursesQuery.ToListAsync();
        var courseIds = courses.Select(c => c.Id).ToList();

        // Get progress data
        var progressData = await _context.LearnerProgresses
            .AsNoTracking()
            .Where(lp => courseIds.Contains(lp.CourseId!))
            .ToListAsync();

        var result = courses.Select(c =>
        {
            var courseProgress = progressData.Where(lp => lp.CourseId == c.Id).ToList();
            var data = new Dictionary<string, object>
            {
                ["courseId"] = c.Id,
                ["title"] = c.Title,
                ["category"] = c.Category ?? "Uncategorized",
                ["createdAt"] = c.CreatedAt
            };

            // Add metrics based on selection
            if (request.Metrics.Contains("enrollments"))
                data["enrollments"] = courseProgress.Count;
            if (request.Metrics.Contains("completions"))
                data["completions"] = courseProgress.Count(lp => lp.Completed);
            if (request.Metrics.Contains("completionRate"))
            {
                var totalEnrollments = courseProgress.Count;
                var completions = courseProgress.Count(lp => lp.Completed);
                data["completionRate"] = totalEnrollments > 0 ? Math.Round((completions * 100.0) / totalEnrollments, 2) : 0;
            }
            if (request.Metrics.Contains("averageProgress"))
                data["averageProgress"] = courseProgress.Any() ? Math.Round(courseProgress.Average(lp => lp.ProgressPercent), 2) : 0;
            if (request.Metrics.Contains("averageCompletionTime"))
            {
                var completedProgress = courseProgress.Where(lp => lp.Completed && lp.CompletedAt.HasValue).ToList();
                if (completedProgress.Any())
                {
                    var avgTime = completedProgress
                        .Where(lp => lp.CompletedAt > c.CreatedAt)
                        .Select(lp => (lp.CompletedAt!.Value - c.CreatedAt).TotalDays)
                        .Where(days => days > 0)
                        .DefaultIfEmpty(0)
                        .Average();
                    data["averageCompletionTime"] = Math.Round(avgTime, 2);
                }
                else
                {
                    data["averageCompletionTime"] = 0;
                }
            }

            return (object)data;
        }).ToList();

        return result;
    }

    private async Task<List<object>> BuildPathwayReport(CustomReportRequest request, long? orgId)
    {
        var pathwaysQuery = _context.LearningPathways.AsNoTracking();
        if (orgId.HasValue)
            pathwaysQuery = pathwaysQuery.Where(p => p.OrganisationId == orgId);

        var pathways = await pathwaysQuery.ToListAsync();
        var pathwayIds = pathways.Select(p => p.Id).ToList();

        // Get pathway progress data
        var progressData = await _context.LearnerPathwayProgresses
            .AsNoTracking()
            .Where(lpp => pathwayIds.Contains(lpp.LearningPathwayId))
            .ToListAsync();

        var result = pathways.Select(p =>
        {
            var pathwayProgress = progressData.Where(lpp => lpp.LearningPathwayId == p.Id).ToList();
            var data = new Dictionary<string, object>
            {
                ["pathwayId"] = p.Id,
                ["title"] = p.Title,
                ["description"] = p.Description ?? "",
                ["isActive"] = p.IsActive
            };

            // Add metrics based on selection
            if (request.Metrics.Contains("enrollments"))
                data["enrollments"] = pathwayProgress.Count;
            if (request.Metrics.Contains("completions"))
                data["completions"] = pathwayProgress.Count(lpp => lpp.IsCompleted);
            if (request.Metrics.Contains("completionRate"))
            {
                var totalEnrollments = pathwayProgress.Count;
                var completions = pathwayProgress.Count(lpp => lpp.IsCompleted);
                data["completionRate"] = totalEnrollments > 0 ? Math.Round((completions * 100.0) / totalEnrollments, 2) : 0;
            }
            if (request.Metrics.Contains("averageProgress"))
                data["averageProgress"] = pathwayProgress.Any() ? Math.Round(pathwayProgress.Average(lpp => lpp.ProgressPercent), 2) : 0;

            return (object)data;
        }).ToList();

        return result;
    }

    private async Task<List<object>> BuildProgressReport(CustomReportRequest request, long? orgId)
    {
        var progressQuery = _context.LearnerProgresses
            .AsNoTracking()
            .Include(lp => lp.User)
            .Include(lp => lp.Course)
            .AsQueryable();

        if (orgId.HasValue)
            progressQuery = progressQuery.Where(lp => lp.User!.OrganisationID == orgId);

        // Apply date filters
        if (request.StartDate.HasValue)
            progressQuery = progressQuery.Where(lp => lp.CompletedAt >= request.StartDate.Value || lp.CompletedAt == null);
        if (request.EndDate.HasValue)
            progressQuery = progressQuery.Where(lp => lp.CompletedAt <= request.EndDate.Value || lp.CompletedAt == null);

        var progressData = await progressQuery.ToListAsync();

        var result = progressData.Select(lp =>
        {
            var userName = lp.User != null ? $"{lp.User.FirstName} {lp.User.LastName}".Trim() : "Unknown";
            var data = new Dictionary<string, object>
            {
                ["progressId"] = lp.Id,
                ["userId"] = lp.UserId,
                ["userName"] = !string.IsNullOrEmpty(userName) ? userName : "Unknown",
                ["courseId"] = lp.CourseId ?? "",
                ["courseTitle"] = lp.Course?.Title ?? "N/A",
                ["progressPercent"] = lp.ProgressPercent,
                ["completed"] = lp.Completed,
                ["completedAt"] = lp.CompletedAt
            };

            // Add metrics based on selection
            if (request.Metrics.Contains("timeToComplete") && lp.Completed && lp.CompletedAt.HasValue && lp.Course != null)
            {
                var timeToComplete = (lp.CompletedAt.Value - lp.Course.CreatedAt).TotalDays;
                data["timeToComplete"] = Math.Round(timeToComplete > 0 ? timeToComplete : 0, 2);
            }

            return (object)data;
        }).ToList();

        return result;
    }

    private List<object> ApplyCustomFilters(List<object> dataPoints, string filterBy, object filterValue)
    {
        return dataPoints.Where(item =>
        {
            var dict = item as Dictionary<string, object>;
            if (dict == null || !dict.ContainsKey(filterBy))
                return false;

            var value = dict[filterBy];
            return value?.ToString()?.Contains(filterValue.ToString() ?? "", StringComparison.OrdinalIgnoreCase) ?? false;
        }).ToList();
    }

    private List<object> ApplySorting(List<object> dataPoints, string sortBy, bool descending)
    {
        return descending
            ? dataPoints.OrderByDescending(item =>
            {
                var dict = item as Dictionary<string, object>;
                return dict != null && dict.ContainsKey(sortBy) ? dict[sortBy] : null;
            }).ToList()
            : dataPoints.OrderBy(item =>
            {
                var dict = item as Dictionary<string, object>;
                return dict != null && dict.ContainsKey(sortBy) ? dict[sortBy] : null;
            }).ToList();
    }

    private Dictionary<string, object> ApplyGrouping(List<object> dataPoints, string groupBy, List<string> metrics)
    {
        var grouped = dataPoints
            .GroupBy(item =>
            {
                var dict = item as Dictionary<string, object>;
                return dict != null && dict.ContainsKey(groupBy) ? dict[groupBy]?.ToString() ?? "N/A" : "N/A";
            })
            .ToDictionary(
                g => g.Key,
                g => (object)new
                {
                    count = g.Count(),
                    items = g.Take(5).ToList() // Show first 5 items per group
                }
            );

        return grouped;
    }

    private Dictionary<string, object> CalculateSummary(List<object> dataPoints, List<string> metrics)
    {
        var summary = new Dictionary<string, object>
        {
            ["totalRecords"] = dataPoints.Count
        };

        foreach (var metric in metrics)
        {
            var values = dataPoints
                .Select(item => item as Dictionary<string, object>)
                .Where(dict => dict != null && dict.ContainsKey(metric))
                .Select(dict => dict![metric])
                .Where(val => val != null && (val is int || val is double || val is decimal))
                .Select(val => Convert.ToDouble(val))
                .ToList();

            if (values.Any())
            {
                summary[$"{metric}_total"] = Math.Round(values.Sum(), 2);
                summary[$"{metric}_average"] = Math.Round(values.Average(), 2);
                summary[$"{metric}_max"] = Math.Round(values.Max(), 2);
                summary[$"{metric}_min"] = Math.Round(values.Min(), 2);
            }
        }

        return summary;
    }

    #endregion

    #region Certificate Statistics

    [HttpGet("certificates")]
    public async Task<IActionResult> GetCertificateStatistics(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? courseId = null,
        [FromQuery] long? organisationId = null)
    {
        try
        {
            var orgId = await GetOrgIdFilter();
            if (orgId.HasValue)
            {
                // OrgAdmin can only see their org
                organisationId = orgId.Value;
            }

            var start = startDate ?? DateTime.UtcNow.AddMonths(-6);
            var end = endDate ?? DateTime.UtcNow;

            // Base query for certificates
            var certificatesQuery = _context.LearnerProgresses
                .Include(lp => lp.User)
                .Include(lp => lp.Course)
                .Where(lp => lp.CertificateIssuedAt != null
                    && lp.CertificateIssuedAt >= start
                    && lp.CertificateIssuedAt <= end
                    && lp.LessonId == null);

            // Apply filters
            if (organisationId.HasValue)
            {
                certificatesQuery = certificatesQuery.Where(lp => lp.User!.OrganisationID == organisationId.Value);
            }

            if (!string.IsNullOrEmpty(courseId))
            {
                certificatesQuery = certificatesQuery.Where(lp => lp.CourseId == courseId);
            }

            var certificates = await certificatesQuery.ToListAsync();

            // Total certificates issued
            var totalCertificates = certificates.Count;

            // Certificates by course
            var certificatesByCourse = certificates
                .GroupBy(c => new { c.CourseId, c.Course!.Title })
                .Select(g => new
                {
                    courseId = g.Key.CourseId,
                    courseName = g.Key.Title,
                    count = g.Count(),
                    latestIssued = g.Max(c => c.CertificateIssuedAt)
                })
                .OrderByDescending(x => x.count)
                .ToList();

            // Certificates by organization
            var certificatesByOrg = certificates
                .Where(c => c.User?.Organisation != null)
                .GroupBy(c => new { c.User!.OrganisationID, c.User.Organisation!.Name })
                .Select(g => new
                {
                    organisationId = g.Key.OrganisationID,
                    organisationName = g.Key.Name,
                    count = g.Count()
                })
                .OrderByDescending(x => x.count)
                .ToList();

            // Certificates over time (by month)
            var certificatesByMonth = certificates
                .GroupBy(c => new
                {
                    year = c.CertificateIssuedAt!.Value.Year,
                    month = c.CertificateIssuedAt!.Value.Month
                })
                .Select(g => new
                {
                    period = $"{g.Key.year}-{g.Key.month:D2}",
                    count = g.Count()
                })
                .OrderBy(x => x.period)
                .ToList();

            // Recent certificates
            var recentCertificates = certificates
                .OrderByDescending(c => c.CertificateIssuedAt)
                .Take(10)
                .Select(c => new
                {
                    certificateId = c.CertificateId,
                    learnerName = $"{c.User!.FirstName} {c.User.LastName}",
                    courseName = c.Course!.Title,
                    issuedAt = c.CertificateIssuedAt,
                    certificateUrl = c.CertificateUrl
                })
                .ToList();

            return Ok(new
            {
                summary = new
                {
                    totalCertificates,
                    dateRange = new { start, end },
                    filters = new
                    {
                        courseId,
                        organisationId
                    }
                },
                certificatesByCourse,
                certificatesByOrganisation = certificatesByOrg,
                certificatesByMonth,
                recentCertificates
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating certificate statistics");
            return StatusCode(500, new { message = "An error occurred while generating certificate statistics" });
        }
    }

    #endregion
}

public class CustomReportRequest
{
    public string EntityType { get; set; } = "users"; // users, courses, pathways, progress
    public List<string> Metrics { get; set; } = new(); // Selected metrics to include
    public string? GroupBy { get; set; } // Field to group by
    public string? SortBy { get; set; } // Field to sort by
    public bool? SortDescending { get; set; } = true; // Sort direction
    public string? FilterBy { get; set; } // Field to filter by
    public object? FilterValue { get; set; } // Filter value
    public DateTime? StartDate { get; set; } // Date range start
    public DateTime? EndDate { get; set; } // Date range end
    public int? Limit { get; set; } = 100; // Max records to return
}
