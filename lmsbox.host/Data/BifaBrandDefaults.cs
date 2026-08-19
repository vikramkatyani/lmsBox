using System.Reflection;
using Microsoft.AspNetCore.Hosting;

namespace lmsBox.Server.Data;

/// <summary>
/// Local BIFA brand (Guidelines v1.2) used when provisioning the bifa tenant.
/// Theme tokens match tenants.json / bifa-theme.css.
/// </summary>
public static class BifaBrandDefaults
{
    public const string Code = "bifa";
    public const string Name = "BIFA";
    public const string BrandName = "BIFA Learning";
    public const string LogoUrl = "/assets/bifa-logo.svg";
    public const string AdminEmail = "vikram@intellimindsdigital.com";
    public const string AdminFirstName = "Vikram";
    public const string AdminLastName = "Katyani";
    public const string AdminPassword = "P@ssw0rd1!";

    /// <summary>
    /// Courses to reassign from the default tenant onto BIFA's primary organisation.
    /// Idempotent: skipped once the course already belongs to BIFA.
    /// </summary>
    public static readonly string[] CoursesToAdopt =
    {
        "FORZ-RJTdECMGtLr6k938JA" // Liability Insurance (v2.0)
    };

    public const string ThemeSettingsJson =
        "{\"name\":\"BIFA Learning\",\"strapline\":\"The leading body representing the UK international freight services industry\",\"primaryColor\":\"#002e62\",\"secondaryColor\":\"#0059a3\",\"accentColor\":\"#ee7203\",\"accentStrongColor\":\"#e74011\",\"pageBackgroundColor\":\"#f7f8fa\",\"buttonColor\":\"#e74011\",\"buttonTextColor\":\"#ffffff\",\"grey\":\"#575756\",\"lightGrey\":\"#c4c2b2\",\"fontFamily\":\"Poppins, Arial, Helvetica, sans-serif\",\"css\":\"bifa\",\"logo\":\"/assets/bifa-logo.svg\",\"guidelineVersion\":\"1.2\"}";

    public static string? LoadCustomCss(IWebHostEnvironment? environment)
    {
        var candidates = new List<string>();
        if (!string.IsNullOrWhiteSpace(environment?.WebRootPath))
        {
            candidates.Add(Path.Combine(environment.WebRootPath, "design-system", "tenants", "bifa-theme.css"));
        }

        if (!string.IsNullOrWhiteSpace(environment?.ContentRootPath))
        {
            candidates.Add(Path.Combine(environment.ContentRootPath, "wwwroot", "design-system", "tenants", "bifa-theme.css"));
        }

        candidates.Add(Path.Combine(AppContext.BaseDirectory, "wwwroot", "design-system", "tenants", "bifa-theme.css"));

        foreach (var path in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (File.Exists(path))
            {
                return File.ReadAllText(path);
            }
        }

        var assembly = Assembly.GetExecutingAssembly();
        var resourceName = assembly.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("bifa-theme.css", StringComparison.OrdinalIgnoreCase));
        if (resourceName == null)
        {
            return null;
        }

        using var stream = assembly.GetManifestResourceStream(resourceName);
        if (stream == null)
        {
            return null;
        }

        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
