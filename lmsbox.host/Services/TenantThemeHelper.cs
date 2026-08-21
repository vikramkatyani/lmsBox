using System.Text.Json;
using lmsbox.domain.Models;

namespace lmsBox.Server.Services;

public static class TenantThemeHelper
{
    public const string DefaultBrandName = "LMS Box";
    public const string DefaultLogoUrl = "/assets/lmsbox-logo.png";
    public const string DefaultPrimaryColor = "#1b365d";
    public const string DefaultPageBackgroundColor = "#F5F5EF";
    public const string DefaultButtonColor = "#2afeae";
    public const string DefaultButtonTextColor = "#1b365d";

    public static BrandingDto Enrich(BrandingDto dto)
    {
        var parsed = Parse(dto.ThemeSettings, dto.CustomCss);
        dto.PrimaryColor = parsed.PrimaryColor;
        dto.SecondaryColor = parsed.SecondaryColor;
        dto.AccentColor = parsed.AccentColor;
        dto.AccentStrongColor = parsed.AccentStrongColor;
        dto.PageBackgroundColor = parsed.PageBackgroundColor;
        dto.ButtonColor = parsed.ButtonColor;
        dto.ButtonTextColor = parsed.ButtonTextColor;
        dto.FontFamily = parsed.FontFamily;
        dto.CustomCss = parsed.CustomCss ?? dto.CustomCss;
        dto.LoginHeroUrl ??= parsed.LoginHeroUrl;
        return dto;
    }

    public static TenantTheme Parse(string? themeSettingsJson, string? customCss)
    {
        var theme = new TenantTheme { CustomCss = string.IsNullOrWhiteSpace(customCss) ? null : customCss };
        if (string.IsNullOrWhiteSpace(themeSettingsJson))
        {
            return theme;
        }

        try
        {
            using var doc = JsonDocument.Parse(themeSettingsJson);
            var root = doc.RootElement;
            theme.PrimaryColor = GetString(root, "primaryColor");
            theme.SecondaryColor = GetString(root, "secondaryColor");
            theme.AccentColor = GetString(root, "accentColor");
            theme.AccentStrongColor = GetString(root, "accentStrongColor");
            theme.PageBackgroundColor = GetString(root, "pageBackgroundColor");
            theme.ButtonColor = GetString(root, "buttonColor");
            theme.ButtonTextColor = GetString(root, "buttonTextColor");
            theme.FontFamily = GetString(root, "fontFamily");
            theme.Logo = GetString(root, "logo");
            theme.Name = GetString(root, "name");
            theme.LoginHeroUrl = GetString(root, "loginHeroUrl");
        }
        catch (JsonException)
        {
            // Keep whatever CustomCss was supplied if ThemeSettings is not valid JSON.
        }

        return theme;
    }

    public static string? MergeThemeSettings(string? existingJson, UpdateTenantBrandingRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.ThemeSettings))
        {
            return request.ThemeSettings;
        }

        var map = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(existingJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(existingJson);
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    map[prop.Name] = prop.Value.Clone();
                }
            }
            catch (JsonException)
            {
                map.Clear();
            }
        }

        Set(map, "primaryColor", request.PrimaryColor);
        Set(map, "secondaryColor", request.SecondaryColor);
        Set(map, "accentColor", request.AccentColor);
        Set(map, "accentStrongColor", request.AccentStrongColor);
        Set(map, "pageBackgroundColor", request.PageBackgroundColor);
        Set(map, "buttonColor", request.ButtonColor);
        Set(map, "buttonTextColor", request.ButtonTextColor);
        Set(map, "fontFamily", request.FontFamily);

        if (map.Count == 0)
        {
            return string.IsNullOrWhiteSpace(existingJson) ? null : existingJson;
        }

        var payload = map.ToDictionary(k => k.Key, v => (object?)JsonSerializer.Deserialize<object>(v.Value.GetRawText()));
        return JsonSerializer.Serialize(payload);
    }

    public static PublicTenantBrandingDto ToPublic(Tenant? tenant)
    {
        if (tenant == null)
        {
            return Default();
        }

        var parsed = Parse(tenant.ThemeSettings, tenant.CustomCss);
        var logo = FirstNonEmpty(tenant.BannerUrl, parsed.Logo, DefaultLogoUrl);
        var brandName = FirstNonEmpty(tenant.BrandName, parsed.Name, tenant.Name) ?? DefaultBrandName;
        var hasCustom = !string.IsNullOrWhiteSpace(tenant.BrandName)
            || !string.IsNullOrWhiteSpace(tenant.BannerUrl)
            || !string.IsNullOrWhiteSpace(tenant.FaviconUrl)
            || !string.IsNullOrWhiteSpace(tenant.LoginHeroUrl)
            || !string.IsNullOrWhiteSpace(tenant.CustomCss)
            || !string.IsNullOrWhiteSpace(parsed.PrimaryColor)
            || !string.IsNullOrWhiteSpace(parsed.ButtonColor)
            || !string.IsNullOrWhiteSpace(parsed.PageBackgroundColor)
            || !string.IsNullOrWhiteSpace(parsed.FontFamily);

        return new PublicTenantBrandingDto
        {
            IsDefault = !hasCustom,
            HasCustomTheme = hasCustom,
            Code = tenant.Code,
            Name = tenant.Name,
            BrandName = brandName,
            LogoUrl = logo,
            FaviconUrl = FirstNonEmpty(tenant.FaviconUrl, logo),
            LoginHeroUrl = FirstNonEmpty(tenant.LoginHeroUrl, parsed.LoginHeroUrl),
            PrimaryColor = FirstNonEmpty(parsed.PrimaryColor, DefaultPrimaryColor),
            SecondaryColor = parsed.SecondaryColor,
            AccentColor = parsed.AccentColor,
            AccentStrongColor = parsed.AccentStrongColor,
            PageBackgroundColor = FirstNonEmpty(parsed.PageBackgroundColor, DefaultPageBackgroundColor),
            ButtonColor = FirstNonEmpty(parsed.ButtonColor, parsed.AccentColor, DefaultButtonColor),
            ButtonTextColor = FirstNonEmpty(parsed.ButtonTextColor, DefaultButtonTextColor),
            FontFamily = parsed.FontFamily,
            CustomCss = parsed.CustomCss,
            LoginPath = TenantPortalUrl.TenantLoginPath(tenant.Code)
        };
    }

    public static PublicTenantBrandingDto Default() => new()
    {
        IsDefault = true,
        HasCustomTheme = false,
        BrandName = DefaultBrandName,
        LogoUrl = DefaultLogoUrl,
        FaviconUrl = DefaultLogoUrl,
        PrimaryColor = DefaultPrimaryColor,
        PageBackgroundColor = DefaultPageBackgroundColor,
        ButtonColor = DefaultButtonColor,
        ButtonTextColor = DefaultButtonTextColor,
        LoginPath = "/login"
    };

    public static void ApplyStructuredFields(Tenant tenant, UpdateTenantBrandingRequest request)
    {
        tenant.BrandName = string.IsNullOrWhiteSpace(request.BrandName) ? null : request.BrandName.Trim();
        tenant.BannerUrl = string.IsNullOrWhiteSpace(request.BannerUrl) ? null : request.BannerUrl.Trim();
        tenant.FaviconUrl = string.IsNullOrWhiteSpace(request.FaviconUrl) ? null : request.FaviconUrl.Trim();
        tenant.LoginHeroUrl = string.IsNullOrWhiteSpace(request.LoginHeroUrl) ? null : request.LoginHeroUrl.Trim();
        tenant.CustomCss = string.IsNullOrWhiteSpace(request.CustomCss) ? null : request.CustomCss;
        tenant.ThemeSettings = MergeThemeSettings(tenant.ThemeSettings, request);
    }

    private static void Set(Dictionary<string, JsonElement> map, string key, string? value)
    {
        if (value == null)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(value))
        {
            map.Remove(key);
            return;
        }

        map[key] = JsonSerializer.SerializeToElement(value.Trim());
    }

    private static string? GetString(JsonElement root, string name)
    {
        if (root.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        foreach (var prop in root.EnumerateObject())
        {
            if (prop.NameEquals(name) && prop.Value.ValueKind == JsonValueKind.String)
            {
                var value = prop.Value.GetString();
                return string.IsNullOrWhiteSpace(value) ? null : value;
            }
        }

        return null;
    }

    public static string? FirstNonEmpty(params string?[] values) =>
        values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));
}

public class TenantTheme
{
    public string? Name { get; set; }
    public string? PrimaryColor { get; set; }
    public string? SecondaryColor { get; set; }
    public string? AccentColor { get; set; }
    public string? AccentStrongColor { get; set; }
    public string? PageBackgroundColor { get; set; }
    public string? ButtonColor { get; set; }
    public string? ButtonTextColor { get; set; }
    public string? FontFamily { get; set; }
    public string? Logo { get; set; }
    public string? LoginHeroUrl { get; set; }
    public string? CustomCss { get; set; }
}
