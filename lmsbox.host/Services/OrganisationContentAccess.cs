namespace lmsBox.Server.Services;

public static class OrganisationContentAccess
{
    public static bool CanViewCourse(long courseOrganisationId, string? role, long? viewerOrganisationId)
    {
        if (role is "SuperAdmin" or "Admin")
        {
            return true;
        }

        if (role == "OrgAdmin")
        {
            return viewerOrganisationId.HasValue && courseOrganisationId == viewerOrganisationId.Value;
        }

        return false;
    }

    public static bool CanMutateCourse(long courseOrganisationId, string? role, long? viewerOrganisationId)
        => CanViewCourse(courseOrganisationId, role, viewerOrganisationId);
}
