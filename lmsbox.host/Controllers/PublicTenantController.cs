using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using lmsBox.Server.Services;

namespace lmsBox.Server.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/public")]
public class PublicTenantController : ControllerBase
{
    private readonly TenantResolver _tenantResolver;

    public PublicTenantController(TenantResolver tenantResolver)
    {
        _tenantResolver = tenantResolver;
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
