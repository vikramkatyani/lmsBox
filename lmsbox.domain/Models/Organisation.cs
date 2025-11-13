using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace lmsbox.domain.Models;
public class Organisation
{
    public long Id { get; set; }

    [Required]
    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    // Configuration Settings
    public int MaxUsers { get; set; } = 100;
    
    public long AllocatedStorageGB { get; set; } = 10;
    
    public string? Domain { get; set; }
    
    // Azure Storage paths
    public string? BannerUrl { get; set; }
    
    public string? FaviconUrl { get; set; }
    
    // Theme Settings (stored as JSON)
    public string? ThemeSettings { get; set; }
    
    // Email Configuration
    public string? SmtpHost { get; set; }
    
    public int? SmtpPort { get; set; }
    
    public string? SmtpUsername { get; set; }
    
    public string? SmtpPassword { get; set; }
    
    public bool SmtpUseSsl { get; set; } = true;
    
    public string? SendGridApiKey { get; set; }
    
    public string? FromEmail { get; set; }
    
    public string? FromName { get; set; }
    
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
    public ICollection<ApplicationUser> Users { get; set; } = new List<ApplicationUser>();
}