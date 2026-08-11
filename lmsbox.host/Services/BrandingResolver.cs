using lmsbox.domain.Models;

namespace lmsBox.Server.Services;

public static class BrandingResolver
{
    public static BrandingDto Resolve(Organisation organisation, Tenant? tenant)
    {
        if (organisation.UseTenantBranding && tenant != null)
        {
            return FromTenant(tenant, useTenantBranding: true);
        }

        return new BrandingDto
        {
            BrandName = organisation.BrandName,
            BannerUrl = organisation.BannerUrl,
            LogoUrl = organisation.BannerUrl,
            FaviconUrl = organisation.FaviconUrl,
            ThemeSettings = organisation.ThemeSettings,
            UseTenantBranding = false,
            Source = "organisation"
        };
    }

    public static BrandingDto FromTenant(Tenant tenant, bool useTenantBranding = true) => new()
    {
        BrandName = tenant.BrandName,
        BannerUrl = tenant.BannerUrl,
        LogoUrl = tenant.BannerUrl,
        FaviconUrl = tenant.FaviconUrl,
        ThemeSettings = tenant.ThemeSettings,
        UseTenantBranding = useTenantBranding,
        Source = "tenant"
    };

    public static bool HasCustomOrganisationBranding(Organisation organisation) =>
        !string.IsNullOrWhiteSpace(organisation.BrandName)
        || !string.IsNullOrWhiteSpace(organisation.BannerUrl)
        || !string.IsNullOrWhiteSpace(organisation.FaviconUrl)
        || !string.IsNullOrWhiteSpace(organisation.ThemeSettings);
}
