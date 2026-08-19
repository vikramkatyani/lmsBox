using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Services;

public static class TenantPortalUrl
{
    public static string TenantLoginPath(string tenantCode) => $"/t/{Uri.EscapeDataString(tenantCode)}/login";

    public static string TenantVerifyPath(string tenantCode) => $"/t/{Uri.EscapeDataString(tenantCode)}/verify-login";

    public static string BuildLoginUrl(string frontendBase, string? tenantCode)
    {
        var baseUrl = frontendBase.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(tenantCode))
        {
            return $"{baseUrl}/login";
        }

        return $"{baseUrl}{TenantLoginPath(tenantCode)}";
    }

    public static string BuildVerifyUrl(string frontendBase, string tenantCode, string encodedToken)
    {
        return $"{frontendBase.TrimEnd('/')}{TenantVerifyPath(tenantCode)}?token={encodedToken}";
    }

    public static string ResolveFrontendBase(IConfiguration config, HttpRequest? request)
    {
        var frontendBase = config["LoginLink:FrontendBaseUrl"] ?? config["AppSettings:BaseUrl"];
        if (!string.IsNullOrWhiteSpace(frontendBase))
        {
            return frontendBase.TrimEnd('/');
        }

        if (request != null)
        {
            return $"{request.Scheme}://{request.Host}";
        }

        return "http://localhost:5174";
    }

    public static async Task<string?> GetTenantCodeAsync(ApplicationDbContext db, long? tenantId)
    {
        if (!tenantId.HasValue)
        {
            return null;
        }

        return await db.Tenants
            .AsNoTracking()
            .Where(t => t.Id == tenantId.Value)
            .Select(t => t.Code)
            .FirstOrDefaultAsync();
    }

    public static async Task<string> BuildLoginUrlAsync(
        ApplicationDbContext db,
        IConfiguration config,
        HttpRequest request,
        long? tenantId)
    {
        var code = await GetTenantCodeAsync(db, tenantId);
        return BuildLoginUrl(ResolveFrontendBase(config, request), code);
    }
}
