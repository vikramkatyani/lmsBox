using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;

public class InteractiveBlock
{
    public long Id { get; set; }

    public long InteractiveLessonSettingsId { get; set; }

    [ForeignKey(nameof(InteractiveLessonSettingsId))]
    public InteractiveLessonSettings? InteractiveLessonSettings { get; set; }

    public int Ordinal { get; set; }

    [Required]
    public string BlockType { get; set; } = "questionnaire";

    [Required]
    public string Title { get; set; } = null!;

    /// <summary>Draft | Generating | Generated | Approved</summary>
    [Required]
    public string Status { get; set; } = "Draft";

    public string? FormPayloadJson { get; set; }

    public string? GeneratedHtml { get; set; }

    public string? EditedHtml { get; set; }

    public string? CompletionRuleJson { get; set; }

    public string? MediaAssetsJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ApprovedAt { get; set; }
}
