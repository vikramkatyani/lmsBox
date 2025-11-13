using System;
using System.ComponentModel.DataAnnotations;

namespace lmsbox.domain.Models;

public class GlobalLibraryContent
{
    public long Id { get; set; }

    [Required]
    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    [Required]
    public string ContentType { get; set; } = null!; // "pdf" or "video"

    [Required]
    public string AzureBlobPath { get; set; } = null!; // Path in Azure Storage

    public string? FileName { get; set; }

    public long FileSizeBytes { get; set; }

    public string? MimeType { get; set; }

    public DateTime UploadedOn { get; set; } = DateTime.UtcNow;

    public string UploadedBy { get; set; } = "system";

    public bool IsActive { get; set; } = true;

    public DateTime? UpdatedOn { get; set; }

    public string? UpdatedBy { get; set; }

    // Tags or categories for filtering
    public string? Tags { get; set; }
}
