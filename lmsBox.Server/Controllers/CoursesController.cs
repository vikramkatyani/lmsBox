using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/learner/courses")]
[Authorize] // Requires authenticated user
public class CoursesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CoursesController> _logger;

    public CoursesController(ApplicationDbContext context, ILogger<CoursesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get courses for the current learner with their progress
    /// </summary>
    /// <param name="search">Optional search query</param>
    /// <param name="progress">Filter by progress: all, not_started, in_progress, completed</param>
    /// <returns>List of courses with user progress</returns>
    [HttpGet]
    [ResponseCache(Duration = 60, VaryByQueryKeys = new[] { "search", "progress" }, VaryByHeader = "Authorization")]
    public async Task<ActionResult<CourseListResponse>> GetMyCourses(
        [FromQuery] string? search = null,
        [FromQuery] string? progress = "all")
    {
        try
        {
            // Get current user ID from claims
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            // Get user's learning groups
            var userGroupIds = await _context.LearnerGroups
                .Where(lg => lg.UserId == userId && lg.IsActive)
                .Select(lg => lg.LearningGroupId)
                .ToListAsync();

            // Get courses mapped to these groups with optimized query
            var courses = await _context.Courses
                .Where(c => c.GroupCourses.Any(gc => userGroupIds.Contains(gc.LearningGroupId)))
                .Select(c => new
                {
                    Course = c,
                    UserProgress = _context.LearnerProgresses
                        .Where(lp => lp.UserId == userId && lp.CourseId == c.Id && lp.LessonId == null)
                        .Select(lp => new { lp.ProgressPercent, lp.Completed })
                        .FirstOrDefault()
                })
                .ToListAsync();

            // Apply search filter
            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchLower = search.ToLower();
                courses = courses.Where(r =>
                    r.Course.Title.ToLower().Contains(searchLower) ||
                    (r.Course.Description != null && r.Course.Description.ToLower().Contains(searchLower))
                ).ToList();
            }

            // Map to DTOs
            var courseDtos = courses.Select(r => new CourseItemDto
            {
                Id = r.Course.Id.ToString(),
                Title = r.Course.Title,
                Banner = "/assets/default-course-banner.png", // TODO: Add banner field to Course model
                Progress = r.UserProgress?.ProgressPercent ?? 0,
                EnrolledDate = r.UserProgress != null ? r.Course.CreatedAt : null,
                LastAccessedDate = null, // TODO: Add LastAccessedDate to LearnerProgress model
                IsCompleted = r.UserProgress?.Completed ?? false,
                CertificateEligible = r.UserProgress?.Completed ?? false // TODO: Add certificate logic
            }).ToList();

            // Apply progress filter
            courseDtos = progress switch
            {
                "not_started" => courseDtos.Where(c => c.Progress == 0).ToList(),
                "in_progress" => courseDtos.Where(c => c.Progress > 0 && c.Progress < 100).ToList(),
                "completed" => courseDtos.Where(c => c.Progress >= 100).ToList(),
                _ => courseDtos
            };

            return Ok(new CourseListResponse
            {
                Items = courseDtos,
                Total = courseDtos.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching learner courses for user");
            return StatusCode(500, new { message = "An error occurred while fetching courses" });
        }
    }

    /// <summary>
    /// Get courses with certificates (completed courses)
    /// </summary>
    [HttpGet("certificates")]
    public async Task<ActionResult<CourseListResponse>> GetCertificates()
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var certificates = await _context.LearnerProgresses
                .Include(lp => lp.Course)
                .Where(lp => lp.UserId == userId
                    && lp.CourseId != null
                    && lp.LessonId == null
                    && lp.Completed
                    && lp.CompletedAt != null)
                .Select(lp => new CourseItemDto
                {
                    Id = lp.Course!.Id.ToString(),
                    Title = lp.Course.Title,
                    Banner = "/assets/default-course-banner.png",
                    Progress = 100,
                    EnrolledDate = lp.Course.CreatedAt,
                    LastAccessedDate = null,
                    IsCompleted = true,
                    CertificateEligible = true,
                    CertificateIssuedDate = lp.CompletedAt,
                    CertificateUrl = null // TODO: Generate certificate URL
                })
                .ToListAsync();

            return Ok(new CourseListResponse
            {
                Items = certificates,
                Total = certificates.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching certificates");
            return StatusCode(500, new { message = "An error occurred while fetching certificates" });
        }
    }

    /// <summary>
    /// Get detailed course information with lessons for the current learner
    /// </summary>
    /// <param name="courseId">Course ID</param>
    /// <returns>Course details with lessons and progress</returns>
    [HttpGet("{courseId}")]
    public async Task<ActionResult<CourseDetailDto>> GetCourseDetail(long courseId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            // Check if user has access to this course through group assignments
            var hasAccess = await _context.LearnerGroups
                .Where(lg => lg.UserId == userId && lg.IsActive)
                .Join(_context.GroupCourses, lg => lg.LearningGroupId, gc => gc.LearningGroupId, (lg, gc) => gc)
                .AnyAsync(gc => gc.CourseId == courseId);

            if (!hasAccess)
            {
                return Forbid("You don't have access to this course");
            }

            // Get course with lessons
            var course = await _context.Courses
                .Include(c => c.Lessons.OrderBy(l => l.Ordinal))
                .FirstOrDefaultAsync(c => c.Id == courseId);

            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // Get course-level progress
            var courseProgress = await _context.LearnerProgresses
                .Where(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId == null)
                .FirstOrDefaultAsync();

            // Get lesson-level progress
            var lessonProgresses = await _context.LearnerProgresses
                .Where(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId != null)
                .ToListAsync();

            // Map to DTO
            var courseDetail = new CourseDetailDto
            {
                Id = course.Id.ToString(),
                Title = course.Title,
                Description = course.Description ?? "",
                Banner = "/assets/default-course-banner.png",
                Progress = courseProgress?.ProgressPercent ?? 0,
                IsCompleted = courseProgress?.Completed ?? false,
                CompletedAt = courseProgress?.CompletedAt,
                Lessons = course.Lessons.Select(lesson =>
                {
                    var lessonProgress = lessonProgresses.FirstOrDefault(lp => lp.LessonId == lesson.Id);
                    return new LessonDto
                    {
                        Id = lesson.Id.ToString(),
                        Title = lesson.Title,
                        Content = lesson.Content ?? "",
                        Type = "video", // Default type, you can extend this
                        Duration = "15:00", // Mock duration, you can add this field to Lesson model
                        Ordinal = lesson.Ordinal,
                        Progress = lessonProgress?.ProgressPercent ?? 0,
                        IsCompleted = lessonProgress?.Completed ?? false,
                        CompletedAt = lessonProgress?.CompletedAt,
                        Url = "/assets/default-video.mp4" // Mock URL, you can add this field
                    };
                }).ToList()
            };

            return Ok(courseDetail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching course detail for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while fetching course details" });
        }
    }
}

// DTOs
public class CourseListResponse
{
    public List<CourseItemDto> Items { get; set; } = new();
    public int Total { get; set; }
}

public class CourseItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Banner { get; set; } = string.Empty;
    public int Progress { get; set; }
    public DateTime? EnrolledDate { get; set; }
    public DateTime? LastAccessedDate { get; set; }
    public bool IsCompleted { get; set; }
    public bool CertificateEligible { get; set; }
    public DateTime? CertificateIssuedDate { get; set; }
    public string? CertificateUrl { get; set; }
}

public class CourseDetailDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Banner { get; set; } = string.Empty;
    public int Progress { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
    public List<LessonDto> Lessons { get; set; } = new();
}

public class LessonDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // video, pdf, scorm, quiz
    public string Duration { get; set; } = string.Empty;
    public int Ordinal { get; set; }
    public int Progress { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string Url { get; set; } = string.Empty;
}
