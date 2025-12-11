using System;

namespace lmsbox.domain.Models
{
    public class UserEngagement
    {
        public long Id { get; set; }
        public required string UserId { get; set; }
        public long OrganisationId { get; set; }
        
        // What action was performed
        public required string EventType { get; set; } // Login, CourseView, LessonStart, LessonComplete, QuizAttempt, VideoPlay, PDFOpen, SCORMInteraction, AIAssistantQuery, etc.
        
        // Context
        public string? CourseId { get; set; }
        public long? LessonId { get; set; }
        public long? QuizId { get; set; }
        public long? PathwayId { get; set; }
        
        // Additional metadata (JSON for flexibility)
        public string? Metadata { get; set; } // Store as JSON: duration, score, query text, etc.
        
        // Timing
        public DateTime CreatedAt { get; set; }
        public int? DurationSeconds { get; set; } // How long they spent
        
        // Navigation properties
        public ApplicationUser? User { get; set; }
        public Organisation? Organisation { get; set; }
        public Course? Course { get; set; }
        public Lesson? Lesson { get; set; }
    }
}
