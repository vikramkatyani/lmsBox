using System;

namespace lmsbox.domain.Models;
public class LoginLinkToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = null!;
    public string TokenHash { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }

    /// <summary>
    /// Admin-generated links are reusable until expiry and are not consumed on first use.
    /// </summary>
    public bool IsAdminGenerated { get; set; }

    // Telemetry for email delivery
    public DateTime? SentAt { get; set; }
    public int SendFailedCount { get; set; }
    public string? LastSendError { get; set; }
}