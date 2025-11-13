using System;
using System.ComponentModel.DataAnnotations;

namespace lmsbox.domain.Models;

// Super Admin Login (separate from regular users)
public class SuperAdminLoginRequest
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;

    [Required]
    public string Password { get; set; } = null!;
}

public class SuperAdminLoginResponse
{
    public string Token { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string FirstName { get; set; } = null!;
    public string? LastName { get; set; }
    public string Role { get; set; } = "SuperAdmin";
}

// Organisation Management
public class CreateOrganisationRequest
{
    [Required]
    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    [Required]
    [Range(1, 100000)]
    public int MaxUsers { get; set; } = 100;

    [Required]
    [Range(1, 10000)]
    public long AllocatedStorageGB { get; set; } = 10;

    public string? Domain { get; set; }

    public string? SupportEmail { get; set; }

    public string? ManagerName { get; set; }

    public string? ManagerEmail { get; set; }

    public string? ManagerPhone { get; set; }

    public DateTime? RenewalDate { get; set; }

    // Theme settings as JSON string
    public string? ThemeSettings { get; set; }
}

public class UpdateOrganisationRequest
{
    [Required]
    public long Id { get; set; }

    [Required]
    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    [Required]
    [Range(1, 100000)]
    public int MaxUsers { get; set; }

    [Required]
    [Range(1, 10000)]
    public long AllocatedStorageGB { get; set; }

    public string? Domain { get; set; }

    public string? BannerUrl { get; set; }

    public string? FaviconUrl { get; set; }

    public string? ThemeSettings { get; set; }

    // Email Configuration
    public string? SmtpHost { get; set; }
    public int? SmtpPort { get; set; }
    public string? SmtpUsername { get; set; }
    public string? SmtpPassword { get; set; }
    public bool SmtpUseSsl { get; set; }
    public string? SendGridApiKey { get; set; }
    public string? FromEmail { get; set; }
    public string? FromName { get; set; }

    // Support and Contact
    public string? SupportEmail { get; set; }
    public string? ManagerName { get; set; }
    public string? ManagerEmail { get; set; }
    public string? ManagerPhone { get; set; }

    public DateTime? RenewalDate { get; set; }
    public bool IsActive { get; set; }
}

public class OrganisationResponse
{
    public long Id { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public int MaxUsers { get; set; }
    public long AllocatedStorageGB { get; set; }
    public string? Domain { get; set; }
    public string? BannerUrl { get; set; }
    public string? FaviconUrl { get; set; }
    public string? ThemeSettings { get; set; }
    public string? SupportEmail { get; set; }
    public string? ManagerName { get; set; }
    public string? ManagerEmail { get; set; }
    public string? ManagerPhone { get; set; }
    public DateTime? RenewalDate { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedOn { get; set; }
    public int TotalUsers { get; set; }
    public string? AdminEmail { get; set; }
}

// Create Admin for Organisation
public class CreateOrgAdminRequest
{
    [Required]
    public long OrganisationId { get; set; }

    [Required]
    [EmailAddress]
    public string Email { get; set; } = null!;

    [Required]
    public string FirstName { get; set; } = null!;

    public string? LastName { get; set; }

    [Required]
    [MinLength(6)]
    public string Password { get; set; } = null!;
}

// Global Library Content
public class GlobalLibraryContentResponse
{
    public long Id { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public string ContentType { get; set; } = null!;
    public string AzureBlobPath { get; set; } = null!;
    public string? FileName { get; set; }
    public long FileSizeBytes { get; set; }
    public string? MimeType { get; set; }
    public DateTime UploadedOn { get; set; }
    public string UploadedBy { get; set; } = null!;
    public bool IsActive { get; set; }
    public string? Tags { get; set; }
}

public class UploadGlobalContentRequest
{
    [Required]
    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    [Required]
    public string ContentType { get; set; } = null!; // "pdf" or "video"

    public string? Tags { get; set; }
}
