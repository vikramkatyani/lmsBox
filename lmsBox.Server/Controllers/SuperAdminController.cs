using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.ComponentModel.DataAnnotations;
using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Azure.Storage.Blobs;
using Azure.Storage.Sas;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SuperAdminController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SuperAdminController> _logger;
    private readonly IAzureBlobService _blobService;

    public SuperAdminController(
        ApplicationDbContext context,
        UserManager<ApplicationUser> userManager,
        IConfiguration configuration,
        ILogger<SuperAdminController> logger,
        IAzureBlobService blobService)
    {
        _context = context;
        _userManager = userManager;
        _configuration = configuration;
        _logger = logger;
        _blobService = blobService;
    }

    // Super Admin Login (separate endpoint)
    [HttpPost("login")]
    public async Task<IActionResult> SuperAdminLogin([FromBody] SuperAdminLoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null)
        {
            return Unauthorized(new { error = "Invalid credentials" });
        }

        // Verify user is SuperAdmin and has no organisation
        var roles = await _userManager.GetRolesAsync(user);
        if (!roles.Contains("SuperAdmin") || user.OrganisationID.HasValue)
        {
            return Unauthorized(new { error = "Access denied" });
        }

        var passwordValid = await _userManager.CheckPasswordAsync(user, request.Password);
        if (!passwordValid)
        {
            return Unauthorized(new { error = "Invalid credentials" });
        }

        // Generate JWT token
        var token = GenerateJwtToken(user, "SuperAdmin");

        return Ok(new SuperAdminLoginResponse
        {
            Token = token,
            Email = user.Email!,
            FirstName = user.FirstName,
            LastName = user.LastName,
            Role = "SuperAdmin"
        });
    }

    // Get all organisations
    [Authorize(Roles = "SuperAdmin")]
    [HttpGet("organisations")]
    public async Task<IActionResult> GetOrganisations()
    {
        var orgs = await _context.Organisations
            .Include(o => o.Users)
            .ToListAsync();

        var response = orgs.Select(o => new OrganisationResponse
        {
            Id = o.Id,
            Name = o.Name,
            Description = o.Description,
            MaxUsers = o.MaxUsers,
            AllocatedStorageGB = o.AllocatedStorageGB,
            Domain = o.Domain,
            BannerUrl = o.BannerUrl,
            FaviconUrl = o.FaviconUrl,
            ThemeSettings = o.ThemeSettings,
            SupportEmail = o.SupportEmail,
            ManagerName = o.ManagerName,
            ManagerEmail = o.ManagerEmail,
            ManagerPhone = o.ManagerPhone,
            RenewalDate = o.RenewalDate,
            IsActive = o.IsActive,
            CreatedOn = o.CreatedOn,
            TotalUsers = o.Users.Count,
            AdminEmail = o.Users.FirstOrDefault()?.Email
        }).ToList();

        return Ok(response);
    }

    // Get organisation by ID
    [Authorize(Roles = "SuperAdmin")]
    [HttpGet("organisations/{id}")]
    public async Task<IActionResult> GetOrganisation(long id)
    {
        var org = await _context.Organisations
            .Include(o => o.Users)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (org == null)
            return NotFound(new { error = "Organisation not found" });

        var response = new OrganisationResponse
        {
            Id = org.Id,
            Name = org.Name,
            Description = org.Description,
            MaxUsers = org.MaxUsers,
            AllocatedStorageGB = org.AllocatedStorageGB,
            Domain = org.Domain,
            BannerUrl = org.BannerUrl,
            FaviconUrl = org.FaviconUrl,
            ThemeSettings = org.ThemeSettings,
            SupportEmail = org.SupportEmail,
            ManagerName = org.ManagerName,
            ManagerEmail = org.ManagerEmail,
            ManagerPhone = org.ManagerPhone,
            RenewalDate = org.RenewalDate,
            IsActive = org.IsActive,
            CreatedOn = org.CreatedOn,
            TotalUsers = org.Users.Count,
            AdminEmail = org.Users.FirstOrDefault()?.Email
        };

        return Ok(response);
    }

    // Create new organisation
    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("organisations")]
    public async Task<IActionResult> CreateOrganisation([FromBody] CreateOrganisationRequest request)
    {
        var superAdminEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";

        var organisation = new Organisation
        {
            Name = request.Name,
            Description = request.Description,
            MaxUsers = request.MaxUsers,
            AllocatedStorageGB = request.AllocatedStorageGB,
            Domain = request.Domain,
            SupportEmail = request.SupportEmail,
            ManagerName = request.ManagerName,
            ManagerEmail = request.ManagerEmail,
            ManagerPhone = request.ManagerPhone,
            RenewalDate = request.RenewalDate,
            ThemeSettings = request.ThemeSettings,
            IsActive = true,
            CreatedOn = DateTime.UtcNow,
            CreatedBy = superAdminEmail
        };

        _context.Organisations.Add(organisation);
        await _context.SaveChangesAsync();

        _logger.LogInformation("SuperAdmin {Email} created organisation {OrgName} (ID: {OrgId})", 
            superAdminEmail, organisation.Name, organisation.Id);

        return CreatedAtAction(nameof(GetOrganisation), new { id = organisation.Id }, 
            new { id = organisation.Id, name = organisation.Name });
    }

    // Update organisation
    [Authorize(Roles = "SuperAdmin")]
    [HttpPut("organisations/{id}")]
    public async Task<IActionResult> UpdateOrganisation(long id, [FromBody] UpdateOrganisationRequest request)
    {
        if (id != request.Id)
            return BadRequest(new { error = "ID mismatch" });

        var organisation = await _context.Organisations.FindAsync(id);
        if (organisation == null)
            return NotFound(new { error = "Organisation not found" });

        var superAdminEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";

        // Update properties
        organisation.Name = request.Name;
        organisation.Description = request.Description;
        organisation.MaxUsers = request.MaxUsers;
        organisation.AllocatedStorageGB = request.AllocatedStorageGB;
        organisation.Domain = request.Domain;
        organisation.BannerUrl = request.BannerUrl;
        organisation.FaviconUrl = request.FaviconUrl;
        organisation.ThemeSettings = request.ThemeSettings;
        organisation.SmtpHost = request.SmtpHost;
        organisation.SmtpPort = request.SmtpPort;
        organisation.SmtpUsername = request.SmtpUsername;
        organisation.SmtpPassword = request.SmtpPassword;
        organisation.SmtpUseSsl = request.SmtpUseSsl;
        organisation.SendGridApiKey = request.SendGridApiKey;
        organisation.FromEmail = request.FromEmail;
        organisation.FromName = request.FromName;
        organisation.SupportEmail = request.SupportEmail;
        organisation.ManagerName = request.ManagerName;
        organisation.ManagerEmail = request.ManagerEmail;
        organisation.ManagerPhone = request.ManagerPhone;
        organisation.RenewalDate = request.RenewalDate;
        organisation.IsActive = request.IsActive;
        organisation.UpdatedOn = DateTime.UtcNow;
        organisation.UpdatedBy = superAdminEmail;

        await _context.SaveChangesAsync();

        _logger.LogInformation("SuperAdmin {Email} updated organisation {OrgName} (ID: {OrgId})", 
            superAdminEmail, organisation.Name, organisation.Id);

        return Ok(new { message = "Organisation updated successfully" });
    }

    // Create admin account for organisation
    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("organisations/{orgId}/admin")]
    public async Task<IActionResult> CreateOrgAdmin(long orgId, [FromBody] CreateOrgAdminRequest request)
    {
        if (orgId != request.OrganisationId)
            return BadRequest(new { error = "Organisation ID mismatch" });

        var organisation = await _context.Organisations.FindAsync(orgId);
        if (organisation == null)
            return NotFound(new { error = "Organisation not found" });

        // Check if email already exists
        var existingUser = await _userManager.FindByEmailAsync(request.Email);
        if (existingUser != null)
            return BadRequest(new { error = "Email already exists" });

        var superAdminEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";

        var admin = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            EmailConfirmed = true,
            FirstName = request.FirstName,
            LastName = request.LastName,
            OrganisationID = orgId,
            CreatedBy = superAdminEmail,
            ActivatedBy = superAdminEmail,
            DeactivatedBy = superAdminEmail,
            ActiveStatus = 1,
            ActivatedOn = DateTime.UtcNow,
            CreatedOn = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(admin, request.Password);
        if (!result.Succeeded)
        {
            return BadRequest(new { error = "Failed to create admin", errors = result.Errors });
        }

        await _userManager.AddToRoleAsync(admin, "OrgAdmin");

        _logger.LogInformation("SuperAdmin {SuperAdmin} created OrgAdmin {AdminEmail} for organisation {OrgName}", 
            superAdminEmail, admin.Email, organisation.Name);

        return Ok(new { message = "Organisation admin created successfully", email = admin.Email });
    }

    // Get Azure Storage SAS token for uploading org assets
    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("organisations/{orgId}/upload-token")]
    public IActionResult GetUploadToken(long orgId, [FromQuery] string fileType)
    {
        var connectionString = _configuration["AzureStorage:ConnectionString"];
        if (string.IsNullOrEmpty(connectionString))
            return BadRequest(new { error = "Azure Storage not configured" });

        var blobServiceClient = new BlobServiceClient(connectionString);
        var containerName = _configuration["AzureStorage:ContainerName"] ?? "lms-content";
        var containerClient = blobServiceClient.GetBlobContainerClient(containerName);

        // Generate unique blob name
        var blobPath = $"organisation/{orgId:D10}/uicontent/{Guid.NewGuid()}{Path.GetExtension(fileType)}";
        var blobClient = containerClient.GetBlobClient(blobPath);

        // Generate SAS token (write only, 1 hour expiry)
        var sasBuilder = new BlobSasBuilder
        {
            BlobContainerName = containerName,
            BlobName = blobPath,
            Resource = "b",
            ExpiresOn = DateTimeOffset.UtcNow.AddHours(1)
        };
        sasBuilder.SetPermissions(BlobSasPermissions.Write | BlobSasPermissions.Create);

        var sasToken = blobClient.GenerateSasUri(sasBuilder);

        return Ok(new
        {
            uploadUrl = sasToken.ToString(),
            blobPath = blobPath,
            expiresAt = sasBuilder.ExpiresOn
        });
    }

    // Global Library Content Management

    [Authorize(Roles = "SuperAdmin")]
    [HttpGet("global-library")]
    public async Task<IActionResult> GetGlobalLibrary([FromQuery] string? contentType)
    {
        var query = _context.GlobalLibraryContents.AsQueryable();

        if (!string.IsNullOrEmpty(contentType))
        {
            query = query.Where(c => c.ContentType == contentType);
        }

        var contents = await query
            .Where(c => c.IsActive)
            .OrderByDescending(c => c.UploadedOn)
            .Select(c => new GlobalLibraryContentResponse
            {
                Id = c.Id,
                Title = c.Title,
                Description = c.Description,
                ContentType = c.ContentType,
                AzureBlobPath = c.AzureBlobPath,
                FileName = c.FileName,
                FileSizeBytes = c.FileSizeBytes,
                MimeType = c.MimeType,
                UploadedOn = c.UploadedOn,
                UploadedBy = c.UploadedBy,
                IsActive = c.IsActive,
                Tags = c.Tags
            })
            .ToListAsync();

        return Ok(contents);
    }

    /// <summary>
    /// Upload a video file to global library blob storage
    /// </summary>
    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("global-library/upload-video")]
    [RequestSizeLimit(524_288_000)] // 500 MB limit
    public async Task<ActionResult<GlobalLibraryUploadResponse>> UploadVideo([FromForm] IFormFile video, [FromForm] string title, [FromForm] string description, [FromForm] string tags)
    {
        try
        {
            var superAdminEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";

            if (video == null || video.Length == 0)
            {
                return BadRequest(new { message = "No video file provided" });
            }

            // Validate video file type
            var allowedExtensions = new[] { ".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".webm" };
            var extension = Path.GetExtension(video.FileName).ToLower();
            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new { message = $"Invalid video format. Allowed: {string.Join(", ", allowedExtensions)}" });
            }

            if (!_blobService.IsConfigured())
            {
                return StatusCode(501, new { message = "Azure Blob Storage is not configured. Please configure it to upload files." });
            }

            // Generate unique filename
            var uniqueFileName = $"{Guid.NewGuid()}{extension}";

            // Upload to blob storage in global-library/video folder
            using var stream = video.OpenReadStream();
            var blobUrl = await _blobService.UploadToCustomPathAsync(
                stream,
                uniqueFileName,
                "global-library",
                video.ContentType,
                "video");

            // Create database record
            var content = new GlobalLibraryContent
            {
                Title = title,
                Description = description,
                ContentType = "video",
                AzureBlobPath = blobUrl,
                FileName = uniqueFileName,
                FileSizeBytes = video.Length,
                MimeType = video.ContentType,
                Tags = tags,
                UploadedOn = DateTime.UtcNow,
                UploadedBy = superAdminEmail,
                IsActive = true
            };

            _context.GlobalLibraryContents.Add(content);
            await _context.SaveChangesAsync();

            _logger.LogInformation("SuperAdmin {Email} uploaded video to global library: {Title}", superAdminEmail, content.Title);

            return Ok(new GlobalLibraryUploadResponse
            {
                Id = content.Id,
                VideoUrl = blobUrl,
                FileName = uniqueFileName,
                OriginalFileName = video.FileName,
                Size = video.Length,
                ContentType = video.ContentType,
                Message = "Video uploaded successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading video to global library");
            return StatusCode(500, new { message = "An error occurred while uploading the video" });
        }
    }

    /// <summary>
    /// Upload a PDF file to global library blob storage
    /// </summary>
    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("global-library/upload-pdf")]
    [RequestSizeLimit(104_857_600)] // 100 MB limit
    public async Task<ActionResult<GlobalLibraryUploadResponse>> UploadPdf([FromForm] IFormFile pdf, [FromForm] string title, [FromForm] string description, [FromForm] string tags)
    {
        try
        {
            var superAdminEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";

            if (pdf == null || pdf.Length == 0)
            {
                return BadRequest(new { message = "No PDF file provided" });
            }

            // Validate PDF file type
            var allowedExtensions = new[] { ".pdf" };
            var extension = Path.GetExtension(pdf.FileName).ToLower();
            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new { message = "Invalid file format. Only PDF files are allowed." });
            }

            // Additional MIME type validation
            if (pdf.ContentType != "application/pdf")
            {
                return BadRequest(new { message = "Invalid file type. Only PDF documents are allowed." });
            }

            if (!_blobService.IsConfigured())
            {
                return StatusCode(501, new { message = "Azure Blob Storage is not configured. Please configure it to upload files." });
            }

            // Generate unique filename
            var uniqueFileName = $"{Guid.NewGuid()}{extension}";

            // Upload to blob storage in global-library/pdf folder
            using var stream = pdf.OpenReadStream();
            var blobUrl = await _blobService.UploadToCustomPathAsync(
                stream,
                uniqueFileName,
                "global-library",
                pdf.ContentType,
                "pdf");

            // Create database record
            var content = new GlobalLibraryContent
            {
                Title = title,
                Description = description,
                ContentType = "pdf",
                AzureBlobPath = blobUrl,
                FileName = uniqueFileName,
                FileSizeBytes = pdf.Length,
                MimeType = pdf.ContentType,
                Tags = tags,
                UploadedOn = DateTime.UtcNow,
                UploadedBy = superAdminEmail,
                IsActive = true
            };

            _context.GlobalLibraryContents.Add(content);
            await _context.SaveChangesAsync();

            _logger.LogInformation("SuperAdmin {Email} uploaded PDF to global library: {Title}", superAdminEmail, content.Title);

            return Ok(new GlobalLibraryUploadResponse
            {
                Id = content.Id,
                DocumentUrl = blobUrl,
                FileName = uniqueFileName,
                OriginalFileName = pdf.FileName,
                Size = pdf.Length,
                ContentType = pdf.ContentType,
                Message = "PDF uploaded successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading PDF to global library");
            return StatusCode(500, new { message = "An error occurred while uploading the PDF" });
        }
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("global-library/upload-token")]
    public IActionResult GetGlobalLibraryUploadToken([FromQuery] string contentType, [FromQuery] string fileName)
    {
        if (contentType != "pdf" && contentType != "video")
            return BadRequest(new { error = "Content type must be 'pdf' or 'video'" });

        var connectionString = _configuration["AzureStorage:ConnectionString"];
        if (string.IsNullOrEmpty(connectionString))
            return BadRequest(new { error = "Azure Storage not configured" });

        var blobServiceClient = new BlobServiceClient(connectionString);
        var containerName = _configuration["AzureStorage:ContainerName"] ?? "lms-content";
        var containerClient = blobServiceClient.GetBlobContainerClient(containerName);

    // Generate blob path: global-library/pdf/guid.pdf or global-library/video/guid.mp4
    var extension = Path.GetExtension(fileName);
    var blobPath = $"global-library/{contentType}/{Guid.NewGuid()}{extension}";
        var blobClient = containerClient.GetBlobClient(blobPath);

        var sasBuilder = new BlobSasBuilder
        {
            BlobContainerName = containerName,
            BlobName = blobPath,
            Resource = "b",
            ExpiresOn = DateTimeOffset.UtcNow.AddHours(2)
        };
        sasBuilder.SetPermissions(BlobSasPermissions.Write | BlobSasPermissions.Create);

        var sasToken = blobClient.GenerateSasUri(sasBuilder);

        return Ok(new
        {
            uploadUrl = sasToken.ToString(),
            blobPath = blobPath,
            expiresAt = sasBuilder.ExpiresOn
        });
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("global-library")]
    public async Task<IActionResult> CreateGlobalLibraryContent([FromBody] GlobalLibraryContentRequest request)
    {
        var superAdminEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";

        var content = new GlobalLibraryContent
        {
            Title = request.Title,
            Description = request.Description,
            ContentType = request.ContentType,
            AzureBlobPath = request.BlobPath,
            FileName = request.FileName,
            FileSizeBytes = request.FileSizeBytes,
            MimeType = request.MimeType,
            Tags = request.Tags,
            UploadedOn = DateTime.UtcNow,
            UploadedBy = superAdminEmail,
            IsActive = true
        };

        _context.GlobalLibraryContents.Add(content);
        await _context.SaveChangesAsync();

        _logger.LogInformation("SuperAdmin {Email} uploaded global library content: {Title}", superAdminEmail, content.Title);

        return Ok(new { id = content.Id, message = "Content uploaded successfully" });
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpDelete("global-library/{id}")]
    public async Task<IActionResult> DeleteGlobalLibraryContent(long id)
    {
        var content = await _context.GlobalLibraryContents.FindAsync(id);
        if (content == null)
            return NotFound(new { error = "Content not found" });

        var superAdminEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";

        content.IsActive = false;
        content.UpdatedOn = DateTime.UtcNow;
        content.UpdatedBy = superAdminEmail;

        await _context.SaveChangesAsync();

        _logger.LogInformation("SuperAdmin {Email} deleted global library content: {Title}", superAdminEmail, content.Title);

        return Ok(new { message = "Content deleted successfully" });
    }

    // Helper method to generate JWT token
    private string GenerateJwtToken(ApplicationUser user, string role)
    {
        var jwtSection = _configuration.GetSection("Jwt");
        var key = Encoding.UTF8.GetBytes(jwtSection["Key"] ?? "dev-secret-change-me-please-0123456789");

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id),
            new Claim(ClaimTypes.Email, user.Email!),
            new Claim(ClaimTypes.Name, user.FirstName),
            new Claim(ClaimTypes.Role, role)
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddHours(8),
            Issuer = jwtSection["Issuer"],
            Audience = jwtSection["Audience"],
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature)
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}

// Additional DTO for global library upload
public class GlobalLibraryContentRequest
{
    [Required]
    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    [Required]
    public string ContentType { get; set; } = null!;

    [Required]
    public string BlobPath { get; set; } = null!;

    public string? FileName { get; set; }

    public long FileSizeBytes { get; set; }

    public string? MimeType { get; set; }

    public string? Tags { get; set; }
}

public class GlobalLibraryUploadResponse
{
    public long Id { get; set; }
    public string? VideoUrl { get; set; }
    public string? DocumentUrl { get; set; }
    public string FileName { get; set; } = null!;
    public string OriginalFileName { get; set; } = null!;
    public long Size { get; set; }
    public string ContentType { get; set; } = null!;
    public string Message { get; set; } = null!;
}
