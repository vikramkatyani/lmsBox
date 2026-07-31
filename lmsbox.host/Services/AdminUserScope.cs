using System.Security.Claims;
using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Services;

/// <summary>
/// Resolves organisation scoping for OrgAdmin and SuperAdmin.
/// </summary>
public sealed class AdminUserScope
{
    public long? OrganisationId { get; init; }

    public bool HasOrganisationFilter => OrganisationId.HasValue;

    public static async Task<AdminUserScope> ResolveAsync(
        ClaimsPrincipal principal,
        ApplicationDbContext context)
    {
        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue("sub");
        if (string.IsNullOrEmpty(userId))
        {
            return new AdminUserScope();
        }

        var user = await context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return new AdminUserScope();
        }

        if (principal.IsInRole("OrgAdmin") || principal.IsInRole("Admin"))
        {
            return new AdminUserScope { OrganisationId = user.OrganisationID };
        }

        return new AdminUserScope();
    }

    public IQueryable<ApplicationUser> ApplyToUsers(IQueryable<ApplicationUser> query)
    {
        if (OrganisationId.HasValue)
        {
            query = query.Where(u => u.OrganisationID == OrganisationId);
        }

        return query;
    }

    public bool CanAccessUser(ApplicationUser target)
    {
        if (OrganisationId.HasValue && target.OrganisationID != OrganisationId)
        {
            return false;
        }

        return true;
    }
}
