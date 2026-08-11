using System.Text.Json;
using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/admin/question-bank/questions")]
[Authorize(Roles = "Admin,OrgAdmin,TenantAdmin,SuperAdmin")]
public class AdminQuestionBankQuestionsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IAdminActivityTracker _activityTracker;
    private readonly IQuizFeatureService _quizFeatures;

    public AdminQuestionBankQuestionsController(
        ApplicationDbContext context,
        UserManager<ApplicationUser> userManager,
        IAdminActivityTracker activityTracker,
        IQuizFeatureService quizFeatures)
    {
        _context = context;
        _userManager = userManager;
        _activityTracker = activityTracker;
        _quizFeatures = quizFeatures;
    }

    // GET /api/admin/question-bank/questions?search=term&tags=tag1,tag2&includeGlobal=false&includeArchived=false&page=1&pageSize=50
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search = null,
        [FromQuery] string? tags = null,
        [FromQuery] bool includeGlobal = false,
        [FromQuery] bool includeArchived = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var orgScope = await ResolveOrgScopeAsync(requireOrgForOrgAdmin: false);
        if (orgScope.Error != null) return orgScope.Error;

        var query = _context.QuestionBankQuestions
            .Include(q => q.Options.OrderBy(o => o.Order))
            .AsQueryable();

        if (!includeArchived)
        {
            query = query.Where(q => !q.IsArchived);
        }

        query = ApplyOrganisationScope(query, orgScope.OrganisationId, includeGlobal);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(q =>
                q.Question.ToLower().Contains(s) ||
                (q.Category != null && q.Category.ToLower().Contains(s)) ||
                (q.Explanation != null && q.Explanation.ToLower().Contains(s)));
        }

        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 ? 1 : pageSize;
        pageSize = pageSize > 200 ? 200 : pageSize;

        var total = await query.CountAsync();

        var list = await query
            .OrderByDescending(q => q.UpdatedAt ?? q.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var tagFilter = ParseTags(tags);
        if (tagFilter.Count > 0)
        {
            list = list.Where(q =>
            {
                var qTags = ParseTagsJson(q.Tags);
                return tagFilter.All(t => qTags.Contains(t, StringComparer.OrdinalIgnoreCase));
            }).ToList();
        }

        var ids = list.Select(x => x.Id).ToArray();

        var quizCountsByQuestionId = await _context.QuizQuestions
            .Where(qq => qq.QuestionBankQuestionId != null && ids.Contains(qq.QuestionBankQuestionId.Value))
            .GroupBy(qq => qq.QuestionBankQuestionId!.Value)
            .Select(g => new
            {
                QuestionId = g.Key,
                QuizCount = g.Select(x => x.QuizId).Distinct().Count()
            })
            .ToDictionaryAsync(x => x.QuestionId, x => x.QuizCount);

        var items = list.Select(q => new
        {
            q.Id,
            q.Question,
            q.Type,
            q.Points,
            q.Category,
            q.IsCriticalSafety,
            q.IsArchived,
            q.CreatedAt,
            q.UpdatedAt,
            Tags = ParseTagsJson(q.Tags),
            OptionCount = q.Options.Count,
            QuizCount = quizCountsByQuestionId.TryGetValue(q.Id, out var qc) ? qc : 0
        });

        return Ok(new { items, total, page, pageSize });
    }

    // GET /api/admin/question-bank/questions/{id}
    [HttpGet("{id:long}")]
    public async Task<IActionResult> Get(long id)
    {
        var orgScope = await ResolveOrgScopeAsync(requireOrgForOrgAdmin: false);
        if (orgScope.Error != null) return orgScope.Error;

        var q = await _context.QuestionBankQuestions
            .Include(x => x.Options.OrderBy(o => o.Order))
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsArchived);

        if (q == null) return NotFound(new { message = "Question not found" });
        if (!CanAccessQuestion(q, orgScope.OrganisationId, includeGlobal: true))
        {
            return NotFound(new { message = "Question not found" });
        }

        return Ok(new
        {
            q.Id,
            q.Question,
            q.Type,
            q.Points,
            q.Explanation,
            q.Category,
            q.IsCriticalSafety,
            Tags = ParseTagsJson(q.Tags),
            Options = q.Options.OrderBy(o => o.Order).Select(o => new { o.Id, o.Text, o.IsCorrect, o.Order })
        });
    }

    // POST /api/admin/question-bank/questions
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateQuestionBankQuestionRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var orgScope = await ResolveOrgScopeAsync(requireOrgForOrgAdmin: true);
        if (orgScope.Error != null) return orgScope.Error;
        if (orgScope.OrganisationId == null)
        {
            return BadRequest(new { message = "Organisation context is required to create questions." });
        }

        var user = orgScope.User!;
        var validationError = ValidateQuestionPayload(request, out var options);
        if (validationError != null) return BadRequest(new { message = validationError });

        var entity = new QuestionBankQuestion
        {
            Question = request.Question.Trim(),
            Type = string.IsNullOrWhiteSpace(request.Type) ? "mc_single" : request.Type,
            Points = request.Points <= 0 ? 1 : request.Points,
            Explanation = string.IsNullOrWhiteSpace(request.Explanation) ? null : request.Explanation.Trim(),
            Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim(),
            IsCriticalSafety = _quizFeatures.ResolveCriticalSafety(request.IsCriticalSafety),
            Tags = NormalizeTagsToJson(request.Tags),
            OrganisationId = orgScope.OrganisationId,
            CreatedByUserId = user.Id,
            CreatedAt = DateTime.UtcNow,
        };

        for (var i = 0; i < options.Count; i++)
        {
            entity.Options.Add(new QuestionBankQuestionOption
            {
                Text = options[i].Text.Trim(),
                IsCorrect = options[i].IsCorrect,
                Order = i
            });
        }

        _context.QuestionBankQuestions.Add(entity);
        await _context.SaveChangesAsync();

        await _activityTracker.TrackAsync(
            user,
            "Question Bank Question Created",
            $"Question ID: {entity.Id}, Type: {entity.Type}, Category: {entity.Category ?? "—"}",
            EngagementTrackingService.EVENT_QUESTION_BANK_QUESTION_CREATED,
            metadata: new { questionId = entity.Id, type = entity.Type, category = entity.Category, organisationId = entity.OrganisationId });

        return CreatedAtAction(nameof(Get), new { id = entity.Id }, new { id = entity.Id });
    }

    // PUT /api/admin/question-bank/questions/{id}
    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, [FromBody] UpdateQuestionBankQuestionRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);

        var orgScope = await ResolveOrgScopeAsync(requireOrgForOrgAdmin: true);
        if (orgScope.Error != null) return orgScope.Error;

        var entity = await _context.QuestionBankQuestions
            .Include(q => q.Options)
            .FirstOrDefaultAsync(q => q.Id == id);

        if (entity == null) return NotFound(new { message = "Question not found" });
        if (!CanMutateQuestion(entity, orgScope.OrganisationId))
        {
            return Forbid();
        }

        var user = orgScope.User!;
        var hasBeenPresented = await _context.QuizAttemptQuestions.AnyAsync(aq => aq.QuestionBankQuestionId == id);
        var hasBeenAttempted = await _context.QuizAttemptAnswers.AnyAsync(a => a.QuestionBankQuestionId == id);
        if (hasBeenPresented || hasBeenAttempted)
        {
            return BadRequest(new { message = "This question has already been presented/attempted by learners and can no longer be edited. Archive it instead." });
        }

        var validationError = ValidateQuestionPayload(request, out var options);
        if (validationError != null) return BadRequest(new { message = validationError });

        entity.Question = request.Question.Trim();
        entity.Type = string.IsNullOrWhiteSpace(request.Type) ? "mc_single" : request.Type;
        entity.Points = request.Points <= 0 ? 1 : request.Points;
        entity.Explanation = string.IsNullOrWhiteSpace(request.Explanation) ? null : request.Explanation.Trim();
        entity.Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim();
        entity.IsCriticalSafety = _quizFeatures.ResolveCriticalSafety(request.IsCriticalSafety);
        entity.Tags = NormalizeTagsToJson(request.Tags);
        entity.UpdatedAt = DateTime.UtcNow;

        _context.QuestionBankQuestionOptions.RemoveRange(entity.Options);
        entity.Options.Clear();
        for (var i = 0; i < options.Count; i++)
        {
            entity.Options.Add(new QuestionBankQuestionOption
            {
                Text = options[i].Text.Trim(),
                IsCorrect = options[i].IsCorrect,
                Order = i
            });
        }

        await _context.SaveChangesAsync();

        await _activityTracker.TrackAsync(
            user,
            "Question Bank Question Updated",
            $"Question ID: {entity.Id}, Type: {entity.Type}, Category: {entity.Category ?? "—"}",
            EngagementTrackingService.EVENT_QUESTION_BANK_QUESTION_UPDATED,
            metadata: new { questionId = entity.Id, type = entity.Type, category = entity.Category, organisationId = entity.OrganisationId });

        return Ok(new { message = "Question updated" });
    }

    // PATCH /api/admin/question-bank/questions/{id}/archive
    [HttpPatch("{id:long}/archive")]
    public async Task<IActionResult> SetArchived(long id, [FromBody] SetArchiveRequest request)
    {
        var orgScope = await ResolveOrgScopeAsync(requireOrgForOrgAdmin: true);
        if (orgScope.Error != null) return orgScope.Error;

        var entity = await _context.QuestionBankQuestions.FirstOrDefaultAsync(q => q.Id == id);
        if (entity == null) return NotFound(new { message = "Question not found" });
        if (!CanMutateQuestion(entity, orgScope.OrganisationId))
        {
            return Forbid();
        }

        var user = orgScope.User!;
        entity.IsArchived = request.IsArchived;
        entity.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _activityTracker.TrackAsync(
            user,
            $"Question Bank Question {(request.IsArchived ? "Archived" : "Unarchived")}",
            $"Question ID: {entity.Id}, Category: {entity.Category ?? "—"}",
            EngagementTrackingService.EVENT_QUESTION_BANK_QUESTION_ARCHIVED,
            metadata: new { questionId = entity.Id, isArchived = request.IsArchived, category = entity.Category, organisationId = entity.OrganisationId });

        return Ok(new { message = request.IsArchived ? "Question archived" : "Question unarchived" });
    }

    // DELETE /api/admin/question-bank/questions/{id}
    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        var orgScope = await ResolveOrgScopeAsync(requireOrgForOrgAdmin: true);
        if (orgScope.Error != null) return orgScope.Error;

        var entity = await _context.QuestionBankQuestions.FirstOrDefaultAsync(q => q.Id == id);
        if (entity == null) return NotFound(new { message = "Question not found" });
        if (!CanMutateQuestion(entity, orgScope.OrganisationId))
        {
            return Forbid();
        }

        var isReferencedByQuiz = await _context.QuizQuestions.AnyAsync(qq => qq.QuestionBankQuestionId == id);
        var hasBeenPresented = await _context.QuizAttemptQuestions.AnyAsync(aq => aq.QuestionBankQuestionId == id);
        var hasBeenAttempted = await _context.QuizAttemptAnswers.AnyAsync(a => a.QuestionBankQuestionId == id);

        if (isReferencedByQuiz || hasBeenPresented || hasBeenAttempted)
        {
            return BadRequest(new { message = "This question is already in use. It cannot be deleted. Archive it instead." });
        }

        var user = orgScope.User!;
        var questionId = entity.Id;
        var category = entity.Category;
        _context.QuestionBankQuestions.Remove(entity);
        await _context.SaveChangesAsync();

        await _activityTracker.TrackAsync(
            user,
            "Question Bank Question Deleted",
            $"Question ID: {questionId}, Category: {category ?? "—"}",
            EngagementTrackingService.EVENT_QUESTION_BANK_QUESTION_DELETED,
            metadata: new { questionId, category, organisationId = entity.OrganisationId });

        return Ok(new { message = "Question deleted" });
    }

    private async Task<(ApplicationUser? User, long? OrganisationId, IActionResult? Error)> ResolveOrgScopeAsync(bool requireOrgForOrgAdmin)
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null) return (null, null, Unauthorized());

        if (User.IsInRole("OrgAdmin"))
        {
            if (!user.OrganisationID.HasValue)
            {
                return (user, null, BadRequest(new { message = "Organisation not found for this user." }));
            }

            return (user, user.OrganisationID.Value, null);
        }

        if (requireOrgForOrgAdmin)
        {
            return (user, null, BadRequest(new { message = "Only organisation admins can manage organisation question banks." }));
        }

        return (user, null, null);
    }

    private static IQueryable<QuestionBankQuestion> ApplyOrganisationScope(
        IQueryable<QuestionBankQuestion> query,
        long? organisationId,
        bool includeGlobal)
    {
        if (organisationId.HasValue)
        {
            return includeGlobal
                ? query.Where(q => q.OrganisationId == organisationId || q.OrganisationId == null)
                : query.Where(q => q.OrganisationId == organisationId);
        }

        return query;
    }

    private static bool CanAccessQuestion(QuestionBankQuestion question, long? organisationId, bool includeGlobal)
    {
        if (!organisationId.HasValue) return true;
        if (question.OrganisationId == organisationId) return true;
        return includeGlobal && question.OrganisationId == null;
    }

    private static bool CanMutateQuestion(QuestionBankQuestion question, long? organisationId)
        => organisationId.HasValue && question.OrganisationId == organisationId;

    private static string? ValidateQuestionPayload(CreateQuestionBankQuestionRequest request, out List<CreateOptionRequest> options)
    {
        options = (request.Options ?? new List<CreateOptionRequest>())
            .Where(o => !string.IsNullOrWhiteSpace(o.Text))
            .ToList();

        if (string.IsNullOrWhiteSpace(request.Question))
        {
            return "Question text is required";
        }

        if (options.Count < 2) return "At least 2 options are required";
        if (!options.Any(o => o.IsCorrect)) return "Select at least one correct answer";
        if ((request.Type ?? "mc_single") == "mc_single" && options.Count(o => o.IsCorrect) != 1)
        {
            return "Exactly one correct answer is required";
        }

        return null;
    }

    private static List<string> ParseTags(string? tags)
    {
        if (string.IsNullOrWhiteSpace(tags)) return new List<string>();
        return tags.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(t => t.Trim())
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static List<string> ParseTagsJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<string>();
        try
        {
            var arr = JsonSerializer.Deserialize<string[]>(json);
            return (arr ?? Array.Empty<string>())
                .Select(t => (t ?? string.Empty).Trim())
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
        catch
        {
            return ParseTags(json);
        }
    }

    private static string? NormalizeTagsToJson(string[]? tags)
    {
        if (tags == null || tags.Length == 0) return null;
        var clean = tags
            .Select(t => (t ?? string.Empty).Trim())
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (clean.Length == 0) return null;
        return JsonSerializer.Serialize(clean);
    }

    public class SetArchiveRequest
    {
        public bool IsArchived { get; set; }
    }
}
