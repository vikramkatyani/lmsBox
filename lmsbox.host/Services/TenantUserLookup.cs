using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Services;

public class TenantUserLookup
{
    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public TenantUserLookup(ApplicationDbContext db, UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    public async Task<ApplicationUser?> FindByEmailAndTenantAsync(string email, long? tenantId)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var normalized = _userManager.NormalizeEmail(email);
        if (tenantId.HasValue)
        {
            return await _db.Users.FirstOrDefaultAsync(u =>
                u.NormalizedEmail == normalized && u.TenantId == tenantId.Value);
        }

        return await _db.Users.FirstOrDefaultAsync(u =>
            u.NormalizedEmail == normalized && u.TenantId == null);
    }

    public async Task<bool> EmailExistsInTenantAsync(string email, long? tenantId)
    {
        return await FindByEmailAndTenantAsync(email, tenantId) != null;
    }
}
