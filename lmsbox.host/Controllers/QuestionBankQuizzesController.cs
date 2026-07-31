using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/superadmin/question-bank/quizzes")]
[Authorize(Roles = "SuperAdmin")]
public class QuestionBankQuizzesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ILogger<QuestionBankQuizzesController> _logger;
    private readonly IAdminActivityTracker _activityTracker;
    private readonly IQuizFeatureService _quizFeatures;

    public QuestionBankQuizzesController(
        ApplicationDbContext context,
        UserManager<ApplicationUser> userManager,
        ILogger<QuestionBankQuizzesController> logger,
        IAdminActivityTracker activityTracker,
        IQuizFeatureService quizFeatures)
    {
        _context = context;
        _userManager = userManager;
        _logger = logger;
        _activityTracker = activityTracker;
        _quizFeatures = quizFeatures;
    }

    // GET /api/superadmin/question-bank/quizzes?search=term
    [HttpGet]
    public async Task<IActionResult> GetBankQuizzes([FromQuery] string? search = null)
    {
        var query = _context.Quizzes
            .Where(q => q.IsQuestionBank && q.CourseId == null)
            .Include(q => q.CreatedByUser)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.ToLower();
            query = query.Where(q =>
                q.Title.ToLower().Contains(s) ||
                (q.Description != null && q.Description.ToLower().Contains(s)));
        }

        var quizzes = await query
            .OrderByDescending(q => q.CreatedAt)
            .Select(q => new
            {
                q.Id,
                q.Title,
                q.Description,
                q.PassingScore,
                q.IsTimed,
                q.TimeLimit,
                q.AllowRetake,
                q.MaxAttempts,
                q.CreatedAt,
                q.UpdatedAt,
                QuestionCount = q.Questions.Count,
                CreatedBy = new
                {
                    q.CreatedByUser!.Id,
                    Name = q.CreatedByUser.FirstName + " " + q.CreatedByUser.LastName
                }
            })
            .ToListAsync();

        return Ok(new { items = quizzes });
    }

    // GET /api/superadmin/question-bank/quizzes/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetBankQuiz(string id)
    {
        var quiz = await _context.Quizzes
            .Include(q => q.Questions.OrderBy(qq => qq.Order))
                .ThenInclude(qq => qq.Options.OrderBy(o => o.Order))
            .Include(q => q.CreatedByUser)
            .FirstOrDefaultAsync(q => q.Id == id && q.IsQuestionBank && q.CourseId == null);

        if (quiz == null)
        {
            return NotFound(new { message = "Question bank assessment not found" });
        }

        return Ok(new
        {
            quiz.Id,
            quiz.Title,
            quiz.Description,
            quiz.IntroductionContent,
            quiz.PassingScore,
            quiz.IsTimed,
            quiz.TimeLimit,
            quiz.ShuffleQuestions,
            quiz.ShuffleAnswers,
            quiz.ShowResults,
            quiz.AllowRetake,
            quiz.MaxAttempts,
            quiz.QuestionsPerAttempt,
            quiz.CreatedAt,
            quiz.UpdatedAt,
            Questions = quiz.Questions.Select(qq => new
            {
                qq.Id,
                qq.Question,
                qq.Type,
                qq.Points,
                qq.Explanation,
                qq.Category,
                qq.IsCriticalSafety,
                qq.Order,
                Options = qq.Options.Select(o => new
                {
                    o.Id,
                    o.Text,
                    o.IsCorrect,
                    o.Order
                })
            })
        });
    }

    // POST /api/superadmin/question-bank/quizzes
    [HttpPost]
    public async Task<IActionResult> CreateBankQuiz([FromBody] CreateQuizRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var user = await _userManager.GetUserAsync(User);
        if (user == null)
        {
            return Unauthorized();
        }

        var quizId = Guid.NewGuid().ToString("N");

        var quiz = new Quiz
        {
            Id = quizId,
            Title = request.Title,
            Description = request.Description,
            IntroductionContent = request.IntroductionContent,
            PassingScore = request.PassingScore,
            IsTimed = request.IsTimed,
            TimeLimit = request.TimeLimit,
            ShuffleQuestions = request.ShuffleQuestions,
            ShuffleAnswers = request.ShuffleAnswers,
            ShowResults = request.ShowResults,
            AllowRetake = request.AllowRetake,
            MaxAttempts = request.MaxAttempts,
            QuestionsPerAttempt = request.QuestionsPerAttempt,
            CourseId = null,
            IsQuestionBank = true,
            CreatedByUserId = user.Id,
            CreatedAt = DateTime.UtcNow
        };

        if (request.Questions != null && request.Questions.Any())
        {
            for (int i = 0; i < request.Questions.Count; i++)
            {
                var qReq = request.Questions[i];
                var question = new QuizQuestion
                {
                    Question = qReq.Question,
                    Type = qReq.Type,
                    Points = qReq.Points,
                    Explanation = qReq.Explanation,
                    Category = qReq.Category,
                    IsCriticalSafety = _quizFeatures.ResolveCriticalSafety(qReq.IsCriticalSafety),
                    QuizId = quizId,
                    Order = i
                };

                if (qReq.Options != null && qReq.Options.Any())
                {
                    for (int j = 0; j < qReq.Options.Count; j++)
                    {
                        var oReq = qReq.Options[j];
                        question.Options.Add(new QuizQuestionOption
                        {
                            Text = oReq.Text,
                            IsCorrect = oReq.IsCorrect,
                            QuizQuestion = question,
                            Order = j
                        });
                    }
                }

                quiz.Questions.Add(question);
            }
        }

        _context.Quizzes.Add(quiz);
        await _context.SaveChangesAsync();

        await _activityTracker.TrackAsync(
            user,
            "Question Bank Quiz Created",
            $"Assessment ID: {quizId}, Title: {quiz.Title}, Question Count: {quiz.Questions.Count}",
            EngagementTrackingService.EVENT_QUESTION_BANK_QUIZ_CREATED,
            metadata: new { quizId, title = quiz.Title, questionCount = quiz.Questions.Count });

        return CreatedAtAction(nameof(GetBankQuiz), new { id = quizId }, new { id = quizId });
    }

    // PUT /api/superadmin/question-bank/quizzes/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateBankQuiz(string id, [FromBody] UpdateQuizRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var quiz = await _context.Quizzes
            .Include(q => q.Questions)
                .ThenInclude(qq => qq.Options)
            .FirstOrDefaultAsync(q => q.Id == id && q.IsQuestionBank && q.CourseId == null);

        if (quiz == null)
        {
            return NotFound(new { message = "Question bank assessment not found" });
        }

        quiz.Title = request.Title;
        quiz.Description = request.Description;
        quiz.IntroductionContent = request.IntroductionContent;
        quiz.PassingScore = request.PassingScore;
        quiz.IsTimed = request.IsTimed;
        quiz.TimeLimit = request.TimeLimit;
        quiz.ShuffleQuestions = request.ShuffleQuestions;
        quiz.ShuffleAnswers = request.ShuffleAnswers;
        quiz.ShowResults = request.ShowResults;
        quiz.AllowRetake = request.AllowRetake;
        quiz.MaxAttempts = request.MaxAttempts;
        quiz.QuestionsPerAttempt = request.QuestionsPerAttempt;
        quiz.UpdatedAt = DateTime.UtcNow;

        _context.QuizQuestions.RemoveRange(quiz.Questions);
        quiz.Questions.Clear();

        if (request.Questions != null && request.Questions.Any())
        {
            for (int i = 0; i < request.Questions.Count; i++)
            {
                var qReq = request.Questions[i];
                var question = new QuizQuestion
                {
                    Question = qReq.Question,
                    Type = qReq.Type,
                    Points = qReq.Points,
                    Explanation = qReq.Explanation,
                    Category = qReq.Category,
                    IsCriticalSafety = _quizFeatures.ResolveCriticalSafety(qReq.IsCriticalSafety),
                    QuizId = id,
                    Order = i
                };

                if (qReq.Options != null && qReq.Options.Any())
                {
                    for (int j = 0; j < qReq.Options.Count; j++)
                    {
                        var oReq = qReq.Options[j];
                        question.Options.Add(new QuizQuestionOption
                        {
                            Text = oReq.Text,
                            IsCorrect = oReq.IsCorrect,
                            QuizQuestion = question,
                            Order = j
                        });
                    }
                }

                quiz.Questions.Add(question);
            }
        }

        await _context.SaveChangesAsync();

        var user = await _userManager.GetUserAsync(User);
        if (user != null)
        {
            await _activityTracker.TrackAsync(
                user,
                "Question Bank Quiz Updated",
                $"Assessment ID: {id}, Title: {quiz.Title}, Question Count: {quiz.Questions.Count}",
                EngagementTrackingService.EVENT_QUESTION_BANK_QUIZ_UPDATED,
                metadata: new { quizId = id, title = quiz.Title, questionCount = quiz.Questions.Count });
        }

        return Ok(new { message = "Question bank assessment updated successfully" });
    }

    // DELETE /api/superadmin/question-bank/quizzes/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteBankQuiz(string id)
    {
        var quiz = await _context.Quizzes
            .FirstOrDefaultAsync(q => q.Id == id && q.IsQuestionBank && q.CourseId == null);

        if (quiz == null)
        {
            return NotFound(new { message = "Question bank assessment not found" });
        }

        var user = await _userManager.GetUserAsync(User);
        var quizId = quiz.Id;
        var quizTitle = quiz.Title;
        _context.Quizzes.Remove(quiz);
        await _context.SaveChangesAsync();

        if (user != null)
        {
            await _activityTracker.TrackAsync(
                user,
                "Question Bank Quiz Deleted",
                $"Assessment ID: {quizId}, Title: {quizTitle}",
                EngagementTrackingService.EVENT_QUESTION_BANK_QUIZ_DELETED,
                metadata: new { quizId, title = quizTitle });
        }

        return Ok(new { message = "Question bank assessment deleted successfully" });
    }
}

