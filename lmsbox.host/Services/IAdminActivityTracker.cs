using lmsbox.domain.Models;

namespace lmsBox.Server.Services;

public interface IAdminActivityTracker
{
    Task TrackAsync(
        ApplicationUser user,
        string auditAction,
        string auditDetails,
        string engagementEventType,
        string? courseId = null,
        long? organisationId = null,
        object? metadata = null);
}
