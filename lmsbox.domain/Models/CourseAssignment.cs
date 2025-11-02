using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;
public class CourseAssignment
{
    public int Id { get; set; }

    // The course being assigned
    public string CourseId { get; set; } = null!;
    [ForeignKey(nameof(CourseId))]
    public Course? Course { get; set; }

    // Assignment is to a learning group (direct user assignment intentionally removed)
    public long LearningGroupId { get; set; }
    [ForeignKey(nameof(LearningGroupId))]
    public LearningGroup? LearningGroup { get; set; }

    // Who assigned the course (organisation admin user id)
    public string AssignedByUserId { get; set; } = string.Empty;
    [ForeignKey(nameof(AssignedByUserId))]
    public ApplicationUser? AssignedByUser { get; set; }

    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    public DateTime? DueDate { get; set; }
}