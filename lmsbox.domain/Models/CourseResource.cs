using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;

public class CourseResource
{
    public long Id { get; set; }

    public string CourseId { get; set; } = null!;
    [ForeignKey(nameof(CourseId))]
    public Course? Course { get; set; }

    [Required]
    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public int Ordinal { get; set; }

    // Resource type: pdf, html, video
    public string Type { get; set; } = "pdf";

    public string? VideoUrl { get; set; }
    public string? DocumentUrl { get; set; }
    public string? HtmlContent { get; set; }
    public string? HtmlUrl { get; set; }

    /// <summary>Optional thumbnail image URL shown to learners in the resources panel.</summary>
    public string? ThumbnailUrl { get; set; }

    public string CreatedByUserId { get; set; } = null!;
    [ForeignKey(nameof(CreatedByUserId))]
    public ApplicationUser? CreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
