using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ScormBulkUploadFunction.Models;
using ScormBulkUploadFunction.Services;
using System.Net;
using System.Text.Json;

namespace ScormBulkUploadFunction.Functions;

public class BulkUploadFunction
{
    private readonly ILogger<BulkUploadFunction> _logger;
    private readonly IConfiguration _configuration;
    private readonly IGoogleSheetsService _sheetsService;
    private readonly IGoogleDriveService _driveService;
    private readonly IScormProcessingService _scormService;
    private readonly IAzureBlobStorageService _blobService;
    private readonly IDatabaseService _databaseService;

    public BulkUploadFunction(
        ILogger<BulkUploadFunction> logger,
        IConfiguration configuration,
        IGoogleSheetsService sheetsService,
        IGoogleDriveService driveService,
        IScormProcessingService scormService,
        IAzureBlobStorageService blobService,
        IDatabaseService databaseService)
    {
        _logger = logger;
        _configuration = configuration;
        _sheetsService = sheetsService;
        _driveService = driveService;
        _scormService = scormService;
        _blobService = blobService;
        _databaseService = databaseService;
    }

    [Function("BulkUploadScorm")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "bulk-upload/scorm")] HttpRequestData req)
    {
        _logger.LogInformation("SCORM bulk upload function triggered");

        try
        {
            // Validate authorization
            var authKey = req.Headers.FirstOrDefault(h => h.Key.Equals("X-Auth-Key", StringComparison.OrdinalIgnoreCase)).Value?.FirstOrDefault();
            var expectedAuthKey = _configuration["BulkUploadAuthKey"];

            _logger.LogInformation("Auth validation - Received: {ReceivedKey}, Expected: {ExpectedKey}", 
                authKey ?? "null", 
                expectedAuthKey ?? "null");

            if (string.IsNullOrEmpty(authKey) || authKey != expectedAuthKey)
            {
                _logger.LogWarning("Unauthorized bulk upload attempt");
                var unauthorizedResponse = req.CreateResponse(HttpStatusCode.Unauthorized);
                await unauthorizedResponse.WriteAsJsonAsync(new { error = "Unauthorized" });
                return unauthorizedResponse;
            }

            // Parse request body
            var requestBody = await req.ReadAsStringAsync();
            _logger.LogInformation("Request body: {RequestBody}", requestBody);
            
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };
            var uploadRequest = JsonSerializer.Deserialize<BulkUploadRequest>(requestBody ?? "{}", options);

            _logger.LogInformation("Deserialized request - SpreadsheetId: {SpreadsheetId}, SheetName: {SheetName}, StartRow: {StartRow}, EndRow: {EndRow}", 
                uploadRequest?.SpreadsheetId ?? "null",
                uploadRequest?.SheetName ?? "null",
                uploadRequest?.StartRow ?? 0,
                uploadRequest?.EndRow ?? 0);

            if (uploadRequest == null || string.IsNullOrWhiteSpace(uploadRequest.SpreadsheetId))
            {
                var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequestResponse.WriteAsJsonAsync(new { error = "SpreadsheetId is required" });
                return badRequestResponse;
            }

            var result = await ProcessBulkUpload(
                uploadRequest.SpreadsheetId,
                uploadRequest.SheetName ?? "Sheet1",
                uploadRequest.StartRow,
                uploadRequest.EndRow,
                uploadRequest.UpdateSheetStatus);

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteAsJsonAsync(result);
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing bulk upload");
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteAsJsonAsync(new { error = ex.Message });
            return errorResponse;
        }
    }

    private async Task<BulkUploadResult> ProcessBulkUpload(
        string spreadsheetId,
        string sheetName,
        int? startRow,
        int? endRow,
        bool updateSheetStatus)
    {
        var result = new BulkUploadResult
        {
            StartTime = DateTime.UtcNow,
            Results = new List<UploadResultDetail>()
        };

        try
        {
            // Read packages from Google Sheet
            _logger.LogInformation("Reading packages from sheet: {SheetName}", sheetName);
            var packages = await _sheetsService.ReadScormPackagesAsync(spreadsheetId, sheetName);

            // Filter by row range if specified
            if (startRow.HasValue)
                packages = packages.Where(p => p.RowNumber >= startRow.Value).ToList();
            if (endRow.HasValue)
                packages = packages.Where(p => p.RowNumber <= endRow.Value).ToList();

            result.TotalRows = packages.Count;
            _logger.LogInformation("Processing {Count} packages", result.TotalRows);

            var superAdminEmail = _configuration["SuperAdminEmail"] ?? "superadmin@lmsbox.system";

            // Process each package
            foreach (var package in packages)
            {
                var detail = new UploadResultDetail
                {
                    RowNumber = package.RowNumber,
                    Title = package.Title,
                    Status = "Processing"
                };

                try
                {
                    _logger.LogInformation("Processing row {Row}: {Title}", package.RowNumber, package.Title);

                    // Update sheet status: Processing
                    if (updateSheetStatus)
                    {
                        await _sheetsService.UpdateRowStatusAsync(
                            spreadsheetId, sheetName, package.RowNumber, "Processing", null);
                    }

                    // Download SCORM package from Google Drive
                    _logger.LogInformation("Downloading SCORM package from: {Url}", package.ContentFileUrl);
                    using var zipStream = await _driveService.DownloadFileAsync(package.ContentFileUrl);

                    // Process SCORM package (extract and validate)
                    var fileName = $"{package.Title}.zip";
                    var scormInfo = await _scormService.ProcessScormPackageAsync(zipStream, fileName);

                    // Upload to Azure Blob Storage
                    var manifestDirectory = Path.GetDirectoryName(scormInfo.ManifestPath)!;
                    var uploadedScorm = await _blobService.UploadScormToGlobalLibraryAsync(
                        manifestDirectory,
                        package.Code,
                        scormInfo.LaunchUrl);

                    // Upload thumbnail if provided
                    string? thumbnailUrl = null;
                    if (!string.IsNullOrWhiteSpace(package.ThumbnailUrl))
                    {
                        thumbnailUrl = await _blobService.UploadThumbnailAsync(package.ThumbnailUrl);
                    }

                    // Save to database
                    var content = new GlobalLibraryContent
                    {
                        Title = package.Title,
                        Description = package.Description,
                        Code = package.Code,
                        ContentType = "scorm",
                        AzureBlobPath = uploadedScorm.LaunchUrl,
                        FileName = uploadedScorm.PackageName,
                        FileSizeBytes = uploadedScorm.TotalSize,
                        MimeType = "application/zip",
                        Category = package.Category,
                        Tags = package.Tags,
                        ThumbnailUrl = thumbnailUrl,
                        UploadedOn = DateTime.UtcNow,
                        UploadedBy = superAdminEmail,
                        IsActive = true
                    };

                    var contentId = await _databaseService.SaveGlobalLibraryContentAsync(content);

                    // Clean up temp directory
                    if (Directory.Exists(manifestDirectory))
                    {
                        Directory.Delete(Path.GetDirectoryName(manifestDirectory)!, true);
                    }

                    detail.Status = "Success";
                    detail.ContentId = contentId;
                    detail.LaunchUrl = uploadedScorm.LaunchUrl;
                    detail.FileSizeBytes = uploadedScorm.TotalSize;
                    detail.FileCount = uploadedScorm.FileCount;

                    result.SuccessCount++;

                    _logger.LogInformation("Successfully uploaded row {Row}: {Title}, ID={Id}", 
                        package.RowNumber, package.Title, contentId);

                    // Update sheet status: Success
                    if (updateSheetStatus)
                    {
                        await _sheetsService.UpdateRowStatusAsync(
                            spreadsheetId, sheetName, package.RowNumber, "Success", 
                            $"ID: {contentId}, Files: {uploadedScorm.FileCount}");
                    }
                }
                catch (Exception ex)
                {
                    detail.Status = "Failed";
                    detail.ErrorMessage = ex.Message;
                    result.FailureCount++;

                    _logger.LogError(ex, "Failed to process row {Row}: {Title}", package.RowNumber, package.Title);

                    // Update sheet status: Failed
                    if (updateSheetStatus)
                    {
                        await _sheetsService.UpdateRowStatusAsync(
                            spreadsheetId, sheetName, package.RowNumber, "Failed", ex.Message);
                    }
                }

                result.Results.Add(detail);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Fatal error during bulk upload");
            throw;
        }
        finally
        {
            result.EndTime = DateTime.UtcNow;
        }

        _logger.LogInformation(
            "Bulk upload completed: {Success} succeeded, {Failed} failed, Duration: {Duration}",
            result.SuccessCount, result.FailureCount, result.Duration);

        return result;
    }
}

public class BulkUploadRequest
{
    public string SpreadsheetId { get; set; } = string.Empty;
    public string SheetName { get; set; } = "Sheet1";
    public int? StartRow { get; set; }
    public int? EndRow { get; set; }
    public bool UpdateSheetStatus { get; set; } = true;
}
