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
            var engagements = await _context.UserEngagements
                .Where(e => e.OrganisationId == organisationId && e.CreatedAt >= fromDate && e.CreatedAt <= toDate)
                .ToListAsync();

            // Learner metrics
            var totalLogins = engagements.Count(e => e.EventType == EVENT_LOGIN);
            var totalViews = engagements.Count(e => e.EventType == EVENT_COURSE_VIEW);
            var totalCompletions = engagements.Count(e => e.EventType == EVENT_LESSON_COMPLETE);
            var totalQuizzes = engagements.Count(e => e.EventType == EVENT_QUIZ_ATTEMPT);
            var totalAIQueries = engagements.Count(e => e.EventType == EVENT_AI_QUERY);

            // Admin metrics
            var totalCoursesCreated = engagements.Count(e => e.EventType == EVENT_COURSE_CREATED);
            var totalLessonsCreated = engagements.Count(e => e.EventType == EVENT_LESSON_CREATED);
            var totalUsersAdded = engagements.Count(e => e.EventType == EVENT_USER_ADDED);
            var totalContentUploads = engagements.Count(e => 
                e.EventType == EVENT_VIDEO_UPLOAD || 
                e.EventType == EVENT_PDF_UPLOAD || 
                e.EventType == EVENT_SCORM_UPLOAD || 
                e.EventType == EVENT_HTML_UPLOAD);

            // Calculate weighted engagement score
            var learnerScore = (totalLogins * 1) + (totalViews * 2) + (totalCompletions * 5) + 
                              (totalQuizzes * 3) + (totalAIQueries * 1.5);
            var adminScore = (totalCoursesCreated * 10) + (totalLessonsCreated * 5) + 
                           (totalUsersAdded * 3) + (totalContentUploads * 2);
            var totalScore = learnerScore + adminScore;

            var days = (toDate - fromDate).TotalDays;
            var avgEngagementScore = days > 0 ? totalScore / days : 0;

            return new EngagementOverview
            {
                TotalEvents = engagements.Count,
                ActiveUsers = engagements.Select(e => e.UserId).Distinct().Count(),
                TotalLogins = totalLogins,
                TotalCourseViews = totalViews,
                TotalLessonsCompleted = totalCompletions,
                TotalQuizAttempts = totalQuizzes,
                TotalAIQueries = totalAIQueries,
                TotalCoursesCreated = totalCoursesCreated,
                TotalLessonsCreated = totalLessonsCreated,
                TotalUsersAdded = totalUsersAdded,
                TotalContentUploads = totalContentUploads,
                AverageEngagementScore = Math.Round(avgEngagementScore, 2),
                AverageSessionDuration = Math.Round(
                    engagements.Where(e => e.DurationSeconds.HasValue).Average(e => (double?)e.DurationSeconds / 60) ?? 0, 
                    2)
            };
        }

        public async Task<List<DailyEngagementScore>> GetDailyEngagementScoresAsync(long organisationId, DateTime fromDate, DateTime toDate)
        {
            var engagements = await _context.UserEngagements
                .Where(e => e.OrganisationId == organisationId && e.CreatedAt >= fromDate && e.CreatedAt <= toDate)
                .ToListAsync();

            return engagements
                .GroupBy(e => e.CreatedAt.Date)
                .Select(g => {
                    // Learner activities
                    var logins = g.Count(e => e.EventType == EVENT_LOGIN);
                    var views = g.Count(e => e.EventType == EVENT_COURSE_VIEW);
                    var started = g.Count(e => e.EventType == EVENT_LESSON_START);
                    var completed = g.Count(e => e.EventType == EVENT_LESSON_COMPLETE);
                    var quizzes = g.Count(e => e.EventType == EVENT_QUIZ_ATTEMPT);
                    var aiQueries = g.Count(e => e.EventType == EVENT_AI_QUERY);

                    // Admin activities
                    var coursesCreated = g.Count(e => e.EventType == EVENT_COURSE_CREATED);
                    var lessonsCreated = g.Count(e => e.EventType == EVENT_LESSON_CREATED);
                    var usersAdded = g.Count(e => e.EventType == EVENT_USER_ADDED);
                    var contentUploads = g.Count(e => 
                        e.EventType == EVENT_VIDEO_UPLOAD || 
                        e.EventType == EVENT_PDF_UPLOAD || 
                        e.EventType == EVENT_SCORM_UPLOAD || 
                        e.EventType == EVENT_HTML_UPLOAD);

                    // Weighted scores
                    var learnerScore = (logins * 1) + (views * 2) + (completed * 5) + 
                                      (quizzes * 3) + (aiQueries * 1.5);
                    var adminScore = (coursesCreated * 10) + (lessonsCreated * 5) + 
                                   (usersAdded * 3) + (contentUploads * 2);
                    var totalScore = learnerScore + adminScore;

                    return new DailyEngagementScore
                    {
                        Date = g.Key,
                        TotalEvents = g.Count(),
                        ActiveUsers = g.Select(e => e.UserId).Distinct().Count(),
                        Logins = logins,
                        CourseViews = views,
                        LessonsStarted = started,
                        LessonsCompleted = completed,
                        QuizAttempts = quizzes,
                        AIQueries = aiQueries,
                        CoursesCreated = coursesCreated,
                        LessonsCreated = lessonsCreated,
                        UsersAdded = usersAdded,
                        ContentUploads = contentUploads,
                        EngagementScore = Math.Round((double)totalScore, 2),
                        LearnerScore = Math.Round((double)learnerScore, 2),
                        AdminScore = Math.Round((double)adminScore, 2)
                    };
                })
                .OrderBy(s => s.Date)
                .ToList();
        }

        public async Task<List<TopEngagementUser>> GetTopEngagementUsersAsync(long organisationId, int days = 30, int topCount = 10)
        {
            var fromDate = DateTime.UtcNow.AddDays(-days);

            var userEngagements = await _context.UserEngagements
                .Where(e => e.OrganisationId == organisationId && e.CreatedAt >= fromDate)
                .Include(e => e.User)
                .ToListAsync();

            return userEngagements
                .GroupBy(e => e.User)
                .Select(g => {
                    // Learner metrics
                    var logins = g.Count(e => e.EventType == EVENT_LOGIN);
                    var views = g.Count(e => e.EventType == EVENT_COURSE_VIEW);
                    var completions = g.Count(e => e.EventType == EVENT_LESSON_COMPLETE);
                    var quizzes = g.Count(e => e.EventType == EVENT_QUIZ_ATTEMPT);
                    var aiQueries = g.Count(e => e.EventType == EVENT_AI_QUERY);

                    // Admin metrics
                    var coursesCreated = g.Count(e => e.EventType == EVENT_COURSE_CREATED);
                    var lessonsCreated = g.Count(e => e.EventType == EVENT_LESSON_CREATED);
                    var usersAdded = g.Count(e => e.EventType == EVENT_USER_ADDED);
                    var contentUploads = g.Count(e => 
                        e.EventType == EVENT_VIDEO_UPLOAD || 
                        e.EventType == EVENT_PDF_UPLOAD || 
                        e.EventType == EVENT_SCORM_UPLOAD || 
                        e.EventType == EVENT_HTML_UPLOAD);

                    var learnerScore = (logins * 1) + (views * 2) + (completions * 5) + 
                                      (quizzes * 3) + (aiQueries * 1.5);
                    var adminScore = (coursesCreated * 10) + (lessonsCreated * 5) + 
                                   (usersAdded * 3) + (contentUploads * 2);

                    // Determine primary role based on activity
                    var userRole = adminScore > learnerScore ? "Admin" : "Learner";
                    if (adminScore > 0 && learnerScore > 0) userRole = "Both";

                    return new TopEngagementUser
                    {
                        UserId = g.Key.Id,
                        UserName = $"{g.Key.FirstName} {g.Key.LastName}".Trim(),
                        Email = g.Key.Email ?? "",
                        UserRole = userRole,
                        TotalEvents = g.Count(),
                        LessonsCompleted = completions,
                        CoursesCreated = coursesCreated,
                        LoginDays = g.Where(e => e.EventType == EVENT_LOGIN).Select(e => e.CreatedAt.Date).Distinct().Count(),
                        LastActivity = g.Max(e => e.CreatedAt),
                        EngagementScore = learnerScore + adminScore
                    };
                })
                .OrderByDescending(u => u.EngagementScore)
                .Take(topCount)
                .ToList();
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
