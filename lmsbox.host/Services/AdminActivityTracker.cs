using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Services;

public class AdminActivityTracker : IAdminActivityTracker
{
    private readonly ApplicationDbContext _context;
    private readonly IAuditLogService _auditLogService;
    private readonly IEngagementTrackingService _engagementService;
    private readonly ILogger<AdminActivityTracker> _logger;

    public AdminActivityTracker(
        ApplicationDbContext context,
        IAuditLogService auditLogService,
        IEngagementTrackingService engagementService,
        ILogger<AdminActivityTracker> logger)
    {
        _context = context;
        _auditLogService = auditLogService;
        _engagementService = engagementService;
        _logger = logger;
    }

    public async Task TrackAsync(
        ApplicationUser user,
        string auditAction,
        string auditDetails,
        string engagementEventType,
        string? courseId = null,
        long? organisationId = null,
        object? metadata = null)
    {
        var performedBy = FormatUserName(user);
        var details = $"{auditDetails}; Performed By User ID: {user.Id}";

        try
        {
            await _auditLogService.LogCustomAction(auditAction, performedBy, details);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write audit log for action {Action}", auditAction);
        }

        try
        {
            var orgId = await ResolveOrganisationIdAsync(user, organisationId, courseId);
            if (orgId.HasValue)
            {
                await _engagementService.TrackAsync(
                    user.Id,
                    orgId.Value,
                    engagementEventType,
                    courseId: courseId,
                    metadata: metadata);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to track engagement for action {Action}", auditAction);
        }
    }

    private async Task<long?> ResolveOrganisationIdAsync(ApplicationUser user, long? explicitOrgId, string? courseId)
    {
        if (explicitOrgId.HasValue && explicitOrgId.Value > 0)
        {
            return explicitOrgId.Value;
        }

        if (user.OrganisationID.HasValue && user.OrganisationID.Value > 0)
        {
            return user.OrganisationID.Value;
        }

        if (!string.IsNullOrWhiteSpace(courseId))
        {
            return await _context.Courses
                .AsNoTracking()
                .Where(c => c.Id == courseId)
                .Select(c => (long?)c.OrganisationId)
                .FirstOrDefaultAsync();
        }

        return null;
    }

    internal static string FormatUserName(ApplicationUser user)
    {
        var name = $"{user.FirstName} {user.LastName}".Trim();
        return string.IsNullOrWhiteSpace(name) ? (user.Email ?? user.UserName ?? user.Id) : name;
    }
}
