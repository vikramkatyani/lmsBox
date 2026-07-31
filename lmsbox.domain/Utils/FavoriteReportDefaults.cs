using System.Text.Json;
using lmsbox.domain.Models;

namespace lmsbox.domain.Utils;

/// <summary>
/// Default favourite admin reports. Admins start with every report favourited
/// except the excluded set; they can add/remove favourites afterwards.
/// </summary>
public static class FavoriteReportDefaults
{
    /// <summary>Reports that are not favourited by default.</summary>
    public static readonly HashSet<string> ExcludedFromDefaults = new(StringComparer.OrdinalIgnoreCase)
    {
        "user-lesson-progress",
        "pathway-assignments",
        "pathway-progress",
        "course-completion",
        "user-activity",
        "lesson-analytics",
        "storage-usage",
        "content-usage"
    };

    public static readonly HashSet<string> SuperAdminOnlyReportIds = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>All known admin report ids (same order as the reports UI).</summary>
    public static readonly string[] AllReportIds =
    [
        "user-activity",
        "user-progress",
        "course-enrollment",
        "course-completion",
        "lesson-analytics",
        "user-lesson-progress",
        "quiz-attempts",
        "assessment-difficulty",
        "survey-report",
        "time-tracking",
        "engagement-analytics",
        "pathway-progress",
        "pathway-assignments",
        "user-course-progress",
        "content-usage",
        "activity-logs",
        "storage-usage"
    ];

    public static List<string> GetDefaultFavoriteReportIds(bool includeSuperAdminOnly = false)
    {
        return AllReportIds
            .Where(id => !ExcludedFromDefaults.Contains(id))
            .Where(id => includeSuperAdminOnly || !SuperAdminOnlyReportIds.Contains(id))
            .ToList();
    }

    public static string SerializeJson(bool includeSuperAdminOnly = false)
        => JsonSerializer.Serialize(GetDefaultFavoriteReportIds(includeSuperAdminOnly));

    public static bool IsAdminRole(string? role)
        => !string.IsNullOrWhiteSpace(role)
           && role is "Admin" or "OrgAdmin" or "SuperAdmin";

    /// <summary>
    /// Apply defaults only when favourites have never been set (null).
    /// Does not overwrite an admin's customised list (including an explicit empty list).
    /// </summary>
    public static bool TryApplyDefaults(ApplicationUser user, string role)
    {
        if (user.FavoriteReportIds != null || !IsAdminRole(role))
            return false;

        user.FavoriteReportIds = SerializeJson(
            includeSuperAdminOnly: string.Equals(role, "SuperAdmin", StringComparison.OrdinalIgnoreCase));
        return true;
    }
}
