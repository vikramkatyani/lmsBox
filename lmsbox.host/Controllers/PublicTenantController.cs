using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;

namespace lmsBox.Server.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/public")]
public class PublicTenantController : ControllerBase
{
    private readonly TenantResolver _tenantResolver;
    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public PublicTenantController(
        TenantResolver tenantResolver,
        ApplicationDbContext db,
        UserManager<ApplicationUser> userManager)
    {
        _tenantResolver = tenantResolver;
        _db = db;
        _userManager = userManager;
    }

    [HttpGet("tenants/{code}/seed-status")]
    public async Task<IActionResult> GetSeedStatus(string code)
    {
        var tenant = await _tenantResolver.ResolveByCodeAsync(code);
        if (tenant == null)
        {
            return Ok(new { tenant = false, organisation = false, tenantAdminCount = 0 });
        }

        var hasOrg = await _db.Organisations.AnyAsync(o => o.TenantId == tenant.Id);
        var users = await _db.Users.Where(u => u.TenantId == tenant.Id).ToListAsync();
        var adminCount = 0;
        foreach (var user in users)
        {
            if (await _userManager.IsInRoleAsync(user, "TenantAdmin"))
            {
                adminCount++;
            }
        }

        return Ok(new { tenant = true, organisation = hasOrg, tenantAdminCount = adminCount });
    }

    [HttpGet("tenants/{code}/branding")]
    public async Task<IActionResult> GetBrandingByCode(string code)
    {
        var tenant = await _tenantResolver.ResolveByCodeAsync(code);
        if (tenant == null)
        {
            return NotFound(new { error = "Tenant not found" });
        }

        return Ok(TenantThemeHelper.ToPublic(tenant));
    }

    [HttpGet("branding")]
    public async Task<IActionResult> GetBranding([FromQuery] string? tenantCode)
    {
        var headerCode = Request.Headers["X-Tenant-Code"].FirstOrDefault();
        var tenant = await _tenantResolver.ResolveAsync(
            tenantCode ?? headerCode,
            Request.Host.Value);

        return Ok(TenantThemeHelper.ToPublic(tenant));
    }
}
