# Qualification Management Module - Integration Guide

## Overview

This guide provides step-by-step instructions for integrating the qualification management module into the LMS Box application.

---

## Part 1: Frontend Setup (Already Completed)

### Components Created

```
lmsbox.client/src/pages/Qualifications/
├── CohortsList.jsx              # List of available cohorts
├── CohortSubmission.jsx         # Multi-stage submission workflow
└── index.js                     # Module exports
```

### Routes Added

Routes are already configured in `App.jsx`:

```jsx
// Qualifications routes - learner submission
<Route
  path="/qualifications"
  element={
    <ProtectedRoute>
      <CohortsList />
    </ProtectedRoute>
  }
/>
<Route
  path="/qualifications/cohorts/:cohortId"
  element={
    <ProtectedRoute>
      <CohortSubmission />
    </ProtectedRoute>
  }
/>
```

### Current Features

- ✅ Responsive UI components
- ✅ Mock data for testing
- ✅ Multi-stage submission workflow
- ✅ File upload validation
- ✅ Mock plagiarism results display
- ⏳ API integration (ready for backend)

---

## Part 2: Backend Setup (TODO)

### Step 1: Create Database Entities

#### 1.1 Create Cohort.cs

**Location**: `lmsbox.domain/Models/Cohort.cs`

```csharp
using System;
using System.Collections.Generic;

namespace lmsbox.domain.Models
{
    public class Cohort
    {
        public string Id { get; set; } = "cohort-" + Guid.NewGuid().ToString().Substring(0, 8);
        public string Name { get; set; }
        public string Description { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        
        public string? OrganisationId { get; set; }
        public Organisation? Organisation { get; set; }
        
        // Soft delete
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }
        
        // Navigation properties
        public ICollection<CohortEnrollment> Enrollments { get; set; } = new List<CohortEnrollment>();
        public ICollection<CohortSubmission> Submissions { get; set; } = new List<CohortSubmission>();
        
        // Computed property
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
}
```

#### 1.2 Create CohortEnrollment.cs

**Location**: `lmsbox.domain/Models/CohortEnrollment.cs`

```csharp
using System;

namespace lmsbox.domain.Models
{
    public class CohortEnrollment
    {
        public long Id { get; set; }
        
        public string CohortId { get; set; }
        public Cohort Cohort { get; set; }
        
        public string UserId { get; set; }
        public ApplicationUser User { get; set; }
        
        public DateTime EnrolledAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        
        public string? OrganisationId { get; set; }
        public Organisation? Organisation { get; set; }
    }
}
```

#### 1.3 Create CohortSubmission.cs

**Location**: `lmsbox.domain/Models/CohortSubmission.cs`

```csharp
using System;

namespace lmsbox.domain.Models
{
    public class CohortSubmission
    {
        public string Id { get; set; } = "submission-" + Guid.NewGuid().ToString().Substring(0, 8);
        
        public string CohortId { get; set; }
        public Cohort Cohort { get; set; }
        
        public string UserId { get; set; }
        public ApplicationUser User { get; set; }
        
        public string FileName { get; set; }
        public string DocumentBlobUrl { get; set; }
        
        public int PlagiarismScore { get; set; }
        public string? PlagiarismReportId { get; set; }
        public string? PlagiarismReportUrl { get; set; }
        
        public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
        public DateTime? GradedAt { get; set; }
        
        public string SubmissionStatus { get; set; } = "submitted";
        public string? AdminNotes { get; set; }
        
        public string? OrganisationId { get; set; }
        public Organisation? Organisation { get; set; }
    }
}
```

### Step 2: Update ApplicationDbContext

**Location**: `lmsbox.infrastructure/Data/ApplicationDbContext.cs`

Add DbSets to the context:

```csharp
public DbSet<Cohort> Cohorts { get; set; }
public DbSet<CohortEnrollment> CohortEnrollments { get; set; }
public DbSet<CohortSubmission> CohortSubmissions { get; set; }
```

### Step 3: Create Entity Configurations

#### 3.1 CohortConfiguration.cs

**Location**: `lmsbox.infrastructure/Data/Configurations/CohortConfiguration.cs`

```csharp
using lmsbox.domain.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace lmsbox.infrastructure.Data.Configurations
{
    public class CohortConfiguration : IEntityTypeConfiguration<Cohort>
    {
        public void Configure(EntityTypeBuilder<Cohort> builder)
        {
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).HasMaxLength(100).IsRequired();
            
            builder.Property(x => x.Name).HasMaxLength(255).IsRequired();
            builder.Property(x => x.Description).HasMaxLength(2000);
            
            builder.Property(x => x.OrganisationId).HasMaxLength(100);
            builder.HasOne(x => x.Organisation)
                .WithMany()
                .HasForeignKey(x => x.OrganisationId)
                .OnDelete(DeleteBehavior.NoAction);
            
            // Indexes
            builder.HasIndex(x => new { x.OrganisationId, x.StartDate });
            builder.HasIndex(x => x.IsDeleted);
            
            // Navigation
            builder.HasMany(x => x.Enrollments)
                .WithOne(x => x.Cohort)
                .HasForeignKey(x => x.CohortId)
                .OnDelete(DeleteBehavior.Cascade);
            
            builder.HasMany(x => x.Submissions)
                .WithOne(x => x.Cohort)
                .HasForeignKey(x => x.CohortId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
```

#### 3.2 CohortEnrollmentConfiguration.cs

**Location**: `lmsbox.infrastructure/Data/Configurations/CohortEnrollmentConfiguration.cs`

```csharp
using lmsbox.domain.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace lmsbox.infrastructure.Data.Configurations
{
    public class CohortEnrollmentConfiguration : IEntityTypeConfiguration<CohortEnrollment>
    {
        public void Configure(EntityTypeBuilder<CohortEnrollment> builder)
        {
            builder.HasKey(x => x.Id);
            
            builder.HasIndex(x => new { x.CohortId, x.UserId }).IsUnique();
            
            builder.Property(x => x.CohortId).HasMaxLength(100).IsRequired();
            builder.HasOne(x => x.Cohort)
                .WithMany(x => x.Enrollments)
                .HasForeignKey(x => x.CohortId);
            
            builder.Property(x => x.UserId).IsRequired();
            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId);
            
            builder.Property(x => x.OrganisationId).HasMaxLength(100);
            builder.HasOne(x => x.Organisation)
                .WithMany()
                .HasForeignKey(x => x.OrganisationId)
                .OnDelete(DeleteBehavior.NoAction);
        }
    }
}
```

#### 3.3 CohortSubmissionConfiguration.cs

**Location**: `lmsbox.infrastructure/Data/Configurations/CohortSubmissionConfiguration.cs`

```csharp
using lmsbox.domain.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace lmsbox.infrastructure.Data.Configurations
{
    public class CohortSubmissionConfiguration : IEntityTypeConfiguration<CohortSubmission>
    {
        public void Configure(EntityTypeBuilder<CohortSubmission> builder)
        {
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).HasMaxLength(100).IsRequired();
            
            builder.HasIndex(x => new { x.CohortId, x.UserId }).IsUnique();
            
            builder.Property(x => x.CohortId).HasMaxLength(100).IsRequired();
            builder.HasOne(x => x.Cohort)
                .WithMany(x => x.Submissions)
                .HasForeignKey(x => x.CohortId);
            
            builder.Property(x => x.UserId).IsRequired();
            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId);
            
            builder.Property(x => x.FileName).HasMaxLength(255).IsRequired();
            builder.Property(x => x.SubmissionStatus).HasMaxLength(50);
            
            builder.Property(x => x.OrganisationId).HasMaxLength(100);
            builder.HasOne(x => x.Organisation)
                .WithMany()
                .HasForeignKey(x => x.OrganisationId)
                .OnDelete(DeleteBehavior.NoAction);
            
            // Indexes
            builder.HasIndex(x => x.UserId);
            builder.HasIndex(x => x.SubmittedAt);
        }
    }
}
```

### Step 4: Create Database Migration

```powershell
# Navigate to infrastructure project
cd lmsbox.infrastructure

# Add migration
dotnet ef migrations add CreateCohortTables --startup-project ..\lmsBox.Server

# Apply migration from Server directory
cd ..\lmsBox.Server
dotnet ef database update --project ..\lmsbox.infrastructure
```

### Step 5: Create DTOs

#### 5.1 CohortListDto.cs

**Location**: `lmsBox.Server/Models/DTOs/CohortListDto.cs`

```csharp
using System;

namespace lmsBox.Server.Models.DTOs
{
    public class CohortListDto
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string Status { get; set; }
        public int TotalEnrolled { get; set; }
        public int TotalSubmitted { get; set; }
        public bool UserHasSubmitted { get; set; }
    }
}
```

#### 5.2 PlagiarismCheckResultDto.cs

**Location**: `lmsBox.Server/Models/DTOs/PlagiarismCheckResultDto.cs`

```csharp
using System;
using System.Collections.Generic;

namespace lmsBox.Server.Models.DTOs
{
    public class PlagiarismCheckResultDto
    {
        public string DocumentId { get; set; }
        public string FileName { get; set; }
        public DateTime SubmissionTime { get; set; }
        public int OverallScore { get; set; }
        public string Status { get; set; }
        public List<PlagiarismSourceDto> Sources { get; set; } = new();
        public string ReportUrl { get; set; }
    }

    public class PlagiarismSourceDto
    {
        public string Url { get; set; }
        public int MatchPercentage { get; set; }
        public string MatchedText { get; set; }
    }
}
```

#### 5.3 SubmitQualificationRequestDto.cs

**Location**: `lmsBox.Server/Models/DTOs/SubmitQualificationRequestDto.cs`

```csharp
using System.ComponentModel.DataAnnotations;

namespace lmsBox.Server.Models.DTOs
{
    public class SubmitQualificationRequestDto
    {
        [Required]
        public string DocumentId { get; set; }

        [Required]
        public string FileName { get; set; }

        [Range(0, 100)]
        public int PlagiarismScore { get; set; }
    }
}
```

### Step 6: Create Services

#### 6.1 IQualificationsService.cs

**Location**: `lmsBox.Server/Services/IQualificationsService.cs`

```csharp
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using lmsBox.Server.Models.DTOs;

namespace lmsBox.Server.Services
{
    public interface IQualificationsService
    {
        Task<IEnumerable<CohortListDto>> GetCohortsForUserAsync(
            string userId,
            string? status = null,
            int page = 1,
            int pageSize = 10);

        Task<object> GetCohortDetailsAsync(
            string userId,
            string cohortId);

        Task<PlagiarismCheckResultDto> CheckPlagiarismAsync(
            string userId,
            string cohortId,
            Stream documentStream,
            string fileName);

        Task<object> SubmitQualificationAsync(
            string userId,
            string cohortId,
            SubmitQualificationRequestDto request);
    }
}
```

#### 6.2 QualificationsService.cs

**Location**: `lmsBox.Server/Services/QualificationsService.cs`

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using lmsbox.domain.Models;
using lmsBox.Server.Data;
using lmsBox.Server.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Services
{
    public class QualificationsService : IQualificationsService
    {
        private readonly ApplicationDbContext _context;
        private readonly IAzureBlobService _blobService;
        private readonly IAuditLogService _auditLogService;
        private readonly ILogger<QualificationsService> _logger;

        public QualificationsService(
            ApplicationDbContext context,
            IAzureBlobService blobService,
            IAuditLogService auditLogService,
            ILogger<QualificationsService> logger)
        {
            _context = context;
            _blobService = blobService;
            _auditLogService = auditLogService;
            _logger = logger;
        }

        public async Task<IEnumerable<CohortListDto>> GetCohortsForUserAsync(
            string userId,
            string? status = null,
            int page = 1,
            int pageSize = 10)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) throw new ArgumentException("User not found");

            var query = _context.Cohorts
                .Where(c => !c.IsDeleted && c.OrganisationId == user.OrganisationID)
                .Include(c => c.Enrollments)
                .Include(c => c.Submissions)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
            {
                // Filter by computed status
                query = query.Where(c =>
                    (status == "active" && DateTime.UtcNow >= c.StartDate && DateTime.UtcNow < c.EndDate) ||
                    (status == "upcoming" && DateTime.UtcNow < c.StartDate) ||
                    (status == "completed" && DateTime.UtcNow >= c.EndDate));
            }

            var cohorts = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return cohorts.Select(c => new CohortListDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                StartDate = c.StartDate,
                EndDate = c.EndDate,
                Status = c.Status,
                TotalEnrolled = c.Enrollments.Count,
                TotalSubmitted = c.Submissions.Count,
                UserHasSubmitted = c.Submissions.Any(s => s.UserId == userId)
            }).ToList();
        }

        public async Task<object> GetCohortDetailsAsync(string userId, string cohortId)
        {
            var cohort = await _context.Cohorts
                .Include(c => c.Enrollments)
                .Include(c => c.Submissions)
                .FirstOrDefaultAsync(c => c.Id == cohortId && !c.IsDeleted);

            if (cohort == null) throw new ArgumentException("Cohort not found");

            var enrollment = cohort.Enrollments.FirstOrDefault(e => e.UserId == userId);
            if (enrollment == null) throw new UnauthorizedAccessException("Not enrolled in this cohort");

            var userSubmission = cohort.Submissions.FirstOrDefault(s => s.UserId == userId);

            return new
            {
                cohort.Id,
                cohort.Name,
                cohort.Description,
                cohort.StartDate,
                cohort.EndDate,
                cohort.Status,
                TotalEnrolled = cohort.Enrollments.Count,
                TotalSubmitted = cohort.Submissions.Count,
                UserEnrolled = true,
                UserSubmission = userSubmission != null ? new
                {
                    userSubmission.Id,
                    userSubmission.FileName,
                    userSubmission.SubmittedAt,
                    userSubmission.PlagiarismScore,
                    userSubmission.SubmissionStatus
                } : null
            };
        }

        public async Task<PlagiarismCheckResultDto> CheckPlagiarismAsync(
            string userId,
            string cohortId,
            Stream documentStream,
            string fileName)
        {
            // TODO: Implement actual plagiarism check
            // For now, return mock results
            
            await Task.Delay(3000); // Simulate API call

            return new PlagiarismCheckResultDto
            {
                DocumentId = "doc-" + Guid.NewGuid().ToString().Substring(0, 8),
                FileName = fileName,
                SubmissionTime = DateTime.UtcNow,
                OverallScore = new Random().Next(0, 100),
                Status = "completed",
                Sources = new List<PlagiarismSourceDto>
                {
                    new() { Url = "https://example.com", MatchPercentage = 10, MatchedText = "Sample text..." }
                },
                ReportUrl = "/api/qualifications/reports/mock-report"
            };
        }

        public async Task<object> SubmitQualificationAsync(
            string userId,
            string cohortId,
            SubmitQualificationRequestDto request)
        {
            var cohort = await _context.Cohorts
                .Include(c => c.Enrollments)
                .FirstOrDefaultAsync(c => c.Id == cohortId && !c.IsDeleted);

            if (cohort == null) throw new ArgumentException("Cohort not found");
            
            if (DateTime.UtcNow >= cohort.EndDate)
                throw new InvalidOperationException("Cohort submission period has ended");

            var enrollment = cohort.Enrollments.FirstOrDefault(e => e.UserId == userId);
            if (enrollment == null) throw new UnauthorizedAccessException("Not enrolled in this cohort");

            // Check if already submitted
            var existing = await _context.CohortSubmissions
                .FirstOrDefaultAsync(s => s.CohortId == cohortId && s.UserId == userId);

            if (existing != null)
                throw new InvalidOperationException("Already submitted for this cohort");

            var user = await _context.Users.FindAsync(userId);
            var submission = new CohortSubmission
            {
                CohortId = cohortId,
                UserId = userId,
                FileName = request.FileName,
                PlagiarismScore = request.PlagiarismScore,
                SubmissionStatus = "submitted",
                OrganisationId = user.OrganisationID
            };

            // TODO: Upload document to Azure Blob

            _context.CohortSubmissions.Add(submission);
            await _context.SaveChangesAsync();

            // Log audit
            await _auditLogService.LogAsync(
                userId,
                user.UserName,
                "QualificationSubmitted",
                $"Submitted qualification for cohort {cohort.Name}",
                user.OrganisationID);

            return new
            {
                id = submission.Id,
                cohortId = submission.CohortId,
                fileName = submission.FileName,
                plagiarismScore = submission.PlagiarismScore,
                submittedAt = submission.SubmittedAt,
                status = submission.SubmissionStatus,
                message = "Qualification submitted successfully"
            };
        }
    }
}
```

### Step 7: Create Controller

**Location**: `lmsBox.Server/Controllers/QualificationsController.cs`

```csharp
using System;
using System.Security.Claims;
using System.Threading.Tasks;
using lmsBox.Server.Models.DTOs;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace lmsBox.Server.Controllers
{
    [ApiController]
    [Route("api/qualifications")]
    public class QualificationsController : ControllerBase
    {
        private readonly IQualificationsService _qualificationsService;
        private readonly ILogger<QualificationsController> _logger;

        public QualificationsController(
            IQualificationsService qualificationsService,
            ILogger<QualificationsController> logger)
        {
            _qualificationsService = qualificationsService;
            _logger = logger;
        }

        [Authorize]
        [HttpGet("cohorts")]
        public async Task<IActionResult> GetCohorts(
            [FromQuery] string? status = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var cohorts = await _qualificationsService.GetCohortsForUserAsync(userId, status, page, pageSize);
                return Ok(new { data = cohorts, pageNumber = page, pageSize = pageSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving cohorts");
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize]
        [HttpGet("cohorts/{cohortId}")]
        public async Task<IActionResult> GetCohortDetails(string cohortId)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var details = await _qualificationsService.GetCohortDetailsAsync(userId, cohortId);
                return Ok(details);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving cohort details");
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize]
        [HttpPost("cohorts/{cohortId}/check-plagiarism")]
        public async Task<IActionResult> CheckPlagiarism(string cohortId, IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                    return BadRequest(new { message = "File is required" });

                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                using var stream = file.OpenReadStream();
                var result = await _qualificationsService.CheckPlagiarismAsync(userId, cohortId, stream, file.FileName);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking plagiarism");
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize]
        [HttpPost("cohorts/{cohortId}/submit")]
        public async Task<IActionResult> SubmitQualification(
            string cohortId,
            [FromBody] SubmitQualificationRequestDto request)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var result = await _qualificationsService.SubmitQualificationAsync(userId, cohortId, request);
                return CreatedAtAction(nameof(GetCohortDetails), new { cohortId }, result);
            }
            catch (UnauthorizedAccessException)
            {
                return Forbid();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error submitting qualification");
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
```

### Step 8: Register Services in Program.cs

Add to `Program.cs`:

```csharp
builder.Services.AddScoped<IQualificationsService, QualificationsService>();
```

### Step 9: Update Frontend API Integration

Replace mock API calls in frontend components with actual calls. See `QUALIFICATIONS_API_SPECS.md` for integration points.

---

## Part 3: Testing

### Frontend Testing

```bash
cd lmsbox.client
npm run dev
```

Navigate to `http://localhost:5173/qualifications`

### Backend Testing

```bash
cd lmsBox.Server
dotnet run
```

Test endpoints with Postman or the provided `.http` file.

### Integration Testing

1. Create test cohorts via admin API
2. Enroll learner in cohort
3. Submit qualification as learner
4. Verify data in database

---

## Part 4: Security & Performance

### Security Checklist

- [ ] All endpoints require authentication
- [ ] Authorization checks for cohort enrollment
- [ ] File size validation (max 10MB)
- [ ] File type validation (.doc, .docx only)
- [ ] SQL injection prevention (EF Core parameterized queries)
- [ ] CSRF protection enabled
- [ ] Sensitive data encrypted in transit

### Performance Checklist

- [ ] Database indexes created
- [ ] Pagination implemented
- [ ] Caching enabled for plagiarism results
- [ ] Async/await used throughout
- [ ] Connection pooling configured
- [ ] Load testing performed

---

## Troubleshooting

### Components Not Showing

- Verify routes are added to App.jsx
- Check browser console for errors
- Verify ProtectedRoute wrapper is working

### API Calls Failing

- Verify backend server is running
- Check CORS configuration
- Verify authentication token in headers
- Review backend logs

### Database Migration Issues

- Ensure Entity Framework Core tools are installed
- Verify DbContext configuration
- Check SQL Server connection string
- Review migration file for syntax errors

---

## Rollout Plan

### Phase 1: Development
- [x] Frontend mockup
- [ ] Backend API setup
- [ ] Database setup
- [ ] Local testing

### Phase 2: Testing
- [ ] Integration testing
- [ ] Security testing
- [ ] Performance testing
- [ ] UAT with stakeholders

### Phase 3: Staging
- [ ] Deploy to staging environment
- [ ] Plagiarism API integration
- [ ] Production data testing
- [ ] Load testing

### Phase 4: Production
- [ ] Database backup
- [ ] Staged rollout
- [ ] Monitoring setup
- [ ] Support documentation

---

## Support & Documentation

- **Mockup Guide**: `QUALIFICATIONS_MOCKUP.md`
- **UI Design**: `QUALIFICATIONS_UI_MOCKUP.md`
- **API Specifications**: `QUALIFICATIONS_API_SPECS.md`
- **Quick Start**: `QUALIFICATIONS_QUICKSTART.md`

---

**Last Updated**: January 15, 2026
**Status**: Ready for backend implementation
**Estimated Development Time**: 2-3 weeks
