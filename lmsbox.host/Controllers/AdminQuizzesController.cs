using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using lmsBox.Server.Services;
using System.Text.Json;

namespace lmsBox.Server.Controllers
{
    [ApiController]
    [Route("api/admin/quizzes")]
    [Authorize(Roles = "Admin,OrgAdmin,TenantAdmin,SuperAdmin")]
    public class AdminQuizzesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IAdminActivityTracker _activityTracker;
        private readonly IQuizFeatureService _quizFeatures;
        private readonly ILogger<AdminQuizzesController> _logger;

        public AdminQuizzesController(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager,
            IAdminActivityTracker activityTracker,
            IQuizFeatureService quizFeatures,
            ILogger<AdminQuizzesController> logger)
        {
            _context = context;
            _userManager = userManager;
            _activityTracker = activityTracker;
            _quizFeatures = quizFeatures;
            _logger = logger;
        }

        // GET /api/admin/quizzes?search=term
        [HttpGet]
        public async Task<IActionResult> GetQuizzes([FromQuery] string? search = null)
        {
            var query = _context.Quizzes
                .Include(q => q.Course)
                .Include(q => q.CreatedByUser)
                .AsQueryable();

            // This endpoint lists course assessments only (exclude Question Bank)
            query = query.Where(q => !q.IsQuestionBank && q.CourseId != null);

            // Organization filtering for OrgAdmin
            if (User.IsInRole("OrgAdmin"))
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var currentUser = await _context.Users.FindAsync(userId);
                if (currentUser != null && currentUser.OrganisationID.HasValue)
                {
                    query = query.Where(q =>
                        q.Course!.OrganisationId == currentUser.OrganisationID.Value);
                }
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchTerm = search.ToLower();
                query = query.Where(q =>
                    q.Title.ToLower().Contains(searchTerm) ||
                    (q.Description != null && q.Description.ToLower().Contains(searchTerm)) ||
                    (q.Course != null && q.Course.Title.ToLower().Contains(searchTerm)));
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
                    q.CourseId,
                    Course = new
                    {
                        q.Course!.Id,
                        q.Course.Title
                    },
                    CreatedBy = new
                    {
                        q.CreatedByUser!.Id,
                        Name = q.CreatedByUser.FirstName + " " + q.CreatedByUser.LastName
                    },
                    q.CreatedAt,
                    q.UpdatedAt,
                    QuestionCount = q.Questions.Count
                })
                .ToListAsync();

            return Ok(new { items = quizzes });
        }

        // GET /api/admin/quizzes/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetQuiz(string id)
        {
            var quiz = await _context.Quizzes
                .Include(q => q.Questions.OrderBy(qq => qq.Order))
                    .ThenInclude(qq => qq.Options.OrderBy(o => o.Order))
                .Include(q => q.Course)
                .Include(q => q.CreatedByUser)
                .FirstOrDefaultAsync(q => q.Id == id);

            if (quiz == null)
            {
                return NotFound(new { message = "Assessment not found" });
            }

            if (quiz.IsQuestionBank || quiz.CourseId == null)
            {
                return BadRequest(new { message = "This endpoint is for course assessments. Use the Question Bank endpoints for bank assessments." });
            }

            if ((User.IsInRole("OrgAdmin")) && quiz.Course != null)
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var currentUser = await _context.Users.FindAsync(userId);
                var role = User.FindFirstValue(ClaimTypes.Role);
                if (!OrganisationContentAccess.CanViewCourse(quiz.Course.OrganisationId, role, currentUser?.OrganisationID))
                {
                    return Forbid("You can only access quizzes from your organization");
                }
            }

            var result = new
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
                QuestionsPerAttemptByCategory = ParseCategoryCountsJson(quiz.QuestionsPerAttemptByCategoryJson),
                quiz.CourseId,
                Course = new
                {
                    quiz.Course!.Id,
                    quiz.Course.Title
                },
                CreatedBy = new
                {
                    quiz.CreatedByUser!.Id,
                    Name = quiz.CreatedByUser.FirstName + " " + quiz.CreatedByUser.LastName
                },
                quiz.CreatedAt,
                quiz.UpdatedAt,
                Questions = quiz.Questions.Select(qq => new
                {
                    qq.Id,
                    qq.QuestionBankQuestionId,
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
                        o.QuestionBankQuestionOptionId,
                        o.Text,
                        o.IsCorrect,
                        o.Order
                    })
                })
            };

            return Ok(result);
        }

        // POST /api/admin/quizzes
        [HttpPost]
        public async Task<IActionResult> CreateQuiz([FromBody] CreateQuizRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if (string.IsNullOrWhiteSpace(request.CourseId))
            {
                return BadRequest(new { message = "CourseId is required for course assessments." });
            }

            // Verify course exists
            var course = await _context.Courses.FindAsync(request.CourseId);
            if (course == null)
            {
                return BadRequest(new { message = "Course not found" });
            }

            if (User.IsInRole("OrgAdmin"))
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var currentUser = await _context.Users.FindAsync(userId);
                var role = User.FindFirstValue(ClaimTypes.Role);
                if (!OrganisationContentAccess.CanMutateCourse(course.OrganisationId, role, currentUser?.OrganisationID))
                {
                    return Forbid("You can only create quizzes for courses in your organization");
                }
            }

            // Check if course is published
            if (course.Status == "Published")
            {
                return BadRequest(new { message = "Cannot add assessments to published courses. Please unpublish the course first." });
            }

            // Get current user
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
                QuestionsPerAttempt = NormalizeQuestionsPerAttempt(request.QuestionsPerAttempt, request.Questions?.Count ?? 0),
                CourseId = request.CourseId!,
                CreatedByUserId = user.Id,
                CreatedAt = DateTime.UtcNow
            };

            var questionsPerAttemptError = ValidateQuestionsPerAttempt(quiz.QuestionsPerAttempt, request.Questions?.Count ?? 0);
            if (questionsPerAttemptError != null)
            {
                return BadRequest(new { message = questionsPerAttemptError });
            }

            // Add questions
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

                    // Add options
                    if (qReq.Options != null && qReq.Options.Any())
                    {
                        for (int j = 0; j < qReq.Options.Count; j++)
                        {
                            var oReq = qReq.Options[j];
                            var option = new QuizQuestionOption
                            {
                                Text = oReq.Text,
                                IsCorrect = oReq.IsCorrect,
                                QuizQuestion = question,
                                Order = j
                            };
                            question.Options.Add(option);
                        }
                    }

                    quiz.Questions.Add(question);
                }
            }

            _context.Quizzes.Add(quiz);
            await _context.SaveChangesAsync();

            // Automatically create a lesson entry for this quiz
            // Get the next ordinal number for lessons in this course
            var maxOrdinal = await _context.Lessons
                .Where(l => l.CourseId == request.CourseId)
                .Select(l => (int?)l.Ordinal)
                .MaxAsync() ?? 0;

            var quizLesson = new Lesson
            {
                CourseId = request.CourseId,
                Title = request.Title,
                Content = request.Description,
                Type = "quiz",
                QuizId = quizId,
                Ordinal = maxOrdinal + 1,
                IsOptional = false,
                CreatedByUserId = user.Id,
                CreatedAt = DateTime.UtcNow
            };

            _context.Lessons.Add(quizLesson);
            await _context.SaveChangesAsync();

            await _activityTracker.TrackAsync(
                user,
                "Assessment Created",
                $"Assessment ID: {quizId}, Title: {quiz.Title}, Course ID: {request.CourseId}, Question Count: {quiz.Questions.Count}",
                EngagementTrackingService.EVENT_QUIZ_CREATED,
                courseId: request.CourseId,
                metadata: new { quizId, title = quiz.Title, courseId = request.CourseId, questionCount = quiz.Questions.Count });

            return CreatedAtAction(nameof(GetQuiz), new { id = quizId }, new { id = quizId });
        }

        [HttpPost("/api/admin/courses/{courseId}/quizzes/import-from-bank/{bankQuizId}")]
        public async Task<IActionResult> ImportQuizFromQuestionBank(string courseId, string bankQuizId)
        {
            try
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                var course = await _context.Courses.FirstOrDefaultAsync(c => c.Id == courseId);
                if (course == null)
                {
                    return NotFound(new { message = "Course not found" });
                }

                if (course.Status == "Published")
                {
                    return BadRequest(new { message = "Cannot add assessments to published courses. Please unpublish the course first." });
                }

                if (User.IsInRole("OrgAdmin"))
                {
                    var currentUser = await _context.Users.FindAsync(userId);
                    var role = User.FindFirstValue(ClaimTypes.Role);
                    if (!OrganisationContentAccess.CanMutateCourse(course.OrganisationId, role, currentUser?.OrganisationID))
                    {
                        return Forbid("You can only add assessments to courses from your organization");
                    }
                }

                var bankQuiz = await _context.Quizzes
                    .Include(q => q.Questions.OrderBy(qq => qq.Order))
                        .ThenInclude(qq => qq.Options.OrderBy(o => o.Order))
                    .FirstOrDefaultAsync(q => q.Id == bankQuizId && q.IsQuestionBank && q.CourseId == null);

                if (bankQuiz == null)
                {
                    return NotFound(new { message = "Question bank assessment not found" });
                }

                var newQuizId = Guid.NewGuid().ToString("N");
                var newQuiz = new Quiz
                {
                    Id = newQuizId,
                    Title = bankQuiz.Title,
                    Description = bankQuiz.Description,
                    IntroductionContent = bankQuiz.IntroductionContent,
                    PassingScore = bankQuiz.PassingScore,
                    IsTimed = bankQuiz.IsTimed,
                    TimeLimit = bankQuiz.TimeLimit,
                    ShuffleQuestions = bankQuiz.ShuffleQuestions,
                    ShuffleAnswers = bankQuiz.ShuffleAnswers,
                    ShowResults = bankQuiz.ShowResults,
                    AllowRetake = bankQuiz.AllowRetake,
                    MaxAttempts = bankQuiz.MaxAttempts,
                    QuestionsPerAttempt = bankQuiz.QuestionsPerAttempt,
                    QuestionsPerAttemptByCategoryJson = bankQuiz.QuestionsPerAttemptByCategoryJson,
                    CourseId = courseId,
                    IsQuestionBank = false,
                    SourceQuestionBankQuizId = bankQuiz.Id,
                    CreatedByUserId = userId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                foreach (var originalQuestion in bankQuiz.Questions.OrderBy(q => q.Order))
                {
                    var newQuestion = new QuizQuestion
                    {
                        QuizId = newQuizId,
                        Question = originalQuestion.Question,
                        Type = originalQuestion.Type,
                        Points = originalQuestion.Points,
                        Explanation = originalQuestion.Explanation,
                        Category = originalQuestion.Category,
                        IsCriticalSafety = originalQuestion.IsCriticalSafety,
                        Order = originalQuestion.Order
                    };

                    foreach (var originalOption in originalQuestion.Options.OrderBy(o => o.Order))
                    {
                        newQuestion.Options.Add(new QuizQuestionOption
                        {
                            Text = originalOption.Text,
                            IsCorrect = originalOption.IsCorrect,
                            QuizQuestion = newQuestion,
                            Order = originalOption.Order
                        });
                    }

                    newQuiz.Questions.Add(newQuestion);
                }

                _context.Quizzes.Add(newQuiz);
                await _context.SaveChangesAsync();

                var importUser = await _userManager.GetUserAsync(User);
                if (importUser != null)
                {
                    await _activityTracker.TrackAsync(
                        importUser,
                        "Assessment Imported From Question Bank",
                        $"Assessment ID: {newQuizId}, Title: {newQuiz.Title}, Course ID: {courseId}, Source Bank Assessment ID: {bankQuizId}",
                        EngagementTrackingService.EVENT_QUIZ_IMPORTED_FROM_BANK,
                        courseId: courseId,
                        metadata: new { quizId = newQuizId, title = newQuiz.Title, courseId, bankQuizId, questionCount = newQuiz.Questions.Count });
                }

                return Ok(new { id = newQuizId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error importing question bank quiz {BankQuizId} into course {CourseId}", bankQuizId, courseId);
                return StatusCode(500, new { message = "An error occurred while importing the assessment" });
            }
        }

        // POST /api/admin/quizzes/from-bank
        [HttpPost("from-bank")]
        public async Task<IActionResult> CreateQuizFromBank([FromBody] CreateQuizFromBankRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if (string.IsNullOrWhiteSpace(request.CourseId))
            {
                return BadRequest(new { message = "CourseId is required for course assessments." });
            }

            var course = await _context.Courses.FindAsync(request.CourseId);
            if (course == null)
            {
                return BadRequest(new { message = "Course not found" });
            }

            if (User.IsInRole("OrgAdmin"))
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var currentUser = await _context.Users.FindAsync(userId);
                var role = User.FindFirstValue(ClaimTypes.Role);
                if (!OrganisationContentAccess.CanMutateCourse(course.OrganisationId, role, currentUser?.OrganisationID))
                {
                    return Forbid("You can only create quizzes for courses in your organization");
                }
            }

            if (course.Status == "Published")
            {
                return BadRequest(new { message = "Cannot add assessments to published courses. Please unpublish the course first." });
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
                CourseId = request.CourseId,
                CreatedByUserId = user.Id,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var bankQuestionIds = (request.QuestionBankQuestionIds ?? Array.Empty<long>())
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            if (bankQuestionIds.Count == 0)
            {
                return BadRequest(new { message = "Select at least one Question Bank question." });
            }

            var bankQuestions = await _context.QuestionBankQuestions
                .Where(q => bankQuestionIds.Contains(q.Id))
                .Include(q => q.Options.OrderBy(o => o.Order))
                .ToListAsync();

            var missing = bankQuestionIds.Except(bankQuestions.Select(q => q.Id)).ToList();
            if (missing.Count > 0)
            {
                return BadRequest(new { message = "Some Question Bank questions were not found." });
            }

            if (bankQuestions.Any(q => q.IsArchived))
            {
                return BadRequest(new { message = "Archived Question Bank questions cannot be added to assessments." });
            }

            if (User.IsInRole("OrgAdmin"))
            {
                var accessError = ValidateQuestionBankAccessForOrgAdmin(bankQuestions, user.OrganisationID);
                if (accessError != null)
                {
                    return BadRequest(new { message = accessError });
                }
            }

            var orderedBankQuestions = bankQuestionIds
                .Select(id => bankQuestions.First(q => q.Id == id))
                .ToList();

            for (var i = 0; i < orderedBankQuestions.Count; i++)
            {
                var bq = orderedBankQuestions[i];
                var quizQuestion = new QuizQuestion
                {
                    QuestionBankQuestionId = bq.Id,
                    Question = bq.Question,
                    Type = bq.Type,
                    Points = bq.Points,
                    Explanation = bq.Explanation,
                    Category = bq.Category,
                    IsCriticalSafety = _quizFeatures.ResolveCriticalSafety(bq.IsCriticalSafety),
                    QuizId = quizId,
                    Order = i
                };

                var opts = bq.Options.OrderBy(o => o.Order).ToList();
                for (var j = 0; j < opts.Count; j++)
                {
                    quizQuestion.Options.Add(new QuizQuestionOption
                    {
                        QuestionBankQuestionOptionId = opts[j].Id,
                        Text = opts[j].Text,
                        IsCorrect = opts[j].IsCorrect,
                        QuizQuestion = quizQuestion,
                        Order = j
                    });
                }

                quiz.Questions.Add(quizQuestion);
            }

            quiz.QuestionsPerAttempt = NormalizeQuestionsPerAttempt(request.QuestionsPerAttempt, quiz.Questions.Count);
            var questionsPerAttemptError = ValidateQuestionsPerAttempt(quiz.QuestionsPerAttempt, quiz.Questions.Count);
            if (questionsPerAttemptError != null)
            {
                return BadRequest(new { message = questionsPerAttemptError });
            }

            var byCategoryError = ApplyAndValidateByCategoryConfig(quiz, request.QuestionsPerAttemptByCategory);
            if (byCategoryError != null)
            {
                return BadRequest(new { message = byCategoryError });
            }

            _context.Quizzes.Add(quiz);
            await _context.SaveChangesAsync();

            var maxOrdinal = await _context.Lessons
                .Where(l => l.CourseId == request.CourseId)
                .Select(l => (int?)l.Ordinal)
                .MaxAsync() ?? 0;

            var quizLesson = new Lesson
            {
                CourseId = request.CourseId,
                Title = request.Title,
                Content = request.Description,
                Type = "quiz",
                QuizId = quizId,
                Ordinal = maxOrdinal + 1,
                IsOptional = false,
                CreatedByUserId = user.Id,
                CreatedAt = DateTime.UtcNow
            };

            _context.Lessons.Add(quizLesson);
            await _context.SaveChangesAsync();

            await _activityTracker.TrackAsync(
                user,
                "Assessment Created From Question Bank",
                $"Assessment ID: {quizId}, Title: {quiz.Title}, Course ID: {request.CourseId}, Bank Question Count: {quiz.Questions.Count}",
                EngagementTrackingService.EVENT_QUIZ_CREATED,
                courseId: request.CourseId,
                metadata: new { quizId, title = quiz.Title, courseId = request.CourseId, fromQuestionBank = true, questionCount = quiz.Questions.Count });

            return CreatedAtAction(nameof(GetQuiz), new { id = quizId }, new { id = quizId });
        }

        // PUT /api/admin/quizzes/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateQuiz(string id, [FromBody] UpdateQuizRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            if (string.IsNullOrWhiteSpace(request.CourseId))
            {
                return BadRequest(new { message = "CourseId is required for course assessments." });
            }

            var quiz = await _context.Quizzes
                .Include(q => q.Questions)
                    .ThenInclude(qq => qq.Options)
                .Include(q => q.Course)
                .FirstOrDefaultAsync(q => q.Id == id);

            if (quiz == null)
            {
                return NotFound(new { message = "Assessment not found" });
            }

            if ((User.IsInRole("OrgAdmin")) && quiz.Course != null)
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var currentUser = await _context.Users.FindAsync(userId);
                var role = User.FindFirstValue(ClaimTypes.Role);
                if (!OrganisationContentAccess.CanMutateCourse(quiz.Course.OrganisationId, role, currentUser?.OrganisationID))
                {
                    return Forbid("You can only update quizzes from your organization");
                }
            }

            // Check if course is published
            if (quiz.Course?.Status == "Published")
            {
                return BadRequest(new { message = "Cannot edit assessments in published courses. Please unpublish the course first." });
            }

            // Verify course exists if changed
            if (request.CourseId != quiz.CourseId)
            {
                var course = await _context.Courses.FindAsync(request.CourseId);
                if (course == null)
                {
                    return BadRequest(new { message = "Course not found" });
                }
                
                // Update the lesson's course if quiz is moved to a different course
                var quizLesson = await _context.Lessons
                    .FirstOrDefaultAsync(l => l.QuizId == id);
                
                if (quizLesson != null)
                {
                    quizLesson.CourseId = request.CourseId;
                }
                
                quiz.CourseId = request.CourseId;
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
            quiz.QuestionsPerAttempt = NormalizeQuestionsPerAttempt(request.QuestionsPerAttempt, request.Questions?.Count ?? 0);
            quiz.UpdatedAt = DateTime.UtcNow;

            var questionsPerAttemptError = ValidateQuestionsPerAttempt(quiz.QuestionsPerAttempt, request.Questions?.Count ?? 0);
            if (questionsPerAttemptError != null)
            {
                return BadRequest(new { message = questionsPerAttemptError });
            }

            // Update the corresponding lesson
            var lesson = await _context.Lessons
                .FirstOrDefaultAsync(l => l.QuizId == id);
            
            if (lesson != null)
            {
                lesson.Title = request.Title;
                lesson.Content = request.Description;
            }

            // Update questions - for simplicity, remove all and re-add
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

                    // Add options
                    if (qReq.Options != null && qReq.Options.Any())
                    {
                        for (int j = 0; j < qReq.Options.Count; j++)
                        {
                            var oReq = qReq.Options[j];
                            var option = new QuizQuestionOption
                            {
                                Text = oReq.Text,
                                IsCorrect = oReq.IsCorrect,
                                QuizQuestion = question,
                                Order = j
                            };
                            question.Options.Add(option);
                        }
                    }

                    quiz.Questions.Add(question);
                }
            }

            await _context.SaveChangesAsync();

            var updateUser = await _userManager.GetUserAsync(User);
            if (updateUser != null)
            {
                await _activityTracker.TrackAsync(
                    updateUser,
                    "Assessment Updated",
                    $"Assessment ID: {id}, Title: {quiz.Title}, Course ID: {quiz.CourseId}, Question Count: {quiz.Questions.Count}",
                    EngagementTrackingService.EVENT_QUIZ_UPDATED,
                    courseId: quiz.CourseId,
                    metadata: new { quizId = id, title = quiz.Title, courseId = quiz.CourseId, questionCount = quiz.Questions.Count });
            }

            return Ok(new { message = "Assessment updated successfully" });
        }

        // PUT /api/admin/quizzes/{id}/from-bank
        [HttpPut("{id}/from-bank")]
        public async Task<IActionResult> UpdateQuizFromBank(string id, [FromBody] UpdateQuizFromBankRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var quiz = await _context.Quizzes
                .Include(q => q.Questions)
                    .ThenInclude(qq => qq.Options)
                .Include(q => q.Course)
                .FirstOrDefaultAsync(q => q.Id == id);

            if (quiz == null)
            {
                return NotFound(new { message = "Assessment not found" });
            }

            if (quiz.IsQuestionBank || quiz.CourseId == null)
            {
                return BadRequest(new { message = "This endpoint is for course assessments only." });
            }

            if ((User.IsInRole("OrgAdmin")) && quiz.Course != null)
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var currentUser = await _context.Users.FindAsync(userId);
                var role = User.FindFirstValue(ClaimTypes.Role);
                if (!OrganisationContentAccess.CanMutateCourse(quiz.Course.OrganisationId, role, currentUser?.OrganisationID))
                {
                    return Forbid("You can only update quizzes from your organization");
                }
            }

            if (quiz.Course?.Status == "Published")
            {
                return BadRequest(new { message = "Cannot edit assessments in published courses. Please unpublish the course first." });
            }

            if (string.IsNullOrWhiteSpace(request.CourseId))
            {
                return BadRequest(new { message = "CourseId is required for course assessments." });
            }

            if (request.CourseId != quiz.CourseId)
            {
                return BadRequest(new { message = "CourseId cannot be changed via this endpoint." });
            }

            var bankQuestionIds = (request.QuestionBankQuestionIds ?? Array.Empty<long>())
                .Where(x => x > 0)
                .Distinct()
                .ToList();

            if (bankQuestionIds.Count == 0)
            {
                return BadRequest(new { message = "Select at least one Question Bank question." });
            }

            var bankQuestions = await _context.QuestionBankQuestions
                .Where(q => bankQuestionIds.Contains(q.Id))
                .Include(q => q.Options.OrderBy(o => o.Order))
                .ToListAsync();

            var missing = bankQuestionIds.Except(bankQuestions.Select(q => q.Id)).ToList();
            if (missing.Count > 0)
            {
                return BadRequest(new { message = "Some Question Bank questions were not found." });
            }

            if (bankQuestions.Any(q => q.IsArchived))
            {
                return BadRequest(new { message = "Archived Question Bank questions cannot be added to assessments." });
            }

            if (User.IsInRole("OrgAdmin"))
            {
                var currentUser = await _userManager.GetUserAsync(User);
                var accessError = ValidateQuestionBankAccessForOrgAdmin(bankQuestions, currentUser?.OrganisationID);
                if (accessError != null)
                {
                    return BadRequest(new { message = accessError });
                }
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
            quiz.UpdatedAt = DateTime.UtcNow;

            var orderedBankQuestions = bankQuestionIds
                .Select(qid => bankQuestions.First(q => q.Id == qid))
                .ToList();

            _context.QuizQuestions.RemoveRange(quiz.Questions);
            quiz.Questions.Clear();

            for (var i = 0; i < orderedBankQuestions.Count; i++)
            {
                var bq = orderedBankQuestions[i];
                var quizQuestion = new QuizQuestion
                {
                    QuestionBankQuestionId = bq.Id,
                    Question = bq.Question,
                    Type = bq.Type,
                    Points = bq.Points,
                    Explanation = bq.Explanation,
                    Category = bq.Category,
                    IsCriticalSafety = _quizFeatures.ResolveCriticalSafety(bq.IsCriticalSafety),
                    QuizId = id,
                    Order = i
                };

                var opts = bq.Options.OrderBy(o => o.Order).ToList();
                for (var j = 0; j < opts.Count; j++)
                {
                    quizQuestion.Options.Add(new QuizQuestionOption
                    {
                        QuestionBankQuestionOptionId = opts[j].Id,
                        Text = opts[j].Text,
                        IsCorrect = opts[j].IsCorrect,
                        QuizQuestion = quizQuestion,
                        Order = j
                    });
                }

                quiz.Questions.Add(quizQuestion);
            }

            quiz.QuestionsPerAttempt = NormalizeQuestionsPerAttempt(request.QuestionsPerAttempt, quiz.Questions.Count);
            var questionsPerAttemptError = ValidateQuestionsPerAttempt(quiz.QuestionsPerAttempt, quiz.Questions.Count);
            if (questionsPerAttemptError != null)
            {
                return BadRequest(new { message = questionsPerAttemptError });
            }

            var byCategoryError = ApplyAndValidateByCategoryConfig(quiz, request.QuestionsPerAttemptByCategory);
            if (byCategoryError != null)
            {
                return BadRequest(new { message = byCategoryError });
            }

            var lesson = await _context.Lessons.FirstOrDefaultAsync(l => l.QuizId == id);
            if (lesson != null)
            {
                lesson.Title = request.Title;
                lesson.Content = request.Description;
            }

            await _context.SaveChangesAsync();

            var bankUpdateUser = await _userManager.GetUserAsync(User);
            if (bankUpdateUser != null)
            {
                await _activityTracker.TrackAsync(
                    bankUpdateUser,
                    "Assessment Updated From Question Bank",
                    $"Assessment ID: {id}, Title: {quiz.Title}, Course ID: {quiz.CourseId}, Bank Question Count: {quiz.Questions.Count}",
                    EngagementTrackingService.EVENT_QUIZ_UPDATED,
                    courseId: quiz.CourseId,
                    metadata: new { quizId = id, title = quiz.Title, courseId = quiz.CourseId, fromQuestionBank = true, questionCount = quiz.Questions.Count });
            }

            return Ok(new { message = "Assessment updated successfully" });
        }

        // DELETE /api/admin/quizzes/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteQuiz(string id)
        {
            var quiz = await _context.Quizzes
                .Include(q => q.Course)
                .FirstOrDefaultAsync(q => q.Id == id);
                
            if (quiz == null)
            {
                return NotFound(new { message = "Assessment not found" });
            }

            if ((User.IsInRole("OrgAdmin")) && quiz.Course != null)
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var currentUser = await _context.Users.FindAsync(userId);
                var role = User.FindFirstValue(ClaimTypes.Role);
                if (!OrganisationContentAccess.CanMutateCourse(quiz.Course.OrganisationId, role, currentUser?.OrganisationID))
                {
                    return Forbid("You can only delete quizzes from your organization");
                }
            }

            // Check if course is published
            if (quiz.Course?.Status == "Published")
            {
                return BadRequest(new { message = "Cannot delete assessments from published courses. Please unpublish the course first." });
            }

            // Also delete the corresponding lesson
            var quizLesson = await _context.Lessons
                .FirstOrDefaultAsync(l => l.QuizId == id);
            
            if (quizLesson != null)
            {
                _context.Lessons.Remove(quizLesson);
            }

            var deleteUser = await _userManager.GetUserAsync(User);
            var deletedQuizId = quiz.Id;
            var deletedTitle = quiz.Title;
            var deletedCourseId = quiz.CourseId;
            _context.Quizzes.Remove(quiz);
            await _context.SaveChangesAsync();

            if (deleteUser != null)
            {
                await _activityTracker.TrackAsync(
                    deleteUser,
                    "Assessment Deleted",
                    $"Assessment ID: {deletedQuizId}, Title: {deletedTitle}, Course ID: {deletedCourseId}",
                    EngagementTrackingService.EVENT_QUIZ_DELETED,
                    courseId: deletedCourseId,
                    metadata: new { quizId = deletedQuizId, title = deletedTitle, courseId = deletedCourseId });
            }

            return Ok(new { message = "Assessment deleted successfully" });
        }

        private static int? NormalizeQuestionsPerAttempt(int? value, int poolSize)
        {
            if (value == null || value <= 0 || poolSize <= 0 || value >= poolSize)
            {
                return null;
            }

            return value;
        }

        private static string? ValidateQuestionsPerAttempt(int? value, int poolSize)
        {
            if (poolSize == 0)
            {
                return null;
            }

            if (value != null && (value <= 0 || value >= poolSize))
            {
                return $"Questions per attempt must be between 1 and {poolSize - 1} when using a random subset, or leave empty to show all questions.";
            }

            return null;
        }

        private static Dictionary<string, int>? ParseCategoryCountsJson(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;
            try
            {
                return JsonSerializer.Deserialize<Dictionary<string, int>>(json);
            }
            catch
            {
                return null;
            }
        }

        private static string? ApplyAndValidateByCategoryConfig(Quiz quiz, Dictionary<string, int>? counts)
        {
            // Clear config when not provided
            if (counts == null || counts.Count == 0)
            {
                quiz.QuestionsPerAttemptByCategoryJson = null;
                return null;
            }

            if (quiz.QuestionsPerAttempt == null || quiz.QuestionsPerAttempt <= 0)
            {
                return "QuestionsPerAttempt is required when using QuestionsPerAttemptByCategory.";
            }

            // Normalize keys and values
            var normalized = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var kv in counts)
            {
                var key = (kv.Key ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(key)) continue;
                var val = kv.Value;
                if (val < 0) return "Category counts must be 0 or greater.";
                normalized[key] = val;
            }

            if (normalized.Count == 0)
            {
                quiz.QuestionsPerAttemptByCategoryJson = null;
                return null;
            }

            var sum = normalized.Values.Sum();
            if (sum != quiz.QuestionsPerAttempt.Value)
            {
                return $"Sum of per-category counts must equal QuestionsPerAttempt ({quiz.QuestionsPerAttempt.Value}).";
            }

            // Validate availability by category in the quiz pool
            var availability = quiz.Questions
                .GroupBy(q => (q.Category ?? string.Empty).Trim(), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);

            foreach (var kv in normalized)
            {
                var available = availability.TryGetValue(kv.Key, out var a) ? a : 0;
                if (kv.Value > available)
                {
                    return $"Category \"{kv.Key}\" has only {available} question(s) in the quiz pool, but {kv.Value} were requested.";
                }
            }

            quiz.QuestionsPerAttemptByCategoryJson = JsonSerializer.Serialize(normalized);
            return null;
        }

        private static string? ValidateQuestionBankAccessForOrgAdmin(
            IReadOnlyCollection<QuestionBankQuestion> bankQuestions,
            long? organisationId)
        {
            if (!organisationId.HasValue) return null;

            var forbidden = bankQuestions.Any(q =>
                q.OrganisationId != null && q.OrganisationId != organisationId.Value);
            if (forbidden)
            {
                return "Some Question Bank questions belong to another organisation.";
            }

            return null;
        }
    }
}