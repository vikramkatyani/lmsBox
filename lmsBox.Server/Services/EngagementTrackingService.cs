using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace lmsBox.Server.Services
{
    public class EngagementTrackingService : IEngagementTrackingService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<EngagementTrackingService> _logger;

        // Event type constants for consistency
        public const string EVENT_LOGIN = "Login";
        public const string EVENT_COURSE_VIEW = "CourseView";
        public const string EVENT_LESSON_START = "LessonStart";
        public const string EVENT_LESSON_COMPLETE = "LessonComplete";
        public const string EVENT_QUIZ_ATTEMPT = "QuizAttempt";
        public const string EVENT_AI_QUERY = "AIAssistantQuery";
        public const string EVENT_PREVIEW_CONTENT = "PreviewContent";
        
        // Admin events
        public const string EVENT_COURSE_CREATED = "CourseCreated";
        public const string EVENT_LESSON_CREATED = "LessonCreated";
        public const string EVENT_USER_ADDED = "UserAdded";
        public const string EVENT_VIDEO_UPLOAD = "VideoUpload";
        public const string EVENT_PDF_UPLOAD = "PDFUpload";
        public const string EVENT_SCORM_UPLOAD = "SCORMUpload";
        public const string EVENT_HTML_UPLOAD = "HTMLUpload";

        public EngagementTrackingService(ApplicationDbContext context, ILogger<EngagementTrackingService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task TrackAsync(string userId, long organisationId, string eventType, 
            string? courseId = null, long? lessonId = null, long? quizId = null, 
            int? durationSeconds = null, object? metadata = null)
        {
            try
            {
                var engagement = new UserEngagement
                {
                    UserId = userId,
                    OrganisationId = organisationId,
                    EventType = eventType,
                    CourseId = courseId,
                    LessonId = lessonId,
                    QuizId = quizId,
                    DurationSeconds = durationSeconds,
                    Metadata = metadata != null ? JsonSerializer.Serialize(metadata) : null,
                    CreatedAt = DateTime.UtcNow
                };

                _context.UserEngagements.Add(engagement);
                await _context.SaveChangesAsync();
                
                _logger.LogInformation("Tracked engagement: {EventType} for user {UserId} in org {OrgId}", 
                    eventType, userId, organisationId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to track engagement: {EventType} for user {UserId}", eventType, userId);
                // Don't throw - engagement tracking should not break main flow
            }
        }

        public async Task<EngagementOverview> GetOrganisationOverviewAsync(long organisationId, DateTime fromDate, DateTime toDate)
        {
            var aggregate = await _context.UserEngagements
                .AsNoTracking()
                .Where(e => e.OrganisationId == organisationId && e.CreatedAt >= fromDate && e.CreatedAt <= toDate)
                .GroupBy(_ => 1)
                .Select(g => new
                {
                    TotalEvents = g.Count(),
                    ActiveUsers = g.Select(e => e.UserId).Distinct().Count(),
                    TotalLogins = g.Count(e => e.EventType == EVENT_LOGIN),
                    TotalViews = g.Count(e => e.EventType == EVENT_COURSE_VIEW),
                    TotalCompletions = g.Count(e => e.EventType == EVENT_LESSON_COMPLETE),
                    TotalQuizzes = g.Count(e => e.EventType == EVENT_QUIZ_ATTEMPT),
                    TotalAIQueries = g.Count(e => e.EventType == EVENT_AI_QUERY),
                    TotalCoursesCreated = g.Count(e => e.EventType == EVENT_COURSE_CREATED),
                    TotalLessonsCreated = g.Count(e => e.EventType == EVENT_LESSON_CREATED),
                    TotalUsersAdded = g.Count(e => e.EventType == EVENT_USER_ADDED),
                    TotalContentUploads = g.Count(e =>
                        e.EventType == EVENT_VIDEO_UPLOAD ||
                        e.EventType == EVENT_PDF_UPLOAD ||
                        e.EventType == EVENT_SCORM_UPLOAD ||
                        e.EventType == EVENT_HTML_UPLOAD),
                    AvgDurationSeconds = g.Where(e => e.DurationSeconds.HasValue).Average(e => (double?)e.DurationSeconds)
                })
                .FirstOrDefaultAsync();

            if (aggregate == null)
            {
                return new EngagementOverview();
            }

            // Calculate weighted engagement score
            var learnerScore = (aggregate.TotalLogins * 1) + (aggregate.TotalViews * 2) + (aggregate.TotalCompletions * 5) +
                              (aggregate.TotalQuizzes * 3) + (aggregate.TotalAIQueries * 1.5);
            var adminScore = (aggregate.TotalCoursesCreated * 10) + (aggregate.TotalLessonsCreated * 5) +
                           (aggregate.TotalUsersAdded * 3) + (aggregate.TotalContentUploads * 2);
            var totalScore = learnerScore + adminScore;

            var days = (toDate - fromDate).TotalDays;
            var avgEngagementScore = days > 0 ? totalScore / days : 0;

            return new EngagementOverview
            {
                TotalEvents = aggregate.TotalEvents,
                ActiveUsers = aggregate.ActiveUsers,
                TotalLogins = aggregate.TotalLogins,
                TotalCourseViews = aggregate.TotalViews,
                TotalLessonsCompleted = aggregate.TotalCompletions,
                TotalQuizAttempts = aggregate.TotalQuizzes,
                TotalAIQueries = aggregate.TotalAIQueries,
                TotalCoursesCreated = aggregate.TotalCoursesCreated,
                TotalLessonsCreated = aggregate.TotalLessonsCreated,
                TotalUsersAdded = aggregate.TotalUsersAdded,
                TotalContentUploads = aggregate.TotalContentUploads,
                AverageEngagementScore = Math.Round(avgEngagementScore, 2),
                AverageSessionDuration = Math.Round((aggregate.AvgDurationSeconds ?? 0) / 60.0, 2)
            };
        }

        public async Task<List<DailyEngagementScore>> GetDailyEngagementScoresAsync(long organisationId, DateTime fromDate, DateTime toDate)
        {
            var dailyRows = await _context.UserEngagements
                .AsNoTracking()
                .Where(e => e.OrganisationId == organisationId && e.CreatedAt >= fromDate && e.CreatedAt <= toDate)
                .GroupBy(e => e.CreatedAt.Date)
                .Select(g => new
                {
                    Date = g.Key,
                    TotalEvents = g.Count(),
                    ActiveUsers = g.Select(e => e.UserId).Distinct().Count(),
                    Logins = g.Count(e => e.EventType == EVENT_LOGIN),
                    CourseViews = g.Count(e => e.EventType == EVENT_COURSE_VIEW),
                    LessonsStarted = g.Count(e => e.EventType == EVENT_LESSON_START),
                    LessonsCompleted = g.Count(e => e.EventType == EVENT_LESSON_COMPLETE),
                    QuizAttempts = g.Count(e => e.EventType == EVENT_QUIZ_ATTEMPT),
                    AIQueries = g.Count(e => e.EventType == EVENT_AI_QUERY),
                    CoursesCreated = g.Count(e => e.EventType == EVENT_COURSE_CREATED),
                    LessonsCreated = g.Count(e => e.EventType == EVENT_LESSON_CREATED),
                    UsersAdded = g.Count(e => e.EventType == EVENT_USER_ADDED),
                    ContentUploads = g.Count(e =>
                        e.EventType == EVENT_VIDEO_UPLOAD ||
                        e.EventType == EVENT_PDF_UPLOAD ||
                        e.EventType == EVENT_SCORM_UPLOAD ||
                        e.EventType == EVENT_HTML_UPLOAD)
                })
                .OrderBy(s => s.Date)
                .ToListAsync();

            return dailyRows
                .Select(r =>
                {
                    var learnerScore = (r.Logins * 1) + (r.CourseViews * 2) + (r.LessonsCompleted * 5) +
                                      (r.QuizAttempts * 3) + (r.AIQueries * 1.5);
                    var adminScore = (r.CoursesCreated * 10) + (r.LessonsCreated * 5) +
                                   (r.UsersAdded * 3) + (r.ContentUploads * 2);
                    var totalScore = learnerScore + adminScore;

                    return new DailyEngagementScore
                    {
                        Date = r.Date,
                        TotalEvents = r.TotalEvents,
                        ActiveUsers = r.ActiveUsers,
                        Logins = r.Logins,
                        CourseViews = r.CourseViews,
                        LessonsStarted = r.LessonsStarted,
                        LessonsCompleted = r.LessonsCompleted,
                        QuizAttempts = r.QuizAttempts,
                        AIQueries = r.AIQueries,
                        CoursesCreated = r.CoursesCreated,
                        LessonsCreated = r.LessonsCreated,
                        UsersAdded = r.UsersAdded,
                        ContentUploads = r.ContentUploads,
                        EngagementScore = Math.Round(totalScore, 2),
                        LearnerScore = Math.Round(learnerScore, 2),
                        AdminScore = Math.Round((double)adminScore, 2)
                    };
                })
                .ToList();
        }

        public async Task<List<TopEngagementUser>> GetTopEngagementUsersAsync(long organisationId, int days = 30, int topCount = 10)
        {
            var fromDate = DateTime.UtcNow.AddDays(-days);
            var page = await GetTopEngagementUsersPageAsync(
                organisationId,
                fromDate,
                DateTime.UtcNow,
                pageNumber: 1,
                pageSize: Math.Clamp(topCount, 1, 500),
                sortBy: "engagementScore",
                sortDirection: "desc");

            return page.Users;
        }

        public async Task<TopEngagementUsersPageResult> GetTopEngagementUsersPageAsync(
            long organisationId,
            DateTime fromDate,
            DateTime toDate,
            int pageNumber = 1,
            int pageSize = 25,
            string sortBy = "engagementScore",
            string sortDirection = "desc")
        {
            pageNumber = Math.Max(1, pageNumber);
            pageSize = Math.Clamp(pageSize, 1, 500);
            var normalizedSortBy = NormalizeTopUsersSortBy(sortBy);
            var sortDesc = string.Equals(sortDirection, "desc", StringComparison.OrdinalIgnoreCase);

            var userActivityQuery =
                from e in _context.UserEngagements.AsNoTracking()
                where e.OrganisationId == organisationId && e.CreatedAt >= fromDate && e.CreatedAt <= toDate
                group e by e.UserId
                into g
                select new
                {
                    UserId = g.Key,
                    TotalEvents = g.Count(),
                    Logins = g.Count(e => e.EventType == EVENT_LOGIN),
                    CourseViews = g.Count(e => e.EventType == EVENT_COURSE_VIEW),
                    LessonsCompleted = g.Count(e => e.EventType == EVENT_LESSON_COMPLETE),
                    QuizAttempts = g.Count(e => e.EventType == EVENT_QUIZ_ATTEMPT),
                    AIQueries = g.Count(e => e.EventType == EVENT_AI_QUERY),
                    CoursesCreated = g.Count(e => e.EventType == EVENT_COURSE_CREATED),
                    LessonsCreated = g.Count(e => e.EventType == EVENT_LESSON_CREATED),
                    UsersAdded = g.Count(e => e.EventType == EVENT_USER_ADDED),
                    ContentUploads = g.Count(e =>
                        e.EventType == EVENT_VIDEO_UPLOAD ||
                        e.EventType == EVENT_PDF_UPLOAD ||
                        e.EventType == EVENT_SCORM_UPLOAD ||
                        e.EventType == EVENT_HTML_UPLOAD),
                    LoginDays = g.Where(e => e.EventType == EVENT_LOGIN).Select(e => e.CreatedAt.Date).Distinct().Count(),
                    LastActivity = g.Max(e => e.CreatedAt)
                };

            var rowsQuery =
                from a in userActivityQuery
                join u in _context.Users.AsNoTracking() on a.UserId equals u.Id
                select new
                {
                    UserId = a.UserId,
                    UserName = ((u.FirstName ?? "") + " " + (u.LastName ?? "")).Trim(),
                    Email = u.Email ?? "",
                    TotalEvents = a.TotalEvents,
                    LessonsCompleted = a.LessonsCompleted,
                    CoursesCreated = a.CoursesCreated,
                    LoginDays = a.LoginDays,
                    LastActivity = a.LastActivity,
                    LearnerScore = (a.Logins * 1d) + (a.CourseViews * 2d) + (a.LessonsCompleted * 5d) + (a.QuizAttempts * 3d) + (a.AIQueries * 1.5d),
                    AdminScore = (a.CoursesCreated * 10d) + (a.LessonsCreated * 5d) + (a.UsersAdded * 3d) + (a.ContentUploads * 2d)
                };

            var sortableRowsQuery = rowsQuery.Select(r => new
            {
                r.UserId,
                r.UserName,
                r.Email,
                r.TotalEvents,
                r.LessonsCompleted,
                r.CoursesCreated,
                r.LoginDays,
                r.LastActivity,
                EngagementScore = r.LearnerScore + r.AdminScore,
                UserRole = r.AdminScore > 0 && r.LearnerScore > 0
                    ? "Both"
                    : r.AdminScore > r.LearnerScore
                        ? "Admin"
                        : "Learner"
            });

            sortableRowsQuery = normalizedSortBy switch
            {
                "name" => sortDesc ? sortableRowsQuery.OrderByDescending(r => r.UserName) : sortableRowsQuery.OrderBy(r => r.UserName),
                "email" => sortDesc ? sortableRowsQuery.OrderByDescending(r => r.Email) : sortableRowsQuery.OrderBy(r => r.Email),
                "role" => sortDesc ? sortableRowsQuery.OrderByDescending(r => r.UserRole) : sortableRowsQuery.OrderBy(r => r.UserRole),
                "totalevents" => sortDesc ? sortableRowsQuery.OrderByDescending(r => r.TotalEvents) : sortableRowsQuery.OrderBy(r => r.TotalEvents),
                "lessonscompleted" => sortDesc ? sortableRowsQuery.OrderByDescending(r => r.LessonsCompleted) : sortableRowsQuery.OrderBy(r => r.LessonsCompleted),
                "coursescreated" => sortDesc ? sortableRowsQuery.OrderByDescending(r => r.CoursesCreated) : sortableRowsQuery.OrderBy(r => r.CoursesCreated),
                "logindays" => sortDesc ? sortableRowsQuery.OrderByDescending(r => r.LoginDays) : sortableRowsQuery.OrderBy(r => r.LoginDays),
                "lastactivity" => sortDesc ? sortableRowsQuery.OrderByDescending(r => r.LastActivity) : sortableRowsQuery.OrderBy(r => r.LastActivity),
                _ => sortDesc ? sortableRowsQuery.OrderByDescending(r => r.EngagementScore) : sortableRowsQuery.OrderBy(r => r.EngagementScore)
            };

            var totalUsers = await sortableRowsQuery.CountAsync();
            var totalPages = totalUsers == 0 ? 1 : (int)Math.Ceiling(totalUsers / (double)pageSize);
            if (pageNumber > totalPages)
            {
                pageNumber = totalPages;
            }

            var rows = await sortableRowsQuery
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return new TopEngagementUsersPageResult
            {
                Users = rows.Select(r => new TopEngagementUser
                {
                    UserId = r.UserId,
                    UserName = r.UserName,
                    Email = r.Email,
                    UserRole = r.UserRole,
                    TotalEvents = r.TotalEvents,
                    LessonsCompleted = r.LessonsCompleted,
                    CoursesCreated = r.CoursesCreated,
                    LoginDays = r.LoginDays,
                    LastActivity = r.LastActivity,
                    EngagementScore = Math.Round(r.EngagementScore, 2)
                }).ToList(),
                Pagination = new EngagementTablePagination
                {
                    PageNumber = pageNumber,
                    PageSize = pageSize,
                    TotalUsers = totalUsers,
                    TotalPages = totalPages,
                    HasPreviousPage = pageNumber > 1,
                    HasNextPage = pageNumber < totalPages
                }
            };
        }

        private static string NormalizeTopUsersSortBy(string sortBy)
        {
            if (string.IsNullOrWhiteSpace(sortBy))
            {
                return "engagementscore";
            }

            return sortBy.Trim().ToLowerInvariant() switch
            {
                "name" => "name",
                "email" => "email",
                "role" => "role",
                "totalevents" => "totalevents",
                "lessonscompleted" => "lessonscompleted",
                "coursescreated" => "coursescreated",
                "logindays" => "logindays",
                "lastactivity" => "lastactivity",
                _ => "engagementscore"
            };
        }

        public async Task<Dictionary<string, int>> GetEventBreakdownAsync(long organisationId, DateTime fromDate, DateTime toDate)
        {
            return await _context.UserEngagements
                .Where(e => e.OrganisationId == organisationId && e.CreatedAt >= fromDate && e.CreatedAt <= toDate)
                .GroupBy(e => e.EventType)
                .Select(g => new { EventType = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.EventType, x => x.Count);
        }
    }
}
