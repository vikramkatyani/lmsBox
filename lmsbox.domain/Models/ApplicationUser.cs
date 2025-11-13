using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace lmsbox.domain.Models;
public class ApplicationUser : IdentityUser
{
    [Required]
    public string FirstName { get; set; } = null!;

    public string? LastName { get; set; }

    [Column("OrganisationID")]
    public long? OrganisationID { get; set; } // Nullable for SuperAdmin

    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

    [Required]
    public string CreatedBy { get; set; } = null!;

    public int ActiveStatus { get; set; }

    public DateTime ActivatedOn { get; set; }

    [Required]
    public string ActivatedBy { get; set; } = null!;

    public DateTime DeactivatedOn { get; set; }

    [Required]
    public string DeactivatedBy { get; set; } = null!;

    // Navigation
    public Organisation? Organisation { get; set; }

    // Business roles (many-to-many via join entity)
    public ICollection<UserUserRole> UserUserRoles { get; set; } = new List<UserUserRole>();

    // Many-to-many membership in learning groups
    public ICollection<LearnerGroup> LearnerGroups { get; set; } = new List<LearnerGroup>();

    public ICollection<CourseAssignment> CourseAssignments { get; set; } = new List<CourseAssignment>();
    public ICollection<LearnerProgress> LearnerProgresses { get; set; } = new List<LearnerProgress>();
    public ICollection<LoginLinkToken> LoginLinkTokens { get; set; } = new List<LoginLinkToken>();
}