using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using lmsbox.domain.Utils;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/admin/courses")]
[Authorize(Roles = "Admin,OrgAdmin,SuperAdmin")]
public class AdminCoursesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminCoursesController> _logger;

    public AdminCoursesController(ApplicationDbContext context, ILogger<AdminCoursesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get courses for admin management (org admin sees only their org's courses)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<AdminCourseListResponse>> GetCourses(
        [FromQuery] string? search = null,
        [FromQuery] string? status = "all",
        [FromQuery] string? category = "all",
        [FromQuery] string? sort = "updated_desc")
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            // Get user's organization
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var query = _context.Courses
                .Include(c => c.Organisation)
                .Include(c => c.CreatedByUser)
                .Include(c => c.Lessons)
                .AsQueryable();

            // Organization filtering: OrgAdmin can only see their org's courses
            if (userRole == "OrgAdmin")
            {
                query = query.Where(c => c.OrganisationId == user.OrganisationID);
            }
            // SuperAdmin and Admin can see all courses (no additional filter)

            // Search filter
            if (!string.IsNullOrEmpty(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(c => 
                    c.Title.ToLower().Contains(searchLower) ||
                    (c.Description != null && c.Description.ToLower().Contains(searchLower)) ||
                    (c.Category != null && c.Category.ToLower().Contains(searchLower)));
            }

            // Status filter
            if (!string.IsNullOrEmpty(status) && status != "all")
            {
                query = query.Where(c => c.Status.ToLower() == status.ToLower());
            }

            // Category filter
            if (!string.IsNullOrEmpty(category) && category != "all")
            {
                query = query.Where(c => c.Category != null && c.Category.ToLower() == category.ToLower());
            }

            // Sorting
            query = sort switch
            {
                "title_asc" => query.OrderBy(c => c.Title),
                "title_desc" => query.OrderByDescending(c => c.Title),
                "created_asc" => query.OrderBy(c => c.CreatedAt),
                "created_desc" => query.OrderByDescending(c => c.CreatedAt),
                "updated_asc" => query.OrderBy(c => c.UpdatedAt ?? c.CreatedAt),
                "updated_desc" => query.OrderByDescending(c => c.UpdatedAt ?? c.CreatedAt),
                _ => query.OrderByDescending(c => c.UpdatedAt ?? c.CreatedAt)
            };

            var courses = await query.ToListAsync();

            var courseList = courses.Select(c => new AdminCourseDto
            {
                Id = c.Id,
                Title = c.Title,
                Description = c.Description,
                ShortDescription = c.ShortDescription,
                Category = c.Category,
                Tags = !string.IsNullOrEmpty(c.Tags) ? JsonSerializer.Deserialize<string[]>(c.Tags) ?? Array.Empty<string>() : Array.Empty<string>(),
                Status = c.Status,
                CertificateEnabled = c.CertificateEnabled,
                BannerUrl = c.BannerUrl,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt,
                CreatedByUserName = c.CreatedByUser?.FirstName + " " + c.CreatedByUser?.LastName,
                OrganisationName = c.Organisation?.Name,
                LessonCount = c.Lessons.Count
            }).ToList();

            return Ok(new AdminCourseListResponse
            {
                Courses = courseList,
                Total = courseList.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving courses for admin");
            return StatusCode(500, new { message = "An error occurred while retrieving courses" });
        }
    }

    /// <summary>
    /// Get a specific course for editing
    /// </summary>
    [HttpGet("{courseId}")]
    public async Task<ActionResult<AdminCourseDetailDto>> GetCourse(string courseId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var course = await _context.Courses
                .Include(c => c.Organisation)
                .Include(c => c.CreatedByUser)
                .Include(c => c.Lessons)
                .FirstOrDefaultAsync(c => c.Id == courseId);

            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // Check organization access for OrgAdmin
            if (userRole == "OrgAdmin" && course.OrganisationId != user.OrganisationID)
            {
                return Forbid("You can only access courses from your organization");
            }

            var courseDetail = new AdminCourseDetailDto
            {
                Id = course.Id,
                Title = course.Title,
                Description = course.Description,
                ShortDescription = course.ShortDescription,
                Category = course.Category,
                Tags = !string.IsNullOrEmpty(course.Tags) ? JsonSerializer.Deserialize<string[]>(course.Tags) ?? Array.Empty<string>() : Array.Empty<string>(),
                Status = course.Status,
                CertificateEnabled = course.CertificateEnabled,
                BannerUrl = course.BannerUrl,
                CreatedAt = course.CreatedAt,
                UpdatedAt = course.UpdatedAt,
                OrganisationId = course.OrganisationId,
                OrganisationName = course.Organisation?.Name,
                Lessons = course.Lessons.OrderBy(l => l.Ordinal).Select(l => new AdminLessonDto
                {
                    Id = l.Id,
                    Order = l.Ordinal,
                    Type = "content", // Default type since Lesson model doesn't have Type
                    Title = l.Title,
                    Description = l.Content,
                    IsOptional = false, // Default value
                    Src = null, // Not in current model
                    EntryUrl = null, // Not in current model
                    QuizId = null // Not in current model
                }).ToList()
            };

            return Ok(courseDetail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving course {CourseId} for admin", courseId);
            return StatusCode(500, new { message = "An error occurred while retrieving the course" });
        }
    }

    /// <summary>
    /// Create a new course
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<AdminCourseDetailDto>> CreateCourse([FromBody] CreateCourseRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            // Get user's organization
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null || user.OrganisationID == 0)
            {
                return BadRequest(new { message = "User must belong to an organization to create courses" });
            }

            // Validate required fields
            if (string.IsNullOrWhiteSpace(request.Title))
            {
                return BadRequest(new { message = "Title is required" });
            }

            // Create new course
            var course = new Course
            {
                Id = ShortGuid.Generate(), // Generate short GUID
                Title = request.Title.Trim(),
                Description = request.Description?.Trim(),
                ShortDescription = request.ShortDescription?.Trim(),
                Category = request.Category?.Trim(),
                Tags = request.Tags?.Any() == true ? JsonSerializer.Serialize(request.Tags) : null,
                Status = "Draft", // New courses start as Draft
                CertificateEnabled = request.CertificateEnabled,
                BannerUrl = request.BannerUrl,
                OrganisationId = user.OrganisationID,
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Courses.Add(course);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Course {CourseId} created by user {UserId}", course.Id, userId);

            // Return the created course with details
            var createdCourse = await _context.Courses
                .Include(c => c.Organisation)
                .Include(c => c.CreatedByUser)
                .Include(c => c.Lessons)
                .FirstOrDefaultAsync(c => c.Id == course.Id);

            var courseDetail = new AdminCourseDetailDto
            {
                Id = createdCourse!.Id,
                Title = createdCourse.Title,
                Description = createdCourse.Description,
                ShortDescription = createdCourse.ShortDescription,
                Category = createdCourse.Category,
                Tags = !string.IsNullOrEmpty(createdCourse.Tags) ? JsonSerializer.Deserialize<string[]>(createdCourse.Tags) ?? Array.Empty<string>() : Array.Empty<string>(),
                Status = createdCourse.Status,
                CertificateEnabled = createdCourse.CertificateEnabled,
                BannerUrl = createdCourse.BannerUrl,
                CreatedAt = createdCourse.CreatedAt,
                UpdatedAt = createdCourse.UpdatedAt,
                OrganisationId = createdCourse.OrganisationId,
                OrganisationName = createdCourse.Organisation?.Name,
                Lessons = new List<AdminLessonDto>()
            };

            return CreatedAtAction(nameof(GetCourse), new { courseId = course.Id }, courseDetail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating course");
            return StatusCode(500, new { message = "An error occurred while creating the course" });
        }
    }

    /// <summary>
    /// Update an existing course
    /// </summary>
    [HttpPut("{courseId}")]
    public async Task<ActionResult<AdminCourseDetailDto>> UpdateCourse(string courseId, [FromBody] UpdateCourseRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var course = await _context.Courses
                .Include(c => c.Organisation)
                .FirstOrDefaultAsync(c => c.Id == courseId);

            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // Check organization access for OrgAdmin
            if (userRole == "OrgAdmin" && course.OrganisationId != user.OrganisationID)
            {
                return Forbid("You can only update courses from your organization");
            }

            // Validate required fields
            if (string.IsNullOrWhiteSpace(request.Title))
            {
                return BadRequest(new { message = "Title is required" });
            }

            // Update course fields
            course.Title = request.Title.Trim();
            course.Description = request.Description?.Trim();
            course.ShortDescription = request.ShortDescription?.Trim();
            course.Category = request.Category?.Trim();
            course.Tags = request.Tags?.Any() == true ? JsonSerializer.Serialize(request.Tags) : null;
            course.Status = request.Status ?? course.Status;
            course.CertificateEnabled = request.CertificateEnabled;
            course.BannerUrl = request.BannerUrl;
            course.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Course {CourseId} updated by user {UserId}", courseId, userId);

            // Return the updated course with details
            var updatedCourse = await _context.Courses
                .Include(c => c.Organisation)
                .Include(c => c.CreatedByUser)
                .Include(c => c.Lessons)
                .FirstOrDefaultAsync(c => c.Id == courseId);

            var courseDetail = new AdminCourseDetailDto
            {
                Id = updatedCourse!.Id,
                Title = updatedCourse.Title,
                Description = updatedCourse.Description,
                ShortDescription = updatedCourse.ShortDescription,
                Category = updatedCourse.Category,
                Tags = !string.IsNullOrEmpty(updatedCourse.Tags) ? JsonSerializer.Deserialize<string[]>(updatedCourse.Tags) ?? Array.Empty<string>() : Array.Empty<string>(),
                Status = updatedCourse.Status,
                CertificateEnabled = updatedCourse.CertificateEnabled,
                BannerUrl = updatedCourse.BannerUrl,
                CreatedAt = updatedCourse.CreatedAt,
                UpdatedAt = updatedCourse.UpdatedAt,
                OrganisationId = updatedCourse.OrganisationId,
                OrganisationName = updatedCourse.Organisation?.Name,
                Lessons = updatedCourse.Lessons.OrderBy(l => l.Ordinal).Select(l => new AdminLessonDto
                {
                    Id = l.Id,
                    Order = l.Ordinal,
                    Type = "content", // Default type since Lesson model doesn't have Type
                    Title = l.Title,
                    Description = l.Content,
                    IsOptional = false, // Default value
                    Src = null, // Not in current model
                    EntryUrl = null, // Not in current model
                    QuizId = null // Not in current model
                }).ToList()
            };

            return Ok(courseDetail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while updating the course" });
        }
    }

    /// <summary>
    /// Delete a course
    /// </summary>
    [HttpDelete("{courseId}")]
    public async Task<ActionResult> DeleteCourse(string courseId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var course = await _context.Courses
                .Include(c => c.Lessons)
                .Include(c => c.GroupCourses)
                .Include(c => c.CourseAssignments)
                .FirstOrDefaultAsync(c => c.Id == courseId);

            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // Check organization access for OrgAdmin
            if (userRole == "OrgAdmin" && course.OrganisationId != user.OrganisationID)
            {
                return Forbid("You can only delete courses from your organization");
            }

            // Check if course has assignments or group mappings
            if (course.GroupCourses.Any() || course.CourseAssignments.Any())
            {
                return BadRequest(new { message = "Cannot delete course that is assigned to groups or has active assignments. Please remove all assignments first." });
            }

            // Remove course and related data
            _context.Courses.Remove(course);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Course {CourseId} deleted by user {UserId}", courseId, userId);

            return Ok(new { message = "Course deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while deleting the course" });
        }
    }
}

// DTOs for API responses
public class AdminCourseListResponse
{
    public List<AdminCourseDto> Courses { get; set; } = new();
    public int Total { get; set; }
}

public class AdminCourseDto
{
    public string Id { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public string? ShortDescription { get; set; }
    public string? Category { get; set; }
    public string[] Tags { get; set; } = Array.Empty<string>();
    public string Status { get; set; } = null!;
    public bool CertificateEnabled { get; set; }
    public string? BannerUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? CreatedByUserName { get; set; }
    public string? OrganisationName { get; set; }
    public int LessonCount { get; set; }
}

public class AdminCourseDetailDto : AdminCourseDto
{
    public long OrganisationId { get; set; }
    public List<AdminLessonDto> Lessons { get; set; } = new();
}

public class AdminLessonDto
{
    public long Id { get; set; }
    public int Order { get; set; }
    public string Type { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsOptional { get; set; }
    public string? Src { get; set; }
    public string? EntryUrl { get; set; }
    public long? QuizId { get; set; }
}

// DTOs for API requests
public class CreateCourseRequest
{
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public string? ShortDescription { get; set; }
    public string? Category { get; set; }
    public string[]? Tags { get; set; }
    public bool CertificateEnabled { get; set; } = true;
    public string? BannerUrl { get; set; }
}

public class UpdateCourseRequest : CreateCourseRequest
{
    public string? Status { get; set; }
}