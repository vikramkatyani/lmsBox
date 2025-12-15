using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ScormBulkUploadFunction.Models;
using System.Text.RegularExpressions;

namespace ScormBulkUploadFunction.Services;

public class AzureBlobStorageService : IAzureBlobStorageService
{
    private readonly ILogger<AzureBlobStorageService> _logger;
    private readonly BlobContainerClient _containerClient;
    private readonly HttpClient _httpClient;

    public AzureBlobStorageService(
        ILogger<AzureBlobStorageService> logger,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory)
    {
        _logger = logger;
        _httpClient = httpClientFactory.CreateClient();

        var connectionString = configuration["AzureStorageConnectionString"];
        var containerName = configuration["AzureStorageContainerName"] ?? "lmscontent";

        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException("Azure Storage connection string not configured");
        }

        var blobServiceClient = new BlobServiceClient(connectionString);
        _containerClient = blobServiceClient.GetBlobContainerClient(containerName);
    }

    public async Task<ScormPackageInfo> UploadScormToGlobalLibraryAsync(string extractedPath, string code, string launchFile)
    {
        try
        {
            var sanitizedCode = SanitizeFileName(code);
            var scormFolder = $"global-library/scorm/{sanitizedCode}";

            _logger.LogInformation("Uploading SCORM package to: {Folder}", scormFolder);

            var uploadStats = await UploadDirectoryRecursive(extractedPath, scormFolder);

            var baseUrl = $"{_containerClient.Uri}/{scormFolder}";
            var launchUrl = $"{baseUrl}/{launchFile.Replace("\\", "/")}";

            _logger.LogInformation("Uploaded {FileCount} files, total size: {Size} bytes", 
                uploadStats.FileCount, uploadStats.TotalSize);

            return new ScormPackageInfo
            {
                PackageName = sanitizedCode,
                LaunchUrl = launchUrl,
                BaseUrl = baseUrl,
                ManifestPath = $"{scormFolder}/imsmanifest.xml",
                TotalSize = uploadStats.TotalSize,
                FileCount = uploadStats.FileCount
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload SCORM package to Azure");
            throw;
        }
    }

    public async Task<string?> UploadThumbnailAsync(string thumbnailUrl)
    {
        if (string.IsNullOrWhiteSpace(thumbnailUrl))
            return null;

        try
        {
            _logger.LogInformation("Downloading thumbnail from: {Url}", thumbnailUrl);

            using var response = await _httpClient.GetAsync(thumbnailUrl);
            response.EnsureSuccessStatusCode();

            var contentType = response.Content.Headers.ContentType?.MediaType ?? "image/jpeg";
            var extension = GetExtensionFromContentType(contentType);
            var fileName = $"{Guid.NewGuid()}{extension}";
            var blobPath = $"global-library/thumbnails/{fileName}";

            var blobClient = _containerClient.GetBlobClient(blobPath);
            
            using var stream = await response.Content.ReadAsStreamAsync();
            await blobClient.UploadAsync(stream, new BlobHttpHeaders { ContentType = contentType });

            var uploadedUrl = $"{_containerClient.Uri}/{blobPath}";
            _logger.LogInformation("Thumbnail uploaded: {Url}", uploadedUrl);

            return uploadedUrl;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to upload thumbnail, continuing without it");
            return null;
        }
    }

    private async Task<(int FileCount, long TotalSize)> UploadDirectoryRecursive(string localPath, string blobPrefix)
    {
        int fileCount = 0;
        long totalSize = 0;

        var files = Directory.GetFiles(localPath, "*", SearchOption.AllDirectories);

        foreach (var filePath in files)
        {
            var relativePath = Path.GetRelativePath(localPath, filePath);
            var blobPath = $"{blobPrefix}/{relativePath.Replace("\\", "/")}";
            var blobClient = _containerClient.GetBlobClient(blobPath);

            var contentType = GetContentType(filePath);

            using var fileStream = File.OpenRead(filePath);
            await blobClient.UploadAsync(fileStream, new BlobHttpHeaders { ContentType = contentType });

            var fileInfo = new FileInfo(filePath);
            totalSize += fileInfo.Length;
            fileCount++;

            if (fileCount % 10 == 0)
            {
                _logger.LogInformation("Uploaded {Count} files...", fileCount);
            }
        }

        return (fileCount, totalSize);
    }

    private string GetContentType(string filePath)
    {
        var extension = Path.GetExtension(filePath).ToLowerInvariant();
        return extension switch
        {
            ".html" or ".htm" => "text/html",
            ".css" => "text/css",
            ".js" => "application/javascript",
            ".json" => "application/json",
            ".xml" => "application/xml",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".svg" => "image/svg+xml",
            ".mp4" => "video/mp4",
            ".webm" => "video/webm",
            ".mp3" => "audio/mpeg",
            ".pdf" => "application/pdf",
            ".zip" => "application/zip",
            _ => "application/octet-stream"
        };
    }

    private string GetExtensionFromContentType(string contentType)
    {
        return contentType.ToLowerInvariant() switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/gif" => ".gif",
            "image/svg+xml" => ".svg",
            "image/webp" => ".webp",
            _ => ".jpg"
        };
    }

    private string SanitizeFileName(string fileName)
    {
        var invalidChars = Path.GetInvalidFileNameChars();
        var sanitized = new string(fileName.Select(c => invalidChars.Contains(c) ? '-' : c).ToArray());
        sanitized = Regex.Replace(sanitized, @"\s+", "-");
        sanitized = Regex.Replace(sanitized, @"-+", "-");
        return sanitized.Trim('-').ToLowerInvariant();
    }
}
