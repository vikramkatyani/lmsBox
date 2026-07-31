using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/superadmin/question-bank/categories")]
[Authorize(Roles = "SuperAdmin")]
public class QuestionBankCategoriesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IAdminActivityTracker _activityTracker;

    public QuestionBankCategoriesController(
        ApplicationDbContext context,
        UserManager<ApplicationUser> userManager,
        IAdminActivityTracker activityTracker)
    {
        _context = context;
        _userManager = userManager;
        _activityTracker = activityTracker;
    }

    // GET /api/superadmin/question-bank/categories?search=term
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? search = null)
    {
        var query = _context.QuestionBankCategories.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c => c.Name.ToLower().Contains(s) || (c.Description != null && c.Description.ToLower().Contains(s)));
        }

        var items = await query
            .OrderBy(c => c.Name)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Description,
                c.CreatedAt,
                c.UpdatedAt
            })
            .ToListAsync();

        return Ok(new { items });
    }

    // POST /api/superadmin/question-bank/categories
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateQuestionBankCategoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Category name is required" });
        }

        var name = request.Name.Trim();

        var exists = await _context.QuestionBankCategories.AnyAsync(c => c.Name.ToLower() == name.ToLower());
        if (exists)
        {
            return BadRequest(new { message = "Category already exists" });
        }

        var user = await _userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();

        var entity = new QuestionBankCategory
        {
            Name = name,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = user.Id
        };

        _context.QuestionBankCategories.Add(entity);
        await _context.SaveChangesAsync();

        await _activityTracker.TrackAsync(
            user,
            "Question Bank Category Created",
            $"Category ID: {entity.Id}, Name: {entity.Name}",
            EngagementTrackingService.EVENT_QUESTION_BANK_CATEGORY_CREATED,
            metadata: new { categoryId = entity.Id, name = entity.Name });

        return Ok(new { id = entity.Id });
    }

    // PUT /api/superadmin/question-bank/categories/{id}
    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, [FromBody] UpdateQuestionBankCategoryRequest request)
    {
        var entity = await _context.QuestionBankCategories.FirstOrDefaultAsync(c => c.Id == id);
        if (entity == null) return NotFound(new { message = "Category not found" });

        var user = await _userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();

        var newName = string.IsNullOrWhiteSpace(request.Name) ? null : request.Name.Trim();
        if (string.IsNullOrWhiteSpace(newName))
        {
            return BadRequest(new { message = "Category name is required" });
        }

        var nameChanged = !string.Equals(entity.Name, newName, StringComparison.Ordinal);
        if (nameChanged)
        {
            var exists = await _context.QuestionBankCategories.AnyAsync(c => c.Id != id && c.Name.ToLower() == newName!.ToLower());
            if (exists)
            {
                return BadRequest(new { message = "Another category with this name already exists" });
            }
        }

        var oldName = entity.Name;
        entity.Name = newName!;
        entity.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        entity.UpdatedAt = DateTime.UtcNow;
        entity.UpdatedByUserId = user.Id;

        if (nameChanged)
        {
            // Keep existing questions consistent with the renamed category
            await _context.QuestionBankQuestions
                .Where(q => q.Category != null && q.Category.ToLower() == oldName.ToLower())
                .ExecuteUpdateAsync(s => s.SetProperty(q => q.Category, newName));
        }

        await _context.SaveChangesAsync();

        await _activityTracker.TrackAsync(
            user,
            "Question Bank Category Updated",
            $"Category ID: {entity.Id}, Name: {entity.Name}" + (nameChanged ? $", Previous Name: {oldName}" : ""),
            EngagementTrackingService.EVENT_QUESTION_BANK_CATEGORY_UPDATED,
            metadata: new { categoryId = entity.Id, name = entity.Name, previousName = nameChanged ? oldName : null });

        return Ok(new { message = "Category updated" });
    }

    // DELETE /api/superadmin/question-bank/categories/{id}
    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Delete(long id)
    {
        var entity = await _context.QuestionBankCategories.FirstOrDefaultAsync(c => c.Id == id);
        if (entity == null) return NotFound(new { message = "Category not found" });

        var isUsed = await _context.QuestionBankQuestions.AnyAsync(q => q.Category != null && q.Category.ToLower() == entity.Name.ToLower());
        if (isUsed)
        {
            return BadRequest(new { message = "This category is in use by one or more questions. Rename it instead, or change those questions first." });
        }

        var user = await _userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();

        var categoryId = entity.Id;
        var categoryName = entity.Name;
        _context.QuestionBankCategories.Remove(entity);
        await _context.SaveChangesAsync();

        await _activityTracker.TrackAsync(
            user,
            "Question Bank Category Deleted",
            $"Category ID: {categoryId}, Name: {categoryName}",
            EngagementTrackingService.EVENT_QUESTION_BANK_CATEGORY_DELETED,
            metadata: new { categoryId, name = categoryName });

        return Ok(new { message = "Category deleted" });
    }
}

public class CreateQuestionBankCategoryRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
}

public class UpdateQuestionBankCategoryRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
}

