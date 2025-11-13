namespace lmsBox.Server.Services;

public interface IAzureBlobService
{
    /// <summary>
    /// Upload a file to Azure Blob Storage in the organization's library folder
    /// </summary>
    Task<string> UploadFileAsync(Stream fileStream, string fileName, string organisationId, string contentType);

    /// <summary>
    /// Upload a file to Azure Blob Storage with custom folder path
    /// </summary>
    Task<string> UploadToCustomPathAsync(Stream fileStream, string fileName, string folderPath, string contentType, string? subFolder = null);

    /// <summary>
    /// List all files in an organization's library folder
    /// </summary>
    Task<List<BlobFileInfo>> ListOrganisationFilesAsync(string organisationId, string? fileType = null);

    /// <summary>
    /// List all files in the shared LMS library (accessible to all organizations)
    /// </summary>
    Task<List<BlobFileInfo>> ListSharedLibraryFilesAsync(string? fileType = null);

    /// <summary>
    /// Delete a file from blob storage
    /// </summary>
    Task<bool> DeleteFileAsync(string blobUrl);

    /// <summary>
    /// Get a SAS token URL for secure access to a blob
    /// </summary>
    Task<string> GetSasUrlAsync(string blobUrl, int expiryHours = 24);

    /// <summary>
    /// Check if blob storage is configured
    /// </summary>
    bool IsConfigured();

    /// <summary>
    /// Upload and extract a SCORM package to Azure Blob Storage
    /// </summary>
    Task<ScormPackageInfo> UploadScormPackageAsync(Stream zipStream, string fileName, string organisationId);
}

public class BlobFileInfo
{
    public string Name { get; set; } = null!;
    public string Url { get; set; } = null!;
    public string ContentType { get; set; } = null!;
    public long Size { get; set; }
    public DateTimeOffset? LastModified { get; set; }
    public string FileType { get; set; } = null!; // video, document, scorm, other
}

public class ScormPackageInfo
{
    public string PackageName { get; set; } = null!;
    public string LaunchUrl { get; set; } = null!;
    public string BaseUrl { get; set; } = null!;
    public string ManifestPath { get; set; } = null!;
    public long TotalSize { get; set; }
    public int FileCount { get; set; }
}
