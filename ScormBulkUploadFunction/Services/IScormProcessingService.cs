using ScormBulkUploadFunction.Models;

namespace ScormBulkUploadFunction.Services;

public interface IScormProcessingService
{
    Task<ScormPackageInfo> ProcessScormPackageAsync(Stream zipStream, string fileName);
    string? FindManifestFile(string directory);
    string? ParseScormManifest(string manifestPath);
}
