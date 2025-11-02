using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;
public class GroupCourse
{
    public int Id { get; set; }

    public long LearningGroupId { get; set; }
    [ForeignKey(nameof(LearningGroupId))]
    public LearningGroup? LearningGroup { get; set; }

    public string CourseId { get; set; } = null!;
    [ForeignKey(nameof(CourseId))]
    public Course? Course { get; set; }

    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }
}