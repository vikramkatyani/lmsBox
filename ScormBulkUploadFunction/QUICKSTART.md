# SCORM Bulk Upload - Quick Start Guide

## Prerequisites

1. Google Sheet with SCORM package details
2. SCORM `.zip` files uploaded to Google Drive
3. Google Cloud service account with API access
4. Azure Function App deployed

## Step-by-Step Setup

### 1. Prepare Google Sheet

Create a sheet with these columns (A-F are input, G-H are output):

| Column | Name | Required | Example |
|--------|------|----------|---------|
| A | Title | Yes | Ladder Safety Training |
| B | Description | No | Training on safe ladder usage |
| C | Category | No | Workplace Safety |
| D | Tags | No | ladder, fall prevention, PPE |
| E | Thumbnail URL | No | https://example.com/thumb.jpg |
| F | Content File URL | Yes | https://drive.google.com/file/d/... |
| G | Status | Auto | Success/Failed/Processing |
| H | Error Message | Auto | (error details if failed) |

### 2. Upload SCORM Files to Google Drive

1. Create a folder in Google Drive: "SCORM Packages"
2. Upload all `.zip` files to this folder
3. For each file:
   - Right-click → Get link
   - Change to "Anyone with the link can view"
   - Copy the link
   - Paste in column F of your sheet

### 3. Create Google Service Account

```bash
# Install gcloud CLI if not installed
# https://cloud.google.com/sdk/docs/install

# Login
gcloud auth login

# Create project (or use existing)
gcloud projects create lmsbox-bulk-upload

# Set project
gcloud config set project lmsbox-bulk-upload

# Enable APIs
gcloud services enable sheets.googleapis.com
gcloud services enable drive.googleapis.com

# Create service account
gcloud iam service-accounts create lmsbox-scorm-uploader \
    --display-name="LMS Box SCORM Uploader"

# Create key
gcloud iam service-accounts keys create service-account-key.json \
    --iam-account=lmsbox-scorm-uploader@lmsbox-bulk-upload.iam.gserviceaccount.com
```

### 4. Share Resources

**Google Sheet**:
```
1. Open your sheet
2. Click "Share"
3. Add: lmsbox-scorm-uploader@lmsbox-bulk-upload.iam.gserviceaccount.com
4. Role: Editor
5. Uncheck "Notify people"
6. Click "Share"
```

**Google Drive Folder**:
```
1. Open "SCORM Packages" folder
2. Click "Share"
3. Add: lmsbox-scorm-uploader@lmsbox-bulk-upload.iam.gserviceaccount.com
4. Role: Viewer
5. Click "Share"
```

### 5. Get Google Sheet ID

From sheet URL:
```
https://docs.google.com/spreadsheets/d/1AbC123XyZ-456def/edit
                                        ^^^^^^^^^^^^^^^^
                                        This is your Sheet ID
```

### 6. Configure Azure Function

Edit `local.settings.json`:

```json
{
  "Values": {
    "SqlConnectionString": "Server=YOUR_SERVER;Database=LmsBoxDB;...",
    "AzureStorageConnectionString": "DefaultEndpointsProtocol=https;AccountName=YOUR_ACCOUNT;AccountKey=YOUR_KEY;",
    "AzureStorageContainerName": "lmscontent",
    "GoogleServiceAccountJson": "<paste content of service-account-key.json>",
    "GoogleSpreadsheetId": "1AbC123XyZ-456def",
    "SuperAdminEmail": "superadmin@lmsbox.system",
    "BulkUploadAuthKey": "GENERATE-RANDOM-KEY-HERE"
  }
}
```

### 7. Deploy Function

```powershell
# Navigate to function directory
cd d:\LMSBOX\lmsBox\ScormBulkUploadFunction

# Restore packages
dotnet restore

# Build
dotnet build

# Test locally
func start

# Deploy to Azure
func azure functionapp publish YOUR-FUNCTION-APP-NAME
```

### 8. Test with Single Row

```powershell
$headers = @{
    "X-Auth-Key" = "YOUR-AUTH-KEY"
    "Content-Type" = "application/json"
}

$body = @{
    spreadsheetId = "1AbC123XyZ-456def"
    sheetName = "Sheet1"
    startRow = 2
    endRow = 2  # Test with just first data row
    updateSheetStatus = $true
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "https://YOUR-FUNCTION-APP.azurewebsites.net/api/bulk-upload/scorm" `
    -Method Post `
    -Headers $headers `
    -Body $body
```

### 9. Run Full Bulk Upload

```powershell
# Process all rows
$body = @{
    spreadsheetId = "1AbC123XyZ-456def"
    sheetName = "Sheet1"
    updateSheetStatus = $true
} | ConvertTo-Json

$response = Invoke-RestMethod `
    -Uri "https://YOUR-FUNCTION-APP.azurewebsites.net/api/bulk-upload/scorm" `
    -Method Post `
    -Headers $headers `
    -Body $body

# View results
$response | ConvertTo-Json -Depth 10
```

## Verification

### Check Azure Blob Storage

```powershell
# Using Azure Storage Explorer or Azure Portal
# Navigate to: lmscontent/global-library/scorm/
# You should see folders like:
#   ladder-safety/
#   fire-safety-at-workplace/
#   etc.
```

### Check Database

```sql
-- View uploaded content
SELECT 
    Id,
    Title,
    Category,
    FileSizeBytes / 1024.0 / 1024.0 AS SizeMB,
    UploadedOn,
    AzureBlobPath
FROM GlobalLibraryContents
WHERE ContentType = 'scorm'
ORDER BY UploadedOn DESC;
```

### Check Google Sheet

- Column G (Status) should show "Success" or "Failed"
- Column H (Error Message) will show details if failed
- Failed rows can be fixed and re-run using startRow/endRow

## Common Issues

**Issue**: "The caller does not have permission"  
**Fix**: Add service account email to sheet/folder with proper permissions

**Issue**: "Invalid SCORM package: imsmanifest.xml not found"  
**Fix**: Verify `.zip` file structure - manifest must be at root or in subdirectory

**Issue**: "Could not extract file ID from URL"  
**Fix**: Ensure Google Drive URL is in correct format, use shareable link

**Issue**: Function timeout  
**Fix**: Increase timeout in `host.json` or use Premium plan

## Best Practices

1. **Test First**: Always test with 1-2 rows before full batch
2. **Batch Processing**: Process in chunks of 10-20 for large sets
3. **Monitor Progress**: Watch Google Sheet status column for real-time updates
4. **Error Handling**: Failed rows can be retried independently
5. **Cleanup**: Failed attempts leave no orphaned data

## Next Steps

After successful upload:
1. Login as SuperAdmin
2. Navigate to Global Library
3. Verify packages appear with correct metadata
4. Test SCORM player with sample package
5. Make packages available to organizations

---

Need help? Check the full README.md for detailed troubleshooting.
