using Google.Apis.Auth.OAuth2;
using Google.Apis.Drive.v3;
using Google.Apis.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;

namespace ScormBulkUploadFunction.Services;

public class GoogleDriveService : IGoogleDriveService
{
    private readonly ILogger<GoogleDriveService> _logger;
    private readonly IConfiguration _configuration;
    private readonly DriveService _driveService;
    private readonly HttpClient _httpClient;

    public GoogleDriveService(
        ILogger<GoogleDriveService> logger, 
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory)
    {
        _logger = logger;
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();

        // Initialize Google Drive API
        var serviceAccountJson = configuration["GoogleServiceAccountJson"];
        GoogleCredential credential;

        if (!string.IsNullOrEmpty(serviceAccountJson))
        {
            credential = GoogleCredential.FromJson(serviceAccountJson)
                .CreateScoped(DriveService.Scope.DriveReadonly);
        }
        else
        {
            throw new InvalidOperationException("Google Service Account JSON not configured");
        }

        _driveService = new DriveService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = "LMS Box SCORM Bulk Upload"
        });
    }

    public string? ExtractFileIdFromUrl(string url)
    {
        // Support various Google Drive URL formats:
        // https://drive.google.com/file/d/FILE_ID/view
        // https://drive.google.com/open?id=FILE_ID
        // https://drive.google.com/uc?id=FILE_ID&export=download
        
        var patterns = new[]
        {
            @"\/file\/d\/([a-zA-Z0-9_-]+)",
            @"[?&]id=([a-zA-Z0-9_-]+)",
            @"\/d\/([a-zA-Z0-9_-]+)"
        };

        foreach (var pattern in patterns)
        {
            var match = Regex.Match(url, pattern);
            if (match.Success && match.Groups.Count > 1)
            {
                return match.Groups[1].Value;
            }
        }

        _logger.LogWarning("Could not extract file ID from URL: {Url}", url);
        return null;
    }

    public async Task<Stream> DownloadFileAsync(string fileUrl)
    {
        try
        {
            var fileId = ExtractFileIdFromUrl(fileUrl);
            if (string.IsNullOrEmpty(fileId))
            {
                throw new InvalidOperationException($"Invalid Google Drive URL: {fileUrl}");
            }

            _logger.LogInformation("Downloading file {FileId} from Google Drive", fileId);

            // Try to get file using Drive API first
            try
            {
                var request = _driveService.Files.Get(fileId);
                var memoryStream = new MemoryStream();
                
                await request.DownloadAsync(memoryStream);
                memoryStream.Position = 0;
                
                _logger.LogInformation("Successfully downloaded file {FileId}, size: {Size} bytes", 
                    fileId, memoryStream.Length);
                
                return memoryStream;
            }
            catch (Exception apiEx)
            {
                _logger.LogWarning(apiEx, "Drive API download failed, trying direct download");
                
                // Fallback to direct download URL
                var downloadUrl = $"https://drive.google.com/uc?id={fileId}&export=download";
                var response = await _httpClient.GetAsync(downloadUrl);
                response.EnsureSuccessStatusCode();
                
                var stream = await response.Content.ReadAsStreamAsync();
                var memoryStream = new MemoryStream();
                await stream.CopyToAsync(memoryStream);
                memoryStream.Position = 0;
                
                _logger.LogInformation("Successfully downloaded file via direct URL, size: {Size} bytes", 
                    memoryStream.Length);
                
                return memoryStream;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to download file from Google Drive: {Url}", fileUrl);
            throw;
        }
    }
}
