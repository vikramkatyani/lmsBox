using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "OrgAdmin,SuperAdmin")]
public class AIAssistantController : ControllerBase
{
    private readonly IAIAssistantService _aiService;
    private readonly ILogger<AIAssistantController> _logger;

    public AIAssistantController(IAIAssistantService aiService, ILogger<AIAssistantController> logger)
    {
        _aiService = aiService;
        _logger = logger;
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

            return Ok(new { content = result });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating course outline");
            return StatusCode(500, new { error = "Failed to generate course outline" });
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

            return Ok(new { response = result });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in AI chat");
            return StatusCode(500, new { error = "Failed to process chat message" });
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
