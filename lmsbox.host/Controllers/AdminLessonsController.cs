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
    private readonly IStorageQuotaService _storageQuotaService;
    private readonly ILogger<AdminLessonsController> _logger;
    private readonly IEngagementTrackingService _engagementService;

    public AdminLessonsController(
        ApplicationDbContext context,
        IAzureBlobService blobService,
        IStorageQuotaService storageQuotaService,
        ILogger<AdminLessonsController> logger,
        IEngagementTrackingService engagementService)
    {
        _context = context;
        _blobService = blobService;
        _storageQuotaService = storageQuotaService;
        _logger = logger;
        _engagementService = engagementService;
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
                .Include(c => c.Lessons)
                .ThenInclude(l => l.InteractiveLessonSettings!)
                .ThenInclude(s => s.Blocks)
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

            var lessons = course.Lessons.Select(l =>
            {
                var dto = new LessonDetailDto
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
                    CaptionUrl = l.CaptionUrl,
                    DurationSeconds = l.DurationSeconds,
                    ScormUrl = l.ScormUrl,
                    ScormEntryUrl = l.ScormEntryUrl,
                    ScormVersion = l.ScormVersion,
                    DocumentUrl = l.DocumentUrl,
                    IsOptional = l.IsOptional,
                    CreatedAt = l.CreatedAt,
                    GlobalLibraryContentId = l.GlobalLibraryContentId,
                    ExternalPendingMessage = l.ExternalPendingMessage
                };

                if (string.Equals(l.Type, "interactive", StringComparison.OrdinalIgnoreCase) &&
                    l.InteractiveLessonSettings != null)
                {
                    var blocks = l.InteractiveLessonSettings.Blocks;
                    dto.InteractiveStatus = InteractiveLessonHelper.ComputeStatus(blocks);
                    dto.InteractiveBlockCount = blocks.Count;
                    dto.InteractiveApprovedBlockCount = blocks.Count(b => b.Status == "Approved");
                }

                return dto;
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

            // Generate SAS tokens for blob URLs
            string? videoUrlWithSas = null;
            string? captionUrlWithSas = null;
            string? documentUrlWithSas = null;
            string? scormUrlWithSas = null;
            string? htmlUrlWithSas = null;

            if (!string.IsNullOrEmpty(lesson.VideoUrl))
            {
                videoUrlWithSas = await _blobService.GetSasUrlAsync(lesson.VideoUrl, 24);
            }

            if (!string.IsNullOrEmpty(lesson.CaptionUrl))
            {
                captionUrlWithSas = await _blobService.GetSasUrlAsync(lesson.CaptionUrl, 24);
            }

            if (!string.IsNullOrEmpty(lesson.DocumentUrl))
            {
                documentUrlWithSas = await _blobService.GetSasUrlAsync(lesson.DocumentUrl, 24);
            }

            if (!string.IsNullOrEmpty(lesson.ScormUrl))
            {
                scormUrlWithSas = await _blobService.GetSasUrlAsync(lesson.ScormUrl, 24);
            }

            if (!string.IsNullOrEmpty(lesson.HtmlUrl))
            {
                htmlUrlWithSas = await _blobService.GetSasUrlAsync(lesson.HtmlUrl, 24);
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
                VideoUrl = videoUrlWithSas ?? lesson.VideoUrl,
                CaptionUrl = captionUrlWithSas ?? lesson.CaptionUrl,
                DurationSeconds = lesson.DurationSeconds,
                ScormUrl = scormUrlWithSas ?? lesson.ScormUrl,
                ScormEntryUrl = lesson.ScormEntryUrl,
                ScormVersion = lesson.ScormVersion,
                DocumentUrl = documentUrlWithSas ?? lesson.DocumentUrl,
                HtmlContent = lesson.HtmlContent,
                HtmlUrl = htmlUrlWithSas ?? lesson.HtmlUrl,
                IsOptional = lesson.IsOptional,
                CreatedAt = lesson.CreatedAt,
                GlobalLibraryContentId = lesson.GlobalLibraryContentId,
                ExternalPendingMessage = lesson.ExternalPendingMessage
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
            var validationError = ValidateLessonRequest(request);
            if (validationError != null)
            {
                return validationError;
            }

            var practicalLimitError = await ValidatePracticalLimitAsync(courseId, request.Type);
            if (practicalLimitError != null)
            {
                return practicalLimitError;
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
                CaptionUrl = request.CaptionUrl,
                DurationSeconds = request.DurationSeconds,
                ScormUrl = request.ScormUrl,
                ScormEntryUrl = request.ScormEntryUrl,
                ScormVersion = request.ScormVersion,
                DocumentUrl = request.DocumentUrl,
                HtmlContent = request.HtmlContent,
                HtmlUrl = request.HtmlUrl,
                IsOptional = request.IsOptional,
                ExternalPendingMessage = request.ExternalPendingMessage?.Trim(),
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Lessons.Add(lesson);
            
            // Update course updated timestamp
            course.UpdatedAt = DateTime.UtcNow;
            
            await _context.SaveChangesAsync();

            _logger.LogInformation("Lesson {LessonId} created for course {CourseId} by user {UserId}", 
                lesson.Id, courseId, userId);

            // Track lesson creation engagement
            var creatorUser = await _context.Users.FindAsync(userId);
            if (creatorUser?.OrganisationID.HasValue == true)
            {
                _logger.LogInformation("📊 Tracking lesson creation: User={UserId}, Org={OrgId}, Lesson={LessonId}", userId, creatorUser.OrganisationID.Value, lesson.Id);
                await _engagementService.TrackAsync(
                    userId,
                    creatorUser.OrganisationID.Value,
                    EngagementTrackingService.EVENT_LESSON_CREATED,
                    courseId: courseId,
                    lessonId: lesson.Id,
                    metadata: new { title = lesson.Title, type = lesson.Type }
                );
            }

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
                CaptionUrl = createdLesson.CaptionUrl,
                DurationSeconds = createdLesson.DurationSeconds,
                ScormUrl = createdLesson.ScormUrl,
                ScormEntryUrl = createdLesson.ScormEntryUrl,
                ScormVersion = createdLesson.ScormVersion,
                DocumentUrl = createdLesson.DocumentUrl,
                HtmlContent = createdLesson.HtmlContent,
                HtmlUrl = createdLesson.HtmlUrl,
                IsOptional = createdLesson.IsOptional,
                CreatedAt = createdLesson.CreatedAt,
                GlobalLibraryContentId = createdLesson.GlobalLibraryContentId,
                ExternalPendingMessage = createdLesson.ExternalPendingMessage
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

                // Prevent editing lessons from global library
                if (IsGlobalLibraryLesson(lesson))
                {
                    return BadRequest(new { message = "Cannot edit lessons from global library. You can only remove them from draft courses." });
                }
            }

            // Validate lesson type
            var validationError = ValidateLessonRequest(request);
            if (validationError != null)
            {
                return validationError;
            }

            var practicalLimitError = await ValidatePracticalLimitAsync(courseId, request.Type, lessonId);
            if (practicalLimitError != null)
            {
                return practicalLimitError;
            }

            // Update lesson properties
            lesson.Title = request.Title;
            lesson.Content = request.Content;
            lesson.Ordinal = request.Ordinal;
            lesson.Type = request.Type;
            lesson.QuizId = request.QuizId;
            lesson.VideoUrl = request.VideoUrl;
            lesson.CaptionUrl = request.CaptionUrl;
            lesson.DurationSeconds = request.DurationSeconds;
            lesson.ScormUrl = request.ScormUrl;
            lesson.ScormEntryUrl = request.ScormEntryUrl;
            lesson.ScormVersion = request.ScormVersion;
            lesson.DocumentUrl = request.DocumentUrl;
            lesson.HtmlContent = request.HtmlContent;
            lesson.HtmlUrl = request.HtmlUrl;
            lesson.IsOptional = request.IsOptional;
            lesson.ExternalPendingMessage = request.ExternalPendingMessage?.Trim();

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
                CaptionUrl = lesson.CaptionUrl,
                DurationSeconds = lesson.DurationSeconds,
                ScormUrl = lesson.ScormUrl,
                ScormEntryUrl = lesson.ScormEntryUrl,
                ScormVersion = lesson.ScormVersion,
                DocumentUrl = lesson.DocumentUrl,
                HtmlContent = lesson.HtmlContent,
                HtmlUrl = lesson.HtmlUrl,
                IsOptional = lesson.IsOptional,
                CreatedAt = lesson.CreatedAt,
                GlobalLibraryContentId = lesson.GlobalLibraryContentId,
                ExternalPendingMessage = lesson.ExternalPendingMessage
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

            // Check access rights
            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != lesson.Course?.OrganisationId)
                {
                    return Forbid("You can only delete lessons from your organization");
                }

                // Allow deletion of global library lessons only from draft courses
                if (IsGlobalLibraryLesson(lesson))
                {
                    if (lesson.Course?.Status != "Draft")
                    {
                        return BadRequest(new { message = "Global library lessons can only be removed from draft courses." });
                    }
                }
                // For organization's own lessons, check if course is published
                else if (lesson.Course?.Status == "Published")
                {
                    return BadRequest(new { message = "Cannot delete lessons from published courses. Please unpublish the course first." });
                }
            }
            else if (lesson.Course?.Status == "Published")
            {
                return BadRequest(new { message = "Cannot delete lessons from published courses. Please unpublish the course first." });
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

            // Track video upload engagement
            var uploaderUser = await _context.Users.FindAsync(userId);
            if (uploaderUser?.OrganisationID.HasValue == true)
            {
                _logger.LogInformation("📊 Tracking video upload: User={UserId}, Org={OrgId}, Course={CourseId}", userId, uploaderUser.OrganisationID.Value, courseId);
                await _engagementService.TrackAsync(
                    userId,
                    uploaderUser.OrganisationID.Value,
                    EngagementTrackingService.EVENT_VIDEO_UPLOAD,
                    courseId: courseId,
                    metadata: new { fileName = video.FileName, size = video.Length }
                );
            }

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

    [HttpPost("upload-caption")]
    [RequestSizeLimit(5_242_880)] // 5 MB limit
    public async Task<ActionResult<CaptionUploadResponse>> UploadCaption(string courseId, IFormFile caption)
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

            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != course.OrganisationId)
                {
                    return Forbid("You can only upload captions for courses from your organization");
                }
            }

            if (caption == null || caption.Length == 0)
            {
                return BadRequest(new { message = "No caption file provided" });
            }

            var extension = Path.GetExtension(caption.FileName).ToLower();
            if (extension != ".vtt")
            {
                return BadRequest(new { message = "Invalid caption format. Only WebVTT (.vtt) files are supported." });
            }

            if (!_blobService.IsConfigured())
            {
                return StatusCode(501, new { message = "Azure Blob Storage is not configured. Please configure it to upload files." });
            }

            var uniqueFileName = $"{Guid.NewGuid()}{extension}";

            using var stream = caption.OpenReadStream();
            var blobUrl = await _blobService.UploadFileAsync(
                stream,
                uniqueFileName,
                course.OrganisationId.ToString(),
                "text/vtt");

            _logger.LogInformation("Caption uploaded to blob storage: {BlobUrl}", blobUrl);

            return Ok(new CaptionUploadResponse
            {
                CaptionUrl = blobUrl,
                FileName = uniqueFileName,
                OriginalFileName = caption.FileName,
                Size = caption.Length,
                ContentType = "text/vtt"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading caption for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while uploading the caption" });
        }
    }

    /// <summary>
    /// Update only the caption URL for a video lesson.
    /// Allowed even when the course is published.
    /// </summary>
    [HttpPut("{lessonId:long}/caption")]
    public async Task<ActionResult<LessonDetailDto>> UpdateLessonCaption(
        string courseId,
        long lessonId,
        [FromBody] UpdateCaptionRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var lesson = await _context.Lessons
                .Include(l => l.Course)
                .Include(l => l.Quiz)
                .FirstOrDefaultAsync(l => l.Id == lessonId && l.CourseId == courseId);

            if (lesson == null)
            {
                return NotFound(new { message = "Lesson not found" });
            }

            if (!string.Equals(lesson.Type, "video", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "Captions can only be updated for video lessons." });
            }

            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != lesson.Course?.OrganisationId)
                {
                    return Forbid("You can only update captions for lessons from your organization");
                }
            }

            lesson.CaptionUrl = string.IsNullOrWhiteSpace(request.CaptionUrl) ? null : request.CaptionUrl.Trim();

            if (lesson.Course != null)
            {
                lesson.Course.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Caption updated for lesson {LessonId} by user {UserId}", lessonId, userId);

            string? captionUrlWithSas = lesson.CaptionUrl;
            if (!string.IsNullOrEmpty(lesson.CaptionUrl) && _blobService.IsConfigured())
            {
                try
                {
                    captionUrlWithSas = await _blobService.GetSasUrlAsync(lesson.CaptionUrl, 24);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to generate SAS URL for caption on lesson {LessonId}", lessonId);
                }
            }

            return Ok(new LessonDetailDto
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
                CaptionUrl = captionUrlWithSas,
                DurationSeconds = lesson.DurationSeconds,
                ScormUrl = lesson.ScormUrl,
                ScormEntryUrl = lesson.ScormEntryUrl,
                ScormVersion = lesson.ScormVersion,
                DocumentUrl = lesson.DocumentUrl,
                HtmlContent = lesson.HtmlContent,
                HtmlUrl = lesson.HtmlUrl,
                IsOptional = lesson.IsOptional,
                CreatedAt = lesson.CreatedAt,
                GlobalLibraryContentId = lesson.GlobalLibraryContentId,
                ExternalPendingMessage = lesson.ExternalPendingMessage
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating caption for lesson {LessonId}", lessonId);
            return StatusCode(500, new { message = "An error occurred while updating the caption" });
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

            // Track PDF upload engagement
            var uploaderUser = await _context.Users.FindAsync(userId);
            if (uploaderUser?.OrganisationID.HasValue == true)
            {
                _logger.LogInformation("📊 Tracking PDF upload: User={UserId}, Org={OrgId}, Course={CourseId}", userId, uploaderUser.OrganisationID.Value, courseId);
                await _engagementService.TrackAsync(
                    userId,
                    uploaderUser.OrganisationID.Value,
                    EngagementTrackingService.EVENT_PDF_UPLOAD,
                    courseId: courseId,
                    metadata: new { fileName = pdf.FileName, size = pdf.Length }
                );
            }

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
            if (user == null || !user.OrganisationID.HasValue)
            {
                return BadRequest(new { message = "User organisation not found" });
            }

            // Check storage quota before upload
            var (hasQuota, quotaMessage, _) = await _storageQuotaService.CheckQuotaAsync(user.OrganisationID.Value, file.Length, "content");
            if (!hasQuota)
            {
                _logger.LogWarning("SCORM upload blocked due to quota: {Message}", quotaMessage);
                return BadRequest(new { message = quotaMessage });
            }

            _logger.LogInformation("Uploading SCORM package {FileName} for course {CourseId}", file.FileName, courseId);

            using var stream = file.OpenReadStream();
            var scormInfo = await _blobService.UploadScormPackageAsync(stream, file.FileName, user.OrganisationID.Value.ToString());

            var response = new ScormUploadResponse
            {
                LaunchUrl = scormInfo.LaunchUrl,
                BaseUrl = scormInfo.BaseUrl,
                PackageName = scormInfo.PackageName,
                ManifestPath = scormInfo.ManifestPath,
                ScormVersion = scormInfo.ScormVersion,
                FileCount = scormInfo.FileCount,
                TotalSize = scormInfo.TotalSize
            };

            _logger.LogInformation("SCORM package uploaded successfully: {PackageName}, Files: {FileCount}", 
                scormInfo.PackageName, scormInfo.FileCount);

            // Track SCORM upload engagement
            var uploaderUser = await _context.Users.FindAsync(userId);
            if (uploaderUser?.OrganisationID.HasValue == true)
            {
                _logger.LogInformation("📊 Tracking SCORM upload: User={UserId}, Org={OrgId}, Course={CourseId}", userId, uploaderUser.OrganisationID.Value, courseId);
                await _engagementService.TrackAsync(
                    userId,
                    uploaderUser.OrganisationID.Value,
                    EngagementTrackingService.EVENT_SCORM_UPLOAD,
                    courseId: courseId,
                    metadata: new { packageName = scormInfo.PackageName, fileCount = scormInfo.FileCount, size = scormInfo.TotalSize }
                );
            }

            return Ok(response);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("Storage quota exceeded"))
        {
            _logger.LogWarning("Storage quota exceeded for course {CourseId}: {Message}", courseId, ex.Message);
            return BadRequest(new { message = ex.Message });
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
    /// Upload HTML content as a lesson
    /// </summary>
    [HttpPost("html")]
    public async Task<ActionResult<HtmlUploadResponse>> UploadHtmlContent(string courseId, [FromBody] UploadHtmlRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            // Log the request details for debugging
            _logger.LogInformation("HTML upload request for course {CourseId} - Title: {TitlePresent}, Content length: {ContentLength}", 
                courseId, 
                !string.IsNullOrEmpty(request?.Title), 
                request?.HtmlContent?.Length ?? 0);

            // Check if model binding failed
            if (request == null)
            {
                _logger.LogWarning("HTML upload request body is null for course {CourseId}", courseId);
                return BadRequest(new { message = "Request body is required" });
            }

            if (string.IsNullOrEmpty(request.HtmlContent))
            {
                _logger.LogWarning("HTML content is empty for course {CourseId}", courseId);
                return BadRequest(new { message = "HTML content is required" });
            }

            if (string.IsNullOrEmpty(request.Title))
            {
                _logger.LogWarning("Title is empty for course {CourseId}", courseId);
                return BadRequest(new { message = "Title is required" });
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
            if (user == null || !user.OrganisationID.HasValue)
            {
                return BadRequest(new { message = "User organisation not found" });
            }

            // Check storage quota before upload
            var htmlBytes = System.Text.Encoding.UTF8.GetBytes(request.HtmlContent);
            var (hasQuota, quotaMessage, _) = await _storageQuotaService.CheckQuotaAsync(user.OrganisationID.Value, htmlBytes.Length, "content");
            if (!hasQuota)
            {
                _logger.LogWarning("HTML upload blocked due to quota: {Message}", quotaMessage);
                return BadRequest(new { message = quotaMessage });
            }

            _logger.LogInformation("Uploading HTML content for course {CourseId}", courseId);

            // Create a sanitized filename from the title
            var sanitizedTitle = string.Join("_", request.Title.Split(Path.GetInvalidFileNameChars()));
            var fileName = $"{sanitizedTitle}_{Guid.NewGuid()}.html";

            // Convert HTML string to stream
            using var stream = new MemoryStream(htmlBytes);

            string htmlUrl;
            try
            {
                // Upload to blob storage in organisation library folder (same as videos and PDFs)
                htmlUrl = await _blobService.UploadFileAsync(
                    stream,
                    fileName,
                    user.OrganisationID.Value.ToString(),
                    "text/html"
                );
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("Storage quota exceeded"))
            {
                _logger.LogWarning("Storage quota exceeded for organisation {OrgId}", user.OrganisationID.Value);
                return BadRequest(new { message = ex.Message });
            }

            var response = new HtmlUploadResponse
            {
                HtmlUrl = htmlUrl,
                FileName = fileName,
                Title = request.Title,
                Size = htmlBytes.Length
            };

            _logger.LogInformation("HTML content uploaded successfully: {FileName}", fileName);

            // Track HTML upload engagement (user already fetched above)
            if (!string.IsNullOrEmpty(userId) && user.OrganisationID.HasValue)
            {
                _logger.LogInformation("📊 Tracking HTML upload: User={UserId}, Org={OrgId}, Course={CourseId}", userId, user.OrganisationID.Value, courseId);
                await _engagementService.TrackAsync(
                    userId,
                    user.OrganisationID.Value,
                    EngagementTrackingService.EVENT_HTML_UPLOAD,
                    courseId: courseId,
                    metadata: new { title = request.Title, size = htmlBytes.Length }
                );
            }

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading HTML content for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while uploading the HTML content" });
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

    /// <summary>
    /// Get all lessons from global library (Byte Learning Library)
    /// Excludes lessons already added to the specified course
    /// </summary>
    [HttpGet("/api/admin/global-library/lessons")]
    public async Task<ActionResult<List<GlobalLibraryLessonDto>>> GetGlobalLibraryLessons(
        [FromQuery] string? contentType = null,
        [FromQuery] string? category = null,
        [FromQuery] string? courseId = null)
    {
        try
        {
            // Get list of global library content IDs already added to this course (if courseId provided)
            var excludedLibraryIds = new List<long>();
            if (!string.IsNullOrEmpty(courseId))
            {
                excludedLibraryIds = await _context.Lessons
                    .Where(l => l.CourseId == courseId && l.GlobalLibraryContentId != null)
                    .Select(l => l.GlobalLibraryContentId!.Value)
                    .ToListAsync();
                
                _logger.LogInformation("Excluding {Count} global library lessons already in course {CourseId}", 
                    excludedLibraryIds.Count, courseId);
            }

            var query = _context.GlobalLibraryContents.AsQueryable();

            // Exclude lessons already added to the course
            if (excludedLibraryIds.Any())
            {
                query = query.Where(c => !excludedLibraryIds.Contains(c.Id));
            }

            // Filter by content type if provided
            if (!string.IsNullOrEmpty(contentType) && contentType != "all")
            {
                query = query.Where(c => c.ContentType == contentType);
            }

            // Filter by category if provided
            if (!string.IsNullOrEmpty(category) && category != "all")
            {
                query = query.Where(c => c.Category == category);
            }

            var lessons = await query
                .Where(c => c.IsActive)
                .OrderByDescending(c => c.UploadedOn)
                .ToListAsync();

            // Map to DTO with SAS URLs
            var lessonDtos = new List<GlobalLibraryLessonDto>();
            foreach (var lesson in lessons)
            {
                var azureBlobPath = lesson.AzureBlobPath;
                
                // Generate SAS URL for Azure Blob Storage content if configured
                if (!string.IsNullOrEmpty(azureBlobPath) && _blobService.IsConfigured() && azureBlobPath.Contains("blob.core.windows.net"))
                {
                    try
                    {
                        azureBlobPath = await _blobService.GetSasUrlAsync(azureBlobPath, 24);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to generate SAS URL for global library content {ContentId}, using original path", lesson.Id);
                        // Keep the original path as fallback
                    }
                }

                lessonDtos.Add(new GlobalLibraryLessonDto
                {
                    Id = lesson.Id,
                    Title = lesson.Title,
                    Description = lesson.Description,
                    Code = lesson.Code,
                    ContentType = lesson.ContentType,
                    Category = lesson.Category,
                    Tags = lesson.Tags,
                    AzureBlobPath = azureBlobPath,
                    FileSizeBytes = lesson.FileSizeBytes,
                    FileName = lesson.FileName
                });
            }

            return Ok(lessonDtos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching global library lessons");
            return StatusCode(500, new { message = "An error occurred while fetching global library lessons" });
        }
    }

    /// <summary>
    /// Get all distinct categories from global library
    /// </summary>
    [HttpGet("/api/admin/global-library/categories")]
    public async Task<ActionResult<List<string>>> GetGlobalLibraryCategories()
    {
        try
        {
            var categories = await _context.GlobalLibraryContents
                .Where(c => c.IsActive && !string.IsNullOrEmpty(c.Category))
                .Select(c => c.Category!)
                .Distinct()
                .OrderBy(c => c)
                .ToListAsync();

            return Ok(categories);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching global library categories");
            return StatusCode(500, new { message = "An error occurred while fetching categories" });
        }
    }

    /// <summary>
    /// Add lessons from global library to a course
    /// </summary>
    [HttpPost("/api/admin/courses/{courseId}/lessons/from-library")]
    public async Task<ActionResult> AddLessonsFromLibrary(
        string courseId,
        [FromBody] AddLessonsFromLibraryRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return Unauthorized(new { message = "User not found" });
            }

            // Check course exists and user has access
            var course = await _context.Courses.FindAsync(courseId);
            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // OrgAdmin can only add to their organization's courses
            if (userRole == "OrgAdmin" && course.OrganisationId != user.OrganisationID)
            {
                return Forbid("You can only add lessons to your organization's courses");
            }

            // Get the global library content items
            var libraryContent = await _context.GlobalLibraryContents
                .Where(c => request.LibraryContentIds.Contains(c.Id) && c.IsActive)
                .ToListAsync();

            if (libraryContent.Count == 0)
            {
                return BadRequest(new { message = "No valid library content found" });
            }

            // Get max ordinal for the course
            var maxOrdinal = await _context.Lessons
                .Where(l => l.CourseId == courseId)
                .MaxAsync(l => (int?)l.Ordinal) ?? 0;

            // Create lessons from library content
            var newLessons = new List<Lesson>();
            foreach (var content in libraryContent)
            {
                maxOrdinal++;
                
                var lesson = new Lesson
                {
                    CourseId = courseId,
                    Title = content.Title,
                    Content = content.Description,
                    Ordinal = maxOrdinal,
                    Type = MapContentTypeToLessonType(content.ContentType),
                    IsOptional = false,
                    CreatedByUserId = userId,
                    CreatedAt = DateTime.UtcNow,
                    GlobalLibraryContentId = content.Id  // Store reference to global library content
                };

                // Set the appropriate URL based on content type
                switch (content.ContentType.ToLower())
                {
                    case "video":
                        lesson.VideoUrl = content.AzureBlobPath;
                        break;
                    case "pdf":
                        lesson.DocumentUrl = content.AzureBlobPath;
                        break;
                    case "scorm":
                        lesson.ScormUrl = content.AzureBlobPath;
                        lesson.ScormEntryUrl = content.AzureBlobPath;
                        lesson.ScormVersion = "1.2";
                        break;
                    case "html":
                        lesson.HtmlUrl = content.AzureBlobPath;
                        break;
                }

                newLessons.Add(lesson);
            }

            _context.Lessons.AddRange(newLessons);
            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "User {UserId} added {Count} lessons from global library to course {CourseId}",
                userId, newLessons.Count, courseId);

            return Ok(new
            {
                message = $"{newLessons.Count} lesson(s) added successfully",
                addedCount = newLessons.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding lessons from global library to course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while adding lessons" });
        }
    }

    private string MapContentTypeToLessonType(string contentType)
    {
        return contentType.ToLower() switch
        {
            "video" => "video",
            "pdf" => "pdf",
            "scorm" => "scorm",
            "html" => "html",
            _ => "content"
        };
    }

    private static readonly string[] ValidLessonTypes =
        ["content", "video", "quiz", "scorm", "document", "html", "external", "interactive"];

    private static ActionResult? ValidateLessonRequest(CreateLessonRequest request)
    {
        if (!ValidLessonTypes.Contains(request.Type))
        {
            return new BadRequestObjectResult(new
            {
                message = $"Invalid lesson type. Must be one of: {string.Join(", ", ValidLessonTypes)}"
            });
        }

        if (string.Equals(request.Type, "external", StringComparison.OrdinalIgnoreCase) &&
            string.IsNullOrWhiteSpace(request.ExternalPendingMessage))
        {
            return new BadRequestObjectResult(new
            {
                message = "Pre-completion message is required for practical lessons."
            });
        }

        return null;
    }

    private async Task<ActionResult?> ValidatePracticalLimitAsync(
        string courseId,
        string lessonType,
        long? excludeLessonId = null)
    {
        if (!string.Equals(lessonType, "external", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var existingPracticalQuery = _context.Lessons
            .Where(l => l.CourseId == courseId && l.Type == "external");

        if (excludeLessonId.HasValue)
        {
            existingPracticalQuery = existingPracticalQuery.Where(l => l.Id != excludeLessonId.Value);
        }

        if (await existingPracticalQuery.AnyAsync())
        {
            return new BadRequestObjectResult(new
            {
                message = "A course can only have one practical lesson."
            });
        }

        return null;
    }

    private bool IsGlobalLibraryLesson(Lesson lesson)
    {
        // Check if any of the lesson's URLs point to global library
        return (!string.IsNullOrEmpty(lesson.VideoUrl) && lesson.VideoUrl.Contains("global-library/")) ||
               (!string.IsNullOrEmpty(lesson.DocumentUrl) && lesson.DocumentUrl.Contains("global-library/")) ||
               (!string.IsNullOrEmpty(lesson.ScormUrl) && lesson.ScormUrl.Contains("global-library/")) ||
               (!string.IsNullOrEmpty(lesson.HtmlUrl) && lesson.HtmlUrl.Contains("global-library/"));
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
    public string? CaptionUrl { get; set; }
    public int? DurationSeconds { get; set; }
    public string? ScormUrl { get; set; }
    public string? ScormEntryUrl { get; set; }
    public string? ScormVersion { get; set; }
    public string? DocumentUrl { get; set; }
    public string? HtmlContent { get; set; }
    public string? HtmlUrl { get; set; }
    public bool IsOptional { get; set; }
    public DateTime CreatedAt { get; set; }
    public long? GlobalLibraryContentId { get; set; }
    public string? ExternalPendingMessage { get; set; }
    public string? InteractiveStatus { get; set; }
    public int? InteractiveBlockCount { get; set; }
    public int? InteractiveApprovedBlockCount { get; set; }
}

public class CreateLessonRequest
{
    public string Title { get; set; } = null!;
    public string? Content { get; set; }
    public int Ordinal { get; set; }
    public string Type { get; set; } = "content";
    public string? QuizId { get; set; }
    public string? VideoUrl { get; set; }
    public string? CaptionUrl { get; set; }
    public int? DurationSeconds { get; set; }
    public string? ScormUrl { get; set; }
    public string? ScormEntryUrl { get; set; }
    public string? ScormVersion { get; set; }
    public string? DocumentUrl { get; set; }
    public string? HtmlContent { get; set; }
    public string? HtmlUrl { get; set; }
    public bool IsOptional { get; set; }
    public string? ExternalPendingMessage { get; set; }
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

public class CaptionUploadResponse
{
    public string CaptionUrl { get; set; } = null!;
    public string FileName { get; set; } = null!;
    public string OriginalFileName { get; set; } = null!;
    public long Size { get; set; }
    public string ContentType { get; set; } = null!;
}

public class UpdateCaptionRequest
{
    public string? CaptionUrl { get; set; }
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
    public string ScormVersion { get; set; } = "1.2";
    public int FileCount { get; set; }
    public long TotalSize { get; set; }
}

public class UploadHtmlRequest
{
    public string Title { get; set; } = null!;
    public string HtmlContent { get; set; } = null!;
}

public class HtmlUploadResponse
{
    public string HtmlUrl { get; set; } = null!;
    public string FileName { get; set; } = null!;
    public string Title { get; set; } = null!;
    public long Size { get; set; }
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

// Global Library DTOs
public class GlobalLibraryLessonDto
{
    public long Id { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public string? Code { get; set; }
    public string ContentType { get; set; } = null!; // pdf, video, scorm, html
    public string? Category { get; set; }
    public string? Tags { get; set; }
    public string AzureBlobPath { get; set; } = null!;
    public long FileSizeBytes { get; set; }
    public string? FileName { get; set; }
}

public class AddLessonsFromLibraryRequest
{
    public List<long> LibraryContentIds { get; set; } = new();
}
