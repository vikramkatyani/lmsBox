using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using lmsbox.infrastructure.Data;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/admin/activity-logs")]
[Authorize(Roles = "Admin,OrgAdmin,TenantAdmin,SuperAdmin")]
public class AdminActivityLogsController : ControllerBase
{
    private readonly IActivityLogQueryService _activityLogQueryService;
    private readonly ApplicationDbContext _context;

    public AdminActivityLogsController(
        IActivityLogQueryService activityLogQueryService,
        ApplicationDbContext context)
    {
        _activityLogQueryService = activityLogQueryService;
        _context = context;
    }

    [HttpGet("recent")]
    public async Task<IActionResult> Recent(
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var (organisationId, includeAuditLogs) = await ResolveAccessAsync(cancellationToken);

        var result = await _activityLogQueryService.GetRecentAsync(
            limit,
            organisationId,
            includeAuditLogs,
            cancellationToken);

        return Ok(new { items = result.Items, limit = result.Limit });
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search = null,
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] string? actionContains = null,
        [FromQuery] string? performedBy = null,
        [FromQuery] string? actorType = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var (organisationId, includeAuditLogs) = await ResolveAccessAsync(cancellationToken);

        var result = await _activityLogQueryService.ListAsync(
            new ActivityLogQueryFilter
            {
                Search = search,
                DateFrom = dateFrom,
                DateTo = dateTo,
                ActionContains = actionContains,
                PerformedBy = performedBy,
                ActorType = actorType,
                Page = page,
                PageSize = pageSize
            },
            organisationId,
            includeAuditLogs,
            cancellationToken);

        return Ok(new
        {
            items = result.Items,
            total = result.Total,
            page = result.Page,
            pageSize = result.PageSize,
            totalPages = result.TotalPages
        });
    }

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] string? actorType = null,
        CancellationToken cancellationToken = default)
    {
        var (organisationId, includeAuditLogs) = await ResolveAccessAsync(cancellationToken);

        var result = await _activityLogQueryService.GetSummaryAsync(
            new ActivityLogQueryFilter
            {
                DateFrom = dateFrom,
                DateTo = dateTo,
                ActorType = actorType
            },
            organisationId,
            includeAuditLogs,
            cancellationToken);

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id, CancellationToken cancellationToken = default)
    {
        var (organisationId, includeAuditLogs) = await ResolveAccessAsync(cancellationToken);

        var log = await _activityLogQueryService.GetByIdAsync(
            id,
            organisationId,
            includeAuditLogs,
            cancellationToken);

        if (log is null)
        {
            return NotFound(new { error = "Activity log entry not found." });
        }

        return Ok(log);
    }

    private async Task<(long? OrganisationId, bool IncludeAuditLogs)> ResolveAccessAsync(CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        var scope = await AdminUserScope.ResolveAsync(User, _context);
        var includeAuditLogs = User.IsInRole("SuperAdmin");
        return (scope.OrganisationId, includeAuditLogs);
    }
}
