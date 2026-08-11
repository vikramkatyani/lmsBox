using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace lmsbox.domain.Models;

public class CreateTenantRequest
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = null!;

    [MaxLength(100)]
    public string? Code { get; set; }

    public string? Description { get; set; }

    public bool AllowsMultipleOrganisations { get; set; }

    [Range(1, 100000)]
    public int MaxUsers { get; set; } = 100;

    [Range(1, 10000)]
    public long AllocatedStorageGB { get; set; } = 10;

    public string? Domain { get; set; }

    public string? SupportEmail { get; set; }

    public string? ManagerName { get; set; }

    public string? ManagerEmail { get; set; }

    public string? ManagerPhone { get; set; }

    public DateTime? RenewalDate { get; set; }

    /// <summary>Optional override for the primary organisation name (defaults to tenant name).</summary>
    public string? PrimaryOrganisationName { get; set; }

    [Required]
    [EmailAddress]
    public string TenantAdminEmail { get; set; } = null!;

    [Required]
    public string TenantAdminFirstName { get; set; } = null!;

    public string? TenantAdminLastName { get; set; }

    [Required]
    [MinLength(6)]
    public string TenantAdminPassword { get; set; } = null!;
}

public class UpdateTenantRequest
{
    [Required]
    public long Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = null!;

    [Required]
    [MaxLength(100)]
    public string Code { get; set; } = null!;

    public string? Description { get; set; }

    public bool AllowsMultipleOrganisations { get; set; }

    [Range(1, 100000)]
    public int MaxUsers { get; set; }

    [Range(1, 10000)]
    public long AllocatedStorageGB { get; set; }

    public string? Domain { get; set; }

    public string? SupportEmail { get; set; }

    public string? ManagerName { get; set; }

    public string? ManagerEmail { get; set; }

    public string? ManagerPhone { get; set; }

    public DateTime? RenewalDate { get; set; }

    public bool IsActive { get; set; }

    public string? BrandName { get; set; }

    public string? BannerUrl { get; set; }

    public string? FaviconUrl { get; set; }

    public string? ThemeSettings { get; set; }
}

public class UpdateTenantBrandingRequest
{
    public string? BrandName { get; set; }
    public string? BannerUrl { get; set; }
    public string? FaviconUrl { get; set; }
    public string? ThemeSettings { get; set; }
}

public class BrandingDto
{
    public string? BrandName { get; set; }
    public string? BannerUrl { get; set; }
    public string? LogoUrl { get; set; }
    public string? FaviconUrl { get; set; }
    public string? ThemeSettings { get; set; }
    public bool UseTenantBranding { get; set; }
    public string Source { get; set; } = "tenant"; // "tenant" | "organisation"
}

public class TenantResponse
{
    public long Id { get; set; }
    public string Name { get; set; } = null!;
    public string Code { get; set; } = null!;
    public string? Description { get; set; }
    public bool AllowsMultipleOrganisations { get; set; }
    public int MaxUsers { get; set; }
    public long AllocatedStorageGB { get; set; }
    public string? Domain { get; set; }
    public string? SupportEmail { get; set; }
    public string? ManagerName { get; set; }
    public string? ManagerEmail { get; set; }
    public string? ManagerPhone { get; set; }
    public DateTime? RenewalDate { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedOn { get; set; }
    public int OrganisationCount { get; set; }
    public int TotalUsers { get; set; }
    public long? PrimaryOrganisationId { get; set; }
    public string? TenantAdminEmail { get; set; }
    public string? BrandName { get; set; }
    public string? BannerUrl { get; set; }
    public string? FaviconUrl { get; set; }
    public string? ThemeSettings { get; set; }
    public List<OrganisationSummaryResponse> Organisations { get; set; } = new();
}

public class OrganisationSummaryResponse
{
    public long Id { get; set; }
    public string Name { get; set; } = null!;
    public bool IsActive { get; set; }
    public int TotalUsers { get; set; }
    public int MaxUsers { get; set; }
    public long AllocatedStorageGB { get; set; }
}

public class CreateTenantOrganisationRequest
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    [Range(1, 100000)]
    public int MaxUsers { get; set; } = 100;

    [Range(1, 10000)]
    public long AllocatedStorageGB { get; set; } = 10;

    public string? Domain { get; set; }

    public string? SupportEmail { get; set; }

    public string? ManagerName { get; set; }

    public string? ManagerEmail { get; set; }

    public string? ManagerPhone { get; set; }

    public DateTime? RenewalDate { get; set; }

    public string? ThemeSettings { get; set; }
}

public class CreateTenantAdminRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;

    [Required]
    public string FirstName { get; set; } = null!;

    public string? LastName { get; set; }

    [Required]
    [MinLength(6)]
    public string Password { get; set; } = null!;

    /// <summary>
    /// When true (default for single-org tenants), also assign OrgAdmin on the primary organisation.
    /// </summary>
    public bool AlsoAssignOrgAdmin { get; set; } = true;
}
