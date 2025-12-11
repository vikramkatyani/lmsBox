# SCORM Bulk Upload Azure Function

## Overview

This Azure Function enables bulk uploading of SCORM packages to the Global Library by reading package details from a Google Sheet and downloading files from Google Drive.

## Features

- ✅ Reads SCORM package details from Google Sheets
- ✅ Downloads SCORM `.zip` files from Google Drive
- ✅ Validates and extracts SCORM packages
- ✅ Uploads to Azure Blob Storage (`global-library/scorm/`)
- ✅ Saves records to SQL Server database
- ✅ Updates Google Sheet with upload status
- ✅ Downloads and uploads thumbnails
- ✅ Processes packages in sequence with detailed logging
- ✅ Authorization via API key

## Google Sheet Format

The function expects a Google Sheet with the following columns:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| **Title** | **Description** | **Category** | **Tags** | **Thumbnail URL** | **Content File URL** | **Status** | **Error Message** |
| Ladder Safety | Training on safe ladder... | Workplace Safety | ladder, fall prevention | https://... | https://drive.google.com/file/d/... | Success | |
| Fire Safety | Covers fire prevention... | Emergency Preparedness | fire safety, evacuation | https://... | https://drive.google.com/file/d/... | Processing | |

### Column Definitions

- **A (Title)**: Required. Title of the SCORM package
- **B (Description)**: Optional. Description text
- **C (Category)**: Optional. Category for filtering (e.g., "Workplace Safety")
- **D (Tags)**: Optional. Comma-separated tags
- **E (Thumbnail URL)**: Optional. URL to thumbnail image (can be Google Drive or direct URL)
- **F (Content File URL)**: Required. Google Drive URL to SCORM `.zip` file
- **G (Status)**: Auto-updated by function (Processing/Success/Failed)
- **H (Error Message)**: Auto-updated on failure

### Google Drive URL Formats Supported

```
https://drive.google.com/file/d/FILE_ID/view
https://drive.google.com/open?id=FILE_ID
https://drive.google.com/uc?id=FILE_ID&export=download
```

## Setup Instructions

### 1. Google Cloud Configuration

#### Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable APIs:
   - Google Sheets API
   - Google Drive API
4. Create Service Account:
   - IAM & Admin → Service Accounts → Create Service Account
   - Name: `lmsbox-bulk-upload`
   - Role: None needed (will grant per-resource access)
5. Create Key:
   - Actions → Manage Keys → Add Key → Create new key
   - Type: JSON
   - Save the downloaded JSON file

#### Share Resources with Service Account

1. **Google Sheet**:
   - Open your Google Sheet
   - Click Share → Add the service account email
   - Grant "Editor" access

2. **Google Drive Folder**:
   - Create a folder containing all SCORM `.zip` files
   - Share folder with service account email
   - Grant "Viewer" or "Editor" access

### 2. Azure Function Configuration

#### Local Development (`local.settings.json`)

```json
{
  "Values": {
    "SqlConnectionString": "Server=localhost;Database=LmsBoxDB;Trusted_Connection=True;",
    "AzureStorageConnectionString": "DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;",
    "AzureStorageContainerName": "lmscontent",
    
    "GoogleServiceAccountJson": "{\"type\":\"service_account\",\"project_id\":\"...\",\"private_key_id\":\"...\",\"private_key\":\"...\",\"client_email\":\"...\",\"client_id\":\"...\"}",
    "GoogleSpreadsheetId": "1AbC...XyZ",
    
    "SuperAdminEmail": "superadmin@lmsbox.system",
    "BulkUploadAuthKey": "your-secret-key-here-change-in-production"
  }
}
```

#### Azure Portal Configuration

1. Create Function App:
   - Runtime: .NET 9 (Isolated)
   - OS: Windows or Linux
   - Plan: Consumption or Premium (Premium recommended for large files)

2. Add Application Settings:
   ```
   SqlConnectionString = <your-connection-string>
   AzureStorageConnectionString = <your-storage-connection>
   AzureStorageContainerName = lmscontent
   GoogleServiceAccountJson = <paste-json-content>
   GoogleSpreadsheetId = <your-sheet-id>
   SuperAdminEmail = superadmin@lmsbox.system
   BulkUploadAuthKey = <generate-strong-key>
   ```

3. Increase Timeout (if needed):
   - Configuration → Function runtime settings
   - Function timeout: 00:30:00 (30 minutes)

### 3. Build and Deploy

#### Local Development

```powershell
cd ScormBulkUploadFunction
dotnet restore
dotnet build
func start
```

#### Deploy to Azure

```powershell
# Using Azure Functions Core Tools
func azure functionapp publish <your-function-app-name>

# Or using Visual Studio
# Right-click project → Publish → Select target
```

## Usage

### HTTP Trigger

**Endpoint**: `POST /api/bulk-upload/scorm`

**Headers**:
```
X-Auth-Key: your-secret-key-here
Content-Type: application/json
```

**Request Body**:
```json
{
  "spreadsheetId": "1AbC123...XyZ",
  "sheetName": "Sheet1",
  "startRow": 2,
  "endRow": 10,
  "updateSheetStatus": true
}
```

**Parameters**:
- `spreadsheetId` (required): Google Sheets ID from URL
- `sheetName` (optional): Sheet tab name (default: "Sheet1")
- `startRow` (optional): Start processing from this row number
- `endRow` (optional): Stop processing at this row number
- `updateSheetStatus` (optional): Update Status column (default: true)

**Response**:
```json
{
  "totalRows": 5,
  "successCount": 4,
  "failureCount": 1,
  "skippedCount": 0,
  "startTime": "2025-12-11T10:00:00Z",
  "endTime": "2025-12-11T10:15:30Z",
  "duration": "00:15:30",
  "results": [
    {
      "rowNumber": 2,
      "title": "Ladder Safety",
      "status": "Success",
      "contentId": 123,
      "launchUrl": "https://...global-library/scorm/ladder-safety/index.html",
      "fileSizeBytes": 5242880,
      "fileCount": 42
    },
    {
      "rowNumber": 3,
      "title": "Fire Safety",
      "status": "Failed",
      "errorMessage": "Invalid SCORM package: imsmanifest.xml not found"
    }
  ]
}
```

### Using PowerShell

```powershell
$headers = @{
    "X-Auth-Key" = "your-secret-key-here"
    "Content-Type" = "application/json"
}

$body = @{
    spreadsheetId = "1AbC123...XyZ"
    sheetName = "Sheet1"
    startRow = 2
    endRow = 10
    updateSheetStatus = $true
} | ConvertTo-Json

$response = Invoke-RestMethod `
    -Uri "https://<your-function-app>.azurewebsites.net/api/bulk-upload/scorm" `
    -Method Post `
    -Headers $headers `
    -Body $body

$response | ConvertTo-Json -Depth 10
```

### Using cURL

```bash
curl -X POST \
  https://<your-function-app>.azurewebsites.net/api/bulk-upload/scorm \
  -H "X-Auth-Key: your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "spreadsheetId": "1AbC123...XyZ",
    "sheetName": "Sheet1",
    "updateSheetStatus": true
  }'
```

## Workflow

1. **Read Sheet**: Function reads package details from Google Sheet
2. **Download**: For each row, downloads SCORM `.zip` from Google Drive
3. **Extract**: Extracts and validates `imsmanifest.xml`
4. **Process**: Parses manifest to get launch file
5. **Upload**: Uploads all files to Azure Blob Storage (`global-library/scorm/<package-name>/`)
6. **Thumbnail**: Downloads and uploads thumbnail (if provided)
7. **Database**: Saves record to `GlobalLibraryContents` table
8. **Update**: Updates Google Sheet status column
9. **Cleanup**: Removes temporary files
10. **Repeat**: Continues to next row

## Error Handling

### Common Errors

**Invalid SCORM package**:
- Missing `imsmanifest.xml`
- Corrupt `.zip` file
- Invalid manifest structure

**Google Drive access denied**:
- File not shared with service account
- File ID incorrect
- File deleted

**Azure Storage failure**:
- Connection string invalid
- Container doesn't exist
- Quota exceeded

**Database error**:
- Connection string invalid
- Table doesn't exist
- Duplicate title (if unique constraint)

### Retry Strategy

The function processes packages sequentially. If a package fails:
- Error is logged
- Google Sheet is updated with error message
- Function continues to next package
- Failed packages can be retried by running function again with `startRow`/`endRow`

## Monitoring

### Application Insights

- View logs in Azure Portal → Function App → Application Insights
- Query logs using Kusto Query Language (KQL):

```kusto
traces
| where message contains "bulk upload"
| order by timestamp desc
| take 100
```

### Google Sheet Status

The function updates columns G (Status) and H (Error Message) in real-time:
- **Processing**: Currently being processed
- **Success**: Uploaded successfully (includes ID and file count)
- **Failed**: Error occurred (includes error message)

## Performance

### Timing Estimates

- **Small SCORM** (< 5 MB): ~30-60 seconds per package
- **Medium SCORM** (5-50 MB): ~1-3 minutes per package
- **Large SCORM** (50-200 MB): ~3-10 minutes per package

### Batch Processing

For large batches:
1. Run in chunks using `startRow`/`endRow`
2. Use Premium plan for better performance
3. Increase function timeout if needed
4. Monitor Azure Storage throttling

## Security

- ✅ API key authorization required
- ✅ Service account has minimal permissions
- ✅ No credentials stored in code
- ✅ All secrets in configuration
- ✅ HTTPS only
- ✅ Temporary files cleaned up

## Troubleshooting

### Function not starting

```powershell
# Check logs
func azure functionapp logstream <function-app-name>

# Verify configuration
az functionapp config appsettings list --name <function-app-name> --resource-group <resource-group>
```

### Google Sheets access denied

```
Error: The caller does not have permission
```
**Solution**: Ensure service account email is added to sheet with Editor access

### SCORM validation fails

```
Error: Invalid SCORM package: imsmanifest.xml not found
```
**Solution**: Verify `.zip` contains `imsmanifest.xml` at root or in subdirectory

### Azure Storage quota exceeded

```
Error: Storage quota exceeded
```
**Solution**: Check storage quota settings in database, contact SuperAdmin

## Maintenance

### Update Service Account Key

1. Generate new key in Google Cloud Console
2. Update `GoogleServiceAccountJson` in Function App settings
3. Delete old key from Google Cloud Console

### Monitor Storage Usage

```sql
-- Check global library size
SELECT 
    ContentType,
    COUNT(*) as Count,
    SUM(FileSizeBytes) / 1024.0 / 1024.0 / 1024.0 as TotalGB
FROM GlobalLibraryContents
WHERE ContentType = 'scorm'
GROUP BY ContentType;
```

## Support

For issues or questions:
1. Check Application Insights logs
2. Verify Google Sheet format matches expected structure
3. Test with single row using `startRow` and `endRow`
4. Check service account permissions

---

**Version**: 1.0.0  
**Last Updated**: December 2025  
**Author**: LMS Box Team
