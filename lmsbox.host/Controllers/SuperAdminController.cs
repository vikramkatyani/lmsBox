using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.ComponentModel.DataAnnotations;
using System.IO.Compression;
using lmsbox.domain.Models;
using lmsbox.domain.Utils;
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

        // Verify user is SuperAdmin and has no organisation / tenant
        var roles = await _userManager.GetRolesAsync(user);
        if (!roles.Contains("SuperAdmin") || user.OrganisationID.HasValue || user.TenantId.HasValue)
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

    // ---------- Tenants ----------

    [Authorize(Roles = "SuperAdmin")]
    [HttpGet("tenants")]
    public async Task<IActionResult> GetTenants()
    {
        var tenants = await _context.Tenants
            .OrderBy(t => t.Name)
            .ToListAsync();

        var orgLookup = await _context.Organisations
            .Include(o => o.Users)
            .ToListAsync();

        var tenantAdminEmails = await GetTenantAdminEmailsAsync(tenants.Select(t => t.Id).ToList());

        var response = tenants.Select(t =>
            TenantProvisioningService.ToResponse(
                t,
                orgLookup.Where(o => o.TenantId == t.Id),
                tenantAdminEmails.GetValueOrDefault(t.Id)));

        return Ok(response);
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpGet("tenants/{id}")]
    public async Task<IActionResult> GetTenant(long id)
    {
        var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == id);
        if (tenant == null)
        {
            return NotFound(new { error = "Tenant not found" });
        }

        var orgs = await _context.Organisations
            .Include(o => o.Users)
            .Where(o => o.TenantId == id)
            .ToListAsync();

        var adminEmails = await GetTenantAdminEmailsAsync(new List<long> { id });
        return Ok(TenantProvisioningService.ToResponse(tenant, orgs, adminEmails.GetValueOrDefault(id)));
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("tenants")]
    public async Task<IActionResult> CreateTenant([FromBody] CreateTenantRequest request)
    {
        var superAdminEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";

        try
        {
            var (tenant, org, admin) = await TenantProvisioningService.CreateTenantWithPrimaryOrgAsync(
                _context, _userManager, request, superAdminEmail);

            _logger.LogInformation(
                "SuperAdmin {Email} created tenant {TenantName} (ID: {TenantId}) with primary org {OrgId} and TenantAdmin {AdminEmail}",
                superAdminEmail, tenant.Name, tenant.Id, org.Id, admin.Email);

            return CreatedAtAction(nameof(GetTenant), new { id = tenant.Id }, new
            {
                id = tenant.Id,
                name = tenant.Name,
                code = tenant.Code,
                primaryOrganisationId = org.Id,
                tenantAdminEmail = admin.Email
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpPut("tenants/{id}")]
    public async Task<IActionResult> UpdateTenant(long id, [FromBody] UpdateTenantRequest request)
    {
        if (id != request.Id)
        {
            return BadRequest(new { error = "ID mismatch" });
        }

        var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == id);
        if (tenant == null)
        {
            return NotFound(new { error = "Tenant not found" });
        }

        if (!string.Equals(tenant.Code, request.Code, StringComparison.OrdinalIgnoreCase)
            && await _context.Tenants.AnyAsync(t => t.Code == request.Code && t.Id != id))
        {
            return BadRequest(new { error = "Tenant code already in use" });
        }

        if (!request.AllowsMultipleOrganisations)
        {
            var orgCount = await _context.Organisations.CountAsync(o => o.TenantId == id);
            if (orgCount > 1)
            {
                return BadRequest(new { error = "Cannot disable multiple organisations while more than one organisation exists" });
            }
        }

        var superAdminEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";
        tenant.Name = request.Name;
        tenant.Code = request.Code;
        tenant.Description = request.Description;
        tenant.AllowsMultipleOrganisations = request.AllowsMultipleOrganisations;
        tenant.MaxUsers = request.MaxUsers;
        tenant.AllocatedStorageGB = request.AllocatedStorageGB;
        tenant.Domain = request.Domain;
        tenant.SupportEmail = request.SupportEmail;
        tenant.ManagerName = request.ManagerName;
        tenant.ManagerEmail = request.ManagerEmail;
        tenant.ManagerPhone = request.ManagerPhone;
        tenant.RenewalDate = request.RenewalDate;
        tenant.IsActive = request.IsActive;
        tenant.BrandName = request.BrandName;
        tenant.BannerUrl = request.BannerUrl;
        tenant.FaviconUrl = request.FaviconUrl;
        tenant.ThemeSettings = request.ThemeSettings;
        tenant.UpdatedOn = DateTime.UtcNow;
        tenant.UpdatedBy = superAdminEmail;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Tenant updated successfully" });
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpPut("tenants/{id}/branding")]
    public async Task<IActionResult> UpdateTenantBranding(long id, [FromBody] UpdateTenantBrandingRequest request)
    {
        var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == id);
        if (tenant == null)
        {
            return NotFound(new { error = "Tenant not found" });
        }

        var superAdminEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";
        tenant.BrandName = request.BrandName?.Trim();
        tenant.BannerUrl = request.BannerUrl?.Trim();
        tenant.FaviconUrl = request.FaviconUrl?.Trim();
        tenant.ThemeSettings = request.ThemeSettings;
        tenant.UpdatedOn = DateTime.UtcNow;
        tenant.UpdatedBy = superAdminEmail;

        await _context.SaveChangesAsync();
        return Ok(BrandingResolver.FromTenant(tenant));
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("tenants/{tenantId}/upload-asset")]
    [RequestSizeLimit(10_485_760)]
    public async Task<IActionResult> UploadTenantAsset(long tenantId, [FromForm] IFormFile file, [FromQuery] string assetType)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file provided" });
            }

            assetType = (assetType ?? "").ToLowerInvariant();
            if (assetType is not ("banner" or "favicon"))
            {
                return BadRequest(new { message = "assetType must be 'banner' or 'favicon'" });
            }

            var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId);
            if (tenant == null)
            {
                return NotFound(new { error = "Tenant not found" });
            }

            if (!_blobService.IsConfigured())
            {
                return StatusCode(500, new { message = "File storage is not configured" });
            }

            var folder = $"tenants/{tenant.Code}";
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            var fileName = $"{assetType}_{Guid.NewGuid():N}{extension}";

            string url;
            using (var stream = file.OpenReadStream())
            {
                url = await _blobService.UploadToBrandingContainerAsync(
                    stream,
                    fileName,
                    folder,
                    file.ContentType,
                    organisationId: null);
            }

            if (assetType == "banner")
            {
                tenant.BannerUrl = url;
            }
            else
            {
                tenant.FaviconUrl = url;
            }

            tenant.UpdatedOn = DateTime.UtcNow;
            tenant.UpdatedBy = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";
            await _context.SaveChangesAsync();

            return Ok(new { url, assetType });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading tenant branding asset");
            return StatusCode(500, new { message = "Upload failed" });
        }
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("tenants/{tenantId}/organisations")]
    public async Task<IActionResult> CreateOrganisationUnderTenant(long tenantId, [FromBody] CreateOrganisationRequest request)
    {
        var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId);
        if (tenant == null)
        {
            return NotFound(new { error = "Tenant not found" });
        }

        var orgCount = await _context.Organisations.CountAsync(o => o.TenantId == tenantId);
        if (!tenant.AllowsMultipleOrganisations && orgCount >= 1)
        {
            return BadRequest(new { error = "This tenant does not allow multiple organisations" });
        }

        request.TenantId = tenantId;
        return await CreateOrganisation(request);
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpGet("tenants/{tenantId}/organisations")]
    public async Task<IActionResult> GetTenantOrganisations(long tenantId)
    {
        if (!await _context.Tenants.AnyAsync(t => t.Id == tenantId))
        {
            return NotFound(new { error = "Tenant not found" });
        }

        var orgs = await _context.Organisations
            .Include(o => o.Users)
            .Include(o => o.Tenant)
            .Where(o => o.TenantId == tenantId)
            .ToListAsync();

        var response = orgs.Select(MapOrganisationResponse).ToList();
        return Ok(response);
    }

    // Get all organisations
    [Authorize(Roles = "SuperAdmin")]
    [HttpGet("organisations")]
    public async Task<IActionResult> GetOrganisations()
    {
        var orgs = await _context.Organisations
            .Include(o => o.Users)
            .Include(o => o.Tenant)
            .ToListAsync();

        var response = orgs.Select(MapOrganisationResponse).ToList();

        return Ok(response);
    }

    // Get organisation by ID
    [Authorize(Roles = "SuperAdmin")]
    [HttpGet("organisations/{id}")]
    public async Task<IActionResult> GetOrganisation(long id)
    {
        var org = await _context.Organisations
            .Include(o => o.Users)
            .Include(o => o.Tenant)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (org == null)
            return NotFound(new { error = "Organisation not found" });

        var response = MapOrganisationResponse(org);

        return Ok(response);
    }

    // Create new organisation (must belong to a tenant)
    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("organisations")]
    public async Task<IActionResult> CreateOrganisation([FromBody] CreateOrganisationRequest request)
    {
        if (!request.TenantId.HasValue)
        {
            return BadRequest(new { error = "TenantId is required. Create a tenant first, or POST /api/SuperAdmin/tenants/{tenantId}/organisations" });
        }

        var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == request.TenantId.Value);
        if (tenant == null)
        {
            return NotFound(new { error = "Tenant not found" });
        }

        var orgCount = await _context.Organisations.CountAsync(o => o.TenantId == tenant.Id);
        if (!tenant.AllowsMultipleOrganisations && orgCount >= 1)
        {
            return BadRequest(new { error = "This tenant does not allow multiple organisations" });
        }

        var superAdminEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";

        var organisation = new Organisation
        {
            TenantId = tenant.Id,
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
            UseTenantBranding = true,
            IsActive = true,
            CreatedOn = DateTime.UtcNow,
            CreatedBy = superAdminEmail
        };

        _context.Organisations.Add(organisation);
        await _context.SaveChangesAsync();

        _logger.LogInformation("SuperAdmin {Email} created organisation {OrgName} (ID: {OrgId}) under tenant {TenantId}", 
            superAdminEmail, organisation.Name, organisation.Id, tenant.Id);

        return CreatedAtAction(nameof(GetOrganisation), new { id = organisation.Id }, 
            new { id = organisation.Id, name = organisation.Name, tenantId = tenant.Id });
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
        organisation.UseTenantBranding = request.UseTenantBranding;
        organisation.BrandName = request.BrandName;
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
            TenantId = organisation.TenantId,
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

        if (FavoriteReportDefaults.TryApplyDefaults(admin, "OrgAdmin"))
        {
            await _userManager.UpdateAsync(admin);
        }

        _logger.LogInformation("SuperAdmin {SuperAdmin} created OrgAdmin {AdminEmail} for organisation {OrgName}", 
            superAdminEmail, admin.Email, organisation.Name);

        return Ok(new { message = "Organisation admin created successfully", email = admin.Email });
    }

    // Upload banner or favicon for organisation (server-side with storage tracking)
    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("organisations/{orgId}/upload-asset")]
    [RequestSizeLimit(10_485_760)] // 10 MB limit
    public async Task<IActionResult> UploadOrganisationAsset(long orgId, [FromForm] IFormFile file, [FromQuery] string assetType)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file provided" });
            }

            if (assetType != "banner" && assetType != "favicon")
            {
                return BadRequest(new { message = "Asset type must be 'banner' or 'favicon'" });
            }

            // Validate file type
            var allowedExtensions = assetType == "banner"
                ? new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" }
                : new[] { ".ico", ".png" };
            var extension = Path.GetExtension(file.FileName).ToLower();
            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new { message = $"Invalid file type. Allowed: {string.Join(", ", allowedExtensions)}" });
            }

            // Validate file size (max 10 MB)
            if (file.Length > 10_485_760)
            {
                return BadRequest(new { message = "File size must be less than 10 MB" });
            }

            if (!_blobService.IsConfigured())
            {
                return StatusCode(500, new { message = "File storage is not configured" });
            }

            // Get organisation
            var organisation = await _context.Organisations.FindAsync(orgId);
            if (organisation == null)
            {
                return NotFound(new { message = "Organisation not found" });
            }

            // Upload to branding container with storage tracking
            var assetId = Guid.NewGuid();
            var fileName = $"{assetType}_{assetId}{extension}";
            var companyName = organisation.Name.Replace(" ", "").ToLower();
            var folderPath = $"{companyName}";

            string assetUrl;
            using (var stream = file.OpenReadStream())
            {
                try
                {
                    assetUrl = await _blobService.UploadToBrandingContainerAsync(
                        stream,
                        fileName,
                        folderPath,
                        file.ContentType,
                        organisation.Id
                    );
                }
                catch (InvalidOperationException ex) when (ex.Message.Contains("Storage quota exceeded"))
                {
                    _logger.LogWarning("Storage quota exceeded for organisation {OrgId}", organisation.Id);
                    return BadRequest(new { message = ex.Message });
                }
            }

            _logger.LogInformation("SuperAdmin uploaded {AssetType} for organisation {OrgId}", assetType, organisation.Id);

            return Ok(new { url = assetUrl, message = $"{assetType} uploaded successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading organisation asset for org {OrgId}", orgId);
            return StatusCode(500, new { message = "An error occurred while uploading the file" });
        }
    }

    // Global Library Content Management

    [Authorize(Roles = "SuperAdmin")]
    [HttpGet("global-library")]
    public async Task<IActionResult> GetGlobalLibrary(
        [FromQuery] string? contentType,
        [FromQuery] string? search,
        [FromQuery] string? category,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var query = _context.GlobalLibraryContents.Where(c => c.IsActive);

        // Filter by content type
        if (!string.IsNullOrEmpty(contentType))
        {
            query = query.Where(c => c.ContentType == contentType);
        }

        // Filter by category
        if (!string.IsNullOrEmpty(category))
        {
            query = query.Where(c => c.Category != null && c.Category.ToLower() == category.ToLower());
        }

        // Search across multiple fields
        if (!string.IsNullOrEmpty(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(c => 
                (c.Title != null && c.Title.ToLower().Contains(searchLower)) ||
                (c.Description != null && c.Description.ToLower().Contains(searchLower)) ||
                (c.Code != null && c.Code.ToLower().Contains(searchLower)) ||
                (c.Tags != null && c.Tags.ToLower().Contains(searchLower))
            );
        }

        // Get total count before pagination
        var totalCount = await query.CountAsync();

        // Apply pagination
        var contents = await query
            .OrderByDescending(c => c.UploadedOn)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new GlobalLibraryContentResponse
            {
                Id = c.Id,
                Title = c.Title,
                Description = c.Description,
                Code = c.Code,
                ContentType = c.ContentType,
                AzureBlobPath = c.AzureBlobPath,
                FileName = c.FileName,
                FileSizeBytes = c.FileSizeBytes,
                MimeType = c.MimeType,
                UploadedOn = c.UploadedOn,
                UploadedBy = c.UploadedBy,
                IsActive = c.IsActive,
                Category = c.Category,
                Tags = c.Tags,
                ThumbnailUrl = c.ThumbnailUrl
            })
            .ToListAsync();

        return Ok(new
        {
            items = contents,
            totalCount = totalCount,
            page = page,
            pageSize = pageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpGet("global-library/categories")]
    public async Task<IActionResult> GetGlobalLibraryCategories()
    {
        var categories = await _context.GlobalLibraryContents
            .Where(c => c.IsActive && !string.IsNullOrEmpty(c.Category))
            .Select(c => c.Category)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();

        return Ok(categories);
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpGet("global-library/{id}")]
    public async Task<IActionResult> GetGlobalLibraryContent(long id)
    {
        var content = await _context.GlobalLibraryContents
            .Where(c => c.Id == id && c.IsActive)
            .Select(c => new GlobalLibraryContentResponse
            {
                Id = c.Id,
                Title = c.Title,
                Description = c.Description,
                Code = c.Code,
                ContentType = c.ContentType,
                AzureBlobPath = c.AzureBlobPath,
                FileName = c.FileName,
                FileSizeBytes = c.FileSizeBytes,
                MimeType = c.MimeType,
                UploadedOn = c.UploadedOn,
                UploadedBy = c.UploadedBy,
                IsActive = c.IsActive,
                Category = c.Category,
                Tags = c.Tags,
                DurationSeconds = c.DurationSeconds,
                ThumbnailUrl = c.ThumbnailUrl
            })
            .FirstOrDefaultAsync();

        if (content == null)
            return NotFound(new { error = "Content not found" });

        return Ok(content);
    }

    [Authorize(Roles = "SuperAdmin")]
    [HttpPut("global-library/{id}")]
    public async Task<IActionResult> UpdateGlobalLibraryContent(
        long id,
        [FromForm] string title,
        [FromForm] string? description,
        [FromForm] string code,
        [FromForm] string? category,
        [FromForm] string? tags,
        [FromForm] IFormFile? thumbnail)
    {
        var content = await _context.GlobalLibraryContents.FindAsync(id);
        if (content == null || !content.IsActive)
            return NotFound(new { error = "Content not found" });

        var superAdminEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";

        // Update editable fields
        content.Title = title;
        content.Description = description;
        content.Code = code;
        content.Category = category;
        content.Tags = tags;
        content.UpdatedOn = DateTime.UtcNow;
        content.UpdatedBy = superAdminEmail;

        // Handle thumbnail upload if provided
        if (thumbnail != null && thumbnail.Length > 0)
        {
            if (_blobService.IsConfigured())
            {
                // Upload new thumbnail
                var thumbnailExtension = Path.GetExtension(thumbnail.FileName).ToLower();
                var thumbnailFileName = $"{Guid.NewGuid()}{thumbnailExtension}";
                
                using var thumbnailStream = thumbnail.OpenReadStream();
                var thumbnailUrl = await _blobService.UploadToCustomPathAsync(
                    thumbnailStream,
                    thumbnailFileName,
                    "global-library",
                    thumbnail.ContentType,
                    "thumbnails");

                content.ThumbnailUrl = thumbnailUrl;
                _logger.LogInformation("Updated thumbnail for content {Id}", id);
            }
            else
            {
                _logger.LogWarning("Azure Blob Storage not configured, skipping thumbnail upload");
            }
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("SuperAdmin {Email} updated global library content: {Title}", superAdminEmail, content.Title);

        return Ok(new { message = "Content updated successfully", thumbnailUrl = content.ThumbnailUrl });
    }

    /// <summary>
    /// Upload a video file to global library blob storage
    /// </summary>
    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("global-library/upload-video")]
    [RequestSizeLimit(524_288_000)] // 500 MB limit
    public async Task<ActionResult<GlobalLibraryUploadResponse>> UploadVideo(
        [FromForm] IFormFile video, 
        [FromForm] string title, 
        [FromForm] string description, 
        [FromForm] string code,
        [FromForm] string? category, 
        [FromForm] string tags,
        [FromForm] int? durationSeconds,
        [FromForm] IFormFile? thumbnail)
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

            // Upload thumbnail if provided
            string? thumbnailUrl = null;
            if (thumbnail != null && thumbnail.Length > 0)
            {
                var thumbnailExtension = Path.GetExtension(thumbnail.FileName).ToLower();
                var thumbnailFileName = $"{Guid.NewGuid()}{thumbnailExtension}";
                
                using var thumbnailStream = thumbnail.OpenReadStream();
                thumbnailUrl = await _blobService.UploadToCustomPathAsync(
                    thumbnailStream,
                    thumbnailFileName,
                    "global-library",
                    thumbnail.ContentType,
                    "thumbnails");
            }

            // Create database record
            var content = new GlobalLibraryContent
            {
                Title = title,
                Description = description,
                Code = code,
                ContentType = "video",
                AzureBlobPath = blobUrl,
                FileName = uniqueFileName,
                FileSizeBytes = video.Length,
                MimeType = video.ContentType,
                Category = category,
                Tags = tags,
                DurationSeconds = durationSeconds,
                ThumbnailUrl = thumbnailUrl,
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
                ThumbnailUrl = thumbnailUrl,
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
    public async Task<ActionResult<GlobalLibraryUploadResponse>> UploadPdf(
        [FromForm] IFormFile pdf, 
        [FromForm] string title, 
        [FromForm] string description, 
        [FromForm] string code,
        [FromForm] string? category, 
        [FromForm] string tags,
        [FromForm] IFormFile? thumbnail)
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

            // Upload thumbnail if provided
            string? thumbnailUrl = null;
            if (thumbnail != null && thumbnail.Length > 0)
            {
                var thumbnailExtension = Path.GetExtension(thumbnail.FileName).ToLower();
                var thumbnailFileName = $"{Guid.NewGuid()}{thumbnailExtension}";
                
                using var thumbnailStream = thumbnail.OpenReadStream();
                thumbnailUrl = await _blobService.UploadToCustomPathAsync(
                    thumbnailStream,
                    thumbnailFileName,
                    "global-library",
                    thumbnail.ContentType,
                    "thumbnails");
            }

            // Create database record
            var content = new GlobalLibraryContent
            {
                Title = title,
                Description = description,
                Code = code,
                ContentType = "pdf",
                AzureBlobPath = blobUrl,
                FileName = uniqueFileName,
                FileSizeBytes = pdf.Length,
                MimeType = pdf.ContentType,
                Category = category,
                Tags = tags,
                ThumbnailUrl = thumbnailUrl,
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
                ThumbnailUrl = thumbnailUrl,
                Message = "PDF uploaded successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading PDF to global library");
            return StatusCode(500, new { message = "An error occurred while uploading the PDF" });
        }
    }

    /// <summary>
    /// Upload a SCORM package to global library blob storage
    /// </summary>
    [Authorize(Roles = "SuperAdmin")]
    [HttpPost("global-library/upload-scorm")]
    [RequestSizeLimit(524_288_000)] // 500 MB limit
    public async Task<ActionResult<GlobalLibraryUploadResponse>> UploadScorm(
        [FromForm] IFormFile scormPackage, 
        [FromForm] string title, 
        [FromForm] string description, 
        [FromForm] string code,
        [FromForm] string? category, 
        [FromForm] string tags,
        [FromForm] IFormFile? thumbnail)
    {
        try
        {
            var superAdminEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";

            if (scormPackage == null || scormPackage.Length == 0)
            {
                return BadRequest(new { message = "No SCORM package file provided" });
            }

            // Validate SCORM file type (must be .zip)
            var extension = Path.GetExtension(scormPackage.FileName).ToLower();
            if (extension != ".zip")
            {
                return BadRequest(new { message = "Invalid file format. SCORM packages must be ZIP files." });
            }

            if (!_blobService.IsConfigured())
            {
                return StatusCode(501, new { message = "Azure Blob Storage is not configured. Please configure it to upload files." });
            }

            _logger.LogInformation("Uploading SCORM package to global library: {FileName}", scormPackage.FileName);

            // For global library, we need to manually handle the upload since UploadScormPackageAsync
            // is designed for organization-specific paths (organisations/{orgId}/scorm/)
            // We need: global-library/scorm/{packageName}/
            
            using var stream = scormPackage.OpenReadStream();
            
            // Create a temporary directory to extract the zip
            var tempPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
            Directory.CreateDirectory(tempPath);

            try
            {
                // Save zip to temp file
                var tempZipPath = Path.Combine(tempPath, scormPackage.FileName);
                using (var fileStream = System.IO.File.Create(tempZipPath))
                {
                    await stream.CopyToAsync(fileStream);
                }

                // Extract the zip file
                System.IO.Compression.ZipFile.ExtractToDirectory(tempZipPath, tempPath);

                // Find and validate imsmanifest.xml
                var manifestFiles = Directory.GetFiles(tempPath, "imsmanifest.xml", SearchOption.AllDirectories);
                var manifestPath = manifestFiles.FirstOrDefault();
                
                if (manifestPath == null)
                {
                    throw new InvalidOperationException("Invalid SCORM package: imsmanifest.xml not found");
                }

                // Use provided code for folder naming
                var sanitizedCode = code.Replace(" ", "-").Replace(".", "-").ToLowerInvariant();
                var scormFolder = $"global-library/scorm/{sanitizedCode}";

                // Upload all files from the extracted directory
                var manifestDirectory = Path.GetDirectoryName(manifestPath)!;
                var files = Directory.GetFiles(manifestDirectory, "*", SearchOption.AllDirectories);
                long totalSize = 0;
                int fileCount = 0;

                foreach (var file in files)
                {
                    var relativePath = Path.GetRelativePath(manifestDirectory, file);
                    var blobPath = $"{scormFolder}/{relativePath.Replace("\\", "/")}";
                    
                    using var fileStreamToUpload = System.IO.File.OpenRead(file);
                    var contentType = GetContentType(file);
                    await _blobService.UploadToCustomPathAsync(fileStreamToUpload, Path.GetFileName(file), scormFolder, contentType, Path.GetDirectoryName(relativePath)?.Replace("\\", "/"));
                    
                    var fileInfo = new FileInfo(file);
                    totalSize += fileInfo.Length;
                    fileCount++;
                }

                // Parse manifest to get launch file (simplified - just get href from first resource)
                var manifestContent = await System.IO.File.ReadAllTextAsync(manifestPath);
                var launchFile = "index.html"; // Default fallback
                
                if (manifestContent.Contains("href=\""))
                {
                    var hrefMatch = System.Text.RegularExpressions.Regex.Match(manifestContent, @"href=""([^""]+)""");
                    if (hrefMatch.Success)
                    {
                        launchFile = hrefMatch.Groups[1].Value;
                    }
                }

                // Construct URLs
                var connectionString = _configuration["AzureStorage:ConnectionString"];
                var blobServiceClient = new Azure.Storage.Blobs.BlobServiceClient(connectionString);
                var containerName = _configuration["AzureStorage:ContainerName"] ?? "lmscontent";
                var containerClient = blobServiceClient.GetBlobContainerClient(containerName);
                var baseUrl = $"{containerClient.Uri}/{scormFolder}";
                var launchUrl = $"{baseUrl}/{launchFile.Replace("\\", "/")}";

                // Upload thumbnail if provided
                string? thumbnailUrl = null;
                if (thumbnail != null && thumbnail.Length > 0)
                {
                    var thumbnailExtension = Path.GetExtension(thumbnail.FileName).ToLower();
                    var thumbnailFileName = $"{Guid.NewGuid()}{thumbnailExtension}";
                    
                    using var thumbnailStream = thumbnail.OpenReadStream();
                    thumbnailUrl = await _blobService.UploadToCustomPathAsync(
                        thumbnailStream,
                        thumbnailFileName,
                        "global-library",
                        thumbnail.ContentType,
                        "thumbnails");
                }

                // Create database record
                var content = new GlobalLibraryContent
                {
                    Title = title,
                    Description = description,
                    Code = code,
                    ContentType = "scorm",
                    AzureBlobPath = launchUrl,
                    FileName = sanitizedCode,
                    FileSizeBytes = totalSize,
                    MimeType = "application/zip",
                    Category = category,
                    Tags = tags,
                    ThumbnailUrl = thumbnailUrl,
                    UploadedOn = DateTime.UtcNow,
                    UploadedBy = superAdminEmail,
                    IsActive = true
                };

                _context.GlobalLibraryContents.Add(content);
                await _context.SaveChangesAsync();

                _logger.LogInformation("SuperAdmin {Email} uploaded SCORM package to global library: {Title}, Files: {FileCount}", 
                    superAdminEmail, content.Title, fileCount);

                return Ok(new GlobalLibraryUploadResponse
                {
                    Id = content.Id,
                    ScormUrl = launchUrl,
                    FileName = sanitizedCode,
                    OriginalFileName = scormPackage.FileName,
                    Size = totalSize,
                    ContentType = "application/zip",
                    ThumbnailUrl = thumbnailUrl,
                    Message = $"SCORM package uploaded successfully ({fileCount} files)"
                });
            }
            finally
            {
                // Clean up temp directory
                if (Directory.Exists(tempPath))
                {
                    Directory.Delete(tempPath, true);
                }
            }
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Invalid SCORM package uploaded to global library");
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading SCORM package to global library");
            return StatusCode(500, new { message = "An error occurred while uploading the SCORM package" });
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
        return JwtTokenHelper.CreateToken(_configuration, user, new[] { role });
    }

    private static OrganisationResponse MapOrganisationResponse(Organisation o)
    {
        var effective = BrandingResolver.Resolve(o, o.Tenant);
        return new OrganisationResponse
        {
            Id = o.Id,
            TenantId = o.TenantId,
            Name = o.Name,
            Description = o.Description,
            MaxUsers = o.MaxUsers,
            AllocatedStorageGB = o.AllocatedStorageGB,
            Domain = o.Domain,
            BannerUrl = o.BannerUrl,
            FaviconUrl = o.FaviconUrl,
            ThemeSettings = o.ThemeSettings,
            BrandName = o.BrandName,
            UseTenantBranding = o.UseTenantBranding,
            EffectiveBrandName = effective.BrandName,
            EffectiveBannerUrl = effective.BannerUrl,
            EffectiveFaviconUrl = effective.FaviconUrl,
            EffectiveThemeSettings = effective.ThemeSettings,
            SupportEmail = o.SupportEmail,
            ManagerName = o.ManagerName,
            ManagerEmail = o.ManagerEmail,
            ManagerPhone = o.ManagerPhone,
            RenewalDate = o.RenewalDate,
            IsActive = o.IsActive,
            CreatedOn = o.CreatedOn,
            TotalUsers = o.Users?.Count ?? 0,
            AdminEmail = o.Users?.FirstOrDefault()?.Email
        };
    }

    private async Task<Dictionary<long, string?>> GetTenantAdminEmailsAsync(List<long> tenantIds)
    {
        var result = tenantIds.ToDictionary(id => id, _ => (string?)null);
        if (tenantIds.Count == 0)
        {
            return result;
        }

        var users = await _context.Users
            .Where(u => u.TenantId.HasValue && tenantIds.Contains(u.TenantId.Value))
            .ToListAsync();

        foreach (var group in users.GroupBy(u => u.TenantId!.Value))
        {
            foreach (var user in group)
            {
                if (await _userManager.IsInRoleAsync(user, "TenantAdmin"))
                {
                    result[group.Key] = user.Email;
                    break;
                }
            }
        }

        return result;
    }

    private string GetContentType(string filePath)
    {
        var extension = Path.GetExtension(filePath).ToLowerInvariant();
        return extension switch
        {
            ".html" or ".htm" => "text/html",
            ".css" => "text/css",
            ".js" => "application/javascript",
            ".json" => "application/json",
            ".xml" => "application/xml",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".svg" => "image/svg+xml",
            ".pdf" => "application/pdf",
            ".mp4" => "video/mp4",
            ".webm" => "video/webm",
            ".zip" => "application/zip",
            _ => "application/octet-stream"
        };
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
    public string? ScormUrl { get; set; }
    public string FileName { get; set; } = null!;
    public string OriginalFileName { get; set; } = null!;
    public long Size { get; set; }
    public string ContentType { get; set; } = null!;
    public string? ThumbnailUrl { get; set; }
    public string Message { get; set; } = null!;
}
