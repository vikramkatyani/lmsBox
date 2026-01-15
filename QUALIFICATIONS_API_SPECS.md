# Qualification Management Module - Backend API Specifications

## Overview

This document outlines the API endpoints needed to support the qualification management module. These endpoints should be implemented in the .NET backend to support the learner-facing mockup.

---

## Database Entities

### 1. Cohort Entity

```csharp
public class Cohort
{
    public string Id { get; set; } // "cohort-001"
    public string Name { get; set; }
    public string Description { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    public string? OrganisationId { get; set; }
    public Organisation? Organisation { get; set; }
    
    // Soft delete
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    
    // Navigation properties
    public ICollection<CohortEnrollment> Enrollments { get; set; } = new List<CohortEnrollment>();
    public ICollection<CohortSubmission> Submissions { get; set; } = new List<CohortSubmission>();
    
    // Computed properties
    public string Status 
    { 
        get 
        {
            var now = DateTime.UtcNow;
            if (now < StartDate) return "upcoming";
            if (now < EndDate) return "active";
            return "completed";
        }
    }
}
```

### 2. CohortEnrollment Entity

```csharp
public class CohortEnrollment
{
    public long Id { get; set; }
    public string CohortId { get; set; }
    public Cohort Cohort { get; set; }
    
    public string UserId { get; set; }
    public ApplicationUser User { get; set; }
    
    public DateTime EnrolledAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    public string? OrganisationId { get; set; }
    public Organisation? Organisation { get; set; }
}
```

### 3. CohortSubmission Entity

```csharp
public class CohortSubmission
{
    public string Id { get; set; } // "submission-001"
    public string CohortId { get; set; }
    public Cohort Cohort { get; set; }
    
    public string UserId { get; set; }
    public ApplicationUser User { get; set; }
    
    public string FileName { get; set; }
    public string DocumentBlobUrl { get; set; } // URL in Azure Blob
    
    public int PlagiarismScore { get; set; } // 0-100
    public string PlagiarismReportId { get; set; } // From external API (e.g., Copyleaks)
    public string PlagiarismReportUrl { get; set; } // Link to full report
    
    public DateTime SubmittedAt { get; set; }
    public DateTime? GradedAt { get; set; }
    
    public string SubmissionStatus { get; set; } // "submitted", "reviewing", "graded", "rejected"
    public string? AdminNotes { get; set; } // For admin feedback
    
    public string? OrganisationId { get; set; }
    public Organisation? Organisation { get; set; }
}
```

### 4. PlagiarismCheckResult Entity (Optional Cache)

```csharp
public class PlagiarismCheckResult
{
    public long Id { get; set; }
    public string SubmissionId { get; set; }
    
    public int OverallScore { get; set; }
    public string ApiProvider { get; set; } // "copyleaks", "chatgpt", etc.
    public string RawResponse { get; set; } // JSON response from API
    
    public DateTime CheckedAt { get; set; }
    public int ExpiresInDays { get; set; } = 30
}
```

---

## API Endpoints

### 1. Get Cohorts List for Learner

**Endpoint**: `GET /api/qualifications/cohorts`

**Authentication**: Required (JWT Bearer Token)

**Authorization**: Learner, OrgAdmin, SuperAdmin

**Query Parameters**:
- `status` (optional): Filter by status (active, upcoming, completed, all)
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 10)

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "cohort-001",
      "name": "Advanced Python Programming Q1 2026",
      "description": "Master advanced Python concepts...",
      "startDate": "2026-01-20T00:00:00Z",
      "endDate": "2026-03-20T00:00:00Z",
      "status": "active",
      "totalEnrolled": 24,
      "totalSubmitted": 0,
      "userHasSubmitted": false
    }
  ],
  "totalCount": 4,
  "pageNumber": 1,
  "pageSize": 10,
  "totalPages": 1
}
```

**Error Responses**:
- 401 Unauthorized
- 403 Forbidden
- 500 Internal Server Error

---

### 2. Get Cohort Details

**Endpoint**: `GET /api/qualifications/cohorts/{cohortId}`

**Authentication**: Required (JWT Bearer Token)

**Authorization**: Enrolled users, OrgAdmin, SuperAdmin

**Response** (200 OK):
```json
{
  "id": "cohort-001",
  "name": "Advanced Python Programming Q1 2026",
  "description": "Master advanced Python concepts...",
  "startDate": "2026-01-20T00:00:00Z",
  "endDate": "2026-03-20T00:00:00Z",
  "status": "active",
  "totalEnrolled": 24,
  "totalSubmitted": 0,
  "userEnrolled": true,
  "userSubmission": null
}
```

**Error Responses**:
- 401 Unauthorized
- 403 Forbidden (Not enrolled)
- 404 Not Found
- 500 Internal Server Error

---

### 3. Check Plagiarism

**Endpoint**: `POST /api/qualifications/cohorts/{cohortId}/check-plagiarism`

**Authentication**: Required (JWT Bearer Token)

**Authorization**: Enrolled users in cohort

**Request**: Form Data
- `file`: Word document file (.doc, .docx)

**Processing Steps**:
1. Validate file type and size
2. Extract text from Word document
3. Send text to plagiarism API (Copyleaks/ChatGPT)
4. Parse and return results

**Response** (200 OK):
```json
{
  "documentId": "doc-1234567890",
  "fileName": "submission.docx",
  "submissionTime": "2026-01-15T10:30:00Z",
  "overallScore": 23,
  "status": "completed",
  "sources": [
    {
      "url": "https://example-article.com/python-guide",
      "matchPercentage": 8,
      "matchedText": "Python is a high-level programming language..."
    },
    {
      "url": "https://github.com/sample-repo/code",
      "matchPercentage": 10,
      "matchedText": "def process_data(dataset):..."
    },
    {
      "url": "https://documentation.readthedocs.io/en/latest/",
      "matchPercentage": 5,
      "matchedText": "The following methods are available..."
    }
  ],
  "reportUrl": "/api/qualifications/reports/doc-1234567890"
}
```

**Error Responses**:
- 400 Bad Request (Invalid file)
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found (Cohort)
- 413 Payload Too Large
- 500 Internal Server Error

---

### 4. Submit Qualification

**Endpoint**: `POST /api/qualifications/cohorts/{cohortId}/submit`

**Authentication**: Required (JWT Bearer Token)

**Authorization**: Enrolled users in cohort

**Request Body**:
```json
{
  "documentId": "doc-1234567890",
  "fileName": "submission.docx",
  "plagiarismScore": 23
}
```

**Processing Steps**:
1. Validate cohort enrollment and active status
2. Validate plagiarism check was completed
3. Create CohortSubmission record
4. Upload document to Azure Blob Storage
5. Log audit entry
6. Send confirmation email

**Response** (201 Created):
```json
{
  "id": "submission-001",
  "cohortId": "cohort-001",
  "fileName": "submission.docx",
  "plagiarismScore": 23,
  "submittedAt": "2026-01-15T10:35:00Z",
  "status": "submitted",
  "message": "Qualification submitted successfully"
}
```

**Error Responses**:
- 400 Bad Request (Invalid data)
- 401 Unauthorized
- 403 Forbidden (Not enrolled or cohort not active)
- 404 Not Found
- 409 Conflict (Already submitted)
- 500 Internal Server Error

---

### 5. Get Plagiarism Report

**Endpoint**: `GET /api/qualifications/reports/{documentId}`

**Authentication**: Required (JWT Bearer Token)

**Authorization**: Document owner, OrgAdmin, SuperAdmin

**Response** (200 OK):
```json
{
  "documentId": "doc-1234567890",
  "overallScore": 23,
  "status": "completed",
  "checkedAt": "2026-01-15T10:32:00Z",
  "apiProvider": "copyleaks",
  "sources": [
    {
      "url": "https://example-article.com/python-guide",
      "matchPercentage": 8,
      "matchedText": "Python is a high-level programming language...",
      "matchedUrl": "https://example-article.com/python-guide#para-5"
    }
  ],
  "fullReportUrl": "https://copyleaks.com/report/..."
}
```

**Error Responses**:
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 500 Internal Server Error

---

## Service Interfaces

### IPlagiarismCheckService

```csharp
public interface IPlagiarismCheckService
{
    /// <summary>
    /// Extracts text from Word document and checks for plagiarism
    /// </summary>
    Task<PlagiarismCheckResultDto> CheckPlagiarismAsync(
        Stream documentStream,
        string fileName,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Gets cached plagiarism results if available
    /// </summary>
    Task<PlagiarismCheckResultDto?> GetCachedResultAsync(
        string documentId);
}
```

### IWordDocumentService

```csharp
public interface IWordDocumentService
{
    /// <summary>
    /// Extracts all text from a Word document
    /// </summary>
    Task<string> ExtractTextAsync(
        Stream documentStream,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Validates Word document format
    /// </summary>
    bool IsValidWordDocument(Stream stream);
}
```

### ICopyleaksApiService

```csharp
public interface ICopyleaksApiService
{
    /// <summary>
    /// Submits text for plagiarism checking
    /// </summary>
    Task<CopyleaksCheckResultDto> CheckTextAsync(
        string text,
        string documentName,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Gets plagiarism check results
    /// </summary>
    Task<CopyleaksCheckResultDto> GetResultsAsync(
        string scanId,
        CancellationToken cancellationToken = default);
}
```

---

## DTOs

### CohortListDto

```csharp
public class CohortListDto
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Status { get; set; } // active, upcoming, completed
    public int TotalEnrolled { get; set; }
    public int TotalSubmitted { get; set; }
    public bool UserHasSubmitted { get; set; }
}
```

### PlagiarismCheckResultDto

```csharp
public class PlagiarismCheckResultDto
{
    public string DocumentId { get; set; }
    public string FileName { get; set; }
    public DateTime SubmissionTime { get; set; }
    public int OverallScore { get; set; } // 0-100
    public string Status { get; set; } // completed, pending, failed
    public List<PlagiarismSourceDto> Sources { get; set; }
    public string ReportUrl { get; set; }
}

public class PlagiarismSourceDto
{
    public string Url { get; set; }
    public int MatchPercentage { get; set; }
    public string MatchedText { get; set; }
}
```

### SubmitQualificationRequestDto

```csharp
public class SubmitQualificationRequestDto
{
    [Required]
    public string DocumentId { get; set; }
    
    [Required]
    public string FileName { get; set; }
    
    [Range(0, 100)]
    public int PlagiarismScore { get; set; }
}
```

---

## Database Migrations

### Migration: CreateCohortTables

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    // Create Cohort table
    migrationBuilder.CreateTable(
        name: "Cohorts",
        columns: table => new
        {
            Id = table.Column<string>(type: "nvarchar(100)", nullable: false),
            Name = table.Column<string>(type: "nvarchar(255)", nullable: false),
            Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
            StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
            EndDate = table.Column<DateTime>(type: "datetime2", nullable: false),
            OrganisationId = table.Column<string>(type: "nvarchar(100)", nullable: true),
            CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
            UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
            IsDeleted = table.Column<bool>(type: "bit", nullable: false),
            DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
        },
        constraints: table =>
        {
            table.PrimaryKey("PK_Cohorts", x => x.Id);
            table.ForeignKey("FK_Cohorts_Organisations_OrganisationId",
                x => x.OrganisationId,
                "Organisations",
                "Id");
        });

    // Create CohortEnrollment table
    migrationBuilder.CreateTable(
        name: "CohortEnrollments",
        columns: table => new
        {
            Id = table.Column<long>(type: "bigint", nullable: false)
                .Annotation("SqlServer:Identity", "1, 1"),
            CohortId = table.Column<string>(type: "nvarchar(100)", nullable: false),
            UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
            OrganisationId = table.Column<string>(type: "nvarchar(100)", nullable: true),
            EnrolledAt = table.Column<DateTime>(type: "datetime2", nullable: false),
            UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
        },
        constraints: table =>
        {
            table.PrimaryKey("PK_CohortEnrollments", x => x.Id);
            table.UniqueConstraint("UK_CohortEnrollment", x => new { x.CohortId, x.UserId });
            table.ForeignKey("FK_CohortEnrollments_Cohorts_CohortId",
                x => x.CohortId,
                "Cohorts",
                "Id");
            table.ForeignKey("FK_CohortEnrollments_AspNetUsers_UserId",
                x => x.UserId,
                "AspNetUsers",
                "Id");
        });

    // Create CohortSubmission table
    migrationBuilder.CreateTable(
        name: "CohortSubmissions",
        columns: table => new
        {
            Id = table.Column<string>(type: "nvarchar(100)", nullable: false),
            CohortId = table.Column<string>(type: "nvarchar(100)", nullable: false),
            UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
            FileName = table.Column<string>(type: "nvarchar(255)", nullable: false),
            DocumentBlobUrl = table.Column<string>(type: "nvarchar(max)", nullable: false),
            PlagiarismScore = table.Column<int>(type: "int", nullable: false),
            PlagiarismReportId = table.Column<string>(type: "nvarchar(255)", nullable: true),
            PlagiarismReportUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
            SubmittedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
            GradedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
            SubmissionStatus = table.Column<string>(type: "nvarchar(50)", nullable: false),
            AdminNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
            OrganisationId = table.Column<string>(type: "nvarchar(100)", nullable: true)
        },
        constraints: table =>
        {
            table.PrimaryKey("PK_CohortSubmissions", x => x.Id);
            table.UniqueConstraint("UK_CohortSubmission", x => new { x.CohortId, x.UserId });
            table.ForeignKey("FK_CohortSubmissions_Cohorts_CohortId",
                x => x.CohortId,
                "Cohorts",
                "Id");
            table.ForeignKey("FK_CohortSubmissions_AspNetUsers_UserId",
                x => x.UserId,
                "AspNetUsers",
                "Id");
        });

    // Create indexes
    migrationBuilder.CreateIndex(
        name: "IX_Cohorts_OrganisationId_StartDate",
        table: "Cohorts",
        columns: new[] { "OrganisationId", "StartDate" });

    migrationBuilder.CreateIndex(
        name: "IX_CohortEnrollments_UserId",
        table: "CohortEnrollments",
        column: "UserId");

    migrationBuilder.CreateIndex(
        name: "IX_CohortSubmissions_UserId",
        table: "CohortSubmissions",
        column: "UserId");
}
```

---

## Configuration Setup

### appsettings.json

```json
{
  "Plagiarism": {
    "Provider": "copyleaks",
    "ApiKey": "your-api-key-here",
    "TimeoutSeconds": 30,
    "CacheExpirationDays": 30
  },
  "WordDocument": {
    "MaxFileSizeMB": 10,
    "AllowedMimeTypes": [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]
  }
}
```

---

## Implementation Priority

### Phase 1 (MVP)
- [x] Frontend mockup components
- [ ] Database entities and migrations
- [ ] GET /api/qualifications/cohorts
- [ ] GET /api/qualifications/cohorts/{cohortId}
- [ ] POST /api/qualifications/cohorts/{cohortId}/submit (mock plagiarism)

### Phase 2
- [ ] Word document extraction service
- [ ] Plagiarism API integration (Copyleaks)
- [ ] POST /api/qualifications/cohorts/{cohortId}/check-plagiarism
- [ ] GET /api/qualifications/reports/{documentId}

### Phase 3
- [ ] Admin API endpoints for cohort management
- [ ] Admin dashboard for submissions
- [ ] Email notifications
- [ ] Audit logging

---

## Security Considerations

1. **Authentication**: All endpoints require JWT bearer token
2. **Authorization**: 
   - Learners can only see their own submissions
   - OrgAdmins can see submissions for their organisation
   - SuperAdmins can see all submissions
3. **File Validation**: 
   - Check file type and size on both client and server
   - Scan uploaded files for malware
   - Store in isolated blob container
4. **Rate Limiting**: Implement rate limiting for plagiarism checks
5. **Data Encryption**: Encrypt sensitive data at rest and in transit

---

## Performance Considerations

1. **Plagiarism Checks**: Run as background jobs (consider Azure Functions)
2. **Caching**: Cache plagiarism results for 30 days
3. **Database Indexes**: Add indexes on frequently queried columns
4. **Pagination**: Implement pagination for cohort lists
5. **Async Operations**: Use async/await for all I/O operations

---

## Testing Recommendations

### Unit Tests
- PlagiarismCheckService
- WordDocumentService
- API DTOs and validation

### Integration Tests
- Database operations
- API endpoint calls
- External service calls (mocked)

### End-to-End Tests
- Complete submission workflow
- Error handling
- Edge cases (concurrent submissions, file corruption, etc.)

---

## References

- Copyleaks API Documentation: https://api.copyleaks.com/
- Word Document Processing: https://github.com/nissl-lab/npoi
- Azure Blob Storage: https://learn.microsoft.com/en-us/azure/storage/blobs/
