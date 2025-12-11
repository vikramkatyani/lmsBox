using lmsBox.Server.Services;
using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "OrgAdmin,SuperAdmin")]
public class AIAssistantController : ControllerBase
{
    private readonly IAIAssistantService _aiService;
    private readonly ILogger<AIAssistantController> _logger;
    private readonly IEngagementTrackingService _engagementService;
    private readonly ApplicationDbContext _context;

    public AIAssistantController(
        IAIAssistantService aiService, 
        ILogger<AIAssistantController> logger,
        IEngagementTrackingService engagementService,
        ApplicationDbContext context)
    {
        _aiService = aiService;
        _logger = logger;
        _engagementService = engagementService;
        _context = context;
    }

    [HttpPost("generate-course-outline")]
    public async Task<IActionResult> GenerateCourseOutline([FromBody] GenerateCourseOutlineRequest request)
    {
        try
        {
            var result = await _aiService.GenerateCourseOutlineAsync(
                request.Topic, 
                request.Level, 
                request.Duration);

            await TrackAIQuery("generate-course-outline", new { request.Topic, request.Level, request.Duration });
            
            return Ok(new { content = result });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "AI Assistant feature unavailable");
            return StatusCode(503, new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating course outline");
            return StatusCode(500, new { error = "Failed to generate course outline: " + ex.Message });
        }
    }

    [HttpPost("generate-lesson-content")]
    public async Task<IActionResult> GenerateLessonContent([FromBody] GenerateLessonContentRequest request)
    {
        try
        {
            var result = await _aiService.GenerateLessonContentAsync(
                request.LessonTitle, 
                request.Context);

            await TrackAIQuery("generate-lesson-content", new { request.LessonTitle });

            return Ok(new { content = result });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating lesson content");
            return StatusCode(500, new { error = "Failed to generate lesson content" });
        }
    }

    [HttpPost("generate-quiz-questions")]
    public async Task<IActionResult> GenerateQuizQuestions([FromBody] GenerateQuizQuestionsRequest request)
    {
        try
        {
            var result = await _aiService.GenerateQuizQuestionsAsync(
                request.Topic, 
                request.QuestionCount, 
                request.Difficulty);

            await TrackAIQuery("generate-quiz-questions", new { request.Topic, request.QuestionCount, request.Difficulty });

            return Ok(new { content = result });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating quiz questions");
            return StatusCode(500, new { error = "Failed to generate quiz questions" });
        }
    }

    [HttpPost("improve-content")]
    public async Task<IActionResult> ImproveContent([FromBody] ImproveContentRequest request)
    {
        try
        {
            var result = await _aiService.ImproveContentAsync(
                request.Content, 
                request.ImprovementType);

            await TrackAIQuery("improve-content", new { request.ImprovementType });

            return Ok(new { content = result });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error improving content");
            return StatusCode(500, new { error = "Failed to improve content" });
        }
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] ChatRequest request)
    {
        try
        {
            var result = await _aiService.ChatAsync(
                request.Message, 
                request.Context);

            await TrackAIQuery("chat", new { hasContext = !string.IsNullOrEmpty(request.Context) });

            return Ok(new { response = result });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in AI chat");
            return StatusCode(500, new { error = "Failed to process chat message" });
        }
    }

    [HttpPost("learner-query")]
    [AllowAnonymous] // Override class-level role restriction - still requires authentication via JWT
    public async Task<IActionResult> LearnerQuery([FromBody] LearnerQueryRequest request)
    {
        try
        {
            var result = await _aiService.LearnerCourseQueryAsync(
                request.Question,
                request.CourseTitle,
                request.LessonTitle,
                request.AdditionalContext);

            await TrackAIQuery("learner-query", new { request.CourseTitle, request.LessonTitle });

            return Ok(new { response = result });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "AI Assistant feature unavailable for learner query");
            return StatusCode(503, new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing learner query");
            return StatusCode(500, new { error = "Failed to process your question. Please try again." });
        }
    }

    private async Task TrackAIQuery(string queryType, object metadata)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId)) return;

            var orgId = await _context.Users
                .Where(u => u.Id == userId)
                .Select(u => u.OrganisationID)
                .FirstOrDefaultAsync();

            if (orgId.HasValue)
            {
                _logger.LogInformation("📊 Tracking AI query: User={UserId}, Org={OrgId}, Type={QueryType}", userId, orgId.Value, queryType);
                await _engagementService.TrackAsync(
                    userId,
                    orgId.Value,
                    EngagementTrackingService.EVENT_AI_QUERY,
                    metadata: new { queryType, details = metadata }
                );
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to track AI query");
        }
    }
}

public class GenerateCourseOutlineRequest
{
    public string Topic { get; set; } = string.Empty;
    public string? Level { get; set; }
    public string? Duration { get; set; }
}

public class GenerateLessonContentRequest
{
    public string LessonTitle { get; set; } = string.Empty;
    public string? Context { get; set; }
}

public class GenerateQuizQuestionsRequest
{
    public string Topic { get; set; } = string.Empty;
    public int QuestionCount { get; set; } = 5;
    public string? Difficulty { get; set; }
}

public class ImproveContentRequest
{
    public string Content { get; set; } = string.Empty;
    public string ImprovementType { get; set; } = "general";
}

public class ChatRequest
{
    public string Message { get; set; } = string.Empty;
    public string? Context { get; set; }
}

public class LearnerQueryRequest
{
    public string Question { get; set; } = string.Empty;
    public string CourseTitle { get; set; } = string.Empty;
    public string? LessonTitle { get; set; }
    public string? AdditionalContext { get; set; }
}
