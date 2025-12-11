namespace ScormBulkUploadFunction.Services;

public interface IGoogleDriveService
{
    Task<Stream> DownloadFileAsync(string fileUrl);
    string? ExtractFileIdFromUrl(string url);
}
