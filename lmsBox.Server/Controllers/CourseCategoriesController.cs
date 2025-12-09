using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/course-categories")]
[Authorize(Roles = "Admin,OrgAdmin,SuperAdmin")]
public class CourseCategoriesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CourseCategoriesController(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Get all course categories (shared across all organizations)
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetCategories()
    {
        var categories = await _context.CourseCategories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => c.Name)
            .ToListAsync();

        return Ok(new { categories });
    }

    /// <summary>
    /// Add a new category or return existing one (case-insensitive check)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> AddCategory([FromBody] AddCategoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Category name is required" });
        }

        var categoryName = request.Name.Trim();

        // Check if category already exists (case-insensitive)
        var existing = await _context.CourseCategories
            .FirstOrDefaultAsync(c => c.Name.ToLower() == categoryName.ToLower());

        if (existing != null)
        {
            // Return existing category
            return Ok(new { category = existing.Name, isNew = false });
        }

        // Create new category
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var category = new CourseCategory
        {
            Name = categoryName,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        _context.CourseCategories.Add(category);
        await _context.SaveChangesAsync();

        return Ok(new { category = category.Name, isNew = true });
    }
}

public class AddCategoryRequest
{
    public string Name { get; set; } = null!;
}
