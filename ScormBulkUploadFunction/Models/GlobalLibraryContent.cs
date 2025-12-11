namespace ScormBulkUploadFunction.Models;

public class GlobalLibraryContent
{
    public long Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ContentType { get; set; } = string.Empty;
    public string AzureBlobPath { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string MimeType { get; set; } = string.Empty;
    public string? Category { get; set; }
    public string? Tags { get; set; }
    public string? ThumbnailUrl { get; set; }
    public DateTime UploadedOn { get; set; }
    public string? UploadedBy { get; set; }
    public bool IsActive { get; set; }
}
