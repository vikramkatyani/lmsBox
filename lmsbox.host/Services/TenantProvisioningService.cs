using System.Text.RegularExpressions;
using lmsbox.domain.Models;
using lmsbox.domain.Utils;
using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Services;

public static class TenantProvisioningService
{
    public static string GenerateCode(string name, long? suffix = null)
    {
        var slug = Regex.Replace(name.Trim().ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
        if (string.IsNullOrWhiteSpace(slug))
        {
            slug = "tenant";
        }

        if (slug.Length > 80)
        {
            slug = slug[..80].Trim('-');
        }

        return suffix.HasValue ? $"{slug}-{suffix}" : slug;
    }

    public static async Task<string> EnsureUniqueCodeAsync(ApplicationDbContext context, string preferredCode)
    {
        var code = string.IsNullOrWhiteSpace(preferredCode)
            ? GenerateCode("tenant")
            : GenerateCode(preferredCode);

        if (!await context.Tenants.AnyAsync(t => t.Code == code))
        {
            return code;
        }

        for (var i = 2; i < 1000; i++)
        {
            var candidate = $"{code}-{i}";
            if (candidate.Length > 100)
            {
                candidate = candidate[..100];
            }

            if (!await context.Tenants.AnyAsync(t => t.Code == candidate))
            {
                return candidate;
            }
        }

        return $"{code}-{Guid.NewGuid():N}"[..100];
    }

    public static async Task<(Tenant Tenant, Organisation PrimaryOrg, ApplicationUser TenantAdmin)> CreateTenantWithPrimaryOrgAsync(
        ApplicationDbContext context,
        UserManager<ApplicationUser> userManager,
        CreateTenantRequest request,
        string createdBy)
    {
        var normalizedEmail = userManager.NormalizeEmail(request.TenantAdminEmail);
        var code = await EnsureUniqueCodeAsync(context, request.Code ?? request.Name);

        var tenant = new Tenant
        {
            Name = request.Name,
            Code = code,
            Description = request.Description,
            AllowsMultipleOrganisations = request.AllowsMultipleOrganisations,
            MaxUsers = request.MaxUsers,
            AllocatedStorageGB = request.AllocatedStorageGB,
            Domain = request.Domain,
            SupportEmail = request.SupportEmail,
            ManagerName = request.ManagerName,
            ManagerEmail = request.ManagerEmail,
            ManagerPhone = request.ManagerPhone,
            RenewalDate = request.RenewalDate,
            IsActive = true,
            CreatedOn = DateTime.UtcNow,
            CreatedBy = createdBy
        };

        context.Tenants.Add(tenant);
        await context.SaveChangesAsync();

        var orgName = string.IsNullOrWhiteSpace(request.PrimaryOrganisationName)
            ? request.Name
            : request.PrimaryOrganisationName!;

        var organisation = new Organisation
        {
            TenantId = tenant.Id,
            Name = orgName,
            Description = request.Description,
            MaxUsers = request.MaxUsers,
            AllocatedStorageGB = request.AllocatedStorageGB,
            Domain = request.Domain,
            SupportEmail = request.SupportEmail,
            ManagerName = request.ManagerName,
            ManagerEmail = request.ManagerEmail,
            ManagerPhone = request.ManagerPhone,
            RenewalDate = request.RenewalDate,
            UseTenantBranding = true,
            IsActive = true,
            CreatedOn = DateTime.UtcNow,
            CreatedBy = createdBy
        };

        context.Organisations.Add(organisation);
        await context.SaveChangesAsync();

        var duplicateInTenant = await context.Users.AnyAsync(u =>
            u.NormalizedEmail == normalizedEmail && u.TenantId == tenant.Id);
        if (duplicateInTenant)
        {
            throw new InvalidOperationException("Tenant admin email already exists in this tenant");
        }

        var admin = new ApplicationUser
        {
            UserName = TenantIdentity.BuildUserName(tenant.Id, request.TenantAdminEmail),
            Email = request.TenantAdminEmail,
            EmailConfirmed = true,
            FirstName = request.TenantAdminFirstName,
            LastName = request.TenantAdminLastName,
            TenantId = tenant.Id,
            OrganisationID = organisation.Id,
            CreatedBy = createdBy,
            ActivatedBy = createdBy,
            DeactivatedBy = createdBy,
            ActiveStatus = 1,
            ActivatedOn = DateTime.UtcNow,
            CreatedOn = DateTime.UtcNow
        };

        var result = await userManager.CreateAsync(admin, request.TenantAdminPassword);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                "Failed to create tenant admin: " + string.Join("; ", result.Errors.Select(e => e.Description)));
        }

        await userManager.AddToRoleAsync(admin, "TenantAdmin");
        // Single-org (and default): also OrgAdmin on primary org for day-to-day admin
        await userManager.AddToRoleAsync(admin, "OrgAdmin");

        if (FavoriteReportDefaults.TryApplyDefaults(admin, "OrgAdmin"))
        {
            await userManager.UpdateAsync(admin);
        }

        return (tenant, organisation, admin);
    }

    public static TenantResponse ToResponse(Tenant tenant, IEnumerable<Organisation> orgs, string? tenantAdminEmail = null)
    {
        var orgList = orgs.ToList();
        var theme = TenantThemeHelper.Parse(tenant.ThemeSettings, tenant.CustomCss);
        return new TenantResponse
        {
            Id = tenant.Id,
            Name = tenant.Name,
            Code = tenant.Code,
            Description = tenant.Description,
            AllowsMultipleOrganisations = tenant.AllowsMultipleOrganisations,
            MaxUsers = tenant.MaxUsers,
            AllocatedStorageGB = tenant.AllocatedStorageGB,
            Domain = tenant.Domain,
            SupportEmail = tenant.SupportEmail,
            ManagerName = tenant.ManagerName,
            ManagerEmail = tenant.ManagerEmail,
            ManagerPhone = tenant.ManagerPhone,
            RenewalDate = tenant.RenewalDate,
            IsActive = tenant.IsActive,
            CreatedOn = tenant.CreatedOn,
            OrganisationCount = orgList.Count,
            TotalUsers = orgList.Sum(o => o.Users?.Count ?? 0),
            PrimaryOrganisationId = orgList.OrderBy(o => o.Id).FirstOrDefault()?.Id,
            TenantAdminEmail = tenantAdminEmail,
            BrandName = tenant.BrandName,
            BannerUrl = tenant.BannerUrl,
            FaviconUrl = tenant.FaviconUrl,
            ThemeSettings = tenant.ThemeSettings,
            CustomCss = tenant.CustomCss,
            PrimaryColor = theme.PrimaryColor,
            SecondaryColor = theme.SecondaryColor,
            AccentColor = theme.AccentColor,
            AccentStrongColor = theme.AccentStrongColor,
            FontFamily = theme.FontFamily,
            LoginHeroUrl = tenant.LoginHeroUrl,
            PageBackgroundColor = theme.PageBackgroundColor,
            ButtonColor = theme.ButtonColor,
            ButtonTextColor = theme.ButtonTextColor,
            LoginPath = TenantPortalUrl.TenantLoginPath(tenant.Code),
            Organisations = orgList.Select(o => new OrganisationSummaryResponse
            {
                Id = o.Id,
                Name = o.Name,
                IsActive = o.IsActive,
                TotalUsers = o.Users?.Count ?? 0,
                MaxUsers = o.MaxUsers,
                AllocatedStorageGB = o.AllocatedStorageGB
            }).ToList()
        };
    }
}
