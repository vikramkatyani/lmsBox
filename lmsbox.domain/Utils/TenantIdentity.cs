namespace lmsbox.domain.Utils;

/// <summary>
/// Identity usernames must be globally unique. Emails are unique only within a tenant
/// (or among SuperAdmins, who have no tenant).
/// </summary>
public static class TenantIdentity
{
    public static string BuildUserName(long? tenantId, string email)
    {
        var trimmed = email.Trim();
        return tenantId.HasValue ? $"{tenantId.Value}|{trimmed}" : trimmed;
    }
}
