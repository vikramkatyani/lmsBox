using System;
using System.ComponentModel.DataAnnotations;

namespace lmsbox.domain.Models;

/// <summary>
/// Shared course categories across all organizations
/// </summary>
public class CourseCategory
{
    [Key]
    public long Id { get; set; }

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// User ID who created this category (first user to use it)
    /// </summary>
    public string? CreatedByUserId { get; set; }
}
