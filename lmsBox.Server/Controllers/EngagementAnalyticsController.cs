using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using lmsBox.Server.Services;
using lmsbox.infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace lmsBox.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "OrgAdmin,SuperAdmin")]
    public class EngagementAnalyticsController : ControllerBase
    {
        private readonly IEngagementTrackingService _engagementService;
        private readonly IAuditLogService _auditLogService;
        private readonly ApplicationDbContext _context;
        private readonly ILogger<EngagementAnalyticsController> _logger;

        public EngagementAnalyticsController(
            IEngagementTrackingService engagementService,
            IAuditLogService auditLogService,
            ApplicationDbContext context,
            ILogger<EngagementAnalyticsController> logger)
        {
            _engagementService = engagementService;
            _auditLogService = auditLogService;
            _context = context;
            _logger = logger;
        }

        [HttpPost("track-preview")]
        [Authorize]
        public async Task<IActionResult> TrackPreview([FromBody] PreviewTrackingRequest request)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized(new { message = "User not authenticated" });

                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
                if (user == null)
                    return NotFound(new { message = "User not found" });

                // Track the preview event for engagement analytics
                await _engagementService.TrackAsync(
                    userId,
                    user.OrganisationID ?? 0,
                    EngagementTrackingService.EVENT_PREVIEW_CONTENT,
                    metadata: new
                    {
                        contentId = request.ContentId,
                        contentTitle = request.ContentTitle,
                        contentType = request.ContentType,
                        isLibraryContent = request.IsLibraryContent
                    }
                );

                // Also log to audit log
                try
                {
                    await _auditLogService.LogContentPreview(userId, user.UserName ?? "Unknown User", 
                        request.ContentId, request.ContentTitle, request.ContentType);
                }
                catch (Exception auditEx)
                {
                    _logger.LogWarning(auditEx, "Failed to log preview to audit log, but tracking succeeded");
                }

                return Ok(new { success = true, message = "Preview activity tracked" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to track preview activity");
                // Don't fail the preview if tracking fails
                return Ok(new { success = false, message = "Failed to track preview", error = ex.Message });
            }
        }

        [HttpGet("overview")]
        public async Task<IActionResult> GetOverview([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
                
                if (user?.OrganisationID == null)
                    return BadRequest(new { message = "User organisation not found" });

                var from = fromDate ?? DateTime.UtcNow.AddDays(-30);
                var to = toDate ?? DateTime.UtcNow;

                var overview = await _engagementService.GetOrganisationOverviewAsync(user.OrganisationID.Value, from, to);
                
                return Ok(overview);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get engagement overview");
                return StatusCode(500, new { message = "Failed to load engagement overview" });
            }
        }

        [HttpGet("daily-scores")]
        public async Task<IActionResult> GetDailyScores([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
                
                if (user?.OrganisationID == null)
                    return BadRequest(new { message = "User organisation not found" });

                var from = fromDate ?? DateTime.UtcNow.AddDays(-30);
                var to = toDate ?? DateTime.UtcNow;

                var scores = await _engagementService.GetDailyEngagementScoresAsync(user.OrganisationID.Value, from, to);
                
                return Ok(scores);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get daily engagement scores");
                return StatusCode(500, new { message = "Failed to load daily scores" });
            }
        }

        [HttpGet("top-users")]
        public async Task<IActionResult> GetTopUsers([FromQuery] int days = 30, [FromQuery] int top = 10)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
                
                if (user?.OrganisationID == null)
                    return BadRequest(new { message = "User organisation not found" });

                var topUsers = await _engagementService.GetTopEngagementUsersAsync(user.OrganisationID.Value, days, top);
                
                return Ok(topUsers);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get top engaged users");
                return StatusCode(500, new { message = "Failed to load top users" });
            }
        }

        [HttpGet("event-breakdown")]
        public async Task<IActionResult> GetEventBreakdown([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
                
                if (user?.OrganisationID == null)
                    return BadRequest(new { message = "User organisation not found" });

                var from = fromDate ?? DateTime.UtcNow.AddDays(-30);
                var to = toDate ?? DateTime.UtcNow;

                var breakdown = await _engagementService.GetEventBreakdownAsync(user.OrganisationID.Value, from, to);
                
                return Ok(breakdown);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get event breakdown");
                return StatusCode(500, new { message = "Failed to load event breakdown" });
            }
        }
    }

    public class PreviewTrackingRequest
    {
        public required string ContentId { get; set; }
        public required string ContentTitle { get; set; }
        public required string ContentType { get; set; }
        public bool IsLibraryContent { get; set; }
    }
}
