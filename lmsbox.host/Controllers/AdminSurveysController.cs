using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/admin/surveys")]
[Authorize(Roles = "Admin,OrgAdmin,SuperAdmin")]
public class AdminSurveysController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminSurveysController> _logger;
    private readonly IAuditLogService _auditLogService;

    public AdminSurveysController(
        ApplicationDbContext context,
        ILogger<AdminSurveysController> logger,
        IAuditLogService auditLogService)
    {
        _context = context;
        _logger = logger;
        _auditLogService = auditLogService;
    }

    private static string NormalizeResponseVisibility(string? value)
    {
        if (string.Equals(value, SurveyQuestionResponseVisibility.SuperAdminOnly, StringComparison.OrdinalIgnoreCase))
        {
            return SurveyQuestionResponseVisibility.SuperAdminOnly;
        }

        return SurveyQuestionResponseVisibility.All;
    }

    // GET: api/admin/surveys
    [HttpGet]
    public async Task<IActionResult> GetSurveys()
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return Unauthorized();

            long? orgId = null;
            if (User.IsInRole("OrgAdmin"))
                orgId = user.OrganisationID;

            var surveysQuery = _context.Surveys
                .Include(s => s.Questions)
                .Where(s => !s.IsDeleted)
                .AsNoTracking();

            if (orgId.HasValue)
                surveysQuery = surveysQuery.Where(s => s.OrganisationId == orgId);

            var surveys = await surveysQuery
                .OrderByDescending(s => s.CreatedAt)
                .Select(s => new
                {
                    s.Id,
                    s.Title,
                    s.Description,
                    s.Status,
                    s.IsActive,
                    s.CreatedAt,
                    s.UpdatedAt,
                    QuestionCount = s.Questions != null ? s.Questions.Count : 0,
                    s.OrganisationId
                })
                .ToListAsync();

            return Ok(surveys);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving surveys");
            return StatusCode(500, "An error occurred while retrieving surveys");
        }
    }

    // GET: api/admin/surveys/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetSurvey(long id)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return Unauthorized();

            var surveyQuery = _context.Surveys
                .Include(s => s.Questions.OrderBy(q => q.OrderIndex))
                .Where(s => s.Id == id && !s.IsDeleted)
                .AsNoTracking();

            if (User.IsInRole("OrgAdmin"))
                surveyQuery = surveyQuery.Where(s => s.OrganisationId == user.OrganisationID);

            var survey = await surveyQuery.FirstOrDefaultAsync();

            if (survey == null)
                return NotFound("Survey not found");

            return Ok(new
            {
                survey.Id,
                survey.Title,
                survey.Description,
                survey.Status,
                survey.IsActive,
                survey.CreatedAt,
                survey.UpdatedAt,
                Questions = survey.Questions?.Select(q => new
                {
                    q.Id,
                    q.QuestionText,
                    q.QuestionType,
                    Options = string.IsNullOrEmpty(q.Options) ? new List<string>() : JsonSerializer.Deserialize<List<string>>(q.Options),
                    q.OrderIndex,
                    q.IsRequired,
                    q.MinRating,
                    q.MaxRating,
                    q.ResponseVisibility
                }).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving survey {SurveyId}", id);
            return StatusCode(500, "An error occurred while retrieving the survey");
        }
    }

    // POST: api/admin/surveys
    [HttpPost]
    public async Task<IActionResult> CreateSurvey([FromBody] CreateSurveyRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return Unauthorized();

            if (string.IsNullOrWhiteSpace(request.Title))
                return BadRequest("Survey title is required");

            var survey = new Survey
            {
                Title = request.Title,
                Description = request.Description,
                OrganisationId = user.OrganisationID!.Value,
                CreatedByUserId = userId!,
                IsActive = request.IsActive ?? true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Surveys.Add(survey);
            await _context.SaveChangesAsync();

            await _auditLogService.LogSurveyCreation(userId, $"{user.FirstName} {user.LastName}", survey.Id.ToString(), survey.Title);

            _logger.LogInformation("Survey {SurveyId} created by user {UserId}", survey.Id, userId);

            return CreatedAtAction(nameof(GetSurvey), new { id = survey.Id }, new { survey.Id, survey.Title });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating survey");
            return StatusCode(500, "An error occurred while creating the survey");
        }
    }

    // PUT: api/admin/surveys/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateSurvey(long id, [FromBody] UpdateSurveyRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return Unauthorized();

            var surveyQuery = _context.Surveys.Where(s => s.Id == id && !s.IsDeleted);

            if (User.IsInRole("OrgAdmin"))
                surveyQuery = surveyQuery.Where(s => s.OrganisationId == user.OrganisationID);

            var survey = await surveyQuery.FirstOrDefaultAsync();

            if (survey == null)
                return NotFound("Survey not found");

            // Prevent editing published surveys
            if (survey.Status == "Published")
                return BadRequest("Cannot edit a published survey. Unpublish it first to make changes.");

            if (!string.IsNullOrWhiteSpace(request.Title))
                survey.Title = request.Title;

            if (request.Description != null)
                survey.Description = request.Description;

            if (request.IsActive.HasValue)
                survey.IsActive = request.IsActive.Value;

            survey.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            await _auditLogService.LogSurveyUpdate(userId, $"{user.FirstName} {user.LastName}", survey.Id.ToString(), survey.Title);

            _logger.LogInformation("Survey {SurveyId} updated by user {UserId}", id, userId);

            return Ok(new { message = "Survey updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating survey {SurveyId}", id);
            return StatusCode(500, "An error occurred while updating the survey");
        }
    }

    // DELETE: api/admin/surveys/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSurvey(long id)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return Unauthorized();

            var surveyQuery = _context.Surveys.Where(s => s.Id == id && !s.IsDeleted);

            if (User.IsInRole("OrgAdmin"))
                surveyQuery = surveyQuery.Where(s => s.OrganisationId == user.OrganisationID);

            var survey = await surveyQuery.FirstOrDefaultAsync();

            if (survey == null)
                return NotFound("Survey not found");

            survey.IsDeleted = true;
            survey.DeletedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            await _auditLogService.LogSurveyDelete(userId, $"{user.FirstName} {user.LastName}", survey.Id.ToString(), survey.Title);

            _logger.LogInformation("Survey {SurveyId} deleted by user {UserId}", id, userId);

            return Ok(new { message = "Survey deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting survey {SurveyId}", id);
            return StatusCode(500, "An error occurred while deleting the survey");
        }
    }

    // POST: api/admin/surveys/{id}/questions
    [HttpPost("{id}/questions")]
    public async Task<IActionResult> AddQuestion(long id, [FromBody] CreateQuestionRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return Unauthorized();

            var surveyQuery = _context.Surveys.Where(s => s.Id == id && !s.IsDeleted);

            if (User.IsInRole("OrgAdmin"))
                surveyQuery = surveyQuery.Where(s => s.OrganisationId == user.OrganisationID);

            var survey = await surveyQuery.FirstOrDefaultAsync();

            if (survey == null)
                return NotFound("Survey not found");

            // Prevent adding questions to published surveys
            if (survey.Status == "Published")
                return BadRequest("Cannot add questions to a published survey. Unpublish it first to make changes.");

            if (string.IsNullOrWhiteSpace(request.QuestionText))
                return BadRequest("Question text is required");

            // Get the max order index for this survey
            var maxOrderIndex = await _context.SurveyQuestions
                .Where(q => q.SurveyId == id)
                .MaxAsync(q => (int?)q.OrderIndex) ?? -1;

            var question = new SurveyQuestion
            {
                SurveyId = id,
                QuestionText = request.QuestionText,
                QuestionType = request.QuestionType ?? "Text",
                Options = request.Options != null && request.Options.Any() 
                    ? JsonSerializer.Serialize(request.Options) 
                    : null,
                OrderIndex = request.OrderIndex ?? (maxOrderIndex + 1),
                IsRequired = request.IsRequired ?? true,
                MinRating = request.MinRating,
                MaxRating = request.MaxRating,
                ResponseVisibility = NormalizeResponseVisibility(request.ResponseVisibility),
                CreatedAt = DateTime.UtcNow
            };

            _context.SurveyQuestions.Add(question);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Question {QuestionId} added to survey {SurveyId} by user {UserId}", question.Id, id, userId);

            return Ok(new { questionId = question.Id, message = "Question added successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding question to survey {SurveyId}", id);
            return StatusCode(500, "An error occurred while adding the question");
        }
    }

    // PUT: api/admin/surveys/{surveyId}/questions/{questionId}
    [HttpPut("{surveyId}/questions/{questionId}")]
    public async Task<IActionResult> UpdateQuestion(long surveyId, long questionId, [FromBody] UpdateQuestionRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return Unauthorized();

            var questionQuery = _context.SurveyQuestions
                .Include(q => q.Survey)
                .Where(q => q.Id == questionId && q.SurveyId == surveyId && !q.Survey!.IsDeleted);

            if (User.IsInRole("OrgAdmin"))
                questionQuery = questionQuery.Where(q => q.Survey!.OrganisationId == user.OrganisationID);

            var question = await questionQuery.FirstOrDefaultAsync();

            if (question == null)
                return NotFound("Question not found");

            // Prevent updating questions in published surveys
            if (question.Survey!.Status == "Published")
                return BadRequest("Cannot update questions in a published survey. Unpublish it first to make changes.");

            if (!string.IsNullOrWhiteSpace(request.QuestionText))
                question.QuestionText = request.QuestionText;

            if (request.QuestionType != null)
                question.QuestionType = request.QuestionType;

            if (request.Options != null)
                question.Options = request.Options.Any() ? JsonSerializer.Serialize(request.Options) : null;

            if (request.OrderIndex.HasValue)
                question.OrderIndex = request.OrderIndex.Value;

            if (request.IsRequired.HasValue)
                question.IsRequired = request.IsRequired.Value;

            if (request.MinRating.HasValue)
                question.MinRating = request.MinRating;

            if (request.MaxRating.HasValue)
                question.MaxRating = request.MaxRating;

            if (!string.IsNullOrWhiteSpace(request.ResponseVisibility))
                question.ResponseVisibility = NormalizeResponseVisibility(request.ResponseVisibility);

            await _context.SaveChangesAsync();

            _logger.LogInformation("Question {QuestionId} updated by user {UserId}", questionId, userId);

            return Ok(new { message = "Question updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating question {QuestionId}", questionId);
            return StatusCode(500, "An error occurred while updating the question");
        }
    }

    // DELETE: api/admin/surveys/{surveyId}/questions/{questionId}
    [HttpDelete("{surveyId}/questions/{questionId}")]
    public async Task<IActionResult> DeleteQuestion(long surveyId, long questionId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return Unauthorized();

            var questionQuery = _context.SurveyQuestions
                .Include(q => q.Survey)
                .Where(q => q.Id == questionId && q.SurveyId == surveyId && !q.Survey!.IsDeleted);

            if (User.IsInRole("OrgAdmin"))
                questionQuery = questionQuery.Where(q => q.Survey!.OrganisationId == user.OrganisationID);

            var question = await questionQuery.FirstOrDefaultAsync();

            if (question == null)
                return NotFound("Question not found");

            // Prevent deleting questions from published surveys
            if (question.Survey!.Status == "Published")
                return BadRequest("Cannot delete questions from a published survey. Unpublish it first to make changes.");

            _context.SurveyQuestions.Remove(question);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Question {QuestionId} deleted by user {UserId}", questionId, userId);

            return Ok(new { message = "Question deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting question {QuestionId}", questionId);
            return StatusCode(500, "An error occurred while deleting the question");
        }
    }

    // GET: api/admin/surveys/{id}/responses
    [HttpGet("{id}/responses")]
    public async Task<IActionResult> GetSurveyResponses(long id, [FromQuery] string? courseId = null)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return Unauthorized();

            var surveyQuery = _context.Surveys.Where(s => s.Id == id && !s.IsDeleted).AsNoTracking();

            if (User.IsInRole("OrgAdmin"))
                surveyQuery = surveyQuery.Where(s => s.OrganisationId == user.OrganisationID);

            var survey = await surveyQuery.FirstOrDefaultAsync();

            if (survey == null)
                return NotFound("Survey not found");

            // Get all responses for this survey
            var responsesQuery = _context.SurveyResponses
                .Include(sr => sr.User)
                .Include(sr => sr.Course)
                .Include(sr => sr.QuestionResponses!)
                    .ThenInclude(qr => qr.SurveyQuestion)
                .Where(sr => sr.SurveyId == id)
                .AsNoTracking();

            // Filter by course if specified
            if (!string.IsNullOrEmpty(courseId))
                responsesQuery = responsesQuery.Where(sr => sr.CourseId == courseId);

            // Filter by organization for OrgAdmin
            if (User.IsInRole("OrgAdmin"))
                responsesQuery = responsesQuery.Where(sr => sr.User!.OrganisationID == user.OrganisationID);

            var responses = await responsesQuery
                .OrderByDescending(sr => sr.SubmittedAt)
                .ToListAsync();

            var responseData = responses.Select(sr => new
            {
                responseId = sr.Id,
                userName = $"{sr.User?.FirstName} {sr.User?.LastName}",
                userEmail = sr.User?.Email,
                courseName = sr.Course?.Title,
                courseId = sr.CourseId,
                submittedAt = sr.SubmittedAt,
                surveyType = sr.SurveyType,
                answers = sr.QuestionResponses?.Select(qr => new
                {
                    questionId = qr.SurveyQuestionId,
                    questionText = qr.SurveyQuestion?.QuestionText,
                    questionType = qr.SurveyQuestion?.QuestionType,
                    answerText = qr.AnswerText,
                    selectedOptions = string.IsNullOrEmpty(qr.SelectedOptions) 
                        ? new List<string>() 
                        : JsonSerializer.Deserialize<List<string>>(qr.SelectedOptions),
                    ratingValue = qr.RatingValue
                }).ToList()
            }).ToList();

            return Ok(new
            {
                surveyId = id,
                surveyTitle = survey.Title,
                totalResponses = responses.Count,
                responses = responseData
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving survey responses for survey {SurveyId}", id);
            return StatusCode(500, "An error occurred while retrieving survey responses");
        }
    }

    // GET: api/admin/surveys/{id}/analytics
    [HttpGet("{id}/analytics")]
    public async Task<IActionResult> GetSurveyAnalytics(long id, [FromQuery] string? courseId = null)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return Unauthorized();

            var surveyQuery = _context.Surveys
                .Include(s => s.Questions)
                .Where(s => s.Id == id && !s.IsDeleted)
                .AsNoTracking();

            if (User.IsInRole("OrgAdmin"))
                surveyQuery = surveyQuery.Where(s => s.OrganisationId == user.OrganisationID);

            var survey = await surveyQuery.FirstOrDefaultAsync();

            if (survey == null)
                return NotFound("Survey not found");

            // Get all question responses
            var questionResponsesQuery = _context.Set<SurveyQuestionResponse>()
                .Include(qr => qr.SurveyResponse)
                    .ThenInclude(sr => sr!.User)
                .Include(qr => qr.SurveyQuestion)
                .Where(qr => qr.SurveyQuestion!.SurveyId == id)
                .AsNoTracking();

            // Filter by course if specified
            if (!string.IsNullOrEmpty(courseId))
                questionResponsesQuery = questionResponsesQuery.Where(qr => qr.SurveyResponse!.CourseId == courseId);

            // Filter by organization for OrgAdmin
            if (User.IsInRole("OrgAdmin"))
                questionResponsesQuery = questionResponsesQuery.Where(qr => qr.SurveyResponse!.User!.OrganisationID == user.OrganisationID);

            var questionResponses = await questionResponsesQuery.ToListAsync();

            // Group by question and calculate analytics
            var analytics = survey.Questions?.OrderBy(q => q.OrderIndex).Select(question =>
            {
                var responses = questionResponses.Where(qr => qr.SurveyQuestionId == question.Id).ToList();
                var totalResponses = responses.Count;

                object? analysisData = null;

                switch (question.QuestionType)
                {
                    case "Rating":
                        var ratingValues = responses
                            .Where(r => r.RatingValue.HasValue)
                            .Select(r => r.RatingValue!.Value)
                            .ToList();
                        
                        analysisData = new
                        {
                            averageRating = ratingValues.Any() ? Math.Round(ratingValues.Average(), 2) : 0,
                            totalResponses = ratingValues.Count,
                            distribution = ratingValues
                                .GroupBy(v => v)
                                .OrderBy(g => g.Key)
                                .Select(g => new { rating = g.Key, count = g.Count() })
                                .ToList()
                        };
                        break;

                    case "SingleChoice":
                    case "MultipleChoice":
                        var optionCounts = new Dictionary<string, int>();
                        
                        foreach (var response in responses)
                        {
                            List<string>? selectedOptions = null;
                            
                            if (!string.IsNullOrEmpty(response.SelectedOptions))
                            {
                                selectedOptions = JsonSerializer.Deserialize<List<string>>(response.SelectedOptions);
                            }
                            
                            if (selectedOptions != null)
                            {
                                foreach (var option in selectedOptions)
                                {
                                    if (!optionCounts.ContainsKey(option))
                                        optionCounts[option] = 0;
                                    optionCounts[option]++;
                                }
                            }
                        }

                        analysisData = new
                        {
                            totalResponses,
                            optionDistribution = optionCounts.Select(kv => new { option = kv.Key, count = kv.Value }).ToList()
                        };
                        break;

                    case "YesNo":
                        var yesCount = responses.Count(r => r.AnswerText?.ToLower() == "yes");
                        var noCount = responses.Count(r => r.AnswerText?.ToLower() == "no");
                        
                        analysisData = new
                        {
                            totalResponses,
                            yesCount,
                            noCount,
                            yesPercentage = totalResponses > 0 ? Math.Round((double)yesCount / totalResponses * 100, 2) : 0
                        };
                        break;

                    case "Text":
                        analysisData = new
                        {
                            totalResponses,
                            sampleResponses = responses.Take(10).Select(r => r.AnswerText).ToList()
                        };
                        break;
                }

                return new
                {
                    questionId = question.Id,
                    questionText = question.QuestionText,
                    questionType = question.QuestionType,
                    analysis = analysisData
                };
            }).ToList();

            return Ok(new
            {
                surveyId = id,
                surveyTitle = survey.Title,
                totalResponses = questionResponses.Select(qr => qr.SurveyResponseId).Distinct().Count(),
                questionAnalytics = analytics
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving survey analytics for survey {SurveyId}", id);
            return StatusCode(500, "An error occurred while retrieving survey analytics");
        }
    }

    // PUT: api/admin/surveys/{id}/status
    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateSurveyStatus(long id, [FromBody] UpdateSurveyStatusRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return Unauthorized();

            var surveyQuery = _context.Surveys.Where(s => s.Id == id && !s.IsDeleted);

            if (User.IsInRole("OrgAdmin"))
                surveyQuery = surveyQuery.Where(s => s.OrganisationId == user.OrganisationID);

            var survey = await surveyQuery.FirstOrDefaultAsync();

            if (survey == null)
                return NotFound("Survey not found");

            if (request.Status != "Draft" && request.Status != "Published")
                return BadRequest("Status must be either 'Draft' or 'Published'");

            // Validate that survey has at least one question before publishing
            if (request.Status == "Published")
            {
                var questionCount = await _context.SurveyQuestions.CountAsync(q => q.SurveyId == id);
                if (questionCount == 0)
                    return BadRequest("Cannot publish a survey without questions");
            }

            survey.Status = request.Status;
            survey.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Survey {SurveyId} status changed to {Status} by user {UserId}", id, request.Status, userId);

            return Ok(new { message = $"Survey {request.Status.ToLower()} successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating survey status for survey {SurveyId}", id);
            return StatusCode(500, "An error occurred while updating survey status");
        }
    }

    // POST: api/admin/surveys/{id}/duplicate
    [HttpPost("{id}/duplicate")]
    public async Task<IActionResult> DuplicateSurvey(long id)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) return Unauthorized();

            var surveyQuery = _context.Surveys
                .Include(s => s.Questions)
                .Where(s => s.Id == id && !s.IsDeleted);

            if (User.IsInRole("OrgAdmin"))
                surveyQuery = surveyQuery.Where(s => s.OrganisationId == user.OrganisationID);

            var originalSurvey = await surveyQuery.FirstOrDefaultAsync();

            if (originalSurvey == null)
                return NotFound("Survey not found");

            // Create a copy of the survey
            var duplicatedSurvey = new Survey
            {
                Title = $"{originalSurvey.Title} (Copy)",
                Description = originalSurvey.Description,
                Status = "Draft", // Always create as draft
                OrganisationId = originalSurvey.OrganisationId,
                CreatedByUserId = userId!,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Surveys.Add(duplicatedSurvey);
            await _context.SaveChangesAsync();

            // Copy all questions
            if (originalSurvey.Questions != null && originalSurvey.Questions.Any())
            {
                foreach (var question in originalSurvey.Questions.OrderBy(q => q.OrderIndex))
                {
                    var duplicatedQuestion = new SurveyQuestion
                    {
                        SurveyId = duplicatedSurvey.Id,
                        QuestionText = question.QuestionText,
                        QuestionType = question.QuestionType,
                        Options = question.Options,
                        OrderIndex = question.OrderIndex,
                        IsRequired = question.IsRequired,
                        MinRating = question.MinRating,
                        MaxRating = question.MaxRating,
                        ResponseVisibility = question.ResponseVisibility,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.SurveyQuestions.Add(duplicatedQuestion);
                }
                await _context.SaveChangesAsync();
            }

            await _auditLogService.LogSurveyCreation(userId!, $"{user.FirstName} {user.LastName}", duplicatedSurvey.Id.ToString(), duplicatedSurvey.Title);

            _logger.LogInformation("Survey {SurveyId} duplicated to {NewSurveyId} by user {UserId}", id, duplicatedSurvey.Id, userId);

            return Ok(new { 
                id = duplicatedSurvey.Id, 
                message = "Survey duplicated successfully" 
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error duplicating survey {SurveyId}", id);
            return StatusCode(500, "An error occurred while duplicating the survey");
        }
    }
}

// DTOs
public class CreateSurveyRequest
{
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public bool? IsActive { get; set; }
}

public class UpdateSurveyRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public bool? IsActive { get; set; }
}

public class UpdateSurveyStatusRequest
{
    public string Status { get; set; } = null!;
}

public class CreateQuestionRequest
{
    public string QuestionText { get; set; } = null!;
    public string? QuestionType { get; set; }
    public List<string>? Options { get; set; }
    public int? OrderIndex { get; set; }
    public bool? IsRequired { get; set; }
    public int? MinRating { get; set; }
    public int? MaxRating { get; set; }
    public string? ResponseVisibility { get; set; }
}

public class UpdateQuestionRequest
{
    public string? QuestionText { get; set; }
    public string? QuestionType { get; set; }
    public List<string>? Options { get; set; }
    public int? OrderIndex { get; set; }
    public bool? IsRequired { get; set; }
    public int? MinRating { get; set; }
    public int? MaxRating { get; set; }
    public string? ResponseVisibility { get; set; }
}
