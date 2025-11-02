using System;
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

    public DateTime? CompletedAt { get; set; }
}