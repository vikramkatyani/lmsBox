using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Services;

public class TenantResolver
{
    private readonly ApplicationDbContext _db;

    public TenantResolver(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<Tenant?> ResolveByCodeAsync(string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        var normalized = code.Trim().ToLowerInvariant();
        return await _db.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.IsActive && t.Code == normalized);
    }

    public async Task<Tenant?> ResolveByHostAsync(string? host)
    {
        if (string.IsNullOrWhiteSpace(host))
        {
            return null;
        }

        var hostName = NormalizeHost(host);
        if (hostName is "localhost" or "127.0.0.1" or "::1")
        {
            return null;
        }

        var tenants = await _db.Tenants.AsNoTracking().Where(t => t.IsActive).ToListAsync();

        var byDomain = tenants.FirstOrDefault(t =>
            !string.IsNullOrWhiteSpace(t.Domain) &&
            string.Equals(NormalizeHost(t.Domain), hostName, StringComparison.OrdinalIgnoreCase));
        if (byDomain != null)
        {
            return byDomain;
        }

        var subdomain = hostName.Split('.')[0];
        return tenants.FirstOrDefault(t =>
            string.Equals(t.Code, subdomain, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<Tenant?> ResolveAsync(string? tenantCode, string? host)
    {
        return await ResolveByCodeAsync(tenantCode) ?? await ResolveByHostAsync(host);
    }

    public static string NormalizeHost(string value)
    {
        var host = value.Trim();
        if (host.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
        {
            host = host[7..];
        }
        else if (host.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            host = host[8..];
        }

        host = host.Split('/')[0];
        host = host.Split(':')[0];
        return host.Trim().ToLowerInvariant();
    }
}
