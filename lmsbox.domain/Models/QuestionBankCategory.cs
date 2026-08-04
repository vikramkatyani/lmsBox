using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;

/// <summary>
/// Question categories for the question bank. OrganisationId null = global (SuperAdmin managed).
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

    /// <summary>
    /// Null = global platform categories. Set = organisation-owned categories.
    /// </summary>
    public long? OrganisationId { get; set; }
    [ForeignKey(nameof(OrganisationId))]
    public Organisation? Organisation { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CreatedByUserId { get; set; }

    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedByUserId { get; set; }
}
