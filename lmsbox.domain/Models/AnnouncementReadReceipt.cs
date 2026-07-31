using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;

public class AnnouncementReadReceipt
{
    public long Id { get; set; }

    [Required]
    public long AutomationTaskId { get; set; }

    [ForeignKey(nameof(AutomationTaskId))]
    public AutomationTask? AutomationTask { get; set; }

    [Required]
    [MaxLength(450)]
    public string UserId { get; set; } = null!;

    public DateTime ReadAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
