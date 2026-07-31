using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
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
    private readonly IQuizFeatureService _quizFeatures;

    public QuizzesController(
        ApplicationDbContext context,
        ILogger<QuizzesController> logger,
        IEngagementTrackingService engagementService,
        IQuizFeatureService quizFeatures)
    {
        _context = context;
        _logger = logger;
        _engagementService = engagementService;
        _quizFeatures = quizFeatures;
    }

    /// <summary>
    /// Get quiz metadata and attempt status. Questions are returned via start or in-progress resume.
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
                return NotFound(new { message = "Assessment not found" });
            }

            var userAttempts = await LoadUserAttemptsAsync(quizId, userId);
            var completedAttempts = userAttempts.Where(a => a.IsCompleted).ToList();

            var (attemptCount, hasPassed, canAttempt) = GetAttemptStatus(quiz, completedAttempts);
            // Always surface the latest completed attempt so learners returning after a fail
            // see Feedback until they explicitly choose Retake Assessment.
            QuizAttempt? reviewAttempt = null;
            if (completedAttempts.Count > 0)
            {
                reviewAttempt = hasPassed
                    ? completedAttempts.FirstOrDefault(a => a.Passed) ?? completedAttempts.FirstOrDefault()
                    : completedAttempts.FirstOrDefault();
            }
            object? lastAttemptResult = null;
            if (reviewAttempt != null)
            {
                lastAttemptResult = BuildAttemptResult(quiz, reviewAttempt);
            }

            var activePool = await FilterOutArchivedBankQuestionsAsync(quiz.Questions.ToList());
            var poolSize = activePool.Count;
            var questionsPerAttempt = GetEffectiveQuestionsPerAttempt(quiz, poolSize);
            var inProgress = userAttempts.FirstOrDefault(a => !a.IsCompleted);

            List<object>? questions = null;
            long? attemptId = null;
            if (inProgress != null)
            {
                attemptId = inProgress.Id;
                var selected = await GetAttemptQuestionsAsync(inProgress, quiz);
                selected = await FilterOutArchivedBankQuestionsAsync(selected);
                if (selected.Count == 0)
                {
                    return BadRequest(new { message = "All questions in this assessment are archived. Please contact your administrator." });
                }
                questions = MapQuestionsForLearner(quiz, selected);
            }

            var result = new
            {
                id = quiz.Id,
                title = quiz.Title,
                description = quiz.Description,
                introductionContent = quiz.IntroductionContent,
                passingScore = quiz.PassingScore,
                isTimed = quiz.IsTimed,
                timeLimit = quiz.TimeLimit,
                showResults = quiz.ShowResults,
                allowRetake = quiz.AllowRetake,
                maxAttempts = quiz.MaxAttempts,
                questionPoolSize = poolSize,
                questionsPerAttempt,
                usesRandomSubset = questionsPerAttempt < poolSize,
                attemptCount,
                hasPassed,
                canAttempt,
                attemptId,
                inProgressAttempt = inProgress != null,
                lastAttemptResult,
                questions = questions ?? new List<object>()
            };

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching quiz {QuizId}", quizId);
            return StatusCode(500, new { message = "An error occurred while fetching assessment" });
        }
    }

    /// <summary>
    /// Start a new attempt and receive the question set for this attempt.
    /// </summary>
    [HttpPost("{quizId}/start")]
    public async Task<IActionResult> StartAttempt(string quizId)
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
                return NotFound(new { message = "Assessment not found" });
            }

            var activePool = await FilterOutArchivedBankQuestionsAsync(quiz.Questions.ToList());
            if (activePool.Count == 0)
            {
                return BadRequest(new { message = "This assessment has no questions." });
            }

            var userAttempts = await LoadUserAttemptsAsync(quizId, userId);
            var completedAttempts = userAttempts.Where(a => a.IsCompleted).ToList();
            var (_, _, canAttempt) = GetAttemptStatus(quiz, completedAttempts);

            var inProgress = userAttempts.FirstOrDefault(a => !a.IsCompleted);
            if (inProgress != null)
            {
                var resumed = await GetAttemptQuestionsAsync(inProgress, quiz);
                resumed = await FilterOutArchivedBankQuestionsAsync(resumed);
                if (resumed.Count == 0)
                {
                    return BadRequest(new { message = "All questions in this assessment are archived. Please contact your administrator." });
                }
                return Ok(new
                {
                    attemptId = inProgress.Id,
                    resumed = true,
                    questions = MapQuestionsForLearner(quiz, resumed)
                });
            }

            if (!canAttempt)
            {
                return StatusCode(403, new { message = "You cannot start another attempt for this assessment." });
            }

            var selectedQuestions = SelectQuestionsForAttempt(quiz, activePool);
            var startedAt = DateTime.UtcNow;
            var attempt = new QuizAttempt
            {
                QuizId = quizId,
                UserId = userId,
                StartedAt = startedAt,
                CompletedAt = startedAt,
                IsCompleted = false,
                DurationSeconds = 0,
                ScorePercent = 0,
                Passed = false,
                FailedCriticalSafety = false
            };

            for (var i = 0; i < selectedQuestions.Count; i++)
            {
                attempt.AttemptQuestions.Add(new QuizAttemptQuestion
                {
                    QuizQuestionId = selectedQuestions[i].Id,
                    QuestionBankQuestionId = selectedQuestions[i].QuestionBankQuestionId,
                    DisplayOrder = i + 1
                });
            }

            _context.QuizAttempts.Add(attempt);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                attemptId = attempt.Id,
                resumed = false,
                questions = MapQuestionsForLearner(quiz, selectedQuestions)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting quiz attempt {QuizId}", quizId);
            return StatusCode(500, new { message = "An error occurred while starting the assessment attempt" });
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

            if (request.AttemptId == null)
            {
                return BadRequest(new { message = "AttemptId is required. Start the assessment before submitting." });
            }

            var quiz = await _context.Quizzes
                .Include(q => q.Questions)
                    .ThenInclude(qq => qq.Options)
                .FirstOrDefaultAsync(q => q.Id == quizId);

            if (quiz == null)
            {
                return NotFound(new { message = "Assessment not found" });
            }

            var attempt = await _context.QuizAttempts
                .Include(a => a.AttemptQuestions)
                .Include(a => a.Answers)
                .FirstOrDefaultAsync(a => a.Id == request.AttemptId && a.QuizId == quizId && a.UserId == userId);

            if (attempt == null)
            {
                return NotFound(new { message = "Assessment attempt not found" });
            }

            if (attempt.IsCompleted)
            {
                return BadRequest(new { message = "This attempt has already been submitted." });
            }

            var existingCompleted = await _context.QuizAttempts.AsNoTracking()
                .Where(a => a.QuizId == quizId && a.UserId == userId && a.IsCompleted)
                .ToListAsync();

            var (_, hasPassed, canAttempt) = GetAttemptStatus(quiz, existingCompleted);
            if (!canAttempt)
            {
                var reason = hasPassed
                    ? "You have already passed this assessment."
                    : "You have reached the maximum number of attempts for this assessment.";
                return StatusCode(403, new { message = reason });
            }

            var attemptQuestionIds = attempt.AttemptQuestions
                .OrderBy(aq => aq.DisplayOrder)
                .Select(aq => aq.QuizQuestionId)
                .ToHashSet();

            var questionsForAttempt = quiz.Questions
                .Where(q => attemptQuestionIds.Contains(q.Id))
                .OrderBy(q => attempt.AttemptQuestions.First(aq => aq.QuizQuestionId == q.Id).DisplayOrder)
                .ToList();

            var completedAt = request.CompletedAt ?? DateTime.UtcNow;
            var startedAt = request.StartedAt ?? attempt.StartedAt;
            var durationSeconds = request.DurationSeconds ?? Math.Max(0, (int)(completedAt - startedAt).TotalSeconds);

            int totalPoints = 0;
            int earnedPoints = 0;
            var questionResults = new List<object>();
            var attemptAnswers = new List<QuizAttemptAnswer>();
            bool failedCriticalSafety = false;

            foreach (var question in questionsForAttempt)
            {
                totalPoints += question.Points;
                var answer = request.Answers.FirstOrDefault(a => a.QuestionId == question.Id);
                bool isCorrect = false;

                if (answer != null)
                {
                    if (question.Type == "mc_single" || question.Type == "true_false")
                    {
                        var selectedOption = question.Options.FirstOrDefault(o => o.Id == answer.SelectedOptionId);
                        isCorrect = selectedOption?.IsCorrect == true;
                    }
                    else if (question.Type == "mc_multi")
                    {
                        var correctOptionIds = question.Options.Where(o => o.IsCorrect).Select(o => o.Id).ToHashSet();
                        var selectedOptionIds = answer.SelectedOptionIds?.ToHashSet() ?? new HashSet<long>();
                        isCorrect = correctOptionIds.SetEquals(selectedOptionIds);
                    }

                    if (isCorrect)
                    {
                        earnedPoints += question.Points;
                    }
                    else if (_quizFeatures.ResolveCriticalSafety(question.IsCriticalSafety))
                    {
                        failedCriticalSafety = true;
                    }

                    attemptAnswers.Add(new QuizAttemptAnswer
                    {
                        QuizQuestionId = question.Id,
                        QuestionBankQuestionId = question.QuestionBankQuestionId,
                        SelectedOptionId = answer.SelectedOptionId,
                        SelectedOptionIdsJson = answer.SelectedOptionIds != null
                            ? JsonSerializer.Serialize(answer.SelectedOptionIds)
                            : null,
                        SelectedQuestionBankOptionIdsJson = BuildSelectedBankOptionIdsJson(question, answer),
                        IsCorrect = isCorrect,
                        ResponseTimeMs = Math.Max(0, answer.ResponseTimeMs ?? 0)
                    });

                    var selectedTexts = question.Type == "mc_multi"
                        ? question.Options
                            .Where(o => (answer.SelectedOptionIds ?? new List<long>()).Contains(o.Id))
                            .Select(o => o.Text).ToList()
                        : question.Options
                            .Where(o => o.Id == answer.SelectedOptionId)
                            .Select(o => o.Text).ToList();

                    questionResults.Add(new
                    {
                        questionId = question.Id,
                        question = question.Question,
                        isCorrect,
                        isCriticalSafety = _quizFeatures.ResolveCriticalSafety(question.IsCriticalSafety),
                        category = question.Category,
                        responseTimeMs = answer.ResponseTimeMs,
                        explanation = question.Explanation,
                        selectedAnswerTexts = selectedTexts,
                        correctAnswerTexts = question.Options.Where(o => o.IsCorrect).Select(o => o.Text).ToList(),
                        correctAnswers = question.Options.Where(o => o.IsCorrect).Select(o => o.Id).ToList()
                    });
                }
                else if (_quizFeatures.ResolveCriticalSafety(question.IsCriticalSafety))
                {
                    failedCriticalSafety = true;
                    questionResults.Add(new
                    {
                        questionId = question.Id,
                        question = question.Question,
                        isCorrect = false,
                        isCriticalSafety = true,
                        category = question.Category,
                        responseTimeMs = (int?)null,
                        explanation = question.Explanation,
                        selectedAnswerTexts = new List<string>(),
                        correctAnswerTexts = question.Options.Where(o => o.IsCorrect).Select(o => o.Text).ToList(),
                        correctAnswers = question.Options.Where(o => o.IsCorrect).Select(o => o.Id).ToList()
                    });
                }
                else
                {
                    questionResults.Add(new
                    {
                        questionId = question.Id,
                        question = question.Question,
                        isCorrect = false,
                        isCriticalSafety = _quizFeatures.ResolveCriticalSafety(question.IsCriticalSafety),
                        category = question.Category,
                        responseTimeMs = (int?)null,
                        explanation = question.Explanation,
                        selectedAnswerTexts = new List<string>(),
                        correctAnswerTexts = question.Options.Where(o => o.IsCorrect).Select(o => o.Text).ToList(),
                        correctAnswers = question.Options.Where(o => o.IsCorrect).Select(o => o.Id).ToList()
                    });
                }
            }

            int scorePercent = totalPoints > 0 ? (int)((double)earnedPoints / totalPoints * 100) : 0;
            bool passed = scorePercent >= quiz.PassingScore
                && (!_quizFeatures.IsCriticalSafetyEnabled || !failedCriticalSafety);

            attempt.StartedAt = startedAt;
            attempt.CompletedAt = completedAt;
            attempt.DurationSeconds = durationSeconds;
            attempt.ScorePercent = scorePercent;
            attempt.Passed = passed;
            attempt.FailedCriticalSafety = _quizFeatures.IsCriticalSafetyEnabled && failedCriticalSafety;
            attempt.IsCompleted = true;
            attempt.Answers = attemptAnswers;

            await IncrementQuestionBankStatsAsync(quiz, questionsForAttempt, request);
            await _context.SaveChangesAsync();

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
                    courseId: quiz.CourseId,
                    durationSeconds: durationSeconds,
                    metadata: new
                    {
                        score = scorePercent,
                        passed,
                        failedCriticalSafety,
                        durationSeconds,
                        attemptId = attempt.Id,
                        quizId
                    }
                );
            }

            var updatedCompleted = existingCompleted
                .Concat(new[] { attempt })
                .ToList();
            var (attemptCount, _, canAttemptAfterSubmit) = GetAttemptStatus(quiz, updatedCompleted);

            var result = new
            {
                score = scorePercent,
                passed,
                failedCriticalSafety,
                earnedPoints,
                totalPoints,
                passingScore = quiz.PassingScore,
                durationSeconds,
                attemptId = attempt.Id,
                attemptCount,
                canAttempt = canAttemptAfterSubmit,
                // Only disclose per-question responses when the learner cannot take another attempt
                questionResults = quiz.ShowResults && !canAttemptAfterSubmit
                    ? questionResults
                    : null
            };

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting quiz {QuizId}", quizId);
            return StatusCode(500, new { message = "An error occurred while submitting assessment" });
        }
    }

    private string? BuildSelectedBankOptionIdsJson(QuizQuestion question, QuizAnswerDto answer)
    {
        if (question.QuestionBankQuestionId == null)
        {
            return null;
        }

        if (question.Type == "mc_single" || question.Type == "true_false")
        {
            if (answer.SelectedOptionId == null) return null;
            var opt = question.Options.FirstOrDefault(o => o.Id == answer.SelectedOptionId.Value);
            if (opt?.QuestionBankQuestionOptionId == null) return null;
            return JsonSerializer.Serialize(new List<long> { opt.QuestionBankQuestionOptionId.Value });
        }

        if (question.Type == "mc_multi")
        {
            var selectedIds = answer.SelectedOptionIds ?? new List<long>();
            var bankIds = question.Options
                .Where(o => selectedIds.Contains(o.Id) && o.QuestionBankQuestionOptionId != null)
                .Select(o => o.QuestionBankQuestionOptionId!.Value)
                .ToList();
            return bankIds.Count > 0 ? JsonSerializer.Serialize(bankIds) : null;
        }

        return null;
    }

    private async Task IncrementQuestionBankStatsAsync(Quiz quiz, List<QuizQuestion> questionsForAttempt, QuizSubmissionRequest request)
    {
        var bankIds = questionsForAttempt
            .Select(q => q.QuestionBankQuestionId)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        if (bankIds.Count == 0)
        {
            return;
        }

        var now = DateTime.UtcNow;
        var globals = await _context.QuestionBankQuestionStatsGlobal
            .Where(s => bankIds.Contains(s.QuestionBankQuestionId))
            .ToListAsync();

        var courseId = quiz.CourseId;
        var courseStats = courseId == null
            ? new List<QuestionBankQuestionStatsCourse>()
            : await _context.QuestionBankQuestionStatsCourse
                .Where(s => s.CourseId == courseId && bankIds.Contains(s.QuestionBankQuestionId))
                .ToListAsync();

        var quizStats = await _context.QuestionBankQuestionStatsQuiz
            .Where(s => s.QuizId == quiz.Id && bankIds.Contains(s.QuestionBankQuestionId))
            .ToListAsync();

        foreach (var q in questionsForAttempt)
        {
            if (q.QuestionBankQuestionId == null) continue;
            var bankId = q.QuestionBankQuestionId.Value;

            var submitted = request.Answers.FirstOrDefault(a => a.QuestionId == q.Id);
            var isCorrect = false;
            if (submitted != null)
            {
                if (q.Type == "mc_single" || q.Type == "true_false")
                {
                    var selectedOption = q.Options.FirstOrDefault(o => o.Id == submitted.SelectedOptionId);
                    isCorrect = selectedOption?.IsCorrect == true;
                }
                else if (q.Type == "mc_multi")
                {
                    var correctOptionIds = q.Options.Where(o => o.IsCorrect).Select(o => o.Id).ToHashSet();
                    var selectedOptionIds = submitted.SelectedOptionIds?.ToHashSet() ?? new HashSet<long>();
                    isCorrect = correctOptionIds.SetEquals(selectedOptionIds);
                }
            }

            var g = globals.FirstOrDefault(s => s.QuestionBankQuestionId == bankId);
            if (g == null)
            {
                g = new QuestionBankQuestionStatsGlobal { QuestionBankQuestionId = bankId };
                _context.QuestionBankQuestionStatsGlobal.Add(g);
                globals.Add(g);
            }
            g.PresentedCount += 1;
            if (isCorrect) g.CorrectCount += 1; else g.IncorrectCount += 1;
            g.LastPresentedAt = now;

            if (courseId != null)
            {
                var cs = courseStats.FirstOrDefault(s => s.CourseId == courseId && s.QuestionBankQuestionId == bankId);
                if (cs == null)
                {
                    cs = new QuestionBankQuestionStatsCourse { CourseId = courseId, QuestionBankQuestionId = bankId };
                    _context.QuestionBankQuestionStatsCourse.Add(cs);
                    courseStats.Add(cs);
                }
                cs.PresentedCount += 1;
                if (isCorrect) cs.CorrectCount += 1; else cs.IncorrectCount += 1;
                cs.LastPresentedAt = now;
            }

            var qs = quizStats.FirstOrDefault(s => s.QuizId == quiz.Id && s.QuestionBankQuestionId == bankId);
            if (qs == null)
            {
                qs = new QuestionBankQuestionStatsQuiz { QuizId = quiz.Id, QuestionBankQuestionId = bankId };
                _context.QuestionBankQuestionStatsQuiz.Add(qs);
                quizStats.Add(qs);
            }
            qs.PresentedCount += 1;
            if (isCorrect) qs.CorrectCount += 1; else qs.IncorrectCount += 1;
            qs.LastPresentedAt = now;
        }
    }

    private async Task<List<QuizAttempt>> LoadUserAttemptsAsync(string quizId, string userId)
    {
        return await _context.QuizAttempts
            .AsNoTracking()
            .Include(a => a.Answers)
            .Include(a => a.AttemptQuestions)
            .Where(a => a.QuizId == quizId && a.UserId == userId)
            .OrderByDescending(a => a.IsCompleted ? a.CompletedAt : a.StartedAt)
            .ToListAsync();
    }

    private async Task<List<QuizQuestion>> GetAttemptQuestionsAsync(QuizAttempt attempt, Quiz quiz)
    {
        var questionIds = attempt.AttemptQuestions
            .OrderBy(aq => aq.DisplayOrder)
            .Select(aq => aq.QuizQuestionId)
            .ToList();

        return questionIds
            .Select(id => quiz.Questions.First(q => q.Id == id))
            .ToList();
    }

    private static List<QuizQuestion> SelectQuestionsForAttempt(Quiz quiz, List<QuizQuestion> pool)
    {
        var count = GetEffectiveQuestionsPerAttempt(quiz, pool.Count);

        var selected = SelectByCategoryIfConfigured(quiz, pool, count);
        if (quiz.ShuffleQuestions)
        {
            selected = selected.OrderBy(_ => Guid.NewGuid()).ToList();
        }
        else
        {
            selected = selected.OrderBy(q => q.Order).ToList();
        }

        return selected;
    }

    private static List<QuizQuestion> SelectByCategoryIfConfigured(Quiz quiz, List<QuizQuestion> pool, int count)
    {
        if (count <= 0) return new List<QuizQuestion>();

        // Only meaningful in random-subset mode
        if (quiz.QuestionsPerAttempt == null || quiz.QuestionsPerAttempt <= 0 || quiz.QuestionsPerAttempt >= pool.Count)
        {
            return pool.ToList();
        }

        if (string.IsNullOrWhiteSpace(quiz.QuestionsPerAttemptByCategoryJson))
        {
            return pool.OrderBy(_ => Guid.NewGuid()).Take(count).ToList();
        }

        Dictionary<string, int>? byCategory;
        try
        {
            byCategory = JsonSerializer.Deserialize<Dictionary<string, int>>(quiz.QuestionsPerAttemptByCategoryJson);
        }
        catch
        {
            byCategory = null;
        }

        if (byCategory == null || byCategory.Count == 0)
        {
            return pool.OrderBy(_ => Guid.NewGuid()).Take(count).ToList();
        }

        // Group pool by category (case-insensitive)
        var groups = pool
            .GroupBy(q => (q.Category ?? string.Empty).Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);

        var selected = new List<QuizQuestion>(count);
        var selectedIds = new HashSet<long>();

        // First, satisfy explicit category requests
        foreach (var kv in byCategory)
        {
            var key = (kv.Key ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(key)) continue;
            var requested = Math.Max(0, kv.Value);
            if (requested == 0) continue;

            if (!groups.TryGetValue(key, out var list) || list.Count == 0) continue;

            var picks = list
                .OrderBy(_ => Guid.NewGuid())
                .Where(q => !selectedIds.Contains(q.Id))
                .Take(requested)
                .ToList();

            foreach (var q in picks)
            {
                selected.Add(q);
                selectedIds.Add(q.Id);
            }
        }

        // If for any reason we're short (e.g. stale config), fill remainder from remaining pool
        if (selected.Count < count)
        {
            var remainder = pool
                .Where(q => !selectedIds.Contains(q.Id))
                .OrderBy(_ => Guid.NewGuid())
                .Take(count - selected.Count)
                .ToList();
            selected.AddRange(remainder);
        }

        // If we're over (should be prevented by admin validation), trim randomly
        if (selected.Count > count)
        {
            selected = selected.OrderBy(_ => Guid.NewGuid()).Take(count).ToList();
        }

        return selected;
    }

    private async Task<List<QuizQuestion>> FilterOutArchivedBankQuestionsAsync(List<QuizQuestion> questions)
    {
        var bankIds = questions
            .Where(q => q.QuestionBankQuestionId != null)
            .Select(q => q.QuestionBankQuestionId!.Value)
            .Distinct()
            .ToList();

        if (bankIds.Count == 0)
        {
            return questions;
        }

        var archived = await _context.QuestionBankQuestions
            .AsNoTracking()
            .Where(bq => bankIds.Contains(bq.Id) && bq.IsArchived)
            .Select(bq => bq.Id)
            .ToListAsync();

        if (archived.Count == 0)
        {
            return questions;
        }

        var archivedSet = archived.ToHashSet();
        return questions.Where(q => q.QuestionBankQuestionId == null || !archivedSet.Contains(q.QuestionBankQuestionId.Value)).ToList();
    }

    private static int GetEffectiveQuestionsPerAttempt(Quiz quiz, int poolSize)
    {
        if (poolSize == 0)
        {
            return 0;
        }

        var perAttempt = quiz.QuestionsPerAttempt;
        if (perAttempt == null || perAttempt <= 0 || perAttempt >= poolSize)
        {
            return poolSize;
        }

        return perAttempt.Value;
    }

    private List<object> MapQuestionsForLearner(Quiz quiz, List<QuizQuestion> questions)
    {
        return questions.Select((q, index) => new
        {
            id = q.Id,
            question = q.Question,
            type = q.Type,
            points = q.Points,
            explanation = q.Explanation,
            category = q.Category,
            isCriticalSafety = _quizFeatures.ResolveCriticalSafety(q.IsCriticalSafety),
            order = index + 1,
            options = quiz.ShuffleAnswers
                ? q.Options.OrderBy(_ => Guid.NewGuid()).Select(o => new
                {
                    id = o.Id,
                    text = o.Text
                }).ToList()
                : q.Options.OrderBy(o => o.Order).Select(o => new
                {
                    id = o.Id,
                    text = o.Text
                }).ToList()
        }).Cast<object>().ToList();
    }

    private static (int attemptCount, bool hasPassed, bool canAttempt) GetAttemptStatus(
        Quiz quiz,
        IReadOnlyCollection<QuizAttempt> completedAttempts)
    {
        var attemptCount = completedAttempts.Count;
        var hasPassed = completedAttempts.Any(a => a.Passed);
        var canAttempt = !hasPassed
            && attemptCount < quiz.MaxAttempts
            && (attemptCount == 0 || quiz.AllowRetake);
        return (attemptCount, hasPassed, canAttempt);
    }

    private object BuildAttemptResult(Quiz quiz, QuizAttempt attempt)
    {
        List<QuizQuestion> questions;
        if (attempt.AttemptQuestions.Count > 0)
        {
            questions = attempt.AttemptQuestions
                .OrderBy(aq => aq.DisplayOrder)
                .Select(aq => quiz.Questions.First(q => q.Id == aq.QuizQuestionId))
                .ToList();
        }
        else
        {
            questions = quiz.Questions.OrderBy(q => q.Order).ToList();
        }

        var questionResults = new List<object>();
        var earnedPoints = 0;
        var totalPoints = 0;

        foreach (var question in questions)
        {
            totalPoints += question.Points;
            var answer = attempt.Answers.FirstOrDefault(a => a.QuizQuestionId == question.Id);
            var isCorrect = answer?.IsCorrect ?? false;
            if (isCorrect)
            {
                earnedPoints += question.Points;
            }

            List<long> selectedIds;
            if (answer?.SelectedOptionIdsJson != null)
            {
                selectedIds = JsonSerializer.Deserialize<List<long>>(answer.SelectedOptionIdsJson) ?? new List<long>();
            }
            else if (answer?.SelectedOptionId != null)
            {
                selectedIds = new List<long> { answer.SelectedOptionId.Value };
            }
            else
            {
                selectedIds = new List<long>();
            }

            questionResults.Add(new
            {
                questionId = question.Id,
                question = question.Question,
                isCorrect,
                isCriticalSafety = _quizFeatures.ResolveCriticalSafety(question.IsCriticalSafety),
                category = question.Category,
                responseTimeMs = answer?.ResponseTimeMs,
                explanation = question.Explanation,
                selectedAnswerTexts = question.Options.Where(o => selectedIds.Contains(o.Id)).Select(o => o.Text).ToList(),
                correctAnswerTexts = question.Options.Where(o => o.IsCorrect).Select(o => o.Text).ToList(),
                correctAnswers = question.Options.Where(o => o.IsCorrect).Select(o => o.Id).ToList()
            });
        }

        return new
        {
            score = attempt.ScorePercent,
            passed = attempt.Passed,
            failedCriticalSafety = _quizFeatures.IsCriticalSafetyEnabled && attempt.FailedCriticalSafety,
            earnedPoints,
            totalPoints,
            passingScore = quiz.PassingScore,
            durationSeconds = attempt.DurationSeconds,
            attemptId = attempt.Id,
            questionResults = quiz.ShowResults ? questionResults : null
        };
    }
}

// DTOs
public class QuizSubmissionRequest
{
    public long? AttemptId { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int? DurationSeconds { get; set; }
    public List<QuizAnswerDto> Answers { get; set; } = new();
}

public class QuizAnswerDto
{
    public long QuestionId { get; set; }
    public long? SelectedOptionId { get; set; } // For single choice
    public List<long>? SelectedOptionIds { get; set; } // For multiple choice
    public string? TextAnswer { get; set; } // For short answer
    public int? ResponseTimeMs { get; set; }
}
