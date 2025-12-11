using Google.Apis.Auth.OAuth2;
using Google.Apis.Services;
using Google.Apis.Sheets.v4;
using Google.Apis.Sheets.v4.Data;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ScormBulkUploadFunction.Models;

namespace ScormBulkUploadFunction.Services;

public class GoogleSheetsService : IGoogleSheetsService
{
    private readonly ILogger<GoogleSheetsService> _logger;
    private readonly IConfiguration _configuration;
    private readonly SheetsService _sheetsService;

    public GoogleSheetsService(ILogger<GoogleSheetsService> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;

        // Initialize Google Sheets API
        var serviceAccountJson = configuration["GoogleServiceAccountJson"];
        GoogleCredential credential;

        if (!string.IsNullOrEmpty(serviceAccountJson))
        {
            credential = GoogleCredential.FromJson(serviceAccountJson)
                .CreateScoped(SheetsService.Scope.Spreadsheets);
        }
        else
        {
            throw new InvalidOperationException("Google Service Account JSON not configured");
        }

        _sheetsService = new SheetsService(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName = "LMS Box SCORM Bulk Upload"
        });
    }

    public async Task<List<ScormPackageRow>> ReadScormPackagesAsync(string spreadsheetId, string sheetName = "Sheet1")
    {
        try
        {
            // Read data from sheet (A2:F - skip header row)
            // Expected columns: Title | Description | Category | Tags | Thumbnail URL | Content File URL
            var range = $"{sheetName}!A2:F";
            var request = _sheetsService.Spreadsheets.Values.Get(spreadsheetId, range);
            var response = await request.ExecuteAsync();

            var packages = new List<ScormPackageRow>();
            
            if (response.Values == null || response.Values.Count == 0)
            {
                _logger.LogWarning("No data found in sheet");
                return packages;
            }

            for (int i = 0; i < response.Values.Count; i++)
            {
                var row = response.Values[i];
                
                // Skip empty rows
                if (row.Count == 0 || string.IsNullOrWhiteSpace(row[0]?.ToString()))
                    continue;

                var package = new ScormPackageRow
                {
                    RowNumber = i + 2, // +2 because we started from row 2
                    Title = row.Count > 0 ? row[0]?.ToString() ?? "" : "",
                    Description = row.Count > 1 ? row[1]?.ToString() ?? "" : "",
                    Category = row.Count > 2 ? row[2]?.ToString() ?? "" : "",
                    Tags = row.Count > 3 ? row[3]?.ToString() ?? "" : "",
                    ThumbnailUrl = row.Count > 4 ? row[4]?.ToString() ?? "" : "",
                    ContentFileUrl = row.Count > 5 ? row[5]?.ToString() ?? "" : ""
                };

                // Validate required fields
                if (string.IsNullOrWhiteSpace(package.Title))
                {
                    _logger.LogWarning("Row {RowNumber}: Missing title, skipping", package.RowNumber);
                    continue;
                }

                if (string.IsNullOrWhiteSpace(package.ContentFileUrl))
                {
                    _logger.LogWarning("Row {RowNumber}: Missing content URL, skipping", package.RowNumber);
                    continue;
                }

                packages.Add(package);
            }

            _logger.LogInformation("Read {Count} valid packages from sheet", packages.Count);
            return packages;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to read Google Sheet");
            throw;
        }
    }

    public async Task UpdateRowStatusAsync(string spreadsheetId, string sheetName, int rowNumber, string status, string? errorMessage = null)
    {
        try
        {
            // Update columns G (Status) and H (Error Message)
            var range = $"{sheetName}!G{rowNumber}:H{rowNumber}";
            var valueRange = new ValueRange
            {
                Values = new List<IList<object>>
                {
                    new List<object> { status, errorMessage ?? "" }
                }
            };

            var updateRequest = _sheetsService.Spreadsheets.Values.Update(valueRange, spreadsheetId, range);
            updateRequest.ValueInputOption = SpreadsheetsResource.ValuesResource.UpdateRequest.ValueInputOptionEnum.RAW;
            await updateRequest.ExecuteAsync();

            _logger.LogInformation("Updated row {RowNumber} status: {Status}", rowNumber, status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update row {RowNumber} status", rowNumber);
            // Don't throw - this is non-critical
        }
    }
}
