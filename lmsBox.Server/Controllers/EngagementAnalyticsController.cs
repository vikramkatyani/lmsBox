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
        private readonly ApplicationDbContext _context;
        private readonly ILogger<EngagementAnalyticsController> _logger;

        public EngagementAnalyticsController(
            IEngagementTrackingService engagementService, 
            ApplicationDbContext context,
            ILogger<EngagementAnalyticsController> logger)
        {
            _engagementService = engagementService;
            _context = context;
            _logger = logger;
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
}
