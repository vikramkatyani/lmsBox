using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;

public class AutomationDispatch
{
    public long Id { get; set; }

    [Required]
    public long AutomationTaskId { get; set; }

    [ForeignKey(nameof(AutomationTaskId))]
    public AutomationTask? AutomationTask { get; set; }

    [Required]
    public long OrganisationId { get; set; }

    [ForeignKey(nameof(OrganisationId))]
    public Organisation? Organisation { get; set; }

    public string? UserId { get; set; }

    [ForeignKey(nameof(UserId))]
    public ApplicationUser? User { get; set; }

    [Required]
    [MaxLength(320)]
    public string RecipientEmail { get; set; } = null!;

    [Required]
    [MaxLength(250)]
    public string SubjectSnapshot { get; set; } = null!;

    [Required]
    public string BodySnapshot { get; set; } = null!;

    public DateTime ScheduledForUtc { get; set; }

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "Pending";

    public int Attempts { get; set; } = 0;

    [MaxLength(2000)]
    public string? LastError { get; set; }

    public DateTime? SentAtUtc { get; set; }

    [Required]
    [MaxLength(200)]
    public string IdempotencyKey { get; set; } = null!;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAtUtc { get; set; }
}
