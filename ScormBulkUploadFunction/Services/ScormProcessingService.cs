using Microsoft.Extensions.Logging;
using ScormBulkUploadFunction.Models;
using System.IO.Compression;
using System.Xml.Linq;

namespace ScormBulkUploadFunction.Services;

public class ScormProcessingService : IScormProcessingService
{
    private readonly ILogger<ScormProcessingService> _logger;

    public ScormProcessingService(ILogger<ScormProcessingService> logger)
    {
        _logger = logger;
    }

    public async Task<ScormPackageInfo> ProcessScormPackageAsync(Stream zipStream, string fileName)
    {
        var tempPath = Path.Combine(Path.GetTempPath(), "scorm-temp", Guid.NewGuid().ToString());
        Directory.CreateDirectory(tempPath);
        _logger.LogInformation("Created temp directory: {TempPath}", tempPath);

        try
        {
            // Save zip to temp file
            var tempZipPath = Path.Combine(tempPath, fileName);
            _logger.LogInformation("Saving zip to: {TempZipPath}", tempZipPath);
            
            using (var fileStream = File.Create(tempZipPath))
            {
                await zipStream.CopyToAsync(fileStream);
            }
            
            _logger.LogInformation("Zip saved, size: {Size} bytes", new FileInfo(tempZipPath).Length);

            // Extract the zip file
            var extractPath = Path.Combine(tempPath, "extracted");
            Directory.CreateDirectory(extractPath);
            _logger.LogInformation("Extracting to: {ExtractPath}", extractPath);
            
            ZipFile.ExtractToDirectory(tempZipPath, extractPath);
            _logger.LogInformation("Extraction complete");

            // Use extracted path for manifest search
            tempPath = extractPath;

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

            _logger.LogInformation("SCORM launch file: {LaunchFile}", launchFile);

            // Get package stats
            var manifestDirectory = Path.GetDirectoryName(manifestPath)!;
            var files = Directory.GetFiles(manifestDirectory, "*", SearchOption.AllDirectories);
            var totalSize = files.Sum(f => new FileInfo(f).Length);

            return new ScormPackageInfo
            {
                PackageName = Path.GetFileNameWithoutExtension(fileName),
                LaunchUrl = launchFile,
                BaseUrl = manifestDirectory,
                ManifestPath = manifestPath,
                TotalSize = totalSize,
                FileCount = files.Length
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process SCORM package");
            throw;
        }
        finally
        {
            // Note: Don't delete temp directory here as it's needed for upload
            // It will be cleaned up after upload
        }
    }

    public string? FindManifestFile(string directory)
    {
        var manifestFiles = Directory.GetFiles(directory, "imsmanifest.xml", SearchOption.AllDirectories);
        return manifestFiles.FirstOrDefault();
    }

    public string? ParseScormManifest(string manifestPath)
    {
        try
        {
            var doc = XDocument.Load(manifestPath);
            var ns = doc.Root?.Name.Namespace ?? XNamespace.None;

            // Try SCORM 2004 format first
            var resource = doc.Descendants(ns + "resource")
                .FirstOrDefault(r => r.Attribute("type")?.Value == "webcontent");

            if (resource != null)
            {
                var href = resource.Attribute("href")?.Value;
                if (!string.IsNullOrEmpty(href))
                {
                    _logger.LogInformation("Found SCORM 2004 launch file: {Href}", href);
                    return href;
                }
            }

            // Try SCORM 1.2 format
            resource = doc.Descendants(ns + "resource")
                .FirstOrDefault(r => r.Attribute(XNamespace.None + "href") != null);

            if (resource != null)
            {
                var href = resource.Attribute(XNamespace.None + "href")?.Value;
                if (!string.IsNullOrEmpty(href))
                {
                    _logger.LogInformation("Found SCORM 1.2 launch file: {Href}", href);
                    return href;
                }
            }

            // Fallback: look for any resource with href
            var anyResource = doc.Descendants(ns + "resource")
                .Select(r => r.Attribute("href")?.Value ?? r.Attribute(XNamespace.None + "href")?.Value)
                .FirstOrDefault(h => !string.IsNullOrEmpty(h));

            if (anyResource != null)
            {
                _logger.LogInformation("Found fallback launch file: {Href}", anyResource);
                return anyResource;
            }

            _logger.LogWarning("Could not find launch file in manifest");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse SCORM manifest");
            return null;
        }
    }
}
