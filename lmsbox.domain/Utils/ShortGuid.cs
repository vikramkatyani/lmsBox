using System;

namespace lmsbox.domain.Utils;
public static class ShortGuid
{
    /// <summary>
    /// Generates a short, URL-safe GUID (22 characters)
    /// </summary>
    /// <returns>A base64-encoded GUID without padding characters</returns>
    public static string Generate()
    {
        var guid = Guid.NewGuid();
        var base64 = Convert.ToBase64String(guid.ToByteArray());
        
        // Remove padding and make URL-safe
        return base64
            .Replace('+', '-')
            .Replace('/', '_')
            .Replace("=", string.Empty);
    }

    /// <summary>
    /// Converts a short GUID back to a standard GUID
    /// </summary>
    /// <param name="shortGuid">The short GUID to convert</param>
    /// <returns>The original GUID</returns>
    public static Guid ToGuid(string shortGuid)
    {
        if (string.IsNullOrEmpty(shortGuid))
            throw new ArgumentException("Short GUID cannot be null or empty", nameof(shortGuid));

        // Restore base64 format
        var base64 = shortGuid
            .Replace('-', '+')
            .Replace('_', '/');

        // Add padding if needed
        switch (base64.Length % 4)
        {
            case 2: base64 += "=="; break;
            case 3: base64 += "="; break;
        }

        var bytes = Convert.FromBase64String(base64);
        return new Guid(bytes);
    }

    /// <summary>
    /// Validates if a string is a valid short GUID format
    /// </summary>
    /// <param name="shortGuid">The string to validate</param>
    /// <returns>True if valid, false otherwise</returns>
    public static bool IsValid(string shortGuid)
    {
        if (string.IsNullOrEmpty(shortGuid) || shortGuid.Length != 22)
            return false;

        try
        {
            ToGuid(shortGuid);
            return true;
        }
        catch
        {
            return false;
        }
    }
}