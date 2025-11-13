using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/admin/courses/{courseId}/lessons")]
[Authorize(Roles = "Admin,OrgAdmin,SuperAdmin")]
public class AdminLessonsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAzureBlobService _blobService;
    private readonly ILogger<AdminLessonsController> _logger;

    public AdminLessonsController(
        ApplicationDbContext context,
        IAzureBlobService blobService,
        ILogger<AdminLessonsController> logger)
    {
        _context = context;
        _blobService = blobService;
        _logger = logger;
    }

    /// <summary>
    /// Get all lessons for a course
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<LessonDetailDto>>> GetLessons(string courseId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var course = await _context.Courses
                .Include(c => c.Lessons.OrderBy(l => l.Ordinal))
                .ThenInclude(l => l.Quiz)
                .FirstOrDefaultAsync(c => c.Id == courseId);

            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // Check access rights
            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != course.OrganisationId)
                {
                    return Forbid("You can only access courses from your organization");
                }
            }

            var lessons = course.Lessons.Select(l => new LessonDetailDto
            {
                Id = l.Id,
                CourseId = l.CourseId,
                Title = l.Title,
                Content = l.Content,
                Ordinal = l.Ordinal,
                Type = l.Type,
                QuizId = l.QuizId,
                QuizTitle = l.Quiz?.Title,
                VideoUrl = l.VideoUrl,
                VideoDurationSeconds = l.VideoDurationSeconds,
                ScormUrl = l.ScormUrl,
                ScormEntryUrl = l.ScormEntryUrl,
                DocumentUrl = l.DocumentUrl,
                IsOptional = l.IsOptional,
                CreatedAt = l.CreatedAt
            }).ToList();

            return Ok(lessons);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting lessons for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while retrieving lessons" });
        }
    }

    /// <summary>
    /// Get a single lesson by ID
    /// </summary>
    [HttpGet("{lessonId}")]
    public async Task<ActionResult<LessonDetailDto>> GetLesson(string courseId, long lessonId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            var lesson = await _context.Lessons
                .Include(l => l.Course)
                .Include(l => l.Quiz)
                .FirstOrDefaultAsync(l => l.Id == lessonId && l.CourseId == courseId);

            if (lesson == null)
            {
                return NotFound(new { message = "Lesson not found" });
            }

            // Check access rights
            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != lesson.Course?.OrganisationId)
                {
                    return Forbid("You can only access lessons from your organization");
                }
            }

            var lessonDto = new LessonDetailDto
            {
                Id = lesson.Id,
                CourseId = lesson.CourseId,
                Title = lesson.Title,
                Content = lesson.Content,
                Ordinal = lesson.Ordinal,
                Type = lesson.Type,
                QuizId = lesson.QuizId,
                QuizTitle = lesson.Quiz?.Title,
                VideoUrl = lesson.VideoUrl,
                VideoDurationSeconds = lesson.VideoDurationSeconds,
                ScormUrl = lesson.ScormUrl,
                ScormEntryUrl = lesson.ScormEntryUrl,
                DocumentUrl = lesson.DocumentUrl,
                IsOptional = lesson.IsOptional,
                CreatedAt = lesson.CreatedAt
            };

            return Ok(lessonDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting lesson {LessonId}", lessonId);
            return StatusCode(500, new { message = "An error occurred while retrieving the lesson" });
        }
    }

    /// <summary>
    /// Create a new lesson
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<LessonDetailDto>> CreateLesson(string courseId, [FromBody] CreateLessonRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var course = await _context.Courses.FindAsync(courseId);
            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // Check if course is published
            if (course.Status == "Published")
            {
                return BadRequest(new { message = "Cannot add lessons to published courses. Please unpublish the course first." });
            }

            // Check access rights
            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != course.OrganisationId)
                {
                    return Forbid("You can only create lessons in courses from your organization");
                }
            }

            // Validate lesson type
            var validTypes = new[] { "content", "video", "quiz", "scorm", "document" };
            if (!validTypes.Contains(request.Type))
            {
                return BadRequest(new { message = $"Invalid lesson type. Must be one of: {string.Join(", ", validTypes)}" });
            }

            var lesson = new Lesson
            {
                CourseId = courseId,
                Title = request.Title,
                Content = request.Content,
                Ordinal = request.Ordinal,
                Type = request.Type,
                QuizId = request.QuizId,
                VideoUrl = request.VideoUrl,
                VideoDurationSeconds = request.VideoDurationSeconds,
                ScormUrl = request.ScormUrl,
                ScormEntryUrl = request.ScormEntryUrl,
                DocumentUrl = request.DocumentUrl,
                IsOptional = request.IsOptional,
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Lessons.Add(lesson);
            
            // Update course updated timestamp
            course.UpdatedAt = DateTime.UtcNow;
            
            await _context.SaveChangesAsync();

            _logger.LogInformation("Lesson {LessonId} created for course {CourseId} by user {UserId}", 
                lesson.Id, courseId, userId);

            // Fetch the created lesson with related data
            var createdLesson = await _context.Lessons
                .Include(l => l.Quiz)
                .FirstAsync(l => l.Id == lesson.Id);

            var lessonDto = new LessonDetailDto
            {
                Id = createdLesson.Id,
                CourseId = createdLesson.CourseId,
                Title = createdLesson.Title,
                Content = createdLesson.Content,
                Ordinal = createdLesson.Ordinal,
                Type = createdLesson.Type,
                QuizId = createdLesson.QuizId,
                QuizTitle = createdLesson.Quiz?.Title,
                VideoUrl = createdLesson.VideoUrl,
                VideoDurationSeconds = createdLesson.VideoDurationSeconds,
                ScormUrl = createdLesson.ScormUrl,
                ScormEntryUrl = createdLesson.ScormEntryUrl,
                DocumentUrl = createdLesson.DocumentUrl,
                IsOptional = createdLesson.IsOptional,
                CreatedAt = createdLesson.CreatedAt
            };

            return CreatedAtAction(nameof(GetLesson), new { courseId, lessonId = lesson.Id }, lessonDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating lesson for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while creating the lesson" });
        }
    }

    /// <summary>
    /// Update an existing lesson
    /// </summary>
    [HttpPut("{lessonId}")]
    public async Task<ActionResult<LessonDetailDto>> UpdateLesson(
        string courseId, 
        long lessonId, 
        [FromBody] UpdateLessonRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            var lesson = await _context.Lessons
                .Include(l => l.Course)
                .Include(l => l.Quiz)
                .FirstOrDefaultAsync(l => l.Id == lessonId && l.CourseId == courseId);

            if (lesson == null)
            {
                return NotFound(new { message = "Lesson not found" });
            }

            // Check if course is published
            if (lesson.Course?.Status == "Published")
            {
                return BadRequest(new { message = "Cannot edit lessons in published courses. Please unpublish the course first." });
            }

            // Check access rights
            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != lesson.Course?.OrganisationId)
                {
                    return Forbid("You can only update lessons from your organization");
                }
            }

            // Validate lesson type
            var validTypes = new[] { "content", "video", "quiz", "scorm", "document" };
            if (!validTypes.Contains(request.Type))
            {
                return BadRequest(new { message = $"Invalid lesson type. Must be one of: {string.Join(", ", validTypes)}" });
            }

            // Update lesson properties
            lesson.Title = request.Title;
            lesson.Content = request.Content;
            lesson.Ordinal = request.Ordinal;
            lesson.Type = request.Type;
            lesson.QuizId = request.QuizId;
            lesson.VideoUrl = request.VideoUrl;
            lesson.VideoDurationSeconds = request.VideoDurationSeconds;
            lesson.ScormUrl = request.ScormUrl;
            lesson.ScormEntryUrl = request.ScormEntryUrl;
            lesson.DocumentUrl = request.DocumentUrl;
            lesson.IsOptional = request.IsOptional;

            // Update course timestamp
            if (lesson.Course != null)
            {
                lesson.Course.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Lesson {LessonId} updated by user {UserId}", lessonId, userId);

            var lessonDto = new LessonDetailDto
            {
                Id = lesson.Id,
                CourseId = lesson.CourseId,
                Title = lesson.Title,
                Content = lesson.Content,
                Ordinal = lesson.Ordinal,
                Type = lesson.Type,
                QuizId = lesson.QuizId,
                QuizTitle = lesson.Quiz?.Title,
                VideoUrl = lesson.VideoUrl,
                VideoDurationSeconds = lesson.VideoDurationSeconds,
                ScormUrl = lesson.ScormUrl,
                ScormEntryUrl = lesson.ScormEntryUrl,
                DocumentUrl = lesson.DocumentUrl,
                IsOptional = lesson.IsOptional,
                CreatedAt = lesson.CreatedAt
            };

            return Ok(lessonDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating lesson {LessonId}", lessonId);
            return StatusCode(500, new { message = "An error occurred while updating the lesson" });
        }
    }

    /// <summary>
    /// Delete a lesson
    /// </summary>
    [HttpDelete("{lessonId}")]
    public async Task<ActionResult> DeleteLesson(string courseId, long lessonId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            var lesson = await _context.Lessons
                .Include(l => l.Course)
                .FirstOrDefaultAsync(l => l.Id == lessonId && l.CourseId == courseId);

            if (lesson == null)
            {
                return NotFound(new { message = "Lesson not found" });
            }

            // Check if course is published
            if (lesson.Course?.Status == "Published")
            {
                return BadRequest(new { message = "Cannot delete lessons from published courses. Please unpublish the course first." });
            }

            // Check access rights
            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != lesson.Course?.OrganisationId)
                {
                    return Forbid("You can only delete lessons from your organization");
                }
            }

            _context.Lessons.Remove(lesson);

            // Update course timestamp
            if (lesson.Course != null)
            {
                lesson.Course.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Lesson {LessonId} deleted by user {UserId}", lessonId, userId);

            return Ok(new { message = "Lesson deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting lesson {LessonId}", lessonId);
            return StatusCode(500, new { message = "An error occurred while deleting the lesson" });
        }
    }

    /// <summary>
    /// Upload a video file to blob storage
    /// </summary>
    [HttpPost("upload-video")]
    [RequestSizeLimit(524_288_000)] // 500 MB limit
    public async Task<ActionResult<VideoUploadResponse>> UploadVideo(string courseId, IFormFile video)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var course = await _context.Courses.FindAsync(courseId);
            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // Check access rights
            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != course.OrganisationId)
                {
                    return Forbid("You can only upload videos for courses from your organization");
                }
            }

            if (video == null || video.Length == 0)
            {
                return BadRequest(new { message = "No video file provided" });
            }

            // Validate video file type
            var allowedExtensions = new[] { ".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".webm" };
            var extension = Path.GetExtension(video.FileName).ToLower();
            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new { message = $"Invalid video format. Allowed: {string.Join(", ", allowedExtensions)}" });
            }

            if (!_blobService.IsConfigured())
            {
                return StatusCode(501, new { message = "Azure Blob Storage is not configured. Please configure it to upload files." });
            }

            // Generate unique filename
            var uniqueFileName = $"{Guid.NewGuid()}{extension}";

            // Upload to blob storage
            using var stream = video.OpenReadStream();
            var blobUrl = await _blobService.UploadFileAsync(
                stream, 
                uniqueFileName, 
                course.OrganisationId.ToString(), 
                video.ContentType);

            _logger.LogInformation("Video uploaded to blob storage: {BlobUrl}", blobUrl);

            return Ok(new VideoUploadResponse
            {
                VideoUrl = blobUrl,
                FileName = uniqueFileName,
                OriginalFileName = video.FileName,
                Size = video.Length,
                ContentType = video.ContentType
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading video for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while uploading the video" });
        }
    }

    /// <summary>
    /// List videos from organization's library in blob storage
    /// </summary>
    [HttpGet("library/videos")]
    public async Task<ActionResult<List<BlobFileInfo>>> ListLibraryVideos(string courseId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            var course = await _context.Courses.FindAsync(courseId);
            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // Check access rights
            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != course.OrganisationId)
                {
                    return Forbid("You can only access your organization's library");
                }
            }

            if (!_blobService.IsConfigured())
            {
                return Ok(new List<BlobFileInfo>()); // Return empty list if not configured
            }

            var videos = await _blobService.ListOrganisationFilesAsync(
                course.OrganisationId.ToString(), 
                "video");

            return Ok(videos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing library videos for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while retrieving library videos" });
        }
    }

    /// <summary>
    /// List videos from shared LMS library (accessible to all organizations)
    /// </summary>
    [HttpGet("shared-library/videos")]
    public async Task<ActionResult<List<BlobFileInfo>>> ListSharedLibraryVideos(string courseId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var course = await _context.Courses.FindAsync(courseId);
            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            if (!_blobService.IsConfigured())
            {
                return Ok(new List<BlobFileInfo>()); // Return empty list if not configured
            }

            var videos = await _blobService.ListSharedLibraryFilesAsync("video");

            return Ok(videos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing shared library videos for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while retrieving shared library videos" });
        }
    }

    /// <summary>
    /// Upload a PDF file to blob storage
    /// </summary>
    [HttpPost("upload-pdf")]
    [RequestSizeLimit(104_857_600)] // 100 MB limit
    public async Task<ActionResult<DocumentUploadResponse>> UploadPdf(string courseId, IFormFile pdf)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var course = await _context.Courses.FindAsync(courseId);
            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // Check access rights
            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != course.OrganisationId)
                {
                    return Forbid("You can only upload PDFs for courses from your organization");
                }
            }

            if (pdf == null || pdf.Length == 0)
            {
                return BadRequest(new { message = "No PDF file provided" });
            }

            // Validate PDF file type
            var allowedExtensions = new[] { ".pdf" };
            var extension = Path.GetExtension(pdf.FileName).ToLower();
            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new { message = "Invalid file format. Only PDF files are allowed." });
            }

            // Additional MIME type validation
            if (pdf.ContentType != "application/pdf")
            {
                return BadRequest(new { message = "Invalid file type. Only PDF documents are allowed." });
            }

            if (!_blobService.IsConfigured())
            {
                return StatusCode(501, new { message = "Azure Blob Storage is not configured. Please configure it to upload files." });
            }

            // Generate unique filename
            var uniqueFileName = $"{Guid.NewGuid()}{extension}";

            // Upload to blob storage
            using var stream = pdf.OpenReadStream();
            var blobUrl = await _blobService.UploadFileAsync(
                stream, 
                uniqueFileName, 
                course.OrganisationId.ToString(), 
                pdf.ContentType);

            _logger.LogInformation("PDF uploaded to blob storage: {BlobUrl}", blobUrl);

            return Ok(new DocumentUploadResponse
            {
                DocumentUrl = blobUrl,
                FileName = uniqueFileName,
                OriginalFileName = pdf.FileName,
                Size = pdf.Length,
                ContentType = pdf.ContentType
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading PDF for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while uploading the PDF" });
        }
    }

    /// <summary>
    /// List PDFs from shared LMS library (accessible to all organizations)
    /// </summary>
    [HttpGet("shared-library/pdfs")]
    public async Task<ActionResult<List<BlobFileInfo>>> ListSharedLibraryPdfs(string courseId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var course = await _context.Courses.FindAsync(courseId);
            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            if (!_blobService.IsConfigured())
            {
                return Ok(new List<BlobFileInfo>()); // Return empty list if not configured
            }

            var pdfs = await _blobService.ListSharedLibraryFilesAsync("document");

            return Ok(pdfs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing shared library PDFs for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while retrieving shared library PDFs" });
        }
    }

    /// <summary>
    /// Upload SCORM package
    /// </summary>
    [HttpPost("upload-scorm")]
    [RequestSizeLimit(500_000_000)] // 500MB limit
    public async Task<ActionResult<ScormUploadResponse>> UploadScorm(string courseId, IFormFile file)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file uploaded" });
            }

            // Validate file extension
            var extension = Path.GetExtension(file.FileName).ToLower();
            if (extension != ".zip")
            {
                return BadRequest(new { message = "Invalid file format. Only ZIP files are allowed for SCORM packages." });
            }

            // Validate file size (500MB)
            if (file.Length > 500_000_000)
            {
                return BadRequest(new { message = "File size exceeds 500MB limit" });
            }

            var course = await _context.Courses.FindAsync(courseId);
            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            if (!_blobService.IsConfigured())
            {
                return StatusCode(500, new { message = "Azure Blob Storage is not configured" });
            }

            // Get user's organisation
            var user = await _context.Users.FindAsync(userId);
            if (user == null || user.OrganisationID == 0)
            {
                return BadRequest(new { message = "User organisation not found" });
            }

            _logger.LogInformation("Uploading SCORM package {FileName} for course {CourseId}", file.FileName, courseId);

            using var stream = file.OpenReadStream();
            var scormInfo = await _blobService.UploadScormPackageAsync(stream, file.FileName, user.OrganisationID.ToString());

            var response = new ScormUploadResponse
            {
                LaunchUrl = scormInfo.LaunchUrl,
                BaseUrl = scormInfo.BaseUrl,
                PackageName = scormInfo.PackageName,
                ManifestPath = scormInfo.ManifestPath,
                FileCount = scormInfo.FileCount,
                TotalSize = scormInfo.TotalSize
            };

            _logger.LogInformation("SCORM package uploaded successfully: {PackageName}, Files: {FileCount}", 
                scormInfo.PackageName, scormInfo.FileCount);

            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Invalid SCORM package uploaded for course {CourseId}", courseId);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading SCORM package for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while uploading the SCORM package" });
        }
    }

    /// <summary>
    /// Reorder lessons
    /// </summary>
    [HttpPut("reorder")]
    public async Task<ActionResult> ReorderLessons(string courseId, [FromBody] ReorderLessonsRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            var course = await _context.Courses
                .Include(c => c.Lessons)
                .FirstOrDefaultAsync(c => c.Id == courseId);

            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // Check if course is published
            if (course.Status == "Published")
            {
                return BadRequest(new { message = "Cannot reorder lessons in published courses. Please unpublish the course first." });
            }

            // Check access rights
            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != course.OrganisationId)
                {
                    return Forbid("You can only reorder lessons in courses from your organization");
                }
            }

            foreach (var item in request.LessonOrders)
            {
                var lesson = course.Lessons.FirstOrDefault(l => l.Id == item.LessonId);
                if (lesson != null)
                {
                    lesson.Ordinal = item.Ordinal;
                }
            }

            course.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Lessons reordered for course {CourseId} by user {UserId}", courseId, userId);

            return Ok(new { message = "Lessons reordered successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reordering lessons for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while reordering lessons" });
        }
    }
}

// DTOs
public class LessonDetailDto
{
    public long Id { get; set; }
    public string CourseId { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string? Content { get; set; }
    public int Ordinal { get; set; }
    public string Type { get; set; } = null!;
    public string? QuizId { get; set; }
    public string? QuizTitle { get; set; }
    public string? VideoUrl { get; set; }
    public int? VideoDurationSeconds { get; set; }
    public string? ScormUrl { get; set; }
    public string? ScormEntryUrl { get; set; }
    public string? DocumentUrl { get; set; }
    public bool IsOptional { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateLessonRequest
{
    public string Title { get; set; } = null!;
    public string? Content { get; set; }
    public int Ordinal { get; set; }
    public string Type { get; set; } = "content";
    public string? QuizId { get; set; }
    public string? VideoUrl { get; set; }
    public int? VideoDurationSeconds { get; set; }
    public string? ScormUrl { get; set; }
    public string? ScormEntryUrl { get; set; }
    public string? DocumentUrl { get; set; }
    public bool IsOptional { get; set; }
}

public class UpdateLessonRequest : CreateLessonRequest
{
}

public class VideoUploadResponse
{
    public string VideoUrl { get; set; } = null!;
    public string FileName { get; set; } = null!;
    public string OriginalFileName { get; set; } = null!;
    public long Size { get; set; }
    public string ContentType { get; set; } = null!;
}

public class DocumentUploadResponse
{
    public string DocumentUrl { get; set; } = null!;
    public string FileName { get; set; } = null!;
    public string OriginalFileName { get; set; } = null!;
    public long Size { get; set; }
    public string ContentType { get; set; } = null!;
}

public class ScormUploadResponse
{
    public string LaunchUrl { get; set; } = null!;
    public string BaseUrl { get; set; } = null!;
    public string PackageName { get; set; } = null!;
    public string ManifestPath { get; set; } = null!;
    public int FileCount { get; set; }
    public long TotalSize { get; set; }
}

public class ReorderLessonsRequest
{
    public List<LessonOrderItem> LessonOrders { get; set; } = new();
}

public class LessonOrderItem
{
    public long LessonId { get; set; }
    public int Ordinal { get; set; }
}
