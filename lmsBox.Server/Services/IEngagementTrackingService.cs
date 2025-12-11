using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace lmsBox.Server.Services
{
    public interface IEngagementTrackingService
    {
        Task TrackAsync(string userId, long organisationId, string eventType, 
            string? courseId = null, long? lessonId = null, long? quizId = null, 
            int? durationSeconds = null, object? metadata = null);
            
        Task<EngagementOverview> GetOrganisationOverviewAsync(long organisationId, DateTime fromDate, DateTime toDate);
        Task<List<DailyEngagementScore>> GetDailyEngagementScoresAsync(long organisationId, DateTime fromDate, DateTime toDate);
        Task<List<TopEngagementUser>> GetTopEngagementUsersAsync(long organisationId, int days = 30, int topCount = 10);
        Task<Dictionary<string, int>> GetEventBreakdownAsync(long organisationId, DateTime fromDate, DateTime toDate);
    }
    
    public class EngagementOverview
    {
        public int TotalEvents { get; set; }
        public int ActiveUsers { get; set; }
        public int TotalLogins { get; set; }
        public int TotalCourseViews { get; set; }
        public int TotalLessonsCompleted { get; set; }
        public int TotalQuizAttempts { get; set; }
        public int TotalAIQueries { get; set; }
        
        // Admin activity metrics
        public int TotalCoursesCreated { get; set; }
        public int TotalLessonsCreated { get; set; }
        public int TotalUsersAdded { get; set; }
        public int TotalContentUploads { get; set; }
        
        public double AverageEngagementScore { get; set; }
        public double AverageSessionDuration { get; set; }
    }
    
    public class DailyEngagementScore
    {
        public DateTime Date { get; set; }
        public int TotalEvents { get; set; }
        public int ActiveUsers { get; set; }
        
        // Learner activities
        public int Logins { get; set; }
        public int CourseViews { get; set; }
        public int LessonsStarted { get; set; }
        public int LessonsCompleted { get; set; }
        public int QuizAttempts { get; set; }
        public int AIQueries { get; set; }
        
        // Admin activities
        public int CoursesCreated { get; set; }
        public int LessonsCreated { get; set; }
        public int UsersAdded { get; set; }
        public int ContentUploads { get; set; }
        
        public double EngagementScore { get; set; }
        public double LearnerScore { get; set; }
        public double AdminScore { get; set; }
    }
    
    public class TopEngagementUser
    {
        public required string UserId { get; set; }
        public required string UserName { get; set; }
        public string Email { get; set; } = string.Empty;
        public string UserRole { get; set; } = string.Empty;
        public int TotalEvents { get; set; }
        public int LessonsCompleted { get; set; }
        public int CoursesCreated { get; set; }
        public int LoginDays { get; set; }
        public DateTime LastActivity { get; set; }
        public double EngagementScore { get; set; }
    }
}
