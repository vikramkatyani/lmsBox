namespace lmsBox.Server.Services;

public static class OrganisationContentAccess
{
    public static bool CanViewCourse(long courseOrganisationId, string? role, long? viewerOrganisationId, long? viewerTenantId = null, long? courseTenantId = null)
    {
        if (role is "SuperAdmin" or "Admin")
        {
            return true;
        }

        if (role == "TenantAdmin")
        {
            if (viewerTenantId.HasValue && courseTenantId.HasValue)
            {
                return viewerTenantId == courseTenantId;
            }

            // Without tenant on course, fall back to org match only if same org known
            return viewerOrganisationId.HasValue && courseOrganisationId == viewerOrganisationId.Value;
        }

        if (role == "OrgAdmin")
        {
            return viewerOrganisationId.HasValue && courseOrganisationId == viewerOrganisationId.Value;
        }

        return false;
    }

    public static bool CanMutateCourse(long courseOrganisationId, string? role, long? viewerOrganisationId, long? viewerTenantId = null, long? courseTenantId = null)
        => CanViewCourse(courseOrganisationId, role, viewerOrganisationId, viewerTenantId, courseTenantId);
}
