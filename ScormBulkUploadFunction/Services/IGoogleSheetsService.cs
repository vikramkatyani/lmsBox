using ScormBulkUploadFunction.Models;

namespace ScormBulkUploadFunction.Services;

public interface IGoogleSheetsService
{
    Task<List<ScormPackageRow>> ReadScormPackagesAsync(string spreadsheetId, string sheetName = "Sheet1");
    Task UpdateRowStatusAsync(string spreadsheetId, string sheetName, int rowNumber, string status, string? errorMessage = null);
}
