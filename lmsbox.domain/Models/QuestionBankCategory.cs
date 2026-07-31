using System;
using System.ComponentModel.DataAnnotations;

namespace lmsbox.domain.Models;

/// <summary>
/// Shared question categories for the global question bank (SuperAdmin managed).
/// Questions still store Category as a string for simplicity/compatibility.
/// </summary>
public class QuestionBankCategory
{
    [Key]
    public long Id { get; set; }

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = null!;

    [StringLength(500)]
    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedByUserId { get; set; }

    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedByUserId { get; set; }
}
