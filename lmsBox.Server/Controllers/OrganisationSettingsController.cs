using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lmsbox.infrastructure.Data;
using lmsbox.domain.Models;
using System.Security.Claims;
using lmsBox.Server.Services;

namespace lmsBox.Server.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class OrganisationSettingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<OrganisationSettingsController> _logger;
    private readonly IAzureBlobService _blobService;

    public OrganisationSettingsController(
        ApplicationDbContext context,
        ILogger<OrganisationSettingsController> logger,
        IAzureBlobService blobService)
    {
        _context = context;
        _logger = logger;
        _blobService = blobService;
    }

    // GET: api/OrganisationSettings
    [HttpGet]
    public async Task<IActionResult> GetOrganisationSettings()
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var user = await _context.Users
                .Include(u => u.Organisation)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // OrgAdmin can only view their own organisation
            long orgId;
            var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
            
            if (roles.Contains("SuperAdmin"))
            {
                // SuperAdmin should not access this endpoint
                return Forbid();
            }
            else if (roles.Contains("OrgAdmin"))
            {
                if (!user.OrganisationID.HasValue)
                {
                    return BadRequest(new { message = "Organisation admin must belong to an organisation" });
                }
                orgId = user.OrganisationID.Value;
            }
            else
            {
                // Only OrgAdmin can access organisation settings
                return Forbid();
            }

            var organisation = await _context.Organisations
                .FirstOrDefaultAsync(o => o.Id == orgId);

            if (organisation == null)
            {
                return NotFound(new { message = "Organisation not found" });
            }

            var response = new
            {
                id = organisation.Id,
                name = organisation.Name,
                description = organisation.Description,
                brandName = organisation.BrandName,
                logoUrl = organisation.BannerUrl,
                faviconUrl = organisation.FaviconUrl,
                supportName = organisation.ManagerName,
                supportEmail = organisation.SupportEmail ?? organisation.ManagerEmail,
                supportPhone = organisation.ManagerPhone,
                domain = organisation.Domain,
                maxUsers = organisation.MaxUsers,
                allocatedStorageGB = organisation.AllocatedStorageGB,
                isActive = organisation.IsActive
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving organisation settings");
            return StatusCode(500, new { message = "An error occurred while retrieving organisation settings" });
        }
    }

    // PUT: api/OrganisationSettings
    [HttpPut]
    public async Task<IActionResult> UpdateOrganisationSettings([FromBody] UpdateOrganisationSettingsRequest request)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Only OrgAdmin can update organisation settings
            var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
            
            if (roles.Contains("SuperAdmin"))
            {
                return Forbid();
            }
            
            if (!roles.Contains("OrgAdmin"))
            {
                return Forbid();
            }

            if (!user.OrganisationID.HasValue)
            {
                return BadRequest(new { message = "Organisation admin must belong to an organisation" });
            }

            var organisation = await _context.Organisations
                .FirstOrDefaultAsync(o => o.Id == user.OrganisationID.Value);

            if (organisation == null)
            {
                return NotFound(new { message = "Organisation not found" });
            }

            // Update fields
            if (!string.IsNullOrWhiteSpace(request.Name))
            {
                organisation.Name = request.Name.Trim();
            }

            organisation.Description = request.Description?.Trim();
            organisation.BrandName = request.BrandName?.Trim();
            organisation.BannerUrl = request.LogoUrl?.Trim();
            organisation.ManagerName = request.SupportName?.Trim();
            organisation.SupportEmail = request.SupportEmail?.Trim();
            organisation.ManagerEmail = request.SupportEmail?.Trim();
            organisation.ManagerPhone = request.SupportPhone?.Trim();
            
            organisation.UpdatedOn = DateTime.UtcNow;
            organisation.UpdatedBy = userId;

            await _context.SaveChangesAsync();

            var response = new
            {
                id = organisation.Id,
                name = organisation.Name,
                description = organisation.Description,
                brandName = organisation.BrandName,
                logoUrl = organisation.BannerUrl,
                faviconUrl = organisation.FaviconUrl,
                supportName = organisation.ManagerName,
                supportEmail = organisation.SupportEmail,
                supportPhone = organisation.ManagerPhone,
                domain = organisation.Domain,
                maxUsers = organisation.MaxUsers,
                allocatedStorageGB = organisation.AllocatedStorageGB,
                isActive = organisation.IsActive
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating organisation settings");
            return StatusCode(500, new { message = "An error occurred while updating organisation settings" });
        }
    }

    // POST: api/OrganisationSettings/upload-banner
    [HttpPost("upload-banner")]
    [RequestSizeLimit(10_485_760)] // 10 MB limit
    public async Task<IActionResult> UploadBanner([FromForm] IFormFile image)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            // Only OrgAdmin can upload banner
            var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
            if (!roles.Contains("OrgAdmin"))
            {
                return Forbid();
            }

            if (!user.OrganisationID.HasValue)
            {
                return BadRequest(new { message = "Organisation admin must belong to an organisation" });
            }

            if (image == null || image.Length == 0)
            {
                return BadRequest(new { message = "No image file provided" });
            }

            // Validate image file type
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
            var extension = Path.GetExtension(image.FileName).ToLower();
            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new { message = $"Invalid image format. Allowed: {string.Join(", ", allowedExtensions)}" });
            }

            // Validate file size (max 10 MB)
            if (image.Length > 10_485_760)
            {
                return BadRequest(new { message = "Image file size must be less than 10 MB" });
            }

            if (!_blobService.IsConfigured())
            {
                return StatusCode(500, new { message = "File storage is not configured" });
            }

            // Get organisation details first
            var organisation = await _context.Organisations
                .FirstOrDefaultAsync(o => o.Id == user.OrganisationID.Value);

            if (organisation == null)
            {
                return NotFound(new { message = "Organisation not found" });
            }

            // Upload to Azure Blob Storage in lms-content-brandui container
            var companyName = organisation.Name.Replace(" ", "").ToLower();
            var bannerId = Guid.NewGuid();
            var fileName = $"banner_{bannerId}{extension}";
            var folderPath = $"{companyName}";

            string imageUrl;
            using (var stream = image.OpenReadStream())
            {
                imageUrl = await _blobService.UploadToBrandingContainerAsync(
                    stream, 
                    fileName, 
                    folderPath, 
                    image.ContentType,
                    organisation.Id
                );
            }

            organisation.BannerUrl = imageUrl;
            organisation.UpdatedOn = DateTime.UtcNow;
            organisation.UpdatedBy = userId;

            await _context.SaveChangesAsync();

            return Ok(new { url = imageUrl, message = "Banner uploaded successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading banner image");
            return StatusCode(500, new { message = "An error occurred while uploading the banner image" });
        }
    }
}

public class UpdateOrganisationSettingsRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? BrandName { get; set; }
    public string? LogoUrl { get; set; }
    public string? SupportName { get; set; }
    public string? SupportEmail { get; set; }
    public string? SupportPhone { get; set; }
}

