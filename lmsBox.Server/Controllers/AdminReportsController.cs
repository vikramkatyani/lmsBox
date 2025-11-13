using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/admin/reports")]
[Authorize(Roles = "Admin,OrgAdmin,SuperAdmin")]
public class AdminReportsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminReportsController> _logger;

    public AdminReportsController(ApplicationDbContext context, ILogger<AdminReportsController> logger)
    {
        _context = context;
        _logger = logger;
    }

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

    [HttpGet("user-activity")]
    public async Task<IActionResult> GetUserActivityReport(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int minDaysDormant = 30)
    {
        try
        {
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

            var usersQuery = _context.Users.AsNoTracking();
            if (orgId.HasValue)
                usersQuery = usersQuery.Where(u => u.OrganisationID == orgId);

            var users = await usersQuery
                .Select(u => new
                {
                    userId = u.Id,
                    name = u.FirstName + " " + u.LastName,
                    email = u.Email ?? "",
                    status = u.ActiveStatus == 1 ? "Active" : u.ActiveStatus == 0 ? "Inactive" : "Suspended",
                    activeStatus = u.ActiveStatus,
                    createdOn = u.CreatedOn,
                    daysSinceCreated = EF.Functions.DateDiffDay(u.CreatedOn, DateTime.UtcNow)
                })
                .ToListAsync();

            // Calculate engagement scores based on course progress
            var userIds = users.Select(u => u.userId).ToList();
            var progressData = await _context.LearnerProgresses
                .AsNoTracking()
                .Where(lp => userIds.Contains(lp.UserId))
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

            var result = users.Select(u =>
            {
                var progress = progressData.FirstOrDefault(p => p.userId == u.userId);
                var lastActivity = progress?.lastActivityDate ?? u.createdOn;
                var daysSinceLastActivity = (DateTime.UtcNow - lastActivity).Days;
                
                // Engagement score formula: 
                // - Average progress contributes 0-50 points
                // - Each completion adds 5 points (max 50)
                // - Active enrollments add 10 points (max 50)
                // - Recency bonus: lose 1 point per day inactive (max -50)
                var baseScore = (progress?.avgProgress ?? 0) * 0.5;
                var completionBonus = Math.Min(progress?.completedCourses ?? 0, 10) * 5;
                var enrollmentBonus = Math.Min(progress?.totalEnrollments ?? 0, 5) * 10;
                var recencyPenalty = Math.Min(daysSinceLastActivity, 50);
                var engagementScore = Math.Max(0, Math.Round(baseScore + completionBonus + enrollmentBonus - recencyPenalty, 2));

                var isDormant = daysSinceLastActivity > minDaysDormant;

                return new
                {
                    u.userId,
                    u.name,
                    u.email,
                    u.status,
                    u.createdOn,
                    lastActivityDate = lastActivity,
                    daysSinceLastActivity,
                    engagementScore,
                    isDormant,
                    enrollments = progress?.totalEnrollments ?? 0,
                    completions = progress?.completedCourses ?? 0,
                    inProgress = progress?.inProgressCourses ?? 0,
                    averageProgress = progress != null ? Math.Round(progress.avgProgress, 2) : 0,
                    totalTimeSpentMinutes = progress?.totalTimeSpentMinutes ?? 0,
                    totalTimeSpentHours = progress != null ? Math.Round(progress.totalTimeSpentMinutes / 60.0, 2) : 0
                };
            }).OrderByDescending(u => u.engagementScore).ToList();

            // Filter by date range based on creation or last activity
            result = result.Where(u => 
                (u.createdOn >= start && u.createdOn <= end) || 
                (u.lastActivityDate >= start && u.lastActivityDate <= end)
            ).ToList();

            var summary = new
            {
                totalUsers = result.Count,
                activeUsers = result.Count(u => u.status == "Active"),
                inactiveUsers = result.Count(u => u.status == "Inactive"),
                suspendedUsers = result.Count(u => u.status == "Suspended"),
                dormantUsers = result.Count(u => u.isDormant),
                averageEngagementScore = result.Any() ? Math.Round(result.Average(u => u.engagementScore), 2) : 0,
                highlyEngagedUsers = result.Count(u => u.engagementScore >= 70),
                moderatelyEngagedUsers = result.Count(u => u.engagementScore >= 40 && u.engagementScore < 70),
                lowEngagementUsers = result.Count(u => u.engagementScore < 40),
                totalTimeSpentHours = result.Any() ? Math.Round(result.Sum(u => u.totalTimeSpentHours), 2) : 0,
                averageTimeSpentPerUserHours = result.Any() ? Math.Round(result.Average(u => u.totalTimeSpentHours), 2) : 0
            };

            var header = new
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
                    minDaysDormant
                }
            };

            return Ok(new { header, users = result, summary });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating user activity report");
            return StatusCode(500, new { error = "Failed to generate user activity report", details = ex.Message });
        }
    }

    #endregion

    #region User Progress Report

    [HttpGet("user-progress")]
    public async Task<IActionResult> GetUserProgressReport(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        try
        {
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

            var usersQuery = _context.Users.AsNoTracking();
            if (orgId.HasValue)
                usersQuery = usersQuery.Where(u => u.OrganisationID == orgId);

            var users = await usersQuery
                .Select(u => new
                {
                    userId = u.Id,
                    name = u.FirstName + " " + u.LastName,
                    email = u.Email,
                    createdOn = u.CreatedOn
                })
                .ToListAsync();

            var userIds = users.Select(u => u.userId).ToList();

            // Get progress data - fetch raw learner progress records grouped by user
            var learnerProgressByUser = await _context.LearnerProgresses
                .AsNoTracking()
                .Where(lp => userIds.Contains(lp.UserId))
                .ToListAsync();

            // Group and calculate metrics in memory
            var progressData = learnerProgressByUser
                .GroupBy(lp => lp.UserId)
                .Select(g => new
                {
                    userId = g.Key,
                    coursesEnrolled = g.Count(),
                    coursesCompleted = g.Count(lp => lp.Completed),
                    coursesInProgress = g.Count(lp => !lp.Completed && lp.ProgressPercent > 0),
                    overallProgress = g.Any() ? g.Average(lp => (double)lp.ProgressPercent) : 0,
                    completedCourses = g.Where(lp => lp.Completed && lp.CompletedAt.HasValue).ToList(),
                    totalTimeSpentSeconds = g.Sum(lp => lp.TotalTimeSpentSeconds),
                    lastAccessedAt = g.Max(lp => lp.LastAccessedAt)
                })
                .ToList();

            var result = users.Select(u =>
            {
                var progress = progressData.FirstOrDefault(p => p.userId == u.userId);
                var monthsSinceCreated = Math.Max(1, (DateTime.UtcNow - u.createdOn).Days / 30.0);
                var learningVelocity = progress != null
                    ? Math.Round(progress.coursesCompleted / monthsSinceCreated, 2)
                    : 0;

                // Calculate average completion time from completed courses
                var avgCompletionTime = 0.0;
                if (progress?.completedCourses != null && progress.completedCourses.Any())
                {
                    var completionTimes = progress.completedCourses
                        .Where(c => c.CompletedAt.HasValue)
                        .Select(c => (DateTime.UtcNow - c.CompletedAt!.Value).Days)
                        .ToList();
                    
                    if (completionTimes.Any())
                    {
                        avgCompletionTime = Math.Abs(Math.Round(completionTimes.Average(), 1));
                    }
                }

                return new
                {
                    u.userId,
                    u.name,
                    u.email,
                    coursesEnrolled = progress?.coursesEnrolled ?? 0,
                    coursesCompleted = progress?.coursesCompleted ?? 0,
                    coursesInProgress = progress?.coursesInProgress ?? 0,
                    overallProgress = progress != null ? Math.Round(progress.overallProgress, 2) : 0,
                    averageCompletionTime = avgCompletionTime,
                    learningVelocity,
                    totalTimeSpentMinutes = progress != null ? Math.Round(progress.totalTimeSpentSeconds / 60.0, 2) : 0,
                    totalTimeSpentHours = progress != null ? Math.Round(progress.totalTimeSpentSeconds / 3600.0, 2) : 0,
                    lastAccessedAt = progress?.lastAccessedAt,
                    averageTimePerCourse = progress?.coursesEnrolled > 0 ? Math.Round(progress.totalTimeSpentSeconds / 60.0 / progress.coursesEnrolled, 2) : 0
                };
            }).ToList();

            var summary = new
            {
                totalLearners = result.Count,
                averageProgress = result.Any() ? Math.Round(result.Average(r => r.overallProgress), 2) : 0,
                averageCompletionTime = result.Any() ? Math.Round(result.Average(r => r.averageCompletionTime), 2) : 0,
                averageLearningVelocity = result.Any() ? Math.Round(result.Average(r => r.learningVelocity), 2) : 0,
                totalEnrollments = result.Sum(r => r.coursesEnrolled),
                totalCompletions = result.Sum(r => r.coursesCompleted),
                totalTimeSpentHours = result.Any() ? Math.Round(result.Sum(r => r.totalTimeSpentHours), 2) : 0,
                averageTimeSpentPerLearnerHours = result.Any() ? Math.Round(result.Average(r => r.totalTimeSpentHours), 2) : 0,
                averageTimePerCourseMinutes = result.Any() ? Math.Round(result.Average(r => r.averageTimePerCourse), 2) : 0
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
                    endDate
                }
            };

            return Ok(new { header, users = result, summary });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating user progress report");
            return StatusCode(500, new { error = "Failed to generate user progress report", details = ex.Message });
        }
    }

    #endregion

    #region Course Enrollment Report

    [HttpGet("course-enrollment")]
    public async Task<IActionResult> GetCourseEnrollmentReport(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        try
        {
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

            var coursesQuery = _context.Courses.AsNoTracking();
            if (orgId.HasValue)
                coursesQuery = coursesQuery.Where(c => c.OrganisationId == orgId);

            var courses = await coursesQuery.ToListAsync();
            var courseIds = courses.Select(c => c.Id).ToList();

            // Get all learner progress records
            var allProgress = await _context.LearnerProgresses
                .AsNoTracking()
                .Where(lp => courseIds.Contains(lp.CourseId!) && lp.LessonId == null)
                .ToListAsync();

            // Group and calculate in memory
            var enrollmentData = allProgress
                .GroupBy(lp => lp.CourseId)
                .Select(g => new
                {
                    courseId = g.Key,
                    totalEnrollments = g.Count(),
                    activeEnrollments = g.Count(lp => !lp.Completed && lp.ProgressPercent > 0),
                    completedEnrollments = g.Count(lp => lp.Completed),
                    droppedEnrollments = g.Count(lp => !lp.Completed && lp.ProgressPercent == 0),
                    completionRate = g.Any() ? Math.Round((g.Count(lp => lp.Completed) / (double)g.Count()) * 100, 2) : 0
                })
                .ToList();

            var result = courses.Select(c =>
            {
                var enrollment = enrollmentData.FirstOrDefault(e => e.courseId == c.Id);
                var total = enrollment?.totalEnrollments ?? 0;
                var dropoffRate = total > 0 && enrollment != null
                    ? Math.Round((enrollment.droppedEnrollments / (double)total) * 100, 2)
                    : 0;

                return new
                {
                    courseId = c.Id,
                    courseTitle = c.Title,
                    category = c.Category,
                    status = c.Status,
                    createdAt = c.CreatedAt,
                    totalEnrollments = total,
                    activeEnrollments = enrollment?.activeEnrollments ?? 0,
                    completedEnrollments = enrollment?.completedEnrollments ?? 0,
                    completionRate = enrollment?.completionRate ?? 0,
                    dropoffRate,
                    popularity = total > 50 ? "High" : total > 20 ? "Medium" : "Low"
                };
            }).OrderByDescending(c => c.totalEnrollments).ToList();

            // Category-based enrollment breakdown
            var categoryBreakdown = result
                .GroupBy(c => c.category ?? "Uncategorized")
                .Select(g => new
                {
                    category = g.Key,
                    courses = g.Count(),
                    totalEnrollments = g.Sum(c => c.totalEnrollments)
                })
                .OrderByDescending(c => c.totalEnrollments)
                .ToList();

            var summary = new
            {
                totalCourses = result.Count,
                totalEnrollments = result.Sum(c => c.totalEnrollments),
                activeEnrollments = result.Sum(c => c.activeEnrollments),
                completedEnrollments = result.Sum(c => c.completedEnrollments),
                averageEnrollmentPerCourse = result.Any() ? Math.Round(result.Average(c => c.totalEnrollments), 2) : 0,
                averageDropoffRate = result.Any() ? Math.Round(result.Average(c => c.dropoffRate), 2) : 0,
                averageCompletionRate = result.Any() ? Math.Round(result.Average(c => c.completionRate), 2) : 0,
                mostPopularCourse = result.FirstOrDefault()?.courseTitle ?? "N/A",
                leastPopularCourse = result.LastOrDefault()?.courseTitle ?? "N/A"
            };

            // Align header structure with the Course Progress report (conditional dateRange, filters block)
            var header = new
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
                    endDate
                }
            };

            return Ok(new { header, courses = result, summary, categoryBreakdown });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating course enrollment report");
            return StatusCode(500, new { error = "Failed to generate course enrollment report", details = ex.Message });
        }
    }

    #endregion

    #region Course Completion Report

    [HttpGet("course-completion")]
    public async Task<IActionResult> GetCourseCompletionReport(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        try
        {
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

            var coursesQuery = _context.Courses.AsNoTracking();
            if (orgId.HasValue)
                coursesQuery = coursesQuery.Where(c => c.OrganisationId == orgId);

            var courses = await coursesQuery.ToListAsync();
            var courseIds = courses.Select(c => c.Id).ToList();

            // Get all learner progress records
            var allProgress = await _context.LearnerProgresses
                .AsNoTracking()
                .Where(lp => courseIds.Contains(lp.CourseId!) && lp.LessonId == null)
                .ToListAsync();

            // Filter by date range
            var dateFilteredProgress = allProgress
                .Where(lp => !lp.CompletedAt.HasValue || (lp.CompletedAt >= start && lp.CompletedAt <= end))
                .ToList();

            // Group and calculate in memory
            var completionData = dateFilteredProgress
                .GroupBy(lp => lp.CourseId)
                .Select(g => new
                {
                    courseId = g.Key,
                    totalEnrollments = g.Count(),
                    completedCount = g.Count(lp => lp.Completed),
                    incompleteCount = g.Count(lp => !lp.Completed),
                    inProgressCount = g.Count(lp => !lp.Completed && lp.ProgressPercent > 0),
                    notStartedCount = g.Count(lp => !lp.Completed && lp.ProgressPercent == 0),
                    completedCourses = g.Where(lp => lp.Completed && lp.CompletedAt.HasValue).ToList()
                })
                .ToList();

            var result = courses.Select(c =>
            {
                var completion = completionData.FirstOrDefault(cd => cd.courseId == c.Id);
                var total = completion?.totalEnrollments ?? 0;
                var completionRate = total > 0
                    ? Math.Round((completion!.completedCount / (double)total) * 100, 2)
                    : 0;

                // Calculate average completion time from completed courses
                var avgCompletionTime = 0.0;
                if (completion?.completedCourses != null && completion.completedCourses.Any())
                {
                    var completionTimes = completion.completedCourses
                        .Where(cc => cc.CompletedAt.HasValue)
                        .Select(cc => (cc.CompletedAt!.Value - c.CreatedAt).Days)
                        .Where(days => days >= 0)
                        .ToList();
                    
                    if (completionTimes.Any())
                    {
                        avgCompletionTime = Math.Round(completionTimes.Average(), 1);
                    }
                }

                return new
                {
                    courseId = c.Id,
                    courseTitle = c.Title,
                    category = c.Category,
                    createdAt = c.CreatedAt,
                    totalEnrollments = total,
                    completedCount = completion?.completedCount ?? 0,
                    incompleteCount = completion?.incompleteCount ?? 0,
                    inProgressCount = completion?.inProgressCount ?? 0,
                    notStartedCount = completion?.notStartedCount ?? 0,
                    completionRate,
                    averageCompletionTime = avgCompletionTime,
                    performance = completionRate >= 75 ? "Excellent" : completionRate >= 50 ? "Good" : completionRate >= 25 ? "Fair" : "Poor"
                };
            }).OrderByDescending(c => c.completionRate).ToList();

            // Completion trends (last 30 days)
            var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
            var recentCompletions = allProgress
                .Where(lp => lp.Completed && lp.CompletedAt.HasValue && lp.CompletedAt.Value >= thirtyDaysAgo)
                .GroupBy(lp => lp.CompletedAt!.Value.Date)
                .Select(g => new { date = g.Key.ToString("MMM dd"), count = g.Count() })
                .OrderBy(x => x.date)
                .ToList();

            // Category breakdown
            var categoryBreakdown = result
                .GroupBy(c => c.category ?? "Uncategorized")
                .Select(g => new
                {
                    category = g.Key,
                    courses = g.Count(),
                    totalCompletions = g.Sum(c => c.completedCount),
                    averageCompletionRate = Math.Round(g.Average(c => c.completionRate), 2)
                })
                .OrderByDescending(c => c.totalCompletions)
                .ToList();

            var summary = new
            {
                totalCourses = result.Count,
                averageCompletionRate = result.Any() ? Math.Round(result.Average(c => c.completionRate), 2) : 0,
                averageCompletionTime = result.Any() ? Math.Round(result.Where(c => c.averageCompletionTime > 0).Select(c => c.averageCompletionTime).DefaultIfEmpty(0).Average(), 2) : 0,
                totalCompletions = result.Sum(c => c.completedCount),
                totalIncomplete = result.Sum(c => c.incompleteCount),
                totalInProgress = result.Sum(c => c.inProgressCount),
                bestPerforming = result.FirstOrDefault()?.courseTitle ?? "N/A",
                worstPerforming = result.LastOrDefault()?.courseTitle ?? "N/A"
            };

            var header = new
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
                    endDate
                }
            };

            return Ok(new { header, courses = result, summary, completionTrends = recentCompletions, categoryBreakdown });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating course completion report");
            return StatusCode(500, new { error = "Failed to generate course completion report", details = ex.Message });
        }
    }

    #endregion

    #region Lesson Analytics Report

    [HttpGet("lesson-analytics")]
    public async Task<IActionResult> GetLessonAnalyticsReport(
        [FromQuery] string? courseId,
        [FromQuery] string? lessonType,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
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

            var lessonsQuery = _context.Lessons.AsNoTracking();
            
            if (!string.IsNullOrEmpty(courseId))
                lessonsQuery = lessonsQuery.Where(l => l.CourseId == courseId);

            if (!string.IsNullOrEmpty(lessonType))
                lessonsQuery = lessonsQuery.Where(l => l.Type == lessonType);

            if (orgId.HasValue)
                lessonsQuery = lessonsQuery.Where(l => l.Course!.OrganisationId == orgId);

            var lessons = await lessonsQuery.Include(l => l.Course).ToListAsync();
            var lessonIds = lessons.Select(l => l.Id).ToList();

            // Get all progress data for lessons
            var allProgressQuery = _context.LearnerProgresses
                .AsNoTracking()
                .Where(lp => lp.LessonId != null && lp.LessonId != null && lessonIds.Contains(lp.LessonId.Value));

            // Apply date filters
            if (startDate.HasValue)
                allProgressQuery = allProgressQuery.Where(lp => lp.LastAccessedAt >= startDate.Value || lp.CompletedAt >= startDate.Value || (lp.LastAccessedAt == null && lp.CompletedAt == null));
            if (endDate.HasValue)
                allProgressQuery = allProgressQuery.Where(lp => lp.LastAccessedAt <= endDate.Value || lp.CompletedAt <= endDate.Value || (lp.LastAccessedAt == null && lp.CompletedAt == null));

            var allProgress = await allProgressQuery.ToListAsync();

            // Calculate metrics per lesson
            var result = lessons.Select(l =>
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

                // Calculate time spent metrics
                var totalTimeSpentSeconds = lessonProgress.Sum(lp => lp.TotalTimeSpentSeconds);
                var avgTimeSpentMinutes = totalEnrollments > 0
                    ? Math.Round(totalTimeSpentSeconds / 60.0 / totalEnrollments, 2)
                    : 0;

                // Calculate video bookmark usage for video lessons
                var videoBookmarkUsage = l.Type == "video" && totalEnrollments > 0
                    ? Math.Round((lessonProgress.Count(lp => lp.VideoTimestamp.HasValue && lp.VideoTimestamp > 0) / (double)totalEnrollments) * 100, 2)
                    : 0;

                // Calculate last access recency
                var lastAccessed = lessonProgress
                    .Where(lp => lp.LastAccessedAt.HasValue)
                    .OrderByDescending(lp => lp.LastAccessedAt)
                    .FirstOrDefault()?.LastAccessedAt;

                var daysSinceLastAccess = lastAccessed.HasValue 
                    ? (DateTime.UtcNow - lastAccessed.Value).Days 
                    : (int?)null;

                // Calculate engagement level
                string engagementLevel;
                if (completionRate >= 75) engagementLevel = "High";
                else if (completionRate >= 50) engagementLevel = "Medium";
                else if (completionRate >= 25) engagementLevel = "Low";
                else engagementLevel = "Very Low";

                // Calculate difficulty based on completion rate and average progress
                string difficulty;
                if (completionRate >= 75 && avgProgress >= 80) difficulty = "Easy";
                else if (completionRate >= 50 && avgProgress >= 60) difficulty = "Moderate";
                else if (completionRate >= 25) difficulty = "Challenging";
                else difficulty = "Very Challenging";

                return new
                {
                    lessonId = l.Id,
                    lessonTitle = l.Title,
                    lessonType = l.Type ?? "Unknown",
                    courseTitle = l.Course?.Title ?? "N/A",
                    courseId = l.CourseId,
                    order = l.Ordinal,
                    duration = l.VideoDurationSeconds.HasValue ? Math.Round(l.VideoDurationSeconds.Value / 60.0, 1) : (double?)null,
                    totalEnrollments,
                    completions,
                    inProgress,
                    notStarted,
                    completionRate,
                    averageProgress = avgProgress,
                    totalTimeSpentHours = Math.Round(totalTimeSpentSeconds / 3600.0, 2),
                    averageTimeSpentMinutes = avgTimeSpentMinutes,
                    videoBookmarkUsagePercent = videoBookmarkUsage,
                    lastAccessedAt = lastAccessed,
                    daysSinceLastAccess,
                    engagementLevel,
                    difficulty,
                    isPopular = totalEnrollments > 10 && completionRate >= 60
                };
            }).OrderBy(l => l.order).ToList();

            // Group by lesson type
            var typeBreakdown = result.GroupBy(l => l.lessonType)
                .Select(g => new
                {
                    type = g.Key,
                    count = g.Count(),
                    totalEnrollments = g.Sum(l => l.totalEnrollments),
                    averageCompletionRate = g.Any() ? Math.Round(g.Average(l => l.completionRate), 2) : 0,
                    averageProgress = g.Any() ? Math.Round(g.Average(l => l.averageProgress), 2) : 0,
                    totalTimeSpentHours = g.Sum(l => l.totalTimeSpentHours),
                    averageTimeSpentMinutes = g.Any() ? Math.Round(g.Average(l => l.averageTimeSpentMinutes), 2) : 0
                })
                .OrderByDescending(t => t.count)
                .ToList();

            // Group by engagement level
            var engagementBreakdown = result.GroupBy(l => l.engagementLevel)
                .Select(g => new
                {
                    level = g.Key,
                    count = g.Count(),
                    percentage = result.Count > 0 ? Math.Round((g.Count() / (double)result.Count) * 100, 2) : 0
                })
                .ToList();

            // Group by difficulty
            var difficultyBreakdown = result.GroupBy(l => l.difficulty)
                .Select(g => new
                {
                    level = g.Key,
                    count = g.Count(),
                    percentage = result.Count > 0 ? Math.Round((g.Count() / (double)result.Count) * 100, 2) : 0
                })
                .ToList();

            // Find popular and problematic lessons
            var popularLessons = result.Where(l => l.isPopular).Take(5).ToList();
            var problematicLessons = result.Where(l => l.completionRate < 25).OrderBy(l => l.completionRate).Take(5).ToList();

            var summary = new
            {
                totalLessons = result.Count,
                totalEnrollments = result.Sum(l => l.totalEnrollments),
                totalCompletions = result.Sum(l => l.completions),
                averageCompletionRate = result.Any() ? Math.Round(result.Average(l => l.completionRate), 2) : 0,
                averageProgress = result.Any() ? Math.Round(result.Average(l => l.averageProgress), 2) : 0,
                totalTimeSpentHours = result.Sum(l => l.totalTimeSpentHours),
                averageTimePerLessonMinutes = result.Any() ? Math.Round(result.Average(l => l.averageTimeSpentMinutes), 2) : 0,
                mostPopularLesson = result.OrderByDescending(l => l.totalEnrollments).FirstOrDefault()?.lessonTitle ?? "N/A",
                highestCompletionLesson = result.OrderByDescending(l => l.completionRate).FirstOrDefault()?.lessonTitle ?? "N/A",
                lowestCompletionLesson = result.OrderBy(l => l.completionRate).FirstOrDefault()?.lessonTitle ?? "N/A",
                mostTimeConsuming = result.OrderByDescending(l => l.averageTimeSpentMinutes).FirstOrDefault()?.lessonTitle ?? "N/A",
                videoLessonsWithBookmarks = result.Count(l => l.lessonType == "video" && l.videoBookmarkUsagePercent > 0),
                popularLessonsCount = popularLessons.Count,
                problematicLessonsCount = problematicLessons.Count
            };

            var header = new
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
                    endDate
                }
            };

            return Ok(new
            {
                header,
                lessons = result,
                summary,
                typeBreakdown,
                engagementBreakdown,
                difficultyBreakdown,
                popularLessons,
                problematicLessons
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

    [HttpGet("time-tracking")]
    public async Task<IActionResult> GetTimeTrackingReport(
        [FromQuery] string? userId,
        [FromQuery] string? courseId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        try
        {
            var orgId = await GetOrgIdFilter();
            var start = startDate ?? DateTime.UtcNow.AddMonths(-1);
            var end = endDate ?? DateTime.UtcNow;

            // Get organization info for header
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

            // Apply filters
            if (!string.IsNullOrEmpty(userId))
                progressQuery = progressQuery.Where(lp => lp.UserId == userId);

            if (!string.IsNullOrEmpty(courseId))
                progressQuery = progressQuery.Where(lp => lp.CourseId == courseId);

            if (orgId.HasValue)
                progressQuery = progressQuery.Where(lp => lp.Course!.OrganisationId == orgId);

            // Filter by last accessed date
            progressQuery = progressQuery.Where(lp => 
                lp.LastAccessedAt.HasValue && lp.LastAccessedAt.Value >= start && lp.LastAccessedAt.Value <= end);

            var progressData = await progressQuery.ToListAsync();

            // Group by user for user-level analytics
            var userTimeAnalytics = progressData
                .GroupBy(lp => new { lp.UserId, lp.User!.FirstName, lp.User.LastName, lp.User.Email })
                .Select(g => new
                {
                    userId = g.Key.UserId,
                    userName = $"{g.Key.FirstName} {g.Key.LastName}",
                    email = g.Key.Email,
                    totalTimeSpentHours = Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 3600.0, 2),
                    coursesAccessed = g.Select(lp => lp.CourseId).Distinct().Count(),
                    lessonsAccessed = g.Count(lp => lp.LessonId != null),
                    lastActivityDate = g.Max(lp => lp.LastAccessedAt),
                    averageSessionMinutes = g.Any() ? Math.Round(g.Average(lp => lp.TotalTimeSpentSeconds) / 60.0, 2) : 0,
                    activeDays = g.Where(lp => lp.LastAccessedAt.HasValue)
                               .Select(lp => lp.LastAccessedAt!.Value.Date)
                               .Distinct()
                               .Count()
                })
                .OrderByDescending(u => u.totalTimeSpentHours)
                .ToList();

            // Group by course for course-level analytics
            var courseTimeAnalytics = progressData
                .Where(lp => lp.CourseId != null)
                .GroupBy(lp => new { lp.CourseId, lp.Course!.Title })
                .Select(g => new
                {
                    courseId = g.Key.CourseId,
                    courseTitle = g.Key.Title,
                    totalTimeSpentHours = Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 3600.0, 2),
                    uniqueLearners = g.Select(lp => lp.UserId).Distinct().Count(),
                    averageTimePerLearnerMinutes = g.Any() ? 
                        Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 60.0 / g.Select(lp => lp.UserId).Distinct().Count(), 2) : 0,
                    totalLessons = g.Count(lp => lp.LessonId != null),
                    completedLessons = g.Count(lp => lp.LessonId != null && lp.Completed)
                })
                .OrderByDescending(c => c.totalTimeSpentHours)
                .ToList();

            // Group by lesson for lesson-level analytics
            var lessonTimeAnalytics = progressData
                .Where(lp => lp.LessonId != null)
                .GroupBy(lp => new { lp.LessonId, LessonTitle = lp.Lesson!.Title, lp.Lesson.Type, lp.CourseId, CourseTitle = lp.Course!.Title })
                .Select(g => new
                {
                    lessonId = g.Key.LessonId,
                    lessonTitle = g.Key.LessonTitle,
                    lessonType = g.Key.Type ?? "Unknown",
                    courseId = g.Key.CourseId,
                    courseTitle = g.Key.CourseTitle,
                    totalTimeSpentHours = Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 3600.0, 2),
                    uniqueLearners = g.Select(lp => lp.UserId).Distinct().Count(),
                    averageTimePerLearnerMinutes = g.Any() ? 
                        Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 60.0 / g.Select(lp => lp.UserId).Distinct().Count(), 2) : 0,
                    completions = g.Count(lp => lp.Completed),
                    completionRate = g.Any() ? Math.Round((g.Count(lp => lp.Completed) / (double)g.Count()) * 100, 2) : 0,
                    videoBookmarkCount = g.Count(lp => lp.VideoTimestamp.HasValue && lp.VideoTimestamp > 0),
                    lastAccessedAt = g.Max(lp => lp.LastAccessedAt)
                })
                .OrderByDescending(l => l.totalTimeSpentHours)
                .ToList();

            // Daily time spent breakdown
            var dailyTimeBreakdown = progressData
                .Where(lp => lp.LastAccessedAt.HasValue)
                .GroupBy(lp => lp.LastAccessedAt!.Value.Date)
                .Select(g => new
                {
                    date = g.Key,
                    totalTimeSpentHours = Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 3600.0, 2),
                    uniqueLearners = g.Select(lp => lp.UserId).Distinct().Count(),
                    lessonsAccessed = g.Count(lp => lp.LessonId != null),
                    coursesAccessed = g.Select(lp => lp.CourseId).Distinct().Count()
                })
                .OrderBy(d => d.date)
                .ToList();

            // Time by lesson type
            var timeByLessonType = progressData
                .Where(lp => lp.LessonId != null && lp.Lesson != null)
                .GroupBy(lp => lp.Lesson!.Type ?? "Unknown")
                .Select(g => new
                {
                    lessonType = g.Key,
                    totalTimeSpentHours = Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 3600.0, 2),
                    lessonCount = g.Select(lp => lp.LessonId).Distinct().Count(),
                    averageTimePerLessonMinutes = g.Any() ? 
                        Math.Round(g.Sum(lp => lp.TotalTimeSpentSeconds) / 60.0 / g.Select(lp => lp.LessonId).Distinct().Count(), 2) : 0
                })
                .OrderByDescending(t => t.totalTimeSpentHours)
                .ToList();

            var summary = new
            {
                totalTimeSpentHours = Math.Round(progressData.Sum(lp => lp.TotalTimeSpentSeconds) / 3600.0, 2),
                totalUniqueLearners = progressData.Select(lp => lp.UserId).Distinct().Count(),
                totalCoursesAccessed = progressData.Select(lp => lp.CourseId).Distinct().Count(),
                totalLessonsAccessed = progressData.Count(lp => lp.LessonId != null),
                averageTimePerLearnerHours = userTimeAnalytics.Any() ? Math.Round(userTimeAnalytics.Average(u => u.totalTimeSpentHours), 2) : 0,
                averageTimePerCourseHours = courseTimeAnalytics.Any() ? Math.Round(courseTimeAnalytics.Average(c => c.totalTimeSpentHours), 2) : 0,
                averageTimePerLessonMinutes = lessonTimeAnalytics.Any() ? Math.Round(lessonTimeAnalytics.Average(l => l.averageTimePerLearnerMinutes), 2) : 0,
                mostActiveDay = dailyTimeBreakdown.OrderByDescending(d => d.totalTimeSpentHours).FirstOrDefault()?.date.ToString("yyyy-MM-dd") ?? "N/A",
                mostTimeConsuming = courseTimeAnalytics.OrderByDescending(c => c.totalTimeSpentHours).FirstOrDefault()?.courseTitle ?? "N/A",
                peakActivityHours = Math.Round(dailyTimeBreakdown.OrderByDescending(d => d.totalTimeSpentHours).FirstOrDefault()?.totalTimeSpentHours ?? 0, 2)
            };

            var header = new
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
                    endDate
                }
            };

            return Ok(new
            {
                header,
                summary,
                userTimeAnalytics,
                courseTimeAnalytics,
                lessonTimeAnalytics = lessonTimeAnalytics.Take(20).ToList(), // Top 20 lessons
                dailyTimeBreakdown,
                timeByLessonType
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

    [HttpGet("pathway-progress")]
    public async Task<IActionResult> GetPathwayProgressReport(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
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

            var pathways = await pathwaysQuery.ToListAsync();
            var pathwayIds = pathways.Select(p => p.Id).ToList();

            // Get pathway progress data
            var progressQuery = _context.LearnerPathwayProgresses
                .AsNoTracking()
                .Where(lpp => pathwayIds.Contains(lpp.LearningPathwayId));

            // Apply date filters
            if (startDate.HasValue)
                progressQuery = progressQuery.Where(lpp => lpp.EnrolledAt >= startDate.Value);
            if (endDate.HasValue)
                progressQuery = progressQuery.Where(lpp => lpp.EnrolledAt <= endDate.Value);

            var allProgress = await progressQuery.ToListAsync();

            // Get pathway courses
            var pathwayCourses = await _context.PathwayCourses
                .AsNoTracking()
                .Where(pc => pathwayIds.Contains(pc.LearningPathwayId))
                .ToListAsync();

            var result = pathways.Select(p =>
            {
                var pathwayProgress = allProgress.Where(lpp => lpp.LearningPathwayId == p.Id).ToList();
                var totalEnrollments = pathwayProgress.Count;
                var completions = pathwayProgress.Count(lpp => lpp.IsCompleted);
                var inProgress = pathwayProgress.Count(lpp => !lpp.IsCompleted && lpp.ProgressPercent > 0);
                var notStarted = pathwayProgress.Count(lpp => lpp.ProgressPercent == 0);
                
                var completionRate = totalEnrollments > 0
                    ? Math.Round((completions / (double)totalEnrollments) * 100, 2)
                    : 0;

                var avgProgress = pathwayProgress.Any()
                    ? Math.Round(pathwayProgress.Average(lpp => lpp.ProgressPercent), 2)
                    : 0;

                // Calculate average completion time (in days)
                var completedProgress = pathwayProgress.Where(lpp => lpp.IsCompleted && lpp.CompletedAt.HasValue).ToList();
                var avgCompletionTime = completedProgress.Any()
                    ? Math.Round(completedProgress.Average(lpp => (lpp.CompletedAt!.Value - lpp.EnrolledAt).TotalDays), 1)
                    : 0;

                // Get course count
                var courseCount = pathwayCourses.Count(pc => pc.LearningPathwayId == p.Id);

                // Calculate engagement level
                string engagementLevel;
                if (totalEnrollments > 50 && completionRate >= 60) engagementLevel = "Excellent";
                else if (totalEnrollments > 20 && completionRate >= 40) engagementLevel = "Good";
                else if (totalEnrollments > 0 && completionRate >= 20) engagementLevel = "Fair";
                else if (totalEnrollments > 0) engagementLevel = "Poor";
                else engagementLevel = "No Data";

                // Recent enrollments (last 30 days)
                var recentEnrollments = pathwayProgress.Count(lpp => lpp.EnrolledAt >= DateTime.UtcNow.AddDays(-30));

                return new
                {
                    pathwayId = p.Id,
                    pathwayTitle = p.Title,
                    description = p.Description,
                    isActive = p.IsActive,
                    courseCount,
                    totalEnrollments,
                    completions,
                    inProgress,
                    notStarted,
                    completionRate,
                    averageProgress = avgProgress,
                    averageCompletionTime = avgCompletionTime,
                    dropoutRate = totalEnrollments > 0 ? Math.Round(100 - completionRate, 2) : 0,
                    engagementLevel,
                    recentEnrollments,
                    isPopular = totalEnrollments > 20 && completionRate >= 50
                };
            }).OrderByDescending(p => p.totalEnrollments).ToList();

            // Engagement breakdown
            var engagementBreakdown = result.GroupBy(p => p.engagementLevel)
                .Select(g => new
                {
                    level = g.Key,
                    count = g.Count(),
                    percentage = result.Count > 0 ? Math.Round((g.Count() / (double)result.Count) * 100, 2) : 0
                })
                .ToList();

            // Top pathways
            var topPathways = result
                .Where(p => p.totalEnrollments > 0)
                .OrderByDescending(p => p.completionRate)
                .Take(5)
                .ToList();

            // Struggling pathways
            var strugglingPathways = result
                .Where(p => p.totalEnrollments > 5 && p.completionRate < 30)
                .OrderBy(p => p.completionRate)
                .Take(5)
                .ToList();

            // Popular pathways
            var popularPathways = result
                .Where(p => p.isPopular)
                .OrderByDescending(p => p.totalEnrollments)
                .Take(5)
                .ToList();

            // Completion trends (group by month for last 6 months)
            var sixMonthsAgo = DateTime.UtcNow.AddMonths(-6);
            var completionTrends = allProgress
                .Where(lpp => lpp.IsCompleted && lpp.CompletedAt.HasValue && lpp.CompletedAt >= sixMonthsAgo)
                .GroupBy(lpp => new { Year = lpp.CompletedAt!.Value.Year, Month = lpp.CompletedAt.Value.Month })
                .Select(g => new
                {
                    month = $"{g.Key.Year}-{g.Key.Month:D2}",
                    completions = g.Count()
                })
                .OrderBy(t => t.month)
                .ToList();

            var summary = new
            {
                totalPathways = result.Count,
                activePathways = result.Count(p => p.isActive),
                totalEnrollments = result.Sum(p => p.totalEnrollments),
                totalCompletions = result.Sum(p => p.completions),
                averageCompletionRate = result.Any() ? Math.Round(result.Average(p => p.completionRate), 2) : 0,
                averageCompletionTime = result.Where(p => p.averageCompletionTime > 0).Any() 
                    ? Math.Round(result.Where(p => p.averageCompletionTime > 0).Average(p => p.averageCompletionTime), 2) 
                    : 0,
                mostSuccessfulPathway = result.OrderByDescending(p => p.completionRate).FirstOrDefault()?.pathwayTitle ?? "N/A",
                mostPopularPathway = result.OrderByDescending(p => p.totalEnrollments).FirstOrDefault()?.pathwayTitle ?? "N/A",
                pathwaysWithNoEnrollments = result.Count(p => p.totalEnrollments == 0),
                totalInProgress = result.Sum(p => p.inProgress)
            };

            var header = new
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
                    activeOnly
                }
            };

            return Ok(new
            {
                header,
                pathways = result,
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

    [HttpGet("user-course-progress")]
    public async Task<IActionResult> GetUserCourseProgressReport(
        [FromQuery] string? search,
        [FromQuery] string? courseId,
        [FromQuery] string? status,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
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

            // Get users
            var usersQuery = _context.Users.AsNoTracking();
            if (orgId.HasValue)
                usersQuery = usersQuery.Where(u => u.OrganisationID == orgId);

            var users = await usersQuery.ToListAsync();
            var userIds = users.Select(u => u.Id).ToList();

            // Get courses
            var coursesQuery = _context.Courses.AsNoTracking();
            if (orgId.HasValue)
                coursesQuery = coursesQuery.Where(c => c.OrganisationId == orgId);

            var courses = await coursesQuery.ToListAsync();
            var courseIds = courses.Select(c => c.Id).ToList();

            // Get all progress records
            var progressQuery = _context.LearnerProgresses
                .AsNoTracking()
                .Where(lp => userIds.Contains(lp.UserId) && 
                             courseIds.Contains(lp.CourseId!) && 
                             lp.LessonId == null);

            if (!string.IsNullOrEmpty(courseId))
                progressQuery = progressQuery.Where(lp => lp.CourseId == courseId);

            // Date filtering on CompletedAt for completed courses
            if (startDate.HasValue && endDate.HasValue)
                progressQuery = progressQuery.Where(lp => 
                    !lp.Completed || 
                    (lp.CompletedAt.HasValue && lp.CompletedAt >= startDate.Value && lp.CompletedAt <= endDate.Value));
            else if (startDate.HasValue)
                progressQuery = progressQuery.Where(lp => 
                    !lp.Completed || 
                    (lp.CompletedAt.HasValue && lp.CompletedAt >= startDate.Value));
            else if (endDate.HasValue)
                progressQuery = progressQuery.Where(lp => 
                    !lp.Completed || 
                    (lp.CompletedAt.HasValue && lp.CompletedAt <= endDate.Value));

            var allProgress = await progressQuery.ToListAsync();

            // Build detailed user-course progress data
            var userCourseProgress = allProgress.Select(lp =>
            {
                var user = users.FirstOrDefault(u => u.Id == lp.UserId);
                var course = courses.FirstOrDefault(c => c.Id == lp.CourseId);

                var progressStatus = lp.Completed ? "Completed" :
                                    lp.ProgressPercent > 0 ? "In Progress" : "Not Started";

                // Calculate days to complete for completed courses only
                var daysToComplete = lp.Completed && lp.CompletedAt.HasValue 
                    ? (int?)(DateTime.UtcNow - lp.CompletedAt.Value).Days 
                    : null;

                // Use completion date or current date for enrollment reference
                var referenceDate = lp.CompletedAt ?? DateTime.UtcNow;
                var daysSinceReference = (DateTime.UtcNow - referenceDate).Days;

                return new
                {
                    userId = lp.UserId,
                    userName = user != null ? $"{user.FirstName} {user.LastName}" : "Unknown User",
                    email = user?.Email ?? "N/A",
                    courseId = lp.CourseId,
                    courseTitle = course?.Title ?? "Unknown Course",
                    courseCategory = course?.Category ?? "Uncategorized",
                    progressPercent = lp.ProgressPercent,
                    status = progressStatus,
                    completed = lp.Completed,
                    completedAt = lp.CompletedAt,
                    daysToComplete,
                    daysSinceReference,
                    isStale = !lp.Completed && lp.ProgressPercent < 50,
                    performance = lp.Completed && daysToComplete.HasValue
                        ? (daysToComplete.Value <= 7 ? "Excellent" : 
                           daysToComplete.Value <= 14 ? "Good" : 
                           daysToComplete.Value <= 30 ? "Average" : "Slow")
                        : "N/A"
                };
            }).ToList();

            // Apply status filter
            if (!string.IsNullOrEmpty(status))
            {
                userCourseProgress = userCourseProgress
                    .Where(ucp => ucp.status.Equals(status, StringComparison.OrdinalIgnoreCase))
                    .ToList();
            }

            // Apply search filter
            if (!string.IsNullOrEmpty(search))
            {
                var searchLower = search.ToLower();
                userCourseProgress = userCourseProgress
                    .Where(ucp => 
                        ucp.userName.ToLower().Contains(searchLower) ||
                        ucp.email.ToLower().Contains(searchLower) ||
                        ucp.courseTitle.ToLower().Contains(searchLower) ||
                        ucp.courseCategory.ToLower().Contains(searchLower))
                    .ToList();
            }

            // Order by completion status and progress
            userCourseProgress = userCourseProgress
                .OrderByDescending(ucp => ucp.completed)
                .ThenByDescending(ucp => ucp.progressPercent)
                .ThenBy(ucp => ucp.userName)
                .ToList();

            // User statistics
            var userStats = userCourseProgress
                .GroupBy(ucp => ucp.userId)
                .Select(g => new
                {
                    userId = g.Key,
                    userName = g.First().userName,
                    email = g.First().email,
                    totalCourses = g.Count(),
                    completed = g.Count(ucp => ucp.completed),
                    inProgress = g.Count(ucp => ucp.status == "In Progress"),
                    notStarted = g.Count(ucp => ucp.status == "Not Started"),
                    averageProgress = Math.Round(g.Average(ucp => ucp.progressPercent), 2),
                    completionRate = g.Count() > 0 
                        ? Math.Round((g.Count(ucp => ucp.completed) / (double)g.Count()) * 100, 2) 
                        : 0
                })
                .OrderByDescending(us => us.completionRate)
                .ToList();

            // Course statistics
            var courseStats = userCourseProgress
                .GroupBy(ucp => ucp.courseId)
                .Select(g => new
                {
                    courseId = g.Key,
                    courseTitle = g.First().courseTitle,
                    category = g.First().courseCategory,
                    totalEnrolled = g.Count(),
                    completed = g.Count(ucp => ucp.completed),
                    inProgress = g.Count(ucp => ucp.status == "In Progress"),
                    notStarted = g.Count(ucp => ucp.status == "Not Started"),
                    averageProgress = Math.Round(g.Average(ucp => ucp.progressPercent), 2),
                    completionRate = g.Count() > 0 
                        ? Math.Round((g.Count(ucp => ucp.completed) / (double)g.Count()) * 100, 2) 
                        : 0,
                    averageCompletionTime = g.Where(ucp => ucp.daysToComplete.HasValue)
                        .Select(ucp => ucp.daysToComplete.Value)
                        .DefaultIfEmpty(0)
                        .Average()
                })
                .OrderByDescending(cs => cs.totalEnrolled)
                .ToList();

            // Status breakdown
            var statusBreakdown = userCourseProgress
                .GroupBy(ucp => ucp.status)
                .Select(g => new
                {
                    status = g.Key,
                    count = g.Count(),
                    percentage = userCourseProgress.Count > 0 
                        ? Math.Round((g.Count() / (double)userCourseProgress.Count) * 100, 2) 
                        : 0
                })
                .ToList();

            // Performance breakdown
            var performanceBreakdown = userCourseProgress
                .Where(ucp => ucp.performance != "N/A")
                .GroupBy(ucp => ucp.performance)
                .Select(g => new
                {
                    performance = g.Key,
                    count = g.Count()
                })
                .ToList();

            // Stale enrollments (not completed, >30 days, <50% progress)
            var staleEnrollments = userCourseProgress
                .Where(ucp => ucp.isStale)
                .Take(10)
                .ToList();

            // Top performers
            var topPerformers = userStats
                .Where(us => us.totalCourses >= 3)
                .OrderByDescending(us => us.completionRate)
                .ThenByDescending(us => us.completed)
                .Take(10)
                .ToList();

            var summary = new
            {
                totalUsers = users.Count,
                totalCourses = courses.Count,
                totalEnrollments = userCourseProgress.Count,
                totalCompleted = userCourseProgress.Count(ucp => ucp.completed),
                totalInProgress = userCourseProgress.Count(ucp => ucp.status == "In Progress"),
                totalNotStarted = userCourseProgress.Count(ucp => ucp.status == "Not Started"),
                averageProgressPercent = userCourseProgress.Any() 
                    ? Math.Round(userCourseProgress.Average(ucp => ucp.progressPercent), 2) 
                    : 0,
                overallCompletionRate = userCourseProgress.Any() 
                    ? Math.Round((userCourseProgress.Count(ucp => ucp.completed) / (double)userCourseProgress.Count) * 100, 2) 
                    : 0,
                staleEnrollmentsCount = userCourseProgress.Count(ucp => ucp.isStale),
                activeUsers = userCourseProgress.Select(ucp => ucp.userId).Distinct().Count(),
                averageCoursesPerUser = users.Count > 0 
                    ? Math.Round(userCourseProgress.Count / (double)users.Count, 2) 
                    : 0
            };

            var header = new
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
                    endDate
                }
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
                summary
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

    [HttpGet("content-usage")]
    public async Task<IActionResult> GetContentUsageReport(
        [FromQuery] string? category,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
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

            var coursesQuery = _context.Courses.AsNoTracking();
            if (orgId.HasValue)
                coursesQuery = coursesQuery.Where(c => c.OrganisationId == orgId);

            if (!string.IsNullOrEmpty(category))
                coursesQuery = coursesQuery.Where(c => c.Category == category);

            var courses = await coursesQuery.ToListAsync();
            var courseIds = courses.Select(c => c.Id).ToList();

            // Get learner progress data
            var progressQuery = _context.LearnerProgresses
                .AsNoTracking()
                .Where(lp => courseIds.Contains(lp.CourseId!));

            // Apply date filters
            if (startDate.HasValue)
                progressQuery = progressQuery.Where(lp => lp.CompletedAt >= startDate.Value || lp.CompletedAt == null);
            if (endDate.HasValue)
                progressQuery = progressQuery.Where(lp => lp.CompletedAt <= endDate.Value || lp.CompletedAt == null);

            var allProgress = await progressQuery.ToListAsync();

            // Get lessons for courses
            var lessons = await _context.Lessons
                .AsNoTracking()
                .Where(l => courseIds.Contains(l.CourseId))
                .ToListAsync();

            var result = courses.Select(c =>
            {
                var courseProgress = allProgress.Where(lp => lp.CourseId == c.Id).ToList();
                var accessCount = courseProgress.Count;
                var uniqueUsers = courseProgress.Select(lp => lp.UserId).Distinct().Count();
                var completions = courseProgress.Count(lp => lp.Completed);
                var avgProgress = courseProgress.Any() ? courseProgress.Average(lp => lp.ProgressPercent) : 0;
                
                // Last access date
                var lastAccess = courseProgress
                    .Where(lp => lp.CompletedAt.HasValue)
                    .OrderByDescending(lp => lp.CompletedAt)
                    .FirstOrDefault()?.CompletedAt;

                // Calculate engagement level
                string engagementLevel;
                if (accessCount > 100) engagementLevel = "High";
                else if (accessCount > 30) engagementLevel = "Medium";
                else if (accessCount > 0) engagementLevel = "Low";
                else engagementLevel = "None";

                // Get lesson count
                var lessonCount = lessons.Count(l => l.CourseId == c.Id);

                // Calculate usage score (access count + unique users * 2 + completions * 3)
                var usageScore = accessCount + (uniqueUsers * 2) + (completions * 3);

                return new
                {
                    contentId = c.Id,
                    contentTitle = c.Title,
                    contentType = "Course",
                    category = c.Category ?? "Uncategorized",
                    accessCount,
                    uniqueUsers,
                    completions,
                    completionRate = accessCount > 0 ? Math.Round((completions / (double)accessCount) * 100, 2) : 0,
                    averageProgress = Math.Round(avgProgress, 2),
                    engagementLevel,
                    lessonCount,
                    lastAccessDate = lastAccess,
                    daysSinceLastAccess = lastAccess.HasValue ? (int)(DateTime.UtcNow - lastAccess.Value).TotalDays : (int?)null,
                    isUnused = accessCount == 0,
                    usageScore,
                    createdAt = c.CreatedAt
                };
            }).OrderByDescending(c => c.usageScore).ToList();

            // Category breakdown
            var categoryBreakdown = result.GroupBy(c => c.category)
                .Select(g => new
                {
                    category = g.Key,
                    contentCount = g.Count(),
                    totalAccesses = g.Sum(c => c.accessCount),
                    totalUsers = g.Sum(c => c.uniqueUsers),
                    averageEngagement = g.Average(c => c.accessCount),
                    unusedContent = g.Count(c => c.isUnused)
                })
                .OrderByDescending(c => c.totalAccesses)
                .ToList();

            // Engagement breakdown
            var engagementBreakdown = result.GroupBy(c => c.engagementLevel)
                .Select(g => new
                {
                    level = g.Key,
                    count = g.Count(),
                    percentage = result.Count > 0 ? Math.Round((g.Count() / (double)result.Count) * 100, 2) : 0
                })
                .ToList();

            // Top performers
            var topContent = result.Where(c => !c.isUnused).Take(10).ToList();
            var unusedContent = result.Where(c => c.isUnused).ToList();
            var underutilizedContent = result.Where(c => c.accessCount > 0 && c.accessCount < 10).OrderBy(c => c.accessCount).Take(10).ToList();

            // Usage trends (group by category)
            var usageTrends = categoryBreakdown.Select(c => new
            {
                category = c.category,
                accessCount = c.totalAccesses
            }).ToList();

            var summary = new
            {
                totalContent = result.Count,
                totalAccesses = result.Sum(c => c.accessCount),
                totalUniqueUsers = result.Sum(c => c.uniqueUsers),
                unusedContent = unusedContent.Count,
                underutilizedContent = underutilizedContent.Count,
                highEngagement = result.Count(c => c.engagementLevel == "High"),
                mediumEngagement = result.Count(c => c.engagementLevel == "Medium"),
                lowEngagement = result.Count(c => c.engagementLevel == "Low"),
                averageAccessPerContent = result.Count > 0 ? Math.Round(result.Average(c => c.accessCount), 2) : 0,
                mostAccessedContent = result.OrderByDescending(c => c.accessCount).FirstOrDefault()?.contentTitle ?? "N/A",
                leastAccessedContent = result.Where(c => !c.isUnused).OrderBy(c => c.accessCount).FirstOrDefault()?.contentTitle ?? "N/A"
            };

            var header = new
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
                    endDate
                }
            };

            return Ok(new
            {
                header,
                content = result,
                summary,
                categoryBreakdown,
                engagementBreakdown,
                topContent,
                unusedContent = unusedContent.Take(10).ToList(),
                underutilizedContent,
                usageTrends
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
