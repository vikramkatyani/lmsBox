using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using lmsbox.domain.Models;
using lmsbox.domain.Utils;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/tenant")]
[Authorize(Roles = "TenantAdmin,SuperAdmin")]
public class TenantAdminController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<TenantAdminController> _logger;
    private readonly TenantBrandingAssetService _brandingAssets;

    public TenantAdminController(
        ApplicationDbContext context,
        UserManager<ApplicationUser> userManager,
        ILogger<TenantAdminController> logger,
        TenantBrandingAssetService brandingAssets)
    {
        _context = context;
        _userManager = userManager;
        _logger = logger;
        _brandingAssets = brandingAssets;
    }

    private async Task<(AccessScope Scope, Tenant? Tenant, IActionResult? Error)> ResolveTenantContextAsync(long? tenantIdFromRoute = null)
    {
        var scope = await AccessScope.ResolveAsync(User, _context);
        if (scope.IsSuperAdmin)
        {
            if (!tenantIdFromRoute.HasValue)
            {
                return (scope, null, BadRequest(new { error = "Tenant id required for SuperAdmin" }));
            }

            var tenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == tenantIdFromRoute.Value);
            if (tenant == null)
            {
                return (scope, null, NotFound(new { error = "Tenant not found" }));
            }

            return (scope, tenant, null);
        }

        if (!scope.TenantId.HasValue)
        {
            return (scope, null, Forbid());
        }

        var ownTenant = await _context.Tenants.FirstOrDefaultAsync(t => t.Id == scope.TenantId.Value);
        if (ownTenant == null)
        {
            return (scope, null, NotFound(new { error = "Tenant not found" }));
        }

        if (tenantIdFromRoute.HasValue && tenantIdFromRoute.Value != ownTenant.Id)
        {
            return (scope, null, Forbid());
        }

        return (scope, ownTenant, null);
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMyTenant()
    {
        var (scope, tenant, error) = await ResolveTenantContextAsync();
        if (error != null)
        {
            // SuperAdmin calling /me without route — return all not applicable
            if (scope.IsSuperAdmin)
            {
                return BadRequest(new { error = "Use SuperAdmin tenant endpoints" });
            }

            return error;
        }

        var orgs = await _context.Organisations
            .Include(o => o.Users)
            .Where(o => o.TenantId == tenant!.Id)
            .ToListAsync();

        var adminEmail = await GetTenantAdminEmailAsync(tenant.Id);
        return Ok(TenantProvisioningService.ToResponse(tenant, orgs, adminEmail));
    }

    [HttpGet("branding")]
    public async Task<IActionResult> GetBranding()
    {
        var (_, tenant, error) = await ResolveTenantContextAsync();
        if (error != null) return error;
        return Ok(BrandingResolver.FromTenant(tenant!));
    }

    [HttpPut("branding")]
    public async Task<IActionResult> UpdateBranding([FromBody] UpdateTenantBrandingRequest request)
    {
        var (_, tenant, error) = await ResolveTenantContextAsync();
        if (error != null) return error;

        var actor = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";
        TenantThemeHelper.ApplyStructuredFields(tenant!, request);
        tenant!.UpdatedOn = DateTime.UtcNow;
        tenant.UpdatedBy = actor;
        await _context.SaveChangesAsync();

        return Ok(BrandingResolver.FromTenant(tenant));
    }

    [HttpPost("branding/upload-asset")]
    [RequestSizeLimit(10_485_760)]
    public async Task<IActionResult> UploadBrandingAsset([FromForm] IFormFile file, [FromQuery] string assetType)
    {
        var (_, tenant, error) = await ResolveTenantContextAsync();
        if (error != null) return error;

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "No file provided" });
        }

        try
        {
            var normalizedType = TenantBrandingAssetService.NormalizeAssetType(assetType);
            var url = await _brandingAssets.SaveAsync(tenant!, file, normalizedType);
            tenant!.UpdatedOn = DateTime.UtcNow;
            tenant.UpdatedBy = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";
            await _context.SaveChangesAsync();

            return Ok(new
            {
                url,
                assetType = normalizedType,
                bannerUrl = tenant.BannerUrl,
                faviconUrl = tenant.FaviconUrl,
                loginHeroUrl = tenant.LoginHeroUrl,
                branding = BrandingResolver.FromTenant(tenant)
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading tenant branding asset");
            return StatusCode(500, new { message = "Upload failed" });
        }
    }

    [HttpGet("organisations")]
    public async Task<IActionResult> GetOrganisations()
    {
        var (_, tenant, error) = await ResolveTenantContextAsync();
        if (error != null) return error;

        var orgs = await _context.Organisations
            .Include(o => o.Users)
            .Where(o => o.TenantId == tenant!.Id)
            .OrderBy(o => o.Name)
            .ToListAsync();

        var response = orgs.Select(o =>
        {
            var effective = BrandingResolver.Resolve(o, tenant);
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
                TotalUsers = o.Users.Count,
                AdminEmail = o.Users.FirstOrDefault(u => u.Email != null)?.Email
            };
        });

        return Ok(response);
    }

    [HttpPost("organisations")]
    public async Task<IActionResult> CreateOrganisation([FromBody] CreateTenantOrganisationRequest request)
    {
        var (_, tenant, error) = await ResolveTenantContextAsync();
        if (error != null) return error;

        var orgCount = await _context.Organisations.CountAsync(o => o.TenantId == tenant!.Id);
        if (!tenant!.AllowsMultipleOrganisations && orgCount >= 1)
        {
            return BadRequest(new { error = "This tenant does not allow multiple organisations" });
        }

        var actor = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";
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
            CreatedBy = actor
        };

        _context.Organisations.Add(organisation);
        await _context.SaveChangesAsync();

        _logger.LogInformation("TenantAdmin created organisation {OrgName} under tenant {TenantId}", organisation.Name, tenant.Id);

        return CreatedAtAction(nameof(GetOrganisations), new { id = organisation.Id },
            new { id = organisation.Id, name = organisation.Name, tenantId = tenant.Id });
    }

    [HttpPut("organisations/{id}")]
    public async Task<IActionResult> UpdateOrganisation(long id, [FromBody] UpdateOrganisationRequest request)
    {
        var (_, tenant, error) = await ResolveTenantContextAsync();
        if (error != null) return error;

        if (id != request.Id)
        {
            return BadRequest(new { error = "ID mismatch" });
        }

        var organisation = await _context.Organisations.FirstOrDefaultAsync(o => o.Id == id && o.TenantId == tenant!.Id);
        if (organisation == null)
        {
            return NotFound(new { error = "Organisation not found" });
        }

        var actor = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";
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
        organisation.UpdatedBy = actor;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Organisation updated successfully" });
    }

    [HttpPost("organisations/{orgId}/admin")]
    public async Task<IActionResult> CreateOrgAdmin(long orgId, [FromBody] CreateOrgAdminRequest request)
    {
        var (_, tenant, error) = await ResolveTenantContextAsync();
        if (error != null) return error;

        if (orgId != request.OrganisationId)
        {
            return BadRequest(new { error = "Organisation ID mismatch" });
        }

        var organisation = await _context.Organisations.FirstOrDefaultAsync(o => o.Id == orgId && o.TenantId == tenant!.Id);
        if (organisation == null)
        {
            return NotFound(new { error = "Organisation not found" });
        }

        var existingUser = await _context.Users.FirstOrDefaultAsync(u =>
            u.NormalizedEmail == _userManager.NormalizeEmail(request.Email) && u.TenantId == tenant.Id);
        if (existingUser != null)
        {
            return BadRequest(new { error = "Email already exists in this tenant" });
        }

        var actor = User.FindFirst(ClaimTypes.Email)?.Value ?? "system";
        var admin = new ApplicationUser
        {
            UserName = TenantIdentity.BuildUserName(tenant!.Id, request.Email),
            Email = request.Email,
            EmailConfirmed = true,
            FirstName = request.FirstName,
            LastName = request.LastName,
            TenantId = tenant!.Id,
            OrganisationID = orgId,
            CreatedBy = actor,
            ActivatedBy = actor,
            DeactivatedBy = actor,
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

        _logger.LogInformation("TenantAdmin created OrgAdmin {Email} for org {OrgId}", admin.Email, orgId);
        return Ok(new { message = "Organisation admin created successfully", email = admin.Email });
    }

    private async Task<string?> GetTenantAdminEmailAsync(long tenantId)
    {
        var users = await _context.Users
            .Where(u => u.TenantId == tenantId)
            .ToListAsync();

        foreach (var user in users)
        {
            if (await _userManager.IsInRoleAsync(user, "TenantAdmin"))
            {
                return user.Email;
            }
        }

        return null;
    }
}
