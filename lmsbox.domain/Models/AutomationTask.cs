using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lmsbox.domain.Models;

public class AutomationTask
{
    public long Id { get; set; }

    [Required]
    public long OrganisationId { get; set; }

    [ForeignKey(nameof(OrganisationId))]
    public Organisation? Organisation { get; set; }

    [Required]
    public string CreatedByUserId { get; set; } = null!;

    [ForeignKey(nameof(CreatedByUserId))]
    public ApplicationUser? CreatedByUser { get; set; }

    public string? UpdatedByUserId { get; set; }

    [ForeignKey(nameof(UpdatedByUserId))]
    public ApplicationUser? UpdatedByUser { get; set; }

    [Required]
    [MaxLength(40)]
    public string Type { get; set; } = "Notification";

    [Required]
    [MaxLength(30)]
    public string Status { get; set; } = "Draft";

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = null!;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [MaxLength(50)]
    public string? EventKey { get; set; }

    [Required]
    [MaxLength(250)]
    public string EmailSubject { get; set; } = null!;

    [Required]
    public string EmailBodyHtml { get; set; } = null!;

    [Required]
    [MaxLength(50)]
    public string AudienceType { get; set; } = "AllUsers";

    public string? AudienceFilterJson { get; set; }

    public string? CourseFilterJson { get; set; }

    [MaxLength(30)]
    public string? ScheduleMode { get; set; }

    public int? DaysAfterAssignment { get; set; }

    public int? IntervalMinutes { get; set; }

    public DateTime? AnnouncementSendAtLocal { get; set; }

    public DateTime? AnnouncementSendAtUtc { get; set; }

    [MaxLength(100)]
    public string? TimeZoneId { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAtUtc { get; set; }

    public DateTime? PublishedAtUtc { get; set; }

    public ICollection<AutomationDispatch> Dispatches { get; set; } = new List<AutomationDispatch>();
}
