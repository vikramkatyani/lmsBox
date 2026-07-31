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

    // Survey configuration
    public long? PreCourseSurveyId { get; set; }
    [ForeignKey(nameof(PreCourseSurveyId))]
    public Survey? PreCourseSurvey { get; set; }

    public long? PostCourseSurveyId { get; set; }
    [ForeignKey(nameof(PostCourseSurveyId))]
    public Survey? PostCourseSurvey { get; set; }

    public bool IsPreSurveyMandatory { get; set; } = false;
    public bool IsPostSurveyMandatory { get; set; } = false;

    /// <summary>
    /// When true, learners must complete each lesson before the next becomes available.
    /// </summary>
    public bool RequireSequentialLessons { get; set; } = false;

    /// <summary>
    /// When true, learners see Previous/Next navigation buttons in the course player.
    /// Defaults to off; admins can enable per course at any time.
    /// </summary>
    public bool ShowLessonNavigation { get; set; } = false;

    // Ownership: course belongs to an organisation
    public long OrganisationId { get; set; }
    [ForeignKey(nameof(OrganisationId))]
    public Organisation? Organisation { get; set; }

    // Who created the course (organisation admin user id)
    public string CreatedByUserId { get; set; } = null!;
    [ForeignKey(nameof(CreatedByUserId))]
    public ApplicationUser? CreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Soft delete fields
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public string? DeletedByUserId { get; set; }
    [ForeignKey(nameof(DeletedByUserId))]
    public ApplicationUser? DeletedByUser { get; set; }

    // Lessons inside this course
    public ICollection<Lesson> Lessons { get; set; } = new List<Lesson>();

    // Quizzes in this course
    public ICollection<Quiz> Quizzes { get; set; } = new List<Quiz>();

    // Supplementary resources (PDF / HTML / video) outside the lesson sequence
    public ICollection<CourseResource> Resources { get; set; } = new List<CourseResource>();

    // Mapping to learning groups
    public ICollection<GroupCourse> GroupCourses { get; set; } = new List<GroupCourse>();

    // Course assignments (these represent assignments to groups, not direct assignments to users)
    public ICollection<CourseAssignment> CourseAssignments { get; set; } = new List<CourseAssignment>();
}