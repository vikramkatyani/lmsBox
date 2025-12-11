using ScormBulkUploadFunction.Models;

namespace ScormBulkUploadFunction.Services;

public interface IAzureBlobStorageService
{
    Task<ScormPackageInfo> UploadScormToGlobalLibraryAsync(string extractedPath, string packageName, string launchFile);
    Task<string?> UploadThumbnailAsync(string thumbnailUrl);
}
