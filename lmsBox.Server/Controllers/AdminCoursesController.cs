using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using lmsbox.domain.Utils;
using lmsBox.Server.Services;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/admin/courses")]
[Authorize(Roles = "Admin,OrgAdmin,SuperAdmin")]
public class AdminCoursesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminCoursesController> _logger;
    private readonly IAzureBlobService _blobService;
    private readonly IStorageQuotaService _storageQuotaService;
    private readonly IEngagementTrackingService _engagementService;

    public AdminCoursesController(
        ApplicationDbContext context, 
        ILogger<AdminCoursesController> logger,
        IAzureBlobService blobService,
        IStorageQuotaService storageQuotaService,
        IEngagementTrackingService engagementService)
    {
        _context = context;
        _logger = logger;
        _blobService = blobService;
        _storageQuotaService = storageQuotaService;
        _engagementService = engagementService;
    }

    /// <summary>
    /// Get courses for admin management (org admin sees only their org's courses)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<AdminCourseListResponse>> GetCourses(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? status = "all",
        [FromQuery] string? category = "all",
        [FromQuery] string sortBy = "updatedAt",
        [FromQuery] string sortOrder = "desc")
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            // Validate pagination parameters
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 20;
            if (pageSize > 100) pageSize = 100;

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
                .Where(c => !c.IsDeleted) // Exclude soft-deleted courses
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

            // Get total count before pagination
            var totalCount = await query.CountAsync();

            // Sorting
            var sortByLower = sortBy.ToLower();
            var sortOrderLower = sortOrder.ToLower();

            query = sortByLower switch
            {
                "title" => sortOrderLower == "desc" 
                    ? query.OrderByDescending(c => c.Title) 
                    : query.OrderBy(c => c.Title),
                "createdat" => sortOrderLower == "desc" 
                    ? query.OrderByDescending(c => c.CreatedAt) 
                    : query.OrderBy(c => c.CreatedAt),
                "updatedat" => sortOrderLower == "desc" 
                    ? query.OrderByDescending(c => c.UpdatedAt ?? c.CreatedAt) 
                    : query.OrderBy(c => c.UpdatedAt ?? c.CreatedAt),
                "category" => sortOrderLower == "desc" 
                    ? query.OrderByDescending(c => c.Category) 
                    : query.OrderBy(c => c.Category),
                "status" => sortOrderLower == "desc" 
                    ? query.OrderByDescending(c => c.Status) 
                    : query.OrderBy(c => c.Status),
                _ => query.OrderByDescending(c => c.UpdatedAt ?? c.CreatedAt)
            };

            // Apply pagination
            var courses = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            // Get course IDs for learner count calculation
            var courseIds = courses.Select(c => c.Id).ToList();

            // Calculate learner counts based on Learning Pathways
            // A user has access to a course if they are enrolled in any pathway that contains this course
            
            // First, get all pathway-course mappings for these courses
            var pathwayCourseMappings = await _context.PathwayCourses
                .Where(pc => courseIds.Contains(pc.CourseId))
                .Select(pc => new { pc.CourseId, pc.LearningPathwayId })
                .ToListAsync();

            // Create a dictionary of CourseId -> List of PathwayIds
            var coursePathwaysDict = pathwayCourseMappings
                .GroupBy(pc => pc.CourseId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(pc => pc.LearningPathwayId).ToList()
                );

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
                LessonCount = c.Lessons.Count,
                PreCourseSurveyId = c.PreCourseSurveyId,
                PostCourseSurveyId = c.PostCourseSurveyId,
                IsPreSurveyMandatory = c.IsPreSurveyMandatory,
                IsPostSurveyMandatory = c.IsPostSurveyMandatory
            }).ToList();

            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            return Ok(new AdminCourseListResponse
            {
                Courses = courseList,
                Total = totalCount,
                Pagination = new
                {
                    CurrentPage = page,
                    PageSize = pageSize,
                    TotalPages = totalPages,
                    TotalCount = totalCount,
                    HasNextPage = page < totalPages,
                    HasPreviousPage = page > 1
                }
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
                .FirstOrDefaultAsync(c => c.Id == courseId && !c.IsDeleted);

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
                PreCourseSurveyId = course.PreCourseSurveyId,
                PostCourseSurveyId = course.PostCourseSurveyId,
                IsPreSurveyMandatory = course.IsPreSurveyMandatory,
                IsPostSurveyMandatory = course.IsPostSurveyMandatory,
                Lessons = course.Lessons.OrderBy(l => l.Ordinal).Select(l => new AdminLessonDto
                {
                    Id = l.Id,
                    Order = l.Ordinal,
                    Type = l.Type,
                    Title = l.Title,
                    Description = l.Content,
                    IsOptional = l.IsOptional,
                    Src = l.VideoUrl ?? l.DocumentUrl ?? l.ScormUrl,
                    EntryUrl = l.ScormEntryUrl,
                    ScormVersion = l.ScormVersion,
                    QuizId = l.QuizId
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

            // Check for duplicate course title in the same organization
            var duplicateExists = await _context.Courses
                .AnyAsync(c => c.OrganisationId == user.OrganisationID 
                    && c.Title.ToLower() == request.Title.Trim().ToLower() 
                    && !c.IsDeleted);

            if (duplicateExists)
            {
                return BadRequest(new { message = $"A course with the title '{request.Title.Trim()}' already exists in your organization. Please use a different title." });
            }

            // Auto-create category if it doesn't exist
            if (!string.IsNullOrWhiteSpace(request.Category))
            {
                var categoryName = request.Category.Trim();
                var existingCategory = await _context.CourseCategories
                    .FirstOrDefaultAsync(c => c.Name.ToLower() == categoryName.ToLower());
                
                if (existingCategory == null)
                {
                    _context.CourseCategories.Add(new CourseCategory
                    {
                        Name = categoryName,
                        CreatedByUserId = userId,
                        CreatedAt = DateTime.UtcNow
                    });
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("New category '{Category}' created by user {UserId}", categoryName, userId);
                }
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
                OrganisationId = user.OrganisationID ?? 0,
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                PreCourseSurveyId = request.PreCourseSurveyId,
                PostCourseSurveyId = request.PostCourseSurveyId,
                IsPreSurveyMandatory = request.IsPreSurveyMandatory,
                IsPostSurveyMandatory = request.IsPostSurveyMandatory
            };

            _context.Courses.Add(course);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Course {CourseId} created by user {UserId}", course.Id, userId);

            // Track course creation engagement
            if (user.OrganisationID.HasValue)
            {
                _logger.LogInformation("📊 Tracking course creation: User={UserId}, Org={OrgId}, Course={CourseId}", userId, user.OrganisationID.Value, course.Id);
                await _engagementService.TrackAsync(
                    userId,
                    user.OrganisationID.Value,
                    EngagementTrackingService.EVENT_COURSE_CREATED,
                    courseId: course.Id,
                    metadata: new { title = course.Title, category = course.Category }
                );
            }

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
                PreCourseSurveyId = createdCourse.PreCourseSurveyId,
                PostCourseSurveyId = createdCourse.PostCourseSurveyId,
                IsPreSurveyMandatory = createdCourse.IsPreSurveyMandatory,
                IsPostSurveyMandatory = createdCourse.IsPostSurveyMandatory,
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
                .Include(c => c.Lessons)
                .FirstOrDefaultAsync(c => c.Id == courseId && !c.IsDeleted);

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

            // Auto-create category if it doesn't exist and is being changed
            if (!string.IsNullOrWhiteSpace(request.Category))
            {
                var categoryName = request.Category.Trim();
                if (course.Category != categoryName)
                {
                    var existingCategory = await _context.CourseCategories
                        .FirstOrDefaultAsync(c => c.Name.ToLower() == categoryName.ToLower());
                    
                    if (existingCategory == null)
                    {
                        _context.CourseCategories.Add(new CourseCategory
                        {
                            Name = categoryName,
                            CreatedByUserId = userId,
                            CreatedAt = DateTime.UtcNow
                        });
                        await _context.SaveChangesAsync();
                        _logger.LogInformation("New category '{Category}' created by user {UserId}", categoryName, userId);
                    }
                }
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

            // Survey assignments - can only be changed if course is not published
            if (course.Status != "Published")
            {
                course.PreCourseSurveyId = request.PreCourseSurveyId;
                course.PostCourseSurveyId = request.PostCourseSurveyId;
                course.IsPreSurveyMandatory = request.IsPreSurveyMandatory;
                course.IsPostSurveyMandatory = request.IsPostSurveyMandatory;
            }
            else if (request.PreCourseSurveyId != course.PreCourseSurveyId || 
                     request.PostCourseSurveyId != course.PostCourseSurveyId ||
                     request.IsPreSurveyMandatory != course.IsPreSurveyMandatory ||
                     request.IsPostSurveyMandatory != course.IsPostSurveyMandatory)
            {
                return BadRequest(new { message = "Cannot modify survey settings for published courses." });
            }

            // Only allow lesson modifications if course is NOT published
            if (request.Lessons != null)
            {
                if (course.Status == "Published")
                {
                    return BadRequest(new { message = "Cannot add, remove, or reorder lessons for published courses. Unpublish the course first to make lesson changes." });
                }

                // Get existing lesson IDs
                var existingLessonIds = course.Lessons.Select(l => l.Id).ToList();
                var requestLessonIds = request.Lessons
                    .Where(l => l.Id.HasValue)
                    .Select(l => l.Id!.Value)
                    .ToList();

                // Remove lessons that are not in the request
                var lessonsToRemove = course.Lessons
                    .Where(l => !requestLessonIds.Contains(l.Id))
                    .ToList();

                foreach (var lesson in lessonsToRemove)
                {
                    _context.Lessons.Remove(lesson);
                }

                // Update existing lessons and add new ones
                foreach (var lessonDto in request.Lessons)
                {
                    if (lessonDto.Id.HasValue)
                    {
                        // Update existing lesson
                        var existingLesson = course.Lessons.FirstOrDefault(l => l.Id == lessonDto.Id.Value);
                        if (existingLesson != null)
                        {
                            existingLesson.Title = lessonDto.Title;
                            existingLesson.Content = lessonDto.Content;
                            existingLesson.Ordinal = lessonDto.Ordinal;
                            existingLesson.Type = lessonDto.Type;
                            existingLesson.QuizId = lessonDto.QuizId;
                            existingLesson.VideoUrl = lessonDto.VideoUrl;
                            existingLesson.DurationSeconds = lessonDto.DurationSeconds;
                            existingLesson.ScormUrl = lessonDto.ScormUrl;
                            existingLesson.ScormEntryUrl = lessonDto.ScormEntryUrl;
                            existingLesson.ScormVersion = lessonDto.ScormVersion ?? existingLesson.ScormVersion;
                            existingLesson.DocumentUrl = lessonDto.DocumentUrl;
                            existingLesson.IsOptional = lessonDto.IsOptional;
                        }
                    }
                    else
                    {
                        // Add new lesson
                        var newLesson = new Lesson
                        {
                            CourseId = courseId,
                            Title = lessonDto.Title,
                            Content = lessonDto.Content,
                            Ordinal = lessonDto.Ordinal,
                            Type = lessonDto.Type,
                            QuizId = lessonDto.QuizId,
                            VideoUrl = lessonDto.VideoUrl,
                            DurationSeconds = lessonDto.DurationSeconds,
                            ScormUrl = lessonDto.ScormUrl,
                            ScormEntryUrl = lessonDto.ScormEntryUrl,
                            ScormVersion = lessonDto.ScormVersion,
                            DocumentUrl = lessonDto.DocumentUrl,
                            IsOptional = lessonDto.IsOptional,
                            CreatedByUserId = userId,
                            CreatedAt = DateTime.UtcNow
                        };
                        _context.Lessons.Add(newLesson);
                    }
                }
            }

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
                PreCourseSurveyId = updatedCourse.PreCourseSurveyId,
                PostCourseSurveyId = updatedCourse.PostCourseSurveyId,
                IsPreSurveyMandatory = updatedCourse.IsPreSurveyMandatory,
                IsPostSurveyMandatory = updatedCourse.IsPostSurveyMandatory,
                Lessons = updatedCourse.Lessons.OrderBy(l => l.Ordinal).Select(l => new AdminLessonDto
                {
                    Id = l.Id,
                    Order = l.Ordinal,
                    Type = l.Type,
                    Title = l.Title,
                    Description = l.Content,
                    IsOptional = l.IsOptional,
                    Src = l.VideoUrl ?? l.DocumentUrl ?? l.ScormUrl,
                    EntryUrl = l.ScormEntryUrl,
                    ScormVersion = l.ScormVersion,
                    QuizId = l.QuizId
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
    /// Publish or unpublish a course (change status)
    /// </summary>
    [HttpPut("{courseId}/status")]
    public async Task<ActionResult> UpdateCourseStatus(string courseId, [FromBody] UpdateCourseStatusRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            var course = await _context.Courses
                .Include(c => c.Lessons)
                .FirstOrDefaultAsync(c => c.Id == courseId && !c.IsDeleted);

            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // Check organization access for OrgAdmin
            if (userRole == "OrgAdmin" && course.OrganisationId != user.OrganisationID)
            {
                return Forbid("You can only update courses from your organization");
            }

            // Validate status value
            var validStatuses = new[] { "Draft", "Published", "Archived" };
            if (!validStatuses.Contains(request.Status))
            {
                return BadRequest(new { message = $"Invalid status. Valid values are: {string.Join(", ", validStatuses)}" });
            }

            // Validate course is ready for publishing
            if (request.Status == "Published")
            {
                var validationErrors = new List<string>();

                if (string.IsNullOrWhiteSpace(course.Title))
                {
                    validationErrors.Add("Course title is required");
                }

                if (string.IsNullOrWhiteSpace(course.Description) && string.IsNullOrWhiteSpace(course.ShortDescription))
                {
                    validationErrors.Add("Course description is required");
                }

                if (course.Lessons == null || !course.Lessons.Any())
                {
                    validationErrors.Add("Course must have at least one lesson before publishing");
                }

                if (validationErrors.Any())
                {
                    return BadRequest(new 
                    { 
                        message = "Course cannot be published. Please fix the following issues:", 
                        errors = validationErrors 
                    });
                }
            }

            // Update status
            var oldStatus = course.Status;
            course.Status = request.Status;
            course.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Course {CourseId} status changed from {OldStatus} to {NewStatus} by user {UserId}", 
                courseId, oldStatus, request.Status, userId);

            return Ok(new 
            { 
                message = $"Course status updated to {request.Status}",
                status = request.Status,
                courseId = courseId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating course status for {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while updating the course status" });
        }
    }

    /// <summary>
    /// Duplicate a course with all lessons and quizzes
    /// </summary>
    [HttpPost("{courseId}/duplicate")]
    public async Task<ActionResult<AdminCourseDetailDto>> DuplicateCourse(string courseId)
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

            // Get original course with all related data
            var originalCourse = await _context.Courses
                .Include(c => c.Lessons.OrderBy(l => l.Ordinal))
                .ThenInclude(l => l.Quiz)
                .ThenInclude(q => q!.Questions)
                .ThenInclude(q => q.Options)
                .FirstOrDefaultAsync(c => c.Id == courseId);

            if (originalCourse == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // Check organization access for OrgAdmin
            if (userRole == "OrgAdmin" && originalCourse.OrganisationId != user.OrganisationID)
            {
                return Forbid("You can only duplicate courses from your organization");
            }

            // Create new course (copy)
            var newCourse = new Course
            {
                Id = ShortGuid.Generate(),
                Title = $"{originalCourse.Title} (Copy)",
                Description = originalCourse.Description,
                ShortDescription = originalCourse.ShortDescription,
                Category = originalCourse.Category,
                Tags = originalCourse.Tags,
                Status = "Draft", // Always create as draft
                CertificateEnabled = originalCourse.CertificateEnabled,
                BannerUrl = originalCourse.BannerUrl,
                OrganisationId = originalCourse.OrganisationId,
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Courses.Add(newCourse);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Created duplicate course {NewCourseId} from {OriginalCourseId}", newCourse.Id, courseId);

            // Copy lessons and their associated quizzes
            var quizIdMapping = new Dictionary<string, string>(); // Old quiz ID -> New quiz ID

            foreach (var originalLesson in originalCourse.Lessons)
            {
                string? newQuizId = null;

                // If lesson has a quiz, duplicate it first
                if (!string.IsNullOrEmpty(originalLesson.QuizId))
                {
                    var originalQuiz = originalLesson.Quiz;
                    if (originalQuiz != null)
                    {
                        newQuizId = ShortGuid.Generate();
                        quizIdMapping[originalLesson.QuizId] = newQuizId;

                        var newQuiz = new Quiz
                        {
                            Id = newQuizId,
                            Title = originalQuiz.Title,
                            Description = originalQuiz.Description,
                            PassingScore = originalQuiz.PassingScore,
                            TimeLimit = originalQuiz.TimeLimit,
                            IsTimed = originalQuiz.IsTimed,
                            MaxAttempts = originalQuiz.MaxAttempts,
                            ShuffleQuestions = originalQuiz.ShuffleQuestions,
                            ShuffleAnswers = originalQuiz.ShuffleAnswers,
                            ShowResults = originalQuiz.ShowResults,
                            AllowRetake = originalQuiz.AllowRetake,
                            CourseId = newCourse.Id,
                            CreatedByUserId = userId,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };

                        _context.Quizzes.Add(newQuiz);
                        await _context.SaveChangesAsync();

                        _logger.LogInformation("Created duplicate quiz {NewQuizId} from {OriginalQuizId}", newQuizId, originalLesson.QuizId);

                        // Copy quiz questions and options
                        foreach (var originalQuestion in originalQuiz.Questions.OrderBy(q => q.Order))
                        {
                            var newQuestion = new QuizQuestion
                            {
                                QuizId = newQuizId,
                                Question = originalQuestion.Question,
                                Type = originalQuestion.Type,
                                Points = originalQuestion.Points,
                                Order = originalQuestion.Order,
                                Explanation = originalQuestion.Explanation
                            };

                            _context.QuizQuestions.Add(newQuestion);
                            await _context.SaveChangesAsync();

                            // Copy answer options
                            foreach (var originalOption in originalQuestion.Options.OrderBy(o => o.Order))
                            {
                                var newOption = new QuizQuestionOption
                                {
                                    QuizQuestionId = newQuestion.Id,
                                    Text = originalOption.Text,
                                    IsCorrect = originalOption.IsCorrect,
                                    Order = originalOption.Order
                                };

                                _context.QuizQuestionOptions.Add(newOption);
                            }
                        }

                        await _context.SaveChangesAsync();
                    }
                }

                // Copy lesson content files to new locations if they exist
                string? newVideoUrl = null;
                string? newDocumentUrl = null;
                string? newScormUrl = null;
                string? newScormEntryUrl = null;
                string? newScormVersion = null;

                // Get organization storage key
                var organisation = await _context.Organisations
                    .FirstOrDefaultAsync(o => o.Id == originalCourse.OrganisationId);
                
                if (organisation != null && _blobService.IsConfigured())
                {
                    var storageKey = organisation.StorageKey;

                    // Copy video file
                    if (!string.IsNullOrEmpty(originalLesson.VideoUrl))
                    {
                        var videoFileName = Path.GetFileName(new Uri(originalLesson.VideoUrl).AbsolutePath);
                        var uniqueVideoFileName = $"{Guid.NewGuid()}{Path.GetExtension(videoFileName)}";
                        var newVideoPath = $"organisations/{storageKey}/library/{uniqueVideoFileName}";
                        newVideoUrl = await _blobService.CopyBlobAsync(originalLesson.VideoUrl, newVideoPath);
                        
                        if (newVideoUrl != null)
                        {
                            _logger.LogInformation("Copied video from {OldUrl} to {NewUrl}", 
                                originalLesson.VideoUrl, newVideoUrl);
                        }
                    }

                    // Copy document file (PDF, HTML, etc.)
                    if (!string.IsNullOrEmpty(originalLesson.DocumentUrl))
                    {
                        var docFileName = Path.GetFileName(new Uri(originalLesson.DocumentUrl).AbsolutePath);
                        var uniqueDocFileName = $"{Guid.NewGuid()}{Path.GetExtension(docFileName)}";
                        var newDocPath = $"organisations/{storageKey}/library/{uniqueDocFileName}";
                        newDocumentUrl = await _blobService.CopyBlobAsync(originalLesson.DocumentUrl, newDocPath);
                        
                        if (newDocumentUrl != null)
                        {
                            _logger.LogInformation("Copied document from {OldUrl} to {NewUrl}", 
                                originalLesson.DocumentUrl, newDocumentUrl);
                        }
                    }

                    // Copy SCORM package
                    if (!string.IsNullOrEmpty(originalLesson.ScormUrl))
                    {
                        // SCORM packages are stored in folders, we need to copy the entire folder
                        // For now, we'll just reference the same SCORM package
                        // TODO: Implement full SCORM package folder copy if needed
                        newScormUrl = originalLesson.ScormUrl;
                        newScormEntryUrl = originalLesson.ScormEntryUrl;
                        newScormVersion = originalLesson.ScormVersion;
                        
                        _logger.LogInformation("SCORM package will be shared: {ScormUrl}", 
                            originalLesson.ScormUrl);
                    }
                }
                else
                {
                    // If blob service is not configured, just copy the URLs as-is
                    newVideoUrl = originalLesson.VideoUrl;
                    newDocumentUrl = originalLesson.DocumentUrl;
                    newScormUrl = originalLesson.ScormUrl;
                    newScormEntryUrl = originalLesson.ScormEntryUrl;
                    newScormVersion = originalLesson.ScormVersion;
                    
                    _logger.LogWarning("Blob storage not configured, lesson content URLs will be shared between courses");
                }

                // Create new lesson with copied content URLs
                var newLesson = new Lesson
                {
                    Title = originalLesson.Title,
                    Content = originalLesson.Content,
                    Type = originalLesson.Type,
                    Ordinal = originalLesson.Ordinal,
                    VideoUrl = newVideoUrl ?? originalLesson.VideoUrl,
                    DurationSeconds = originalLesson.DurationSeconds,
                    DocumentUrl = newDocumentUrl ?? originalLesson.DocumentUrl,
                    ScormUrl = newScormUrl ?? originalLesson.ScormUrl,
                    ScormEntryUrl = newScormEntryUrl ?? originalLesson.ScormEntryUrl,
                    ScormVersion = newScormVersion ?? originalLesson.ScormVersion,
                    QuizId = newQuizId,
                    IsOptional = originalLesson.IsOptional,
                    CourseId = newCourse.Id,
                    CreatedByUserId = userId,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Lessons.Add(newLesson);
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Successfully duplicated course {CourseId} to {NewCourseId} with {LessonCount} lessons",
                courseId, newCourse.Id, originalCourse.Lessons.Count);

            // Return the new course details
            var newCourseWithLessons = await _context.Courses
                .Include(c => c.Lessons.OrderBy(l => l.Ordinal))
                .FirstOrDefaultAsync(c => c.Id == newCourse.Id);

            var result = new AdminCourseDetailDto
            {
                Id = newCourse.Id,
                Title = newCourse.Title,
                Description = newCourse.Description,
                ShortDescription = newCourse.ShortDescription,
                Category = newCourse.Category,
                Tags = string.IsNullOrEmpty(newCourse.Tags)
                    ? Array.Empty<string>()
                    : (JsonSerializer.Deserialize<List<string>>(newCourse.Tags)?.ToArray() ?? Array.Empty<string>()),
                Status = newCourse.Status,
                CertificateEnabled = newCourse.CertificateEnabled,
                BannerUrl = newCourse.BannerUrl,
                CreatedAt = newCourse.CreatedAt,
                UpdatedAt = newCourse.UpdatedAt,
                OrganisationId = newCourse.OrganisationId,
                Lessons = newCourseWithLessons?.Lessons.Select(l => new AdminLessonDto
                {
                    Id = l.Id,
                    Order = l.Ordinal,
                    Type = l.Type ?? "content",
                    Title = l.Title ?? "",
                    Description = l.Content, // Use Content field as Description
                    IsOptional = l.IsOptional,
                    Src = l.Type switch
                    {
                        "video" => l.VideoUrl,
                        "document" => l.DocumentUrl,
                        "scorm" => l.ScormUrl,
                        _ => null
                    },
                    EntryUrl = l.ScormEntryUrl,
                    ScormVersion = l.ScormVersion,
                    QuizId = l.QuizId
                }).ToList() ?? new List<AdminLessonDto>()
            };

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error duplicating course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while duplicating the course", details = ex.Message });
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
                    .ThenInclude(l => l.Quiz!)
                        .ThenInclude(q => q.Questions)
                            .ThenInclude(qq => qq.Options)
                .Include(c => c.Quizzes)
                    .ThenInclude(q => q.Questions)
                        .ThenInclude(qq => qq.Options)
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

            // Mark course as deleted (soft delete)
            course.IsDeleted = true;
            course.DeletedAt = DateTime.UtcNow;
            course.DeletedByUserId = userId;

            // Delete all related learner progress records
            var progressRecords = await _context.LearnerProgresses
                .Where(lp => lp.CourseId == courseId)
                .ToListAsync();
            _context.LearnerProgresses.RemoveRange(progressRecords);

            // Delete all feedback related to this course
            var feedbackRecords = await _context.Feedbacks
                .Where(f => f.CourseId == courseId)
                .ToListAsync();
            _context.Feedbacks.RemoveRange(feedbackRecords);

            // Delete all pathway course mappings
            var pathwayCourses = await _context.PathwayCourses
                .Where(pc => pc.CourseId == courseId)
                .ToListAsync();
            _context.PathwayCourses.RemoveRange(pathwayCourses);

            // Delete all group course mappings
            if (course.GroupCourses.Any())
            {
                _context.GroupCourses.RemoveRange(course.GroupCourses);
            }

            // Delete all course assignments
            if (course.CourseAssignments.Any())
            {
                _context.CourseAssignments.RemoveRange(course.CourseAssignments);
            }

            // Delete all quiz questions and options for lessons
            foreach (var lesson in course.Lessons.Where(l => l.Quiz != null))
            {
                if (lesson.Quiz?.Questions != null)
                {
                    foreach (var question in lesson.Quiz.Questions)
                    {
                        if (question.Options != null)
                        {
                            _context.QuizQuestionOptions.RemoveRange(question.Options);
                        }
                    }
                    _context.QuizQuestions.RemoveRange(lesson.Quiz.Questions);
                }
                if (lesson.Quiz != null)
                {
                    _context.Quizzes.Remove(lesson.Quiz);
                }
            }

            // Delete all standalone quizzes (not linked to lessons)
            foreach (var quiz in course.Quizzes.Where(q => !course.Lessons.Any(l => l.QuizId == q.Id)))
            {
                if (quiz.Questions != null)
                {
                    foreach (var question in quiz.Questions)
                    {
                        if (question.Options != null)
                        {
                            _context.QuizQuestionOptions.RemoveRange(question.Options);
                        }
                    }
                    _context.QuizQuestions.RemoveRange(quiz.Questions);
                }
                _context.Quizzes.Remove(quiz);
            }

            // Delete all lessons
            _context.Lessons.RemoveRange(course.Lessons);

            // Create audit log
            var auditLog = new AuditLog
            {
                Action = $"Course Deleted: {course.Title} (ID: {courseId})",
                PerformedBy = $"{user.FirstName} {user.LastName} ({user.Email})",
                PerformedAt = DateTime.UtcNow,
                Details = $"Course ID: {courseId}, Course Title: {course.Title}, Organization: {course.OrganisationId}, Deleted Lessons: {course.Lessons.Count}, Deleted Quizzes: {course.Quizzes.Count}, Deleted Progress Records: {progressRecords.Count}, Deleted Feedback: {feedbackRecords.Count}"
            };
            _context.AuditLogs.Add(auditLog);

            await _context.SaveChangesAsync();

            _logger.LogInformation("Course {CourseId} soft deleted by user {UserId} ({UserEmail})", courseId, userId, user.Email);

            return Ok(new { 
                message = "Course and all associated records deleted successfully",
                deletedAt = course.DeletedAt,
                deletedBy = $"{user.FirstName} {user.LastName}"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while deleting the course" });
        }
    }

    /// <summary>
    /// Upload course banner image
    /// </summary>
    [HttpPost("upload-banner")]
    [RequestSizeLimit(10_485_760)] // 10 MB limit
    public async Task<IActionResult> UploadCourseBanner([FromForm] IFormFile image)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
            {
                return NotFound(new { message = "User not found" });
            }

            if (!user.OrganisationID.HasValue)
            {
                return BadRequest(new { message = "User must belong to an organisation" });
            }

            if (image == null || image.Length == 0)
            {
                return BadRequest(new { message = "No image file provided" });
            }

            // Validate image file type
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
            var extension = Path.GetExtension(image.FileName).ToLower();
            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new { message = $"Invalid image format. Allowed: {string.Join(", ", allowedExtensions)}" });
            }

            // Validate file size (max 10 MB)
            if (image.Length > 10_485_760)
            {
                return BadRequest(new { message = "Image file size must be less than 10 MB" });
            }

            if (!_blobService.IsConfigured())
            {
                return StatusCode(500, new { message = "File storage is not configured" });
            }

            // Get organisation details to get StorageKey
            var organisation = await _context.Organisations
                .FirstOrDefaultAsync(o => o.Id == user.OrganisationID.Value);

            if (organisation == null)
            {
                return NotFound(new { message = "Organisation not found" });
            }

            // Upload to Azure Blob Storage with path: {StorageKey}/course-banner/filename.ext
            var bannerId = Guid.NewGuid();
            var fileName = $"course_banner_{bannerId}{extension}";
            var folderPath = $"{organisation.StorageKey}/course-banner";

            string imageUrl;
            using (var stream = image.OpenReadStream())
            {
                try
                {
                    imageUrl = await _blobService.UploadToBrandingContainerAsync(
                        stream, 
                        fileName, 
                        folderPath, 
                        image.ContentType,
                        organisation.Id
                    );
                }
                catch (InvalidOperationException ex) when (ex.Message.Contains("Storage quota exceeded"))
                {
                    _logger.LogWarning("Storage quota exceeded for organisation {OrgId}", organisation.Id);
                    return BadRequest(new { message = ex.Message });
                }
            }

            _logger.LogInformation("Course banner uploaded for organisation {OrgId} by user {UserId}", organisation.Id, userId);

            return Ok(new { url = imageUrl, message = "Course banner uploaded successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading course banner image");
            return StatusCode(500, new { message = "An error occurred while uploading the course banner" });
        }
    }

    /// <summary>
    /// Get storage usage for the organisation
    /// </summary>
    [HttpGet("storage-usage")]
    public async Task<ActionResult<StorageUsageInfo>> GetStorageUsage()
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.FindAsync(userId);

            if (user == null || user.OrganisationID == null)
            {
                return BadRequest(new { message = "User organisation not found" });
            }

            var storageInfo = await _storageQuotaService.GetStorageUsageAsync(user.OrganisationID.Value);

            return Ok(storageInfo);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching storage usage");
            return StatusCode(500, new { message = "An error occurred while fetching storage usage" });
        }
    }

    /// <summary>
    /// Get list of all files in organisation storage
    /// </summary>
    [HttpGet("storage-files")]
    public async Task<ActionResult<List<BlobFileInfo>>> GetStorageFiles()
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.FindAsync(userId);

            if (user == null || user.OrganisationID == null)
            {
                return BadRequest(new { message = "User organisation not found" });
            }

            var files = await _blobService.GetOrganisationStorageFilesAsync(user.OrganisationID.Value);

            return Ok(files);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching storage files");
            return StatusCode(500, new { message = "An error occurred while fetching storage files" });
        }
    }
}

// DTOs for API responses
public class AdminCourseListResponse
{
    public List<AdminCourseDto> Courses { get; set; } = new();
    public int Total { get; set; }
    public object? Pagination { get; set; }
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
    public long? PreCourseSurveyId { get; set; }
    public long? PostCourseSurveyId { get; set; }
    public bool IsPreSurveyMandatory { get; set; }
    public bool IsPostSurveyMandatory { get; set; }
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
    public string? ScormVersion { get; set; }
    public string? QuizId { get; set; }
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
    public long? PreCourseSurveyId { get; set; }
    public long? PostCourseSurveyId { get; set; }
    public bool IsPreSurveyMandatory { get; set; } = false;
    public bool IsPostSurveyMandatory { get; set; } = false;
}

public class UpdateCourseRequest : CreateCourseRequest
{
    public string? Status { get; set; }
    public List<UpdateLessonDto>? Lessons { get; set; }
}

public class UpdateCourseStatusRequest
{
    public string Status { get; set; } = null!;
}

public class UpdateLessonDto
{
    public long? Id { get; set; } // null for new lessons
    public string Title { get; set; } = null!;
    public string? Content { get; set; }
    public int Ordinal { get; set; }
    public string Type { get; set; } = "content"; // content, video, quiz, scorm, document
    public string? QuizId { get; set; }
    public string? VideoUrl { get; set; }
    public int? DurationSeconds { get; set; }
    public string? ScormUrl { get; set; }
    public string? ScormEntryUrl { get; set; }
    public string? ScormVersion { get; set; }
    public string? DocumentUrl { get; set; }
    public bool IsOptional { get; set; }
}
