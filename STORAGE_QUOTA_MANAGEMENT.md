# Storage Quota Management

## Overview

The LMS Box platform now includes comprehensive storage quota tracking and enforcement for multi-tenant organizations. This ensures each organization stays within their allocated storage limits and prevents unexpected overages.

## Features

### 1. Storage Tracking
- **Real-time tracking**: Automatically tracks storage usage on every file upload
- **Separate tracking**: Monitors two distinct storage areas:
  - **Branding Storage** (`lms-content-brandui` container): Course banners, favicons, branding assets
  - **Content Storage** (`lms-content` container): Course content, lessons, SCORM packages, HTML files, documents

### 2. Quota Enforcement
- **Pre-upload validation**: Checks available quota before allowing file uploads
- **User-friendly error messages**: Provides clear feedback when quota is exceeded
- **Automatic rejection**: Prevents uploads that would exceed allocated storage

### 3. Storage Monitoring
- **Usage dashboard**: Real-time storage usage widget for organization admins
- **Visual indicators**: Color-coded progress bars (green → yellow → red)
- **Detailed breakdown**: Shows usage by storage type (content vs branding)
- **Alerts**: Warning messages when approaching or exceeding quota limits

## Database Schema

### Organisation Table (New Fields)

```csharp
public long AllocatedStorageGB { get; set; } = 10;  // Total allocated storage (GB)
public long StorageUsedBytes { get; set; } = 0;     // Total used storage (bytes)
public long BrandingStorageUsedBytes { get; set; } = 0;  // Branding storage (bytes)
public long ContentStorageUsedBytes { get; set; } = 0;   // Content storage (bytes)
public DateTime? StorageLastCalculated { get; set; }     // Last calculation timestamp
```

**Migration**: `20251207103557_AddStorageTrackingFields`

## Backend Architecture

### Services

#### IStorageQuotaService
```csharp
// Check if organization has enough quota
Task<(bool HasQuota, string Message, long AvailableBytes)> CheckQuotaAsync(
    long organisationId, 
    long fileSizeBytes, 
    string storageType = "content"
);

// Track upload (increments usage)
Task TrackUploadAsync(long organisationId, long fileSizeBytes, string storageType);

// Track deletion (decrements usage)
Task TrackDeletionAsync(long organisationId, long fileSizeBytes, string storageType);

// Get current usage stats
Task<StorageUsageInfo> GetStorageUsageAsync(long organisationId);
```

### Updated Blob Upload Methods

All Azure Blob Service upload methods now accept optional `organisationId` parameter:

```csharp
// Branding uploads (course banners, logos, etc.)
Task<string> UploadToBrandingContainerAsync(
    Stream fileStream, 
    string fileName, 
    string folderPath, 
    string contentType, 
    long? organisationId = null
);

// Content uploads (lessons, documents, etc.)
Task<string> UploadToCustomPathAsync(
    Stream fileStream, 
    string fileName, 
    string folderPath, 
    string contentType, 
    string? subFolder = null, 
    long? organisationId = null
);
```

### Upload Flow

1. **Pre-upload quota check**:
   ```csharp
   var (hasQuota, message, _) = await _storageQuotaService.CheckQuotaAsync(
       organisationId, fileSize, "branding"
   );
   if (!hasQuota) throw new InvalidOperationException(message);
   ```

2. **Upload to Azure**:
   ```csharp
   await blobClient.UploadAsync(fileStream, ...);
   ```

3. **Post-upload tracking**:
   ```csharp
   await _storageQuotaService.TrackUploadAsync(organisationId, fileSize, "branding");
   ```

### API Endpoints

#### Get Storage Usage
```http
GET /api/admin/courses/storage-usage
Authorization: Bearer <token>
```

**Response**:
```json
{
  "allocatedBytes": 10737418240,
  "usedBytes": 2147483648,
  "brandingUsedBytes": 52428800,
  "contentUsedBytes": 2095054848,
  "availableBytes": 8589934592,
  "usagePercentage": 20.0,
  "allocatedFormatted": "10.00 GB",
  "usedFormatted": "2.00 GB",
  "availableFormatted": "8.00 GB"
}
```

## Frontend Integration

### Storage Service
```javascript
import { storageService } from '../services/storage';

const storageInfo = await storageService.getStorageUsage();
```

### Storage Usage Widget
```jsx
import StorageUsageWidget from '../components/StorageUsageWidget';

// In admin dashboard or settings page
<StorageUsageWidget />
```

**Features**:
- Real-time progress bar
- Color-coded status (green/yellow/red)
- Breakdown by storage type
- Warning alerts at 80% and 95% usage

## Error Handling

### Upload Quota Exceeded
When an upload would exceed quota, users receive a clear error message:

```
Storage quota exceeded. Used: 9.8 GB / 10 GB. 
Required: 0.5 GB, Available: 0.2 GB. 
Please contact support to increase your quota.
```

### Controller Error Handling
```csharp
try {
    imageUrl = await _blobService.UploadToBrandingContainerAsync(..., organisationId);
}
catch (InvalidOperationException ex) when (ex.Message.Contains("Storage quota exceeded")) {
    return BadRequest(new { message = ex.Message });
}
```

## Default Quotas

- **Default Allocation**: 10 GB per organization
- **SuperAdmin**: No quota enforcement (can manage across all organizations)
- **Quota Modification**: SuperAdmin can update `AllocatedStorageGB` in Organisation management

## Storage Calculation

### Formula
```
Total Used = Branding Storage + Content Storage
Available = (Allocated GB * 1024³) - Total Used
Usage % = (Total Used / Total Allocated) * 100
```

### Tracking Points
- ✅ Course banner uploads → Branding
- ✅ Favicon uploads → Branding
- ✅ HTML lesson content → Content
- ✅ Video uploads → Content
- ✅ Document uploads → Content
- ✅ SCORM package uploads → Content
- ⚠️ File deletions → Not yet implemented (manual recalculation available)

## SuperAdmin Features

SuperAdmin can:
1. View all organizations' storage usage
2. Adjust allocated storage quotas
3. Monitor storage trends across platform
4. Identify organizations nearing limits

## Future Enhancements

### Planned Features
- [ ] Storage deletion tracking (automatic quota recovery on file delete)
- [ ] Scheduled recalculation job (verify tracked vs actual Azure blob sizes)
- [ ] Storage usage analytics and reporting
- [ ] Email notifications at 75%, 90%, 95% usage
- [ ] Storage upgrade request workflow
- [ ] Automatic archival of old content

### Recalculation Method
```csharp
// Manual recalculation (SuperAdmin only)
await _storageQuotaService.RecalculateStorageUsageAsync(organisationId);
```

This will scan Azure Blob Storage and update the database with actual usage (useful for one-time fixes or migrations).

## Testing

### Test Upload with Quota Check
```bash
# Upload should succeed when under quota
POST /api/admin/courses/upload-banner
Content-Type: multipart/form-data
{ image: [file] }

# Response: 200 OK with URL

# Upload should fail when over quota
POST /api/admin/courses/upload-banner
Content-Type: multipart/form-data
{ image: [large-file-exceeding-quota] }

# Response: 400 Bad Request
{
  "message": "Storage quota exceeded. Used: 9.8 GB / 10 GB..."
}
```

### Verify Storage Tracking
```sql
-- Check organization storage usage
SELECT Id, Name, AllocatedStorageGB, 
       StorageUsedBytes / (1024.0 * 1024 * 1024) as UsedGB,
       BrandingStorageUsedBytes / (1024.0 * 1024 * 1024) as BrandingGB,
       ContentStorageUsedBytes / (1024.0 * 1024 * 1024) as ContentGB
FROM Organisations;
```

## Troubleshooting

### Issue: Usage tracking is inaccurate
**Solution**: Run manual recalculation (SuperAdmin feature coming soon)

### Issue: Upload fails despite available quota
**Check**: 
1. Verify file size vs available bytes
2. Check for concurrent uploads
3. Confirm organisation ID is passed correctly

### Issue: Storage widget shows incorrect data
**Solution**: Refresh page or check API response directly at `/api/admin/courses/storage-usage`

## Related Files

### Backend
- `lmsbox.domain/Models/Organisation.cs` - Storage fields
- `lmsBox.Server/Services/IStorageQuotaService.cs` - Service interface
- `lmsBox.Server/Services/StorageQuotaService.cs` - Implementation
- `lmsBox.Server/Services/AzureBlobService.cs` - Updated with quota checks
- `lmsBox.Server/Controllers/AdminCoursesController.cs` - Storage usage endpoint

### Frontend
- `lmsbox.client/src/services/storage.js` - API service
- `lmsbox.client/src/components/StorageUsageWidget.jsx` - UI component

### Database
- `lmsbox.infrastructure/Migrations/20251207103557_AddStorageTrackingFields.cs`
