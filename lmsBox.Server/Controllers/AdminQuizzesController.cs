using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace lmsBox.Server.Controllers
{
    [ApiController]
    [Route("api/admin/quizzes")]
    [Authorize]
    public class AdminQuizzesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public AdminQuizzesController(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        // GET /api/admin/quizzes?search=term
        [HttpGet]
        public async Task<IActionResult> GetQuizzes([FromQuery] string? search = null)
        {
            var query = _context.Quizzes
                .Include(q => q.Course)
                .Include(q => q.CreatedByUser)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchTerm = search.ToLower();
                query = query.Where(q =>
                    q.Title.ToLower().Contains(searchTerm) ||
                    q.Description!.ToLower().Contains(searchTerm) ||
                    q.Course!.Title.ToLower().Contains(searchTerm));
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
                return NotFound(new { message = "Quiz not found" });
            }

            var result = new
            {
                quiz.Id,
                quiz.Title,
                quiz.Description,
                quiz.PassingScore,
                quiz.IsTimed,
                quiz.TimeLimit,
                quiz.ShuffleQuestions,
                quiz.ShuffleAnswers,
                quiz.ShowResults,
                quiz.AllowRetake,
                quiz.MaxAttempts,
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
                    qq.Question,
                    qq.Type,
                    qq.Points,
                    qq.Explanation,
                    qq.Order,
                    Options = qq.Options.Select(o => new
                    {
                        o.Id,
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

            // Verify course exists
            var course = await _context.Courses.FindAsync(request.CourseId);
            if (course == null)
            {
                return BadRequest(new { message = "Course not found" });
            }

            // Check if course is published
            if (course.Status == "Published")
            {
                return BadRequest(new { message = "Cannot add quizzes to published courses. Please unpublish the course first." });
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
                CreatedAt = DateTime.UtcNow
            };

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

            var quiz = await _context.Quizzes
                .Include(q => q.Questions)
                    .ThenInclude(qq => qq.Options)
                .Include(q => q.Course)
                .FirstOrDefaultAsync(q => q.Id == id);

            if (quiz == null)
            {
                return NotFound(new { message = "Quiz not found" });
            }

            // Check if course is published
            if (quiz.Course?.Status == "Published")
            {
                return BadRequest(new { message = "Cannot edit quizzes in published courses. Please unpublish the course first." });
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
            quiz.PassingScore = request.PassingScore;
            quiz.IsTimed = request.IsTimed;
            quiz.TimeLimit = request.TimeLimit;
            quiz.ShuffleQuestions = request.ShuffleQuestions;
            quiz.ShuffleAnswers = request.ShuffleAnswers;
            quiz.ShowResults = request.ShowResults;
            quiz.AllowRetake = request.AllowRetake;
            quiz.MaxAttempts = request.MaxAttempts;
            quiz.UpdatedAt = DateTime.UtcNow;

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

            return Ok(new { message = "Quiz updated successfully" });
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
                return NotFound(new { message = "Quiz not found" });
            }

            // Check if course is published
            if (quiz.Course?.Status == "Published")
            {
                return BadRequest(new { message = "Cannot delete quizzes from published courses. Please unpublish the course first." });
            }

            // Also delete the corresponding lesson
            var quizLesson = await _context.Lessons
                .FirstOrDefaultAsync(l => l.QuizId == id);
            
            if (quizLesson != null)
            {
                _context.Lessons.Remove(quizLesson);
            }

            _context.Quizzes.Remove(quiz);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Quiz deleted successfully" });
        }
    }
}