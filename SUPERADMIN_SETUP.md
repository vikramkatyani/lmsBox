# Super Admin Multi-Tenancy Setup Guide

## Overview
This document describes the Super Admin functionality for managing multi-tenant LMS organisations. The Super Admin is a special user type that is **not associated with any organisation** and has full control over:
- Creating and managing organisations (tenants)
- Configuring organisation settings
- Creating admin accounts for each organisation
- Managing global content library
- System-wide analytics and reporting

## Architecture

### Database Structure

#### Organisation Model
The `Organisation` table has been enhanced with comprehensive configuration fields:

```sql
- Id (bigint)
- Name (string)
- Description (string, nullable)
- MaxUsers (int, default 100)
- AllocatedStorageGB (bigint, default 10)
- Domain (string, nullable)
- BannerUrl (string, nullable)
- FaviconUrl (string, nullable)
- ThemeSettings (string, nullable - JSON)
- SmtpHost, SmtpPort, SmtpUsername, SmtpPassword, SmtpUseSsl, SendGridApiKey
- FromEmail, FromName
- SupportEmail
- ManagerName, ManagerEmail, ManagerPhone
- RenewalDate (datetime, nullable)
- IsActive (bool, default true)
- CreatedOn, CreatedBy, UpdatedOn, UpdatedBy
```

#### ApplicationUser Changes
- `OrganisationID` is now **nullable** (long?)
- SuperAdmin users have `OrganisationID = null`
- Regular users and OrgAdmins have an OrganisationID

#### GlobalLibraryContent Table
New table for managing global content (PDFs and Videos):

```sql
- Id (bigint, identity)
- Title (string)
- Description (string, nullable)
- ContentType (string) - "pdf" or "video"
- AzureBlobPath (string) - path in Azure Storage
- FileName (string, nullable)
- FileSizeBytes (bigint)
- MimeType (string, nullable)
- UploadedOn (datetime)
- UploadedBy (string)
- IsActive (bool)
- UpdatedOn, UpdatedBy
- Tags (string, nullable - comma-separated)
```

### Azure Storage Structure

```
elgdocstorage (Storage Account)
  └── lmscontent (Container)
       ├── organisation/
       │    └── <org-guid>/
       │         ├── uicontent/      (banners, favicons)
       │         └── library/        (org-specific content)
       └── globallibrary/
            ├── pdf/
            └── video/
```

## API Endpoints

### Super Admin Authentication
**POST** `/api/SuperAdmin/login`
- Separate login endpoint for SuperAdmin
- Only accepts users with `SuperAdmin` role and no OrganisationID
- Returns JWT token with SuperAdmin role

### Organisation Management

#### Get All Organisations
**GET** `/api/SuperAdmin/organisations`
- Returns list of all organisations with stats
- Requires `SuperAdmin` role

#### Get Organisation by ID
**GET** `/api/SuperAdmin/organisations/{id}`
- Returns detailed organisation information
- Requires `SuperAdmin` role

#### Create Organisation
**POST** `/api/SuperAdmin/organisations`
```json
{
  "name": "Company Name",
  "description": "Description",
  "maxUsers": 100,
  "allocatedStorageGB": 10,
  "domain": "company.com",
  "supportEmail": "support@company.com",
  "managerName": "John Doe",
  "managerEmail": "john@company.com",
  "managerPhone": "+1234567890",
  "renewalDate": "2026-01-01T00:00:00Z",
  "themeSettings": "{\"primaryColor\":\"#4F46E5\"}"
}
```

#### Update Organisation
**PUT** `/api/SuperAdmin/organisations/{id}`
- Updates all organisation settings
- Includes email configuration (SMTP/SendGrid)
- Theme settings, renewal dates, etc.

#### Create Organisation Admin
**POST** `/api/SuperAdmin/organisations/{orgId}/admin`
```json
{
  "organisationId": 1,
  "email": "admin@company.com",
  "firstName": "Admin",
  "lastName": "User",
  "password": "SecurePassword123!"
}
```

### Azure Storage Integration

#### Get Upload Token for Organisation Assets
**POST** `/api/SuperAdmin/organisations/{orgId}/upload-token?fileType=.png`
- Generates SAS token for uploading banners/favicons
- Returns uploadUrl and blobPath
- Token expires in 1 hour

### Global Library Management

#### Get Global Library Content
**GET** `/api/SuperAdmin/global-library?contentType=pdf`
- Returns all global library content
- Filter by contentType (pdf/video)

#### Get Upload Token for Global Library
**POST** `/api/SuperAdmin/global-library/upload-token?contentType=pdf&fileName=guide.pdf`
- Generates SAS token for uploading global content
- Token expires in 2 hours

#### Create Global Library Content
**POST** `/api/SuperAdmin/global-library`
```json
{
  "title": "Safety Training Guide",
  "description": "Comprehensive safety training materials",
  "contentType": "pdf",
  "blobPath": "globallibrary/pdf/guid.pdf",
  "fileName": "safety-guide.pdf",
  "fileSizeBytes": 1024000,
  "mimeType": "application/pdf",
  "tags": "safety,training,compliance"
}
```

#### Delete Global Library Content
**DELETE** `/api/SuperAdmin/global-library/{id}`
- Soft deletes content (sets IsActive = false)

## Frontend Routes

### SuperAdmin Login
**Route:** `/superadmin/login`
- **Component:** `SuperAdminLogin.jsx`
- Completely separate from regular user login
- Purple/indigo gradient background
- Shield icon branding

### SuperAdmin Dashboard
**Route:** `/superadmin/dashboard`
- **Component:** `SuperAdminDashboard.jsx`
- Stats cards: Total Orgs, Active Orgs, Total Users, Allocated Storage
- Organisation table with inline actions
- Quick action cards for Global Library, Reports, Settings

### Future Routes (To Be Implemented)
- `/superadmin/organisations/create` - Create organisation form
- `/superadmin/organisations/{id}` - Edit organisation
- `/superadmin/organisations/{id}/analytics` - Org-specific analytics
- `/superadmin/global-library` - Manage global content
- `/superadmin/reports` - System-wide reports
- `/superadmin/settings` - Global system settings

## Default SuperAdmin Account

### Credentials
After running migrations and seeding, a default SuperAdmin account is created:

```
Email: superadmin@lmsbox.system
Password: SuperAdmin@123
```

⚠️ **IMPORTANT:** Change this password immediately in production!

### Seeding Code
Located in `DbSeeder.cs`:
- Creates SuperAdmin user with no OrganisationID
- Adds user to "SuperAdmin" role
- Separate from organisation-based admins

## Security Considerations

1. **Separate Login Portal**
   - SuperAdmin login is at `/superadmin/login`
   - Prevents confusion with regular user login
   - Clear visual distinction (purple theme vs regular blue)

2. **Role-Based Authorization**
   - All SuperAdmin endpoints require `[Authorize(Roles = "SuperAdmin")]`
   - OrganisationID null check prevents regular admins from accessing

3. **JWT Token Claims**
   - SuperAdmin tokens include `ClaimTypes.Role = "SuperAdmin"`
   - No OrganisationID claim (since they have none)

4. **Audit Logging**
   - All SuperAdmin actions are logged
   - CreatedBy/UpdatedBy fields track SuperAdmin email

## Migration Guide

### Apply Migration
```powershell
cd D:\LMSBOX\lmsBox\lmsbox.infrastructure
dotnet ef database update --startup-project ..\lmsBox.Server
```

### Seed Data
Run the application - `DbSeeder` automatically creates:
- SuperAdmin role
- SuperAdmin user
- Default organisation (if none exists)

## Usage Workflow

### 1. SuperAdmin Login
1. Navigate to `/superadmin/login`
2. Enter SuperAdmin credentials
3. JWT token stored in localStorage

### 2. Create Organisation
1. Click "Create Organisation" from dashboard
2. Fill in organisation details:
   - Name, description
   - Max users, storage allocation
   - Domain, support email
   - Manager contact info
   - Renewal date

### 3. Create Organisation Admin
1. Select organisation from list
2. Click to create admin account
3. Admin can then log in at regular `/login` portal
4. Admin manages their organisation's users and content

### 4. Configure Organisation
1. Update organisation settings:
   - Email configuration (SMTP/SendGrid)
   - Theme settings (JSON)
   - Banner and favicon (upload to Azure)
   - Renewal dates
   - Active/inactive status

### 5. Manage Global Library
1. Upload PDFs or videos to global library
2. Content available to all organisations
3. Tag and categorize content
4. Soft delete when no longer needed

## Configuration

### appsettings.json
Ensure Azure Storage is configured:

```json
{
  "AzureStorage": {
    "ConnectionString": "DefaultEndpointsProtocol=https;AccountName=...",
    "ContainerName": "lmscontent"
  }
}
```

### Container Setup
Create the container structure in Azure Storage:
```
lmscontent/
  organisation/
  globallibrary/pdf/
  globallibrary/video/
```

## Future Enhancements

1. **Organisation Creation Form**
   - Multi-step wizard
   - Azure Blob upload for banner/favicon
   - Theme color picker

2. **Global Library UI**
   - Drag-and-drop file upload
   - Preview for PDFs and videos
   - Advanced search and filtering

3. **System-Wide Analytics**
   - Total users across all orgs
   - Storage usage by org
   - License expiration tracking
   - Activity heatmaps

4. **Billing Integration**
   - Track user counts vs limits
   - Storage usage monitoring
   - Renewal notifications

5. **Org Cloning**
   - Duplicate organisation structure
   - Copy courses and content
   - Bulk provisioning

6. **Audit Reports**
   - SuperAdmin action log
   - Organisation creation timeline
   - Admin account management history

## Troubleshooting

### SuperAdmin Cannot Login
- Verify user has SuperAdmin role: Check `AspNetUserRoles` table
- Verify OrganisationID is NULL: Check `AspNetUsers` table
- Check JWT token configuration in `appsettings.json`

### Organisation Creation Fails
- Verify unique organisation name
- Check database connection
- Ensure CreatedBy field is populated

### Azure Upload Fails
- Verify Azure Storage connection string
- Check container exists and has proper permissions
- Ensure SAS token has write permissions

### Migration Issues
- Existing data: OrganisationID fields will be nullable
- Update seed data to set default values
- Run `dotnet ef database update --startup-project ..\lmsBox.Server`

## Database Migration Details

Migration: `20251107072141_AddSuperAdminAndOrganisationEnhancements`

### Changes Applied:
1. Added 26 new columns to `Organisations` table
2. Made `AspNetUsers.OrganisationID` nullable
3. Created `GlobalLibraryContents` table
4. Updated foreign key relationships

### Rollback
If needed, rollback the migration:
```powershell
dotnet ef database update <PreviousMigrationName> --startup-project ..\lmsBox.Server
dotnet ef migrations remove --startup-project ..\lmsBox.Server
```

## Support

For questions or issues:
- Check application logs (Serilog output)
- Review `AuditLogs` table for SuperAdmin actions
- Contact development team

---

**Last Updated:** November 7, 2025
**Migration Version:** 20251107072141_AddSuperAdminAndOrganisationEnhancements
