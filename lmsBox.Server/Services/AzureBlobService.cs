using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using System.IO.Compression;
using System.Xml.Linq;
using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Services;

public class AzureBlobService : IAzureBlobService
{
    private readonly string? _connectionString;
    private readonly string _containerName;
    private readonly ILogger<AzureBlobService> _logger;
    private readonly BlobContainerClient? _containerClient;
    private readonly ApplicationDbContext _context;

    public AzureBlobService(
        IConfiguration configuration, 
        ILogger<AzureBlobService> logger,
        ApplicationDbContext context)
    {
        _connectionString = configuration["AzureStorage:ConnectionString"];
        _containerName = configuration["AzureStorage:ContainerName"] ?? "lms-content";
        _logger = logger;
        _context = context;

        if (!string.IsNullOrEmpty(_connectionString))
        {
            try
            {
                var blobServiceClient = new BlobServiceClient(_connectionString);
                _containerClient = blobServiceClient.GetBlobContainerClient(_containerName);
                _containerClient.CreateIfNotExists(PublicAccessType.None);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to initialize Azure Blob Storage");
            }
        }
    }

    public bool IsConfigured()
    {
        return _containerClient != null;
    }

    /// <summary>
    /// Get the storage key for an organisation by its numeric ID
    /// </summary>
    private async Task<string> GetStorageKeyAsync(string organisationId)
    {
        if (!long.TryParse(organisationId, out var orgId))
        {
            // If it's not numeric, assume it's already a storage key
            return organisationId;
        }

        var org = await _context.Organisations
            .Where(o => o.Id == orgId)
            .Select(o => o.StorageKey)
            .FirstOrDefaultAsync();

        if (string.IsNullOrEmpty(org))
        {
            throw new InvalidOperationException($"Organisation with ID {organisationId} not found or has no storage key");
        }

        return org;
    }

    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string organisationId, string contentType)
    {
        if (_containerClient == null)
        {
            throw new InvalidOperationException("Azure Blob Storage is not configured");
        }

        try
        {
            // Get the storage key instead of using numeric ID
            var storageKey = await GetStorageKeyAsync(organisationId);
            
            // Create organization folder path: organisations/{storageKey}/library/{fileName}
            var blobPath = $"organisations/{storageKey}/library/{fileName}";
            var blobClient = _containerClient.GetBlobClient(blobPath);

            // Set content type
            var blobHttpHeaders = new BlobHttpHeaders
            {
                ContentType = contentType
            };

            // Upload with overwrite
            await blobClient.UploadAsync(fileStream, new BlobUploadOptions
            {
                HttpHeaders = blobHttpHeaders
            });

            _logger.LogInformation("File uploaded successfully: {BlobPath}", blobPath);

            return blobClient.Uri.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading file to blob storage");
            throw;
        }
    }

    public async Task<string> UploadToCustomPathAsync(Stream fileStream, string fileName, string folderPath, string contentType, string? subFolder = null)
    {
        if (_containerClient == null)
        {
            throw new InvalidOperationException("Azure Blob Storage is not configured");
        }

        try
        {
            // Create custom folder path: folderPath/subFolder/fileName (if subFolder provided)
            var blobPath = subFolder != null 
                ? $"{folderPath}/{subFolder}/{fileName}"
                : $"{folderPath}/{fileName}";
                
            var blobClient = _containerClient.GetBlobClient(blobPath);

            // Set content type
            var blobHttpHeaders = new BlobHttpHeaders
            {
                ContentType = contentType
            };

            // Upload with overwrite
            await blobClient.UploadAsync(fileStream, new BlobUploadOptions
            {
                HttpHeaders = blobHttpHeaders
            });

            _logger.LogInformation("File uploaded successfully: {BlobPath}", blobPath);

            return blobClient.Uri.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading file to blob storage");
            throw;
        }
    }

    // Upload to branding container specifically
    public async Task<string> UploadToBrandingContainerAsync(Stream fileStream, string fileName, string folderPath, string contentType)
    {
        if (string.IsNullOrEmpty(_connectionString))
        {
            throw new InvalidOperationException("Azure Blob Storage is not configured");
        }

        try
        {
            var containerName = "lms-content-brandui";
            
            // Create container client for branding container
            var blobServiceClient = new BlobServiceClient(_connectionString);
            var containerClient = blobServiceClient.GetBlobContainerClient(containerName);
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

            var blobPath = $"{folderPath}/{fileName}";
            var blobClient = containerClient.GetBlobClient(blobPath);

            // Set content type
            var blobHttpHeaders = new BlobHttpHeaders
            {
                ContentType = contentType
            };

            // Upload with overwrite
            await blobClient.UploadAsync(fileStream, new BlobUploadOptions
            {
                HttpHeaders = blobHttpHeaders
            });

            _logger.LogInformation("File uploaded successfully to branding container: {BlobPath}", blobPath);

            return blobClient.Uri.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading file to branding container");
            throw;
        }
    }

    /// <summary>
    /// Upload a file to Azure Blob Storage with custom folder path
    /// </summary>
    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string folderPath, string contentType, string? subFolder = null)
    {
        if (_containerClient == null)
        {
            throw new InvalidOperationException("Azure Blob Storage is not configured");
        }

        try
        {
            // Create blob path: folderPath/subFolder/fileName or folderPath/fileName
            var blobPath = subFolder != null 
                ? $"{folderPath}/{subFolder}/{fileName}"
                : $"{folderPath}/{fileName}";
            
            var blobClient = _containerClient.GetBlobClient(blobPath);

            // Set content type
            var blobHttpHeaders = new BlobHttpHeaders
            {
                ContentType = contentType
            };

            // Upload with overwrite
            await blobClient.UploadAsync(fileStream, new BlobUploadOptions
            {
                HttpHeaders = blobHttpHeaders
            });

            _logger.LogInformation("File uploaded successfully: {BlobPath}", blobPath);

            return blobClient.Uri.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading file to blob storage");
            throw;
        }
    }

    public async Task<List<BlobFileInfo>> ListOrganisationFilesAsync(string organisationId, string? fileType = null)
    {
        if (_containerClient == null)
        {
            throw new InvalidOperationException("Azure Blob Storage is not configured");
        }

        try
        {
            // Get the storage key instead of using numeric ID
            var storageKey = await GetStorageKeyAsync(organisationId);
            
            var files = new List<BlobFileInfo>();
            var prefix = $"organisations/{storageKey}/library/";

            await foreach (var blobItem in _containerClient.GetBlobsAsync(prefix: prefix))
            {
                var blobClient = _containerClient.GetBlobClient(blobItem.Name);
                var properties = await blobClient.GetPropertiesAsync();

                var detectedFileType = GetFileType(blobItem.Name, properties.Value.ContentType);

                // Filter by file type if specified
                if (!string.IsNullOrEmpty(fileType) && detectedFileType != fileType)
                {
                    continue;
                }

                files.Add(new BlobFileInfo
                {
                    Name = Path.GetFileName(blobItem.Name),
                    Url = blobClient.Uri.ToString(),
                    ContentType = properties.Value.ContentType,
                    Size = blobItem.Properties.ContentLength ?? 0,
                    LastModified = blobItem.Properties.LastModified,
                    FileType = detectedFileType
                });
            }

            return files.OrderByDescending(f => f.LastModified).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing files from blob storage");
            throw;
        }
    }

    public async Task<List<BlobFileInfo>> ListSharedLibraryFilesAsync(string? fileType = null)
    {
        if (_containerClient == null)
        {
            throw new InvalidOperationException("Azure Blob Storage is not configured");
        }

        try
        {
            var files = new List<BlobFileInfo>();
            var prefix = "shared-library/";

            await foreach (var blobItem in _containerClient.GetBlobsAsync(prefix: prefix))
            {
                var blobClient = _containerClient.GetBlobClient(blobItem.Name);
                var properties = await blobClient.GetPropertiesAsync();

                var detectedFileType = GetFileType(blobItem.Name, properties.Value.ContentType);

                // Filter by file type if specified
                if (!string.IsNullOrEmpty(fileType) && detectedFileType != fileType)
                {
                    continue;
                }

                files.Add(new BlobFileInfo
                {
                    Name = Path.GetFileName(blobItem.Name),
                    Url = blobClient.Uri.ToString(),
                    ContentType = properties.Value.ContentType,
                    Size = blobItem.Properties.ContentLength ?? 0,
                    LastModified = blobItem.Properties.LastModified,
                    FileType = detectedFileType
                });
            }

            return files.OrderByDescending(f => f.LastModified).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing shared library files from blob storage");
            throw;
        }
    }

    public async Task<bool> DeleteFileAsync(string blobUrl)
    {
        if (_containerClient == null)
        {
            throw new InvalidOperationException("Azure Blob Storage is not configured");
        }

        try
        {
            // Extract blob name from URL
            var uri = new Uri(blobUrl);
            var blobName = uri.AbsolutePath.Split(new[] { _containerName + "/" }, StringSplitOptions.None).Last();

            var blobClient = _containerClient.GetBlobClient(blobName);
            var response = await blobClient.DeleteIfExistsAsync();

            return response.Value;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting file from blob storage");
            return false;
        }
    }

    public async Task<string> GetSasUrlAsync(string blobUrl, int expiryHours = 24)
    {
        if (_containerClient == null)
        {
            _logger.LogWarning("Azure Blob Storage is not configured, returning original URL");
            return blobUrl;
        }

        if (string.IsNullOrEmpty(blobUrl))
        {
            _logger.LogWarning("Blob URL is null or empty");
            return blobUrl;
        }

        try
        {
            var uri = new Uri(blobUrl);
            
            // Extract blob name from the URI path and URL-decode it
            // Expected format: https://storage.blob.core.windows.net/container/path/to/blob
            var pathSegments = uri.AbsolutePath.TrimStart('/').Split('/');
            
            // First segment is container name, rest is the blob path
            if (pathSegments.Length < 2)
            {
                _logger.LogWarning("Invalid blob URL format: {BlobUrl}", blobUrl);
                return blobUrl;
            }

            // Skip the container name (first segment) and get the rest as blob name
            // URL decode each segment to handle spaces and special characters
            var blobName = string.Join("/", pathSegments.Skip(1).Select(System.Net.WebUtility.UrlDecode));
            
            _logger.LogInformation("Parsed blob name from URL: {BlobName}", blobName);
            
            var blobClient = _containerClient.GetBlobClient(blobName);

            // Check if using connection string authentication (which doesn't support SAS generation)
            // Do this check WITHOUT accessing the blob to avoid BlobNotFound errors
            try
            {
                // Try to generate SAS - if it fails, we're using connection string auth
                var sasBuilder = new BlobSasBuilder
                {
                    BlobContainerName = _containerName,
                    BlobName = blobName,
                    Resource = "b",
                    StartsOn = DateTimeOffset.UtcNow.AddMinutes(-5),
                    ExpiresOn = DateTimeOffset.UtcNow.AddHours(expiryHours)
                };

                sasBuilder.SetPermissions(BlobSasPermissions.Read);

                var sasUri = blobClient.GenerateSasUri(sasBuilder);
                
                // If we got here, SAS generation worked
                _logger.LogInformation("Successfully generated SAS URL for blob: {BlobName}", blobName);
                return sasUri.ToString();
            }
            catch (InvalidOperationException)
            {
                // CanGenerateSasUri is false - using connection string auth
                _logger.LogInformation("Connection string authentication detected, returning original URL for blob: {BlobName}", blobName);
                return blobUrl;
            }
            catch (Azure.RequestFailedException azEx)
            {
                // Some Azure error occurred (like BlobNotFound)
                _logger.LogWarning(azEx, "Azure error during SAS generation for blob: {BlobName}, Error: {ErrorCode}. Returning original URL.", blobName, azEx.ErrorCode);
                return blobUrl;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error generating SAS URL for: {BlobUrl}. Returning original URL.", blobUrl);
            return blobUrl; // Return original URL as fallback
        }
    }

    private string GetFileType(string fileName, string contentType)
    {
        var extension = Path.GetExtension(fileName).ToLower();

        // Video files
        if (contentType.StartsWith("video/") || 
            new[] { ".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".webm" }.Contains(extension))
        {
            return "video";
        }

        // Document files
        if (new[] { ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx" }.Contains(extension))
        {
            return "document";
        }

        // SCORM packages (typically zip files)
        if (extension == ".zip" && fileName.ToLower().Contains("scorm"))
        {
            return "scorm";
        }

        return "other";
    }

    public async Task<ScormPackageInfo> UploadScormPackageAsync(Stream zipStream, string fileName, string organisationId)
    {
        if (_containerClient == null)
            throw new InvalidOperationException("Azure Blob Storage is not configured");

        try
        {
            // Get the storage key instead of using numeric ID
            var storageKey = await GetStorageKeyAsync(organisationId);
            
            // Create folder structure: organisations/{storageKey}/library/scorm/{packageName}/
            var packageName = Path.GetFileNameWithoutExtension(fileName);
            var sanitizedPackageName = SanitizeFileName(packageName);
            var scormFolder = $"organisations/{storageKey}/library/scorm/{sanitizedPackageName}";

            _logger.LogInformation($"Uploading SCORM package to: {scormFolder}");

            // Create a temporary directory to extract the zip
            var tempPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
            Directory.CreateDirectory(tempPath);

            try
            {
                // Save zip to temp file
                var tempZipPath = Path.Combine(tempPath, fileName);
                using (var fileStream = File.Create(tempZipPath))
                {
                    await zipStream.CopyToAsync(fileStream);
                }

                // Extract the zip file
                ZipFile.ExtractToDirectory(tempZipPath, tempPath);

                // Find and validate imsmanifest.xml
                var manifestPath = FindManifestFile(tempPath);
                if (manifestPath == null)
                {
                    throw new InvalidOperationException("Invalid SCORM package: imsmanifest.xml not found");
                }

                // Parse manifest to get launch URL
                var launchFile = ParseScormManifest(manifestPath);
                if (string.IsNullOrEmpty(launchFile))
                {
                    throw new InvalidOperationException("Invalid SCORM package: Could not determine launch file from manifest");
                }

                _logger.LogInformation($"SCORM launch file: {launchFile}");

                // Upload all files from the extracted directory
                var manifestDirectory = Path.GetDirectoryName(manifestPath)!;
                var uploadStats = await UploadDirectoryRecursive(manifestDirectory, scormFolder);

                _logger.LogInformation($"Uploaded {uploadStats.FileCount} files, total size: {uploadStats.TotalSize} bytes");

                // Construct the launch URL
                var baseUrl = $"{_containerClient.Uri}/{scormFolder}";
                var launchUrl = $"{baseUrl}/{launchFile.Replace("\\", "/")}";

                return new ScormPackageInfo
                {
                    PackageName = sanitizedPackageName,
                    LaunchUrl = launchUrl,
                    BaseUrl = baseUrl,
                    ManifestPath = $"{scormFolder}/imsmanifest.xml",
                    TotalSize = uploadStats.TotalSize,
                    FileCount = uploadStats.FileCount
                };
            }
            finally
            {
                // Clean up temp directory
                if (Directory.Exists(tempPath))
                {
                    Directory.Delete(tempPath, true);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload SCORM package");
            throw;
        }
    }

    private string? FindManifestFile(string directory)
    {
        // Look for imsmanifest.xml in the current directory and subdirectories
        var manifestFiles = Directory.GetFiles(directory, "imsmanifest.xml", SearchOption.AllDirectories);
        return manifestFiles.FirstOrDefault();
    }

    private string ParseScormManifest(string manifestPath)
    {
        try
        {
            var doc = XDocument.Load(manifestPath);
            var ns = doc.Root?.Name.Namespace ?? XNamespace.None;

            // Find the default organization
            var defaultOrg = doc.Root?
                .Element(ns + "organizations")?
                .Attribute("default")?.Value;

            // Find the first resource with type="webcontent" or first resource overall
            var resource = doc.Root?
                .Element(ns + "resources")?
                .Elements(ns + "resource")
                .FirstOrDefault(r => r.Attribute("type")?.Value == "webcontent" || 
                                     r.Attribute("adlcp:scormtype")?.Value == "sco");

            if (resource == null)
            {
                // Fallback: get first resource
                resource = doc.Root?
                    .Element(ns + "resources")?
                    .Elements(ns + "resource")
                    .FirstOrDefault();
            }

            var href = resource?.Attribute("href")?.Value;
            
            if (string.IsNullOrEmpty(href))
            {
                // Try to find a file element
                var file = resource?
                    .Element(ns + "file")
                    ?.Attribute("href")?.Value;
                
                if (!string.IsNullOrEmpty(file))
                    return file;

                // Last resort: look for index.html or similar
                var manifestDir = Path.GetDirectoryName(manifestPath)!;
                var possibleEntries = new[] { "index.html", "index.htm", "story.html", "index_lms.html" };
                
                foreach (var entry in possibleEntries)
                {
                    var entryPath = Path.Combine(manifestDir, entry);
                    if (File.Exists(entryPath))
                        return entry;
                }
            }

            return href ?? throw new InvalidOperationException("Could not find launch file in manifest");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse SCORM manifest");
            throw new InvalidOperationException("Failed to parse SCORM manifest", ex);
        }
    }

    private async Task<(int FileCount, long TotalSize)> UploadDirectoryRecursive(string localPath, string blobPath)
    {
        int fileCount = 0;
        long totalSize = 0;

        // Upload all files in current directory
        foreach (var filePath in Directory.GetFiles(localPath))
        {
            var fileName = Path.GetFileName(filePath);
            var blobName = $"{blobPath}/{fileName}";

            var blobClient = _containerClient!.GetBlobClient(blobName);

            // Determine content type
            var contentType = GetContentType(fileName);

            using var fileStream = File.OpenRead(filePath);
            var fileInfo = new FileInfo(filePath);
            totalSize += fileInfo.Length;

            await blobClient.UploadAsync(fileStream, new BlobHttpHeaders
            {
                ContentType = contentType
            });

            fileCount++;
            _logger.LogDebug($"Uploaded: {blobName}");
        }

        // Recursively upload subdirectories
        foreach (var directory in Directory.GetDirectories(localPath))
        {
            var dirName = Path.GetFileName(directory);
            var newBlobPath = $"{blobPath}/{dirName}";
            var subStats = await UploadDirectoryRecursive(directory, newBlobPath);
            fileCount += subStats.FileCount;
            totalSize += subStats.TotalSize;
        }

        return (fileCount, totalSize);
    }

    private string GetContentType(string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLower();
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

    private string SanitizeFileName(string fileName)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var sanitized = string.Join("_", fileName.Split(invalid, StringSplitOptions.RemoveEmptyEntries));
        return sanitized.Trim();
    }

    public async Task<string?> CopyBlobAsync(string sourceBlobUrl, string destinationBlobPath)
    {
        if (_containerClient == null)
        {
            _logger.LogWarning("Azure Blob Storage is not configured");
            return null;
        }

        if (string.IsNullOrEmpty(sourceBlobUrl))
        {
            _logger.LogWarning("Source blob URL is null or empty");
            return null;
        }

        try
        {
            var sourceUri = new Uri(sourceBlobUrl);
            
            // Extract blob name from the source URI path
            var pathSegments = sourceUri.AbsolutePath.TrimStart('/').Split('/');
            
            if (pathSegments.Length < 2)
            {
                _logger.LogWarning("Invalid source blob URL format: {SourceUrl}", sourceBlobUrl);
                return null;
            }

            // Skip the container name and get the blob name
            var sourceBlobName = string.Join("/", pathSegments.Skip(1));
            
            var sourceBlobClient = _containerClient.GetBlobClient(sourceBlobName);
            var destinationBlobClient = _containerClient.GetBlobClient(destinationBlobPath);

            // Check if source blob exists
            if (!await sourceBlobClient.ExistsAsync())
            {
                _logger.LogWarning("Source blob does not exist: {SourceBlobName}", sourceBlobName);
                return null;
            }

            // Start the copy operation
            var copyOperation = await destinationBlobClient.StartCopyFromUriAsync(sourceBlobClient.Uri);
            
            // Wait for the copy to complete
            await copyOperation.WaitForCompletionAsync();

            _logger.LogInformation("Successfully copied blob from {Source} to {Destination}", 
                sourceBlobName, destinationBlobPath);

            return destinationBlobClient.Uri.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error copying blob from {Source} to {Destination}", 
                sourceBlobUrl, destinationBlobPath);
            return null;
        }
    }
}
