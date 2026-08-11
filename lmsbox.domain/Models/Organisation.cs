using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace lmsbox.domain.Models;
public class Organisation
{
    public long Id { get; set; }

    /// <summary>Owning tenant. Required for all organisations.</summary>
    public long TenantId { get; set; }

    [Required]
    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    // Unique storage identifier (used for blob storage paths instead of numeric ID)
    [Required]
    public string StorageKey { get; set; } = Guid.NewGuid().ToString("N").Substring(0, 12);

    // Configuration Settings
    public int MaxUsers { get; set; } = 100;
    
    public long AllocatedStorageGB { get; set; } = 10;
    
    // Storage usage tracking (in bytes)
    public long StorageUsedBytes { get; set; } = 0;
    
    public long BrandingStorageUsedBytes { get; set; } = 0;
    
    public long ContentStorageUsedBytes { get; set; } = 0;
    
    public DateTime? StorageLastCalculated { get; set; }
    
    public string? Domain { get; set; }
    
    // Azure Storage paths
    public string? BannerUrl { get; set; }
    
    public string? FaviconUrl { get; set; }
    
    // Theme Settings (stored as JSON)
    public string? ThemeSettings { get; set; }

    /// <summary>
    /// When true (default), effective branding comes from the parent tenant.
    /// When false, organisation-specific BrandName/BannerUrl/FaviconUrl/ThemeSettings are used.
    /// </summary>
    public bool UseTenantBranding { get; set; } = true;

    // Email Configuration
    public string? SmtpHost { get; set; }
    
    public int? SmtpPort { get; set; }
    
    public string? SmtpUsername { get; set; }
    
    public string? SmtpPassword { get; set; }
    
    public bool SmtpUseSsl { get; set; } = true;
    
    public string? SendGridApiKey { get; set; }
    
    public string? FromEmail { get; set; }
    
    public string? FromName { get; set; }

    public string? TimeZoneId { get; set; }
    
    public string? BrandName { get; set; }
    
    // Support and Contact
    public string? SupportEmail { get; set; }
    
    public string? ManagerName { get; set; }
    
    public string? ManagerEmail { get; set; }
    
    public string? ManagerPhone { get; set; }
    
    // Subscription
    public DateTime? RenewalDate { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    
    public string CreatedBy { get; set; } = "system";
    
    public DateTime? UpdatedOn { get; set; }
    
    public string? UpdatedBy { get; set; }

    // Navigation
    public Tenant Tenant { get; set; } = null!;

    public ICollection<ApplicationUser> Users { get; set; } = new List<ApplicationUser>();
}