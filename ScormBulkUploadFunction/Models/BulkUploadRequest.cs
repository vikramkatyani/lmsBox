using System.Text.Json.Serialization;

namespace ScormBulkUploadFunction.Models;

public class BulkUploadRequest
{
    [JsonPropertyName("spreadsheetId")]
    public string SpreadsheetId { get; set; } = string.Empty;
    
    [JsonPropertyName("sheetName")]
    public string? SheetName { get; set; }
    
    [JsonPropertyName("startRow")]
    public int StartRow { get; set; }
    
    [JsonPropertyName("endRow")]
    public int EndRow { get; set; }
    
    [JsonPropertyName("updateSheetStatus")]
    public bool UpdateSheetStatus { get; set; } = true;
}
