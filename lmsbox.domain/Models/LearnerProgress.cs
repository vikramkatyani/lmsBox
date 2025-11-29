using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;
public class LearnerProgress
{
    public int Id { get; set; }

    public string UserId { get; set; } = null!;
    [ForeignKey(nameof(UserId))]
    public ApplicationUser? User { get; set; }

    public string? CourseId { get; set; }
    [ForeignKey(nameof(CourseId))]
    public Course? Course { get; set; }

    public long? LessonId { get; set; }
    [ForeignKey(nameof(LessonId))]
    public Lesson? Lesson { get; set; }

    // 0..100
    public int ProgressPercent { get; set; }

    public bool Completed { get; set; }

    public DateTime? StartedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    // Video bookmark timestamp in seconds
    public int? VideoTimestamp { get; set; }

    // Last accessed timestamp for resuming
    public DateTime? LastAccessedAt { get; set; }

    // Time tracking for analytics (in seconds)
    public int TotalTimeSpentSeconds { get; set; } = 0;
    
    // SCORM tracking
    public string? ScormData { get; set; } // JSON string for SCORM suspend_data
    public string? ScormLessonLocation { get; set; } // SCORM bookmark/location
    public string? ScormLessonStatus { get; set; } // incomplete, completed, passed, failed, etc.
    public string? ScormScore { get; set; } // SCORM score value
    
    // Current session tracking
    public DateTime? SessionStartTime { get; set; }
    
    // Certificate tracking
    public string? CertificateUrl { get; set; }
    public string? CertificateId { get; set; }
    public DateTime? CertificateIssuedAt { get; set; }
    public string? CertificateIssuedBy { get; set; } // System or Admin who issued
    
    // Survey completion tracking
    public bool PreSurveyCompleted { get; set; } = false;
    public DateTime? PreSurveyCompletedAt { get; set; }
    public long? PreSurveyResponseId { get; set; }
    
    public bool PostSurveyCompleted { get; set; } = false;
    public DateTime? PostSurveyCompletedAt { get; set; }
    public long? PostSurveyResponseId { get; set; }
    
    // Optimistic concurrency control
    [Timestamp]
    public byte[]? RowVersion { get; set; }
}