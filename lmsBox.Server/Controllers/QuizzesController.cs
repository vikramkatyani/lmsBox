using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using lmsbox.infrastructure.Data;
using lmsbox.domain.Models;
using lmsBox.Server.Services;

namespace lmsBox.Server.Controllers;

[Authorize] // Any authenticated user can access quizzes in their courses
[ApiController]
[Route("api/learner/quizzes")]
public class QuizzesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<QuizzesController> _logger;
    private readonly IEngagementTrackingService _engagementService;

    public QuizzesController(
        ApplicationDbContext context, 
        ILogger<QuizzesController> logger,
        IEngagementTrackingService engagementService)
    {
        _context = context;
        _logger = logger;
        _engagementService = engagementService;
    }

    /// <summary>
    /// Get quiz details with questions
    /// </summary>
    [HttpGet("{quizId}")]
    public async Task<IActionResult> GetQuiz(string quizId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var quiz = await _context.Quizzes
                .Include(q => q.Questions.OrderBy(qq => qq.Order))
                    .ThenInclude(qq => qq.Options.OrderBy(o => o.Order))
                .FirstOrDefaultAsync(q => q.Id == quizId);

            if (quiz == null)
            {
                return NotFound(new { message = "Quiz not found" });
            }

            // Shuffle questions if enabled
            var questions = quiz.Questions.ToList();
            if (quiz.ShuffleQuestions)
            {
                questions = questions.OrderBy(x => Guid.NewGuid()).ToList();
            }

            var result = new
            {
                id = quiz.Id,
                title = quiz.Title,
                description = quiz.Description,
                passingScore = quiz.PassingScore,
                isTimed = quiz.IsTimed,
                timeLimit = quiz.TimeLimit,
                showResults = quiz.ShowResults,
                allowRetake = quiz.AllowRetake,
                maxAttempts = quiz.MaxAttempts,
                questions = questions.Select((q, index) => new
                {
                    id = q.Id,
                    question = q.Question,
                    type = q.Type,
                    points = q.Points,
                    explanation = q.Explanation,
                    order = index + 1,
                    options = quiz.ShuffleAnswers
                        ? q.Options.OrderBy(x => Guid.NewGuid()).Select(o => new
                        {
                            id = o.Id,
                            text = o.Text
                            // Don't send isCorrect to client
                        }).ToList()
                        : q.Options.Select(o => new
                        {
                            id = o.Id,
                            text = o.Text
                        }).ToList()
                }).ToList()
            };

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching quiz {QuizId}", quizId);
            return StatusCode(500, new { message = "An error occurred while fetching quiz" });
        }
    }

    /// <summary>
    /// Submit quiz answers and get results
    /// </summary>
    [HttpPost("{quizId}/submit")]
    public async Task<IActionResult> SubmitQuiz(string quizId, [FromBody] QuizSubmissionRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            var quiz = await _context.Quizzes
                .Include(q => q.Questions)
                    .ThenInclude(qq => qq.Options)
                .FirstOrDefaultAsync(q => q.Id == quizId);

            if (quiz == null)
            {
                return NotFound(new { message = "Quiz not found" });
            }

            // Calculate score
            int totalPoints = 0;
            int earnedPoints = 0;
            var questionResults = new List<object>();

            foreach (var question in quiz.Questions)
            {
                totalPoints += question.Points;
                var answer = request.Answers.FirstOrDefault(a => a.QuestionId == question.Id);

                if (answer != null)
                {
                    bool isCorrect = false;

                    if (question.Type == "mc_single" || question.Type == "true_false")
                    {
                        // Single choice - check if selected option is correct
                        var selectedOption = question.Options.FirstOrDefault(o => o.Id == answer.SelectedOptionId);
                        isCorrect = selectedOption?.IsCorrect == true;
                    }
                    else if (question.Type == "mc_multi")
                    {
                        // Multiple choice - all selected options must be correct and all correct options must be selected
                        var correctOptionIds = question.Options.Where(o => o.IsCorrect).Select(o => o.Id).ToHashSet();
                        var selectedOptionIds = answer.SelectedOptionIds?.ToHashSet() ?? new HashSet<long>();
                        isCorrect = correctOptionIds.SetEquals(selectedOptionIds);
                    }

                    if (isCorrect)
                    {
                        earnedPoints += question.Points;
                    }

                    questionResults.Add(new
                    {
                        questionId = question.Id,
                        isCorrect,
                        explanation = question.Explanation,
                        correctAnswers = question.Options.Where(o => o.IsCorrect).Select(o => o.Id).ToList()
                    });
                }
            }

            int scorePercent = totalPoints > 0 ? (int)((double)earnedPoints / totalPoints * 100) : 0;
            bool passed = scorePercent >= quiz.PassingScore;

            // Track quiz attempt engagement
            var orgId = await _context.Users
                .Where(u => u.Id == userId)
                .Select(u => u.OrganisationID)
                .FirstOrDefaultAsync();

            if (orgId.HasValue)
            {
                _logger.LogInformation("📊 Tracking quiz attempt: User={UserId}, Org={OrgId}, Quiz={QuizId}, Score={Score}", userId, orgId.Value, quizId, scorePercent);
                await _engagementService.TrackAsync(
                    userId,
                    orgId.Value,
                    EngagementTrackingService.EVENT_QUIZ_ATTEMPT,
                    quizId: long.TryParse(quizId, out var qId) ? qId : null,
                    metadata: new { score = scorePercent, passed }
                );
            }

            var result = new
            {
                score = scorePercent,
                passed,
                earnedPoints,
                totalPoints,
                passingScore = quiz.PassingScore,
                questionResults = quiz.ShowResults ? questionResults : null
            };

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting quiz {QuizId}", quizId);
            return StatusCode(500, new { message = "An error occurred while submitting quiz" });
        }
    }
}

// DTOs
public class QuizSubmissionRequest
{
    public List<QuizAnswerDto> Answers { get; set; } = new();
}

public class QuizAnswerDto
{
    public long QuestionId { get; set; }
    public long? SelectedOptionId { get; set; } // For single choice
    public List<long>? SelectedOptionIds { get; set; } // For multiple choice
    public string? TextAnswer { get; set; } // For short answer
}
