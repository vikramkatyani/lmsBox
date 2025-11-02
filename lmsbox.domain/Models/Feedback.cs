using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;
public class Feedback
{
    public int Id { get; set; }

    public string UserId { get; set; } = null!;
    [ForeignKey(nameof(UserId))]
    public ApplicationUser? User { get; set; }

    public string? CourseId { get; set; }
    [ForeignKey(nameof(CourseId))]
    public Course? Course { get; set; }

    public string Comment { get; set; } = string.Empty;
    public int Rating { get; set; } = 0; // 0..5
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}