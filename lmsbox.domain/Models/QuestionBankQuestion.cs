using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;

public class QuestionBankQuestion
{
    [Key]
    public long Id { get; set; }

    [Required]
    public string Question { get; set; } = null!;

    public string Type { get; set; } = "mc_single"; // mc_single, mc_multi

    public int Points { get; set; } = 1;

    public string? Explanation { get; set; }

    public string? Category { get; set; }

    public bool IsCriticalSafety { get; set; }

    public bool IsArchived { get; set; }

    /// <summary>
    /// JSON array of tags as a string (e.g. ["fall-protection","ppe"]).
    /// Kept consistent with Course.Tags usage in this codebase.
    /// </summary>
    public string? Tags { get; set; }

    /// <summary>
    /// Null = global platform question bank (SuperAdmin). Set = organisation-owned bank.
    /// </summary>
    public long? OrganisationId { get; set; }
    [ForeignKey(nameof(OrganisationId))]
    public Organisation? Organisation { get; set; }

    public string CreatedByUserId { get; set; } = null!;
    [ForeignKey(nameof(CreatedByUserId))]
    public ApplicationUser? CreatedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<QuestionBankQuestionOption> Options { get; set; } = new List<QuestionBankQuestionOption>();
}

public class QuestionBankQuestionOption
{
    [Key]
    public long Id { get; set; }

    [Required]
    public string Text { get; set; } = null!;

    public bool IsCorrect { get; set; }

    public long QuestionBankQuestionId { get; set; }
    [ForeignKey(nameof(QuestionBankQuestionId))]
    public QuestionBankQuestion? QuestionBankQuestion { get; set; }

    public int Order { get; set; }
}
