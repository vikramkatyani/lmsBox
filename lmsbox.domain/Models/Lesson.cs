using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;
public class Lesson
{
    public long Id { get; set; }

    public string CourseId { get; set; } = null!;
    [ForeignKey(nameof(CourseId))]
    public Course? Course { get; set; }

    [Required]
    public string Title { get; set; } = null!;

    public string? Content { get; set; }

    public int Ordinal { get; set; }

    // Lesson Type: content, video, quiz, scorm, document
    public string Type { get; set; } = "content";

    // For quiz type lessons
    public string? QuizId { get; set; }
    [ForeignKey(nameof(QuizId))]
    public Quiz? Quiz { get; set; }

    // For video lessons
    public string? VideoUrl { get; set; }
    
    // Duration in seconds (applies to all content types)
    public int? DurationSeconds { get; set; }

    // For SCORM lessons
    public string? ScormUrl { get; set; }
    public string? ScormEntryUrl { get; set; }
    public string? ScormVersion { get; set; }

    // For document lessons
    public string? DocumentUrl { get; set; }

    // For HTML lessons
    public string? HtmlContent { get; set; }
    public string? HtmlUrl { get; set; }

    // Reference to global library content if this lesson was imported from the global library
    public long? GlobalLibraryContentId { get; set; }

    // Optional flag
    public bool IsOptional { get; set; } = false;

    // Who created the lesson (organisation admin)
    public string CreatedByUserId { get; set; } = null!;
    [ForeignKey(nameof(CreatedByUserId))]
    public ApplicationUser? CreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}