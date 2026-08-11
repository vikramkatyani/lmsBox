using System.Security.Claims;
using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Services;

/// <summary>
/// Resolves tenant/organisation scoping for SuperAdmin, TenantAdmin, and OrgAdmin.
/// </summary>
public sealed class AccessScope
{
    public long? TenantId { get; init; }
    public long? OrganisationId { get; init; }
    public bool IsSuperAdmin { get; init; }
    public bool IsTenantAdmin { get; init; }
    public bool IsOrgAdmin { get; init; }

    public bool HasOrganisationFilter => OrganisationId.HasValue;
    public bool HasTenantFilter => TenantId.HasValue && !IsSuperAdmin;

    public static async Task<AccessScope> ResolveAsync(
        ClaimsPrincipal principal,
        ApplicationDbContext context)
    {
        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue("sub");
        if (string.IsNullOrEmpty(userId))
        {
            return new AccessScope();
        }

        var user = await context.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return new AccessScope();
        }

        if (principal.IsInRole("SuperAdmin"))
        {
            return new AccessScope { IsSuperAdmin = true };
        }

        if (principal.IsInRole("TenantAdmin"))
        {
            var alsoOrgAdmin = principal.IsInRole("OrgAdmin") || principal.IsInRole("Admin");
            return new AccessScope
            {
                IsTenantAdmin = true,
                IsOrgAdmin = alsoOrgAdmin,
                TenantId = user.TenantId,
                OrganisationId = alsoOrgAdmin ? user.OrganisationID : null
            };
        }

        if (principal.IsInRole("OrgAdmin") || principal.IsInRole("Admin"))
        {
            return new AccessScope
            {
                IsOrgAdmin = true,
                TenantId = user.TenantId,
                OrganisationId = user.OrganisationID
            };
        }

        return new AccessScope
        {
            TenantId = user.TenantId,
            OrganisationId = user.OrganisationID
        };
    }

    public IQueryable<ApplicationUser> ApplyToUsers(IQueryable<ApplicationUser> query)
    {
        if (IsSuperAdmin)
        {
            return query;
        }

        // TenantAdmin sees all users in the tenant (even when also OrgAdmin)
        if (IsTenantAdmin && TenantId.HasValue)
        {
            return query.Where(u => u.TenantId == TenantId);
        }

        if (OrganisationId.HasValue)
        {
            return query.Where(u => u.OrganisationID == OrganisationId);
        }

        if (TenantId.HasValue)
        {
            return query.Where(u => u.TenantId == TenantId);
        }

        return query.Where(_ => false);
    }

    public IQueryable<Organisation> ApplyToOrganisations(IQueryable<Organisation> query)
    {
        if (IsSuperAdmin)
        {
            return query;
        }

        if (IsTenantAdmin && TenantId.HasValue)
        {
            return query.Where(o => o.TenantId == TenantId);
        }

        if (OrganisationId.HasValue)
        {
            return query.Where(o => o.Id == OrganisationId);
        }

        if (TenantId.HasValue)
        {
            return query.Where(o => o.TenantId == TenantId);
        }

        return query.Where(_ => false);
    }

    public bool CanAccessUser(ApplicationUser target)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        if (IsTenantAdmin && TenantId.HasValue)
        {
            return target.TenantId == TenantId;
        }

        if (OrganisationId.HasValue)
        {
            return target.OrganisationID == OrganisationId;
        }

        if (TenantId.HasValue)
        {
            return target.TenantId == TenantId;
        }

        return false;
    }

    public bool CanAccessOrganisation(Organisation org)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        if (IsTenantAdmin && TenantId.HasValue)
        {
            return org.TenantId == TenantId;
        }

        if (OrganisationId.HasValue)
        {
            return org.Id == OrganisationId;
        }

        if (TenantId.HasValue)
        {
            return org.TenantId == TenantId;
        }

        return false;
    }

    /// <summary>
    /// Whether the caller can view org-scoped content for the given organisation.
    /// </summary>
    public bool CanAccessOrganisationContent(long organisationId, long? organisationTenantId = null)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        if (IsTenantAdmin && TenantId.HasValue)
        {
            return organisationTenantId.HasValue && organisationTenantId == TenantId;
        }

        if (OrganisationId.HasValue)
        {
            return OrganisationId == organisationId;
        }

        if (TenantId.HasValue && organisationTenantId.HasValue)
        {
            return organisationTenantId == TenantId;
        }

        return false;
    }
}

/// <summary>
/// Backward-compatible alias used by existing report controllers.
/// Prefer <see cref="AccessScope"/>.
/// </summary>
public sealed class AdminUserScope
{
    public long? OrganisationId { get; init; }
    public long? TenantId { get; init; }
    public bool IsSuperAdmin { get; init; }
    public bool IsTenantAdmin { get; init; }
    public bool HasOrganisationFilter => OrganisationId.HasValue;

    public static async Task<AdminUserScope> ResolveAsync(
        ClaimsPrincipal principal,
        ApplicationDbContext context)
    {
        var scope = await AccessScope.ResolveAsync(principal, context);
        return FromAccessScope(scope);
    }

    public static AdminUserScope FromAccessScope(AccessScope scope) => new()
    {
        // Tenant-wide admin: do not force a single-org filter on report user queries
        OrganisationId = scope.IsTenantAdmin ? null : scope.OrganisationId,
        TenantId = scope.TenantId,
        IsSuperAdmin = scope.IsSuperAdmin,
        IsTenantAdmin = scope.IsTenantAdmin
    };

    public IQueryable<ApplicationUser> ApplyToUsers(IQueryable<ApplicationUser> query)
    {
        if (IsSuperAdmin)
        {
            return query;
        }

        if (OrganisationId.HasValue)
        {
            return query.Where(u => u.OrganisationID == OrganisationId);
        }

        if (TenantId.HasValue)
        {
            return query.Where(u => u.TenantId == TenantId);
        }

        return query.Where(_ => false);
    }

    public bool CanAccessUser(ApplicationUser target)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        if (OrganisationId.HasValue && target.OrganisationID != OrganisationId)
        {
            return false;
        }

        if (!OrganisationId.HasValue && TenantId.HasValue && target.TenantId != TenantId)
        {
            return false;
        }

        return IsSuperAdmin || OrganisationId.HasValue || TenantId.HasValue;
    }
}
