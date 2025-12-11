# Google Sheets Template for SCORM Bulk Upload

## Sheet Structure

### Required Columns (A-F)

| Column | Header | Type | Required | Description | Example |
|--------|--------|------|----------|-------------|---------|
| A | Title | Text | ✅ Yes | Package title (will be sanitized for folder name) | "Ladder Safety Training" |
| B | Description | Text | ❌ No | Detailed description of the content | "Comprehensive training on safe ladder selection, setup, inspection, and usage to prevent falls and injuries." |
| C | Category | Text | ❌ No | Category for filtering/grouping | "Workplace Safety" |
| D | Tags | Text | ❌ No | Comma-separated tags for search | "ladder, fall prevention, PPE, inspection, setup, maintenance" |
| E | Thumbnail URL | URL | ❌ No | Link to thumbnail image | "https://example.com/thumbnails/ladder-safety.jpg" |
| F | Content File URL | URL | ✅ Yes | Google Drive link to SCORM `.zip` | "https://drive.google.com/file/d/1ABC...XYZ/view" |

### Output Columns (G-H) - Auto-Updated by Function

| Column | Header | Description |
|--------|--------|-------------|
| G | Status | Current processing status: "Pending" / "Processing" / "Success" / "Failed" |
| H | Error Message | Error details if Status = "Failed", success details if Status = "Success" |

## Sample Data

```csv
Title,Description,Category,Tags,Thumbnail URL,Content File URL,Status,Error Message
Ladder Safety,Training on safe ladder selection and usage,Workplace Safety,"ladder, fall prevention, PPE",https://example.com/thumb1.jpg,https://drive.google.com/file/d/1ABC123/view,,
Fire Safety at Workplace,Covers fire prevention and emergency response,Emergency Preparedness,"fire safety, evacuation",https://example.com/thumb2.jpg,https://drive.google.com/file/d/2DEF456/view,,
Electrical Safety Awareness,Safe practices around electrical equipment,Technical Safety,"electrical hazards, PPE",https://example.com/thumb3.jpg,https://drive.google.com/file/d/3GHI789/view,,
DSE Awareness,Ergonomic workstation setup and posture,Ergonomics & Wellness,"DSE, ergonomics, posture",https://example.com/thumb4.jpg,https://drive.google.com/file/d/4JKL012/view,,
COSHH Awareness,Handling hazardous substances safely,Chemical Safety,"COSHH, hazardous substances",https://example.com/thumb5.jpg,https://drive.google.com/file/d/5MNO345/view,,
```

## Creating Your Sheet

### Option 1: Manual Creation

1. Create new Google Sheet
2. Add headers in row 1 (columns A-H)
3. Format header row:
   - Bold text
   - Background color (e.g., light blue)
   - Freeze row (View → Freeze → 1 row)
4. Enter your data starting from row 2
5. Apply data validation:
   - Column A (Title): Required, text
   - Column F (Content File URL): Required, valid URL

### Option 2: Import Template

Use this Google Sheets formula to create headers:

```
=ARRAYFORMULA({"Title","Description","Category","Tags","Thumbnail URL","Content File URL","Status","Error Message"})
```

### Option 3: Use Provided Template

Copy this template sheet:
```
https://docs.google.com/spreadsheets/d/TEMPLATE_ID/copy
```

## Preparing SCORM Files

### 1. Organize Files

```
Google Drive/
└── SCORM Packages/
    ├── ladder-safety.zip
    ├── fire-safety-workplace.zip
    ├── electrical-safety.zip
    ├── dse-awareness.zip
    └── coshh-awareness.zip
```

### 2. Get Shareable Links

For each file:
1. Right-click file → Share → Get link
2. Change to "Anyone with the link can view"
3. Copy link
4. Paste in column F

### 3. Verify SCORM Package Structure

Each `.zip` must contain:
```
package.zip
├── imsmanifest.xml (required)
├── index.html or index_lms.html (launch file)
├── css/
├── js/
├── images/
└── ... (other content files)
```

## Data Validation Rules

### Title (Column A)

- **Required**: Yes
- **Max Length**: 255 characters
- **Restrictions**: 
  - No special characters: `/ \ : * ? " < > |`
  - Will be sanitized to lowercase with hyphens
  - Example: "Ladder Safety Training" → "ladder-safety-training"

### Content File URL (Column F)

- **Required**: Yes
- **Format**: Must be valid Google Drive URL
- **Supported formats**:
  ```
  https://drive.google.com/file/d/FILE_ID/view
  https://drive.google.com/open?id=FILE_ID
  https://drive.google.com/uc?id=FILE_ID&export=download
  ```

### Tags (Column D)

- **Format**: Comma-separated values
- **Example**: `ladder, fall prevention, PPE, inspection`
- **Best Practice**: Use 3-10 tags per package

## Pre-Upload Checklist

- [ ] Google Sheet created with correct headers
- [ ] All required columns filled (Title, Content File URL)
- [ ] SCORM `.zip` files uploaded to Google Drive
- [ ] Each SCORM package contains `imsmanifest.xml`
- [ ] Google Drive folder shared with service account
- [ ] Google Sheet shared with service account (Editor access)
- [ ] Thumbnail images accessible (if using)
- [ ] Test with 1-2 rows before full batch

## Tips for Success

### 1. Naming Conventions

**Good titles**:
- ✅ "Ladder Safety Training"
- ✅ "Fire Safety at Workplace"
- ✅ "COSHH Awareness Course"

**Avoid**:
- ❌ "Training#1" (not descriptive)
- ❌ "Course/Safety" (contains slash)
- ❌ "New Package v2.0" (version in title)

### 2. Descriptions

**Good description**:
```
Comprehensive training on safe ladder selection, setup, inspection, 
and usage to prevent falls and injuries. Covers ladder types, 
weight ratings, inspection procedures, and proper climbing techniques.
Duration: 30 minutes. Includes quiz.
```

**Minimal description**:
```
Training on safe ladder usage
```

### 3. Categories

Use consistent categories across all packages:
- Workplace Safety
- Emergency Preparedness
- Technical Safety
- Ergonomics & Wellness
- Chemical Safety
- Compliance Training
- Soft Skills

### 4. Tags

Be specific and consistent:
- **Good**: `ladder, fall prevention, PPE, inspection, setup, maintenance`
- **Too vague**: `safety, training`
- **Too many**: 20+ tags

## Monitoring Upload Progress

### Real-Time Status

The function updates column G (Status) in real-time:

1. **Blank** → Row not processed yet
2. **Processing** → Currently downloading/uploading
3. **Success** → Completed successfully
4. **Failed** → Error occurred

### Success Details

When Status = "Success", column H shows:
```
ID: 123, Files: 42
```

Where:
- **ID**: Database record ID (GlobalLibraryContents)
- **Files**: Number of files in SCORM package

### Failure Details

When Status = "Failed", column H shows error message:
```
Invalid SCORM package: imsmanifest.xml not found
```

Common errors:
- Missing `imsmanifest.xml`
- Invalid Google Drive URL
- Access denied (not shared)
- Corrupt ZIP file
- Network timeout

## Batch Processing Strategy

### For Large Datasets (100+ rows)

Process in batches:

**Batch 1** (rows 2-21):
```powershell
startRow = 2
endRow = 21
```

**Batch 2** (rows 22-41):
```powershell
startRow = 22
endRow = 41
```

### For Testing

Always test with 1-2 rows first:
```powershell
startRow = 2
endRow = 3
```

## Post-Upload Verification

### 1. Check Google Sheet

- All rows should show "Success" or "Failed"
- Failed rows can be fixed and re-uploaded

### 2. Check Azure Blob Storage

Navigate to: `lmscontent/global-library/scorm/`

Expected structure:
```
global-library/
└── scorm/
    ├── ladder-safety-training/
    │   ├── imsmanifest.xml
    │   ├── index.html
    │   └── ... (content files)
    ├── fire-safety-at-workplace/
    │   ├── imsmanifest.xml
    │   └── ...
    └── ...
```

### 3. Check Database

```sql
SELECT 
    Id,
    Title,
    Category,
    Tags,
    FileSizeBytes / 1024.0 / 1024.0 AS SizeMB,
    UploadedOn,
    LEFT(AzureBlobPath, 80) AS LaunchUrl
FROM GlobalLibraryContents
WHERE ContentType = 'scorm'
ORDER BY UploadedOn DESC;
```

### 4. Test in SuperAdmin Portal

1. Login as SuperAdmin
2. Navigate to Global Library
3. Filter by Content Type = "SCORM"
4. Verify packages appear with:
   - Correct title
   - Description
   - Category
   - Tags
   - Thumbnail (if provided)
5. Click "Preview" to test SCORM player

## Troubleshooting

### Issue: Row skipped

**Symptom**: Row has no status after upload  
**Causes**:
- Missing Title (column A)
- Missing Content File URL (column F)
- Empty row

**Solution**: Fill required fields and re-run

### Issue: "Processing" stuck

**Symptom**: Status shows "Processing" indefinitely  
**Causes**:
- Function timeout (large file)
- Network error
- Azure storage quota exceeded

**Solution**:
1. Check function logs in Application Insights
2. Re-run for that specific row
3. Increase function timeout if needed

### Issue: Duplicate uploads

**Symptom**: Same package uploaded multiple times  
**Causes**:
- Running function multiple times on same rows
- No unique constraint on Title

**Solution**:
- Check database before re-running
- Add WHERE clause to SQL to check existing:
  ```sql
  SELECT Title FROM GlobalLibraryContents 
  WHERE Title IN ('Package1', 'Package2')
  ```

## Best Practices

1. ✅ **Test first**: Always test with 1-2 rows
2. ✅ **Batch processing**: Process 20-50 rows at a time
3. ✅ **Monitor progress**: Watch Google Sheet status column
4. ✅ **Verify uploads**: Check Azure Storage and database
5. ✅ **Handle failures**: Fix failed rows and re-upload
6. ✅ **Clean naming**: Use consistent, descriptive titles
7. ✅ **Tag properly**: Use 3-10 relevant tags per package
8. ✅ **Backup sheet**: Keep a copy before bulk upload

---

**Need help?** Check the main README.md for detailed troubleshooting and support information.
