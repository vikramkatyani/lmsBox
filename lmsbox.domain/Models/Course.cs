using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;
public class Course
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public string Id { get; set; } = null!;

    [Required]
    public string Title { get; set; } = null!;

    public string? Description { get; set; }
    
    public string? ShortDescription { get; set; }
    
    public string? Category { get; set; }
    
    public string? Tags { get; set; } // JSON array of tags as string
    
    public bool CertificateEnabled { get; set; } = true;
    
    public string? BannerUrl { get; set; }
    
    public string Status { get; set; } = "Draft"; // Draft, Active, Archived
    
    public DateTime? UpdatedAt { get; set; }

    // Ownership: course belongs to an organisation
    public long OrganisationId { get; set; }
    [ForeignKey(nameof(OrganisationId))]
    public Organisation? Organisation { get; set; }

    // Who created the course (organisation admin user id)
    public string CreatedByUserId { get; set; } = null!;
    [ForeignKey(nameof(CreatedByUserId))]
    public ApplicationUser? CreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Lessons inside this course
    public ICollection<Lesson> Lessons { get; set; } = new List<Lesson>();

    // Mapping to learning groups
    public ICollection<GroupCourse> GroupCourses { get; set; } = new List<GroupCourse>();

    // Course assignments (these represent assignments to groups, not direct assignments to users)
    public ICollection<CourseAssignment> CourseAssignments { get; set; } = new List<CourseAssignment>();
}