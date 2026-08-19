using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace lmsbox.domain.Models;

public class Tenant
{
    public long Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Code { get; set; } = null!;

    public string? Description { get; set; }

    /// <summary>
    /// When false, the tenant is limited to its primary organisation.
    /// </summary>
    public bool AllowsMultipleOrganisations { get; set; }

    public int MaxUsers { get; set; } = 100;

    public long AllocatedStorageGB { get; set; } = 10;

    public string? Domain { get; set; }

    public string? SupportEmail { get; set; }

    public string? ManagerName { get; set; }

    public string? ManagerEmail { get; set; }

    public string? ManagerPhone { get; set; }

    public DateTime? RenewalDate { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

    public string CreatedBy { get; set; } = "system";

    public DateTime? UpdatedOn { get; set; }

    public string? UpdatedBy { get; set; }

    // Branding (inherited by organisations when UseTenantBranding is true)
    public string? BrandName { get; set; }

    public string? BannerUrl { get; set; }

    public string? FaviconUrl { get; set; }

    /// <summary>Right-hand illustration on the tenant login page.</summary>
    public string? LoginHeroUrl { get; set; }

    /// <summary>Theme settings stored as JSON (colors, font, etc.).</summary>
    public string? ThemeSettings { get; set; }

    /// <summary>Optional extra CSS applied on the tenant login page and app chrome.</summary>
    public string? CustomCss { get; set; }

    public ICollection<Organisation> Organisations { get; set; } = new List<Organisation>();

    public ICollection<ApplicationUser> Users { get; set; } = new List<ApplicationUser>();
}
