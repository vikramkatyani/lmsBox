using System.Text.Json;
using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/admin/question-bank/questions")]
[Authorize(Roles = "Admin,OrgAdmin,SuperAdmin")]
public class AdminQuestionBankQuestionsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AdminQuestionBankQuestionsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET /api/admin/question-bank/questions?search=term&tags=tag1,tag2&page=1&pageSize=50
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search = null,
        [FromQuery] string? tags = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _context.QuestionBankQuestions
            .Where(q => !q.IsArchived)
            .Include(q => q.Options.OrderBy(o => o.Order))
            .AsQueryable();

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

        var items = list.Select(q => new
        {
            q.Id,
            q.Question,
            q.Type,
            q.Points,
            q.Category,
            q.IsCriticalSafety,
            q.CreatedAt,
            q.UpdatedAt,
            Tags = ParseTagsJson(q.Tags),
            OptionCount = q.Options.Count
        });

        return Ok(new { items, total, page, pageSize });
    }

    // GET /api/admin/question-bank/questions/{id}
    [HttpGet("{id:long}")]
    public async Task<IActionResult> Get(long id)
    {
        var q = await _context.QuestionBankQuestions
            .Include(x => x.Options.OrderBy(o => o.Order))
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsArchived);

        if (q == null) return NotFound(new { message = "Question not found" });

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
}

