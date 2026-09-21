using System.ComponentModel.DataAnnotations;

namespace lmsbox.domain.Models;

/// <summary>
/// Holds Azure blob locators for LMS records that were soft-deleted so restore stays possible.
/// Blobs are removed from Azure only when the owner is purged and nothing else still references them.
/// </summary>
public class RetainedContentBlob
{
    public long Id { get; set; }

    /// <summary>Owner kind, e.g. course or global-library.</summary>
    [Required]
    [MaxLength(64)]
    public string OwnerType { get; set; } = null!;

    /// <summary>Course id, global library id, etc.</summary>
    [Required]
    [MaxLength(128)]
    public string OwnerId { get; set; } = null!;

    public long? OrganisationId { get; set; }

    [Required]
    public string BlobUrl { get; set; } = null!;

    [Required]
    [MaxLength(128)]
    public string Container { get; set; } = null!;

    [Required]
    [MaxLength(1024)]
    public string BlobName { get; set; } = null!;

    public bool IsPrefix { get; set; }

    [Required]
    [MaxLength(32)]
    public string StorageType { get; set; } = "content";

    public DateTime RetainedAt { get; set; } = DateTime.UtcNow;
}
