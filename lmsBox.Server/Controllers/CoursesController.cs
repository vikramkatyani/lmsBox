using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/learner/courses")]
[Authorize] // Requires authenticated user
public partial class CoursesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CoursesController> _logger;
    private readonly IAzureBlobService _blobService;
    private readonly ICertificateService _certificateService;
    private readonly IAuditLogService _auditLogService;

    public CoursesController(
        ApplicationDbContext context, 
        ILogger<CoursesController> logger, 
        IAzureBlobService blobService,
        ICertificateService certificateService,
        IAuditLogService auditLogService)
    {
        _context = context;
        _logger = logger;
        _blobService = blobService;
        _certificateService = certificateService;
        _auditLogService = auditLogService;
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

            // Get user's assigned learning pathways
            var userPathwayIds = await _context.LearnerPathwayProgresses
                .Where(lpp => lpp.UserId == userId)
                .Select(lpp => lpp.LearningPathwayId)
                .ToListAsync();

            // Get course IDs from learning pathways
            var pathwayCourseIds = await _context.PathwayCourses
                .Where(pc => userPathwayIds.Contains(pc.LearningPathwayId))
                .Select(pc => pc.CourseId)
                .ToListAsync();

            // Get courses mapped to learning groups OR learning pathways with optimized query
            var courses = await _context.Courses
                .Where(c => !c.IsDeleted && 
                    (c.GroupCourses.Any(gc => userGroupIds.Contains(gc.LearningGroupId)) ||
                     pathwayCourseIds.Contains(c.Id)))
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
                    && lp.CompletedAt != null
                    && lp.Course!.CertificateEnabled)
                .ToListAsync();

            var certificateDtos = certificates.Select(lp => new CourseItemDto
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
                CertificateUrl = lp.CertificateUrl // Azure blob URL
            }).ToList();

            return Ok(new CourseListResponse
            {
                Items = certificateDtos,
                Total = certificateDtos.Count
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching certificates");
            return StatusCode(500, new { message = "An error occurred while fetching certificates" });
        }
    }

    /// <summary>
    /// Get or generate certificate URL for a completed course
    /// </summary>
    /// <param name="courseId">Course ID</param>
    /// <returns>Certificate URL from Azure Blob Storage</returns>
    [HttpGet("{courseId}/certificate")]
    public async Task<IActionResult> GetCertificate(string courseId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            _logger.LogInformation("Certificate request for user {UserId}, course {CourseId}", userId, courseId);

            // Check if certificate already exists
            var existingUrl = await _certificateService.GetCertificateUrlAsync(userId, courseId);
            if (!string.IsNullOrEmpty(existingUrl))
            {
                _logger.LogInformation("Returning existing certificate for user {UserId}, course {CourseId}", userId, courseId);
                return Ok(new { certificateUrl = existingUrl });
            }

            // Generate and save certificate to Azure
            _logger.LogInformation("Generating new certificate for user {UserId}, course {CourseId}", userId, courseId);
            var certificateUrl = await _certificateService.GenerateAndSaveCertificateAsync(userId, courseId);

            return Ok(new { certificateUrl });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Certificate validation failed for course {CourseId}: {Message}", courseId, ex.Message);
            return BadRequest(new { message = ex.Message });
        }
        catch (Services.NotFoundException ex)
        {
            _logger.LogWarning(ex, "Resource not found for certificate: {Message}", ex.Message);
            return NotFound(new { message = ex.Message });
        }
        catch (FileNotFoundException ex)
        {
            _logger.LogError(ex, "Certificate template file not found: {Message}", ex.Message);
            return StatusCode(500, new { message = "Certificate template missing. Please contact support." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error getting certificate for user {UserId}, course {CourseId}", User.FindFirstValue(ClaimTypes.NameIdentifier), courseId);
            return StatusCode(500, new { message = $"An error occurred while generating the certificate: {ex.Message}" });
        }
    }

    /// <summary>
    /// Get detailed course information with lessons for the current learner
    /// </summary>
    /// <param name="courseId">Course ID</param>
    /// <returns>Course details with lessons and progress</returns>
    [HttpGet("{courseId}")]
    public async Task<ActionResult<CourseDetailDto>> GetCourseDetail(string courseId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            // Check if user has access to this course through group assignments
            var hasAccessThroughGroup = await _context.LearnerGroups
                .Where(lg => lg.UserId == userId && lg.IsActive)
                .Join(_context.GroupCourses, lg => lg.LearningGroupId, gc => gc.LearningGroupId, (lg, gc) => gc)
                .AnyAsync(gc => gc.CourseId == courseId);

            // Check if user has access to this course through learning pathways
            var hasAccessThroughPathway = await _context.LearnerPathwayProgresses
                .Where(lpp => lpp.UserId == userId)
                .Join(_context.PathwayCourses, lpp => lpp.LearningPathwayId, pc => pc.LearningPathwayId, (lpp, pc) => pc)
                .AnyAsync(pc => pc.CourseId == courseId);

            if (!hasAccessThroughGroup && !hasAccessThroughPathway)
            {
                return Forbid("You don't have access to this course");
            }

            // Get course with lessons
            var course = await _context.Courses
                .Include(c => c.Lessons.OrderBy(l => l.Ordinal))
                .FirstOrDefaultAsync(c => c.Id == courseId && !c.IsDeleted);

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

            // Find the last accessed lesson (most recent LastAccessedAt)
            var lastAccessedProgress = lessonProgresses
                .Where(lp => lp.LastAccessedAt != null)
                .OrderByDescending(lp => lp.LastAccessedAt)
                .FirstOrDefault();

            // Determine if lessons are locked due to mandatory pre-survey
            bool lessonsLocked = course.IsPreSurveyMandatory && 
                                 course.PreCourseSurveyId.HasValue && 
                                 !(courseProgress?.PreSurveyCompleted ?? false);

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
                LastAccessedLessonId = lastAccessedProgress?.LessonId?.ToString(),
                HasPreSurvey = course.PreCourseSurveyId.HasValue,
                IsPreSurveyMandatory = course.IsPreSurveyMandatory,
                PreSurveyCompleted = courseProgress?.PreSurveyCompleted ?? false,
                HasPostSurvey = course.PostCourseSurveyId.HasValue,
                IsPostSurveyMandatory = course.IsPostSurveyMandatory,
                PostSurveyCompleted = courseProgress?.PostSurveyCompleted ?? false,
                LessonsLocked = lessonsLocked,
                Lessons = course.Lessons.Select(lesson =>
                {
                    var lessonProgress = lessonProgresses.FirstOrDefault(lp => lp.LessonId == lesson.Id);
                    
                    // Determine URL based on lesson type
                    string url = lesson.Type.ToLower() switch
                    {
                        "video" => lesson.VideoUrl ?? "",
                        "scorm" => lesson.ScormUrl ?? "",
                        "document" => lesson.DocumentUrl ?? "",
                        "pdf" => lesson.DocumentUrl ?? "",
                        "quiz" => "", // Quiz doesn't need a URL
                        _ => ""
                    };

                    // Generate SAS URL for Azure Blob Storage content if configured
                    if (!string.IsNullOrEmpty(url) && _blobService.IsConfigured() && url.Contains("blob.core.windows.net"))
                    {
                        try
                        {
                            url = _blobService.GetSasUrlAsync(url, 24).Result;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to generate SAS URL for lesson {LessonId}, using original URL", lesson.Id);
                        }
                    }
                    
                    // Format duration for video lessons
                    string duration = "";
                    if (lesson.Type.ToLower() == "video" && lesson.VideoDurationSeconds.HasValue)
                    {
                        var timeSpan = TimeSpan.FromSeconds(lesson.VideoDurationSeconds.Value);
                        duration = timeSpan.ToString(@"mm\:ss");
                    }
                    
                    return new LessonDto
                    {
                        Id = lesson.Id.ToString(),
                        Title = lesson.Title,
                        Content = lesson.Content ?? "",
                        Type = lesson.Type.ToLower(),
                        Duration = duration,
                        Ordinal = lesson.Ordinal,
                        Progress = lessonProgress?.ProgressPercent ?? 0,
                        IsCompleted = lessonProgress?.Completed ?? false,
                        CompletedAt = lessonProgress?.CompletedAt,
                        Url = url,
                        QuizId = lesson.QuizId,
                        VideoTimestamp = lessonProgress?.VideoTimestamp,
                        TotalTimeSpentSeconds = lessonProgress?.TotalTimeSpentSeconds ?? 0
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

    /// <summary>
    /// Update lesson progress with video timestamp
    /// </summary>
    [HttpPost("{courseId}/lessons/{lessonId}/progress")]
    public async Task<IActionResult> UpdateLessonProgress(string courseId, long lessonId, [FromBody] UpdateProgressRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            // Find or create learner progress
            var progress = await _context.LearnerProgresses
                .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.LessonId == lessonId);

            if (progress == null)
            {
                progress = new LearnerProgress
                {
                    UserId = userId,
                    CourseId = courseId,
                    LessonId = lessonId,
                    ProgressPercent = 0,
                    Completed = false
                };
                _context.LearnerProgresses.Add(progress);
            }

            // Update progress
            progress.ProgressPercent = request.ProgressPercent;
            progress.VideoTimestamp = request.VideoTimestamp;
            progress.LastAccessedAt = DateTime.UtcNow; // Track last access time
            
            // Add time spent to total
            if (request.TimeSpentSeconds.HasValue && request.TimeSpentSeconds.Value > 0)
            {
                progress.TotalTimeSpentSeconds += request.TimeSpentSeconds.Value;
            }
            
            if (request.Completed && !progress.Completed)
            {
                progress.Completed = true;
                progress.CompletedAt = DateTime.UtcNow;
                
                // Log lesson completion to audit log
                var user = await _context.Users.FindAsync(userId);
                var lesson = await _context.Lessons.FindAsync(lessonId);
                var course = await _context.Courses.FindAsync(courseId);
                if (user != null && lesson != null && course != null)
                {
                    await _auditLogService.LogLessonCompletion(
                        userId, 
                        $"{user.FirstName} {user.LastName}", 
                        lessonId.ToString(), 
                        lesson.Title, 
                        courseId, 
                        course.Title
                    );
                }
            }

            await _context.SaveChangesAsync();

            // Update course-level progress
            await UpdateCourseProgress(userId, courseId);

            return Ok(new { message = "Progress updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating lesson progress");
            return StatusCode(500, new { message = "An error occurred while updating progress" });
        }
    }

    /// <summary>
    /// Track lesson access without updating progress
    /// </summary>
    [HttpPost("{courseId}/lessons/{lessonId}/access")]
    public async Task<IActionResult> TrackLessonAccess(string courseId, long lessonId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized();
            }

            // Find or create learner progress
            var progress = await _context.LearnerProgresses
                .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.LessonId == lessonId);

            if (progress == null)
            {
                progress = new LearnerProgress
                {
                    UserId = userId,
                    CourseId = courseId,
                    LessonId = lessonId,
                    ProgressPercent = 0,
                    Completed = false,
                    LastAccessedAt = DateTime.UtcNow,
                    SessionStartTime = DateTime.UtcNow // Start new session
                };
                _context.LearnerProgresses.Add(progress);
            }
            else
            {
                // Update last accessed time and start new session if needed
                progress.LastAccessedAt = DateTime.UtcNow;
                
                // If session start time is null or more than 30 minutes ago, start a new session
                if (progress.SessionStartTime == null || 
                    (DateTime.UtcNow - progress.SessionStartTime.Value).TotalMinutes > 30)
                {
                    progress.SessionStartTime = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Lesson access tracked" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error tracking lesson access");
            return StatusCode(500, new { message = "An error occurred while tracking lesson access" });
        }
    }

    private async Task UpdateCourseProgress(string userId, string courseId)
    {
        // Get all lessons in the course
        var totalLessons = await _context.Lessons
            .Where(l => l.CourseId == courseId)
            .CountAsync();

        if (totalLessons == 0)
        {
            return; // No lessons in course
        }

        // Get lesson progress records
        var lessonProgresses = await _context.LearnerProgresses
            .Where(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId != null)
            .ToListAsync();

        var courseProgress = await _context.LearnerProgresses
            .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId == null);

        if (courseProgress == null)
        {
            courseProgress = new LearnerProgress
            {
                UserId = userId,
                CourseId = courseId,
                LessonId = null,
                ProgressPercent = 0,
                Completed = false
            };
            _context.LearnerProgresses.Add(courseProgress);
        }

        // Calculate progress based on total lessons in course
        var completedLessons = lessonProgresses.Count(lp => lp.Completed);
        var progressPercent = (int)Math.Round((double)completedLessons / totalLessons * 100);
        courseProgress.ProgressPercent = progressPercent;

        // Mark course as completed if all lessons are completed (only if not already completed)
        var allCompleted = completedLessons == totalLessons;
        if (allCompleted && !courseProgress.Completed)
        {
            // Check if post-course survey is required
            var course = await _context.Courses.AsNoTracking().FirstOrDefaultAsync(c => c.Id == courseId);
            bool canMarkComplete = true;

            if (course != null && course.IsPostSurveyMandatory && course.PostCourseSurveyId.HasValue)
            {
                // Post-survey is mandatory - check if completed
                if (!courseProgress.PostSurveyCompleted)
                {
                    canMarkComplete = false;
                    _logger.LogInformation("Course {CourseId} cannot be marked complete for user {UserId} - post-survey not completed", 
                        courseId, userId);
                }
            }

            if (canMarkComplete)
            {
                courseProgress.Completed = true;
                courseProgress.CompletedAt = DateTime.UtcNow;
                
                _logger.LogInformation("Course {CourseId} marked as completed for user {UserId} at {CompletedAt}", 
                    courseId, userId, courseProgress.CompletedAt);
                
                // Log course completion to audit log
                var user = await _context.Users.FindAsync(userId);
                if (user != null && course != null)
                {
                    await _auditLogService.LogCourseCompletion(
                        userId, 
                        $"{user.FirstName} {user.LastName}", 
                        courseId, 
                        course.Title
                    );
                }
                
                // Update pathway progress if this course is part of any pathways
                await UpdatePathwayProgress(userId, courseId);
            }
        }
        else if (!allCompleted && courseProgress.Completed)
        {
            // Edge case: If course was marked complete but now isn't (e.g., lessons added)
            _logger.LogWarning("Course {CourseId} was completed but now has incomplete lessons for user {UserId}", 
                courseId, userId);
        }

        await _context.SaveChangesAsync();
    }

    private async Task UpdatePathwayProgress(string userId, string courseId)
    {
        // Find all pathways that contain this course
        var pathwayIds = await _context.PathwayCourses
            .Where(pc => pc.CourseId == courseId)
            .Select(pc => pc.LearningPathwayId)
            .ToListAsync();

        foreach (var pathwayId in pathwayIds)
        {
            // Check if user is enrolled in this pathway
            var pathwayProgress = await _context.LearnerPathwayProgresses
                .FirstOrDefaultAsync(lpp => lpp.UserId == userId && lpp.LearningPathwayId == pathwayId);

            if (pathwayProgress == null)
                continue;

            // Get all courses in this pathway
            var pathwayCourses = await _context.PathwayCourses
                .Where(pc => pc.LearningPathwayId == pathwayId)
                .Select(pc => pc.CourseId)
                .ToListAsync();

            // Get completed courses from this pathway
            var completedCourses = await _context.LearnerProgresses
                .Where(lp => lp.UserId == userId 
                    && lp.LessonId == null 
                    && lp.Completed 
                    && lp.CourseId != null
                    && pathwayCourses.Contains(lp.CourseId))
                .CountAsync();

            // Update pathway progress
            pathwayProgress.CompletedCourses = completedCourses;
            pathwayProgress.TotalCourses = pathwayCourses.Count;
            pathwayProgress.ProgressPercent = pathwayCourses.Count > 0 
                ? (int)((completedCourses / (double)pathwayCourses.Count) * 100) 
                : 0;
            pathwayProgress.LastAccessedAt = DateTime.UtcNow;

            // Check if pathway is completed
            if (completedCourses == pathwayCourses.Count && !pathwayProgress.IsCompleted)
            {
                pathwayProgress.IsCompleted = true;
                pathwayProgress.CompletedAt = DateTime.UtcNow;
            }

            // Update current course to next incomplete course
            if (!pathwayProgress.IsCompleted)
            {
                var nextIncompleteCourse = await _context.PathwayCourses
                    .Where(pc => pc.LearningPathwayId == pathwayId)
                    .OrderBy(pc => pc.SequenceOrder)
                    .Select(pc => pc.CourseId)
                    .FirstOrDefaultAsync(cId => !_context.LearnerProgresses
                        .Any(lp => lp.UserId == userId && lp.CourseId == cId && lp.LessonId == null && lp.Completed));

                pathwayProgress.CurrentCourseId = nextIncompleteCourse;
            }
        }

        await _context.SaveChangesAsync();
    }
}

// Survey endpoints for learners
public partial class CoursesController
{
    // GET: api/learner/courses/{courseId}/survey/pre
    [HttpGet("{courseId}/survey/pre")]
    public async Task<IActionResult> GetPreCourseSurvey(string courseId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var course = await _context.Courses
                .Include(c => c.PreCourseSurvey)
                    .ThenInclude(s => s!.Questions)
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == courseId && !c.IsDeleted);

            if (course == null)
                return NotFound("Course not found");

            if (course.PreCourseSurveyId == null)
                return NotFound("No pre-course survey configured for this course");

            // Check if already completed
            var progress = await _context.LearnerProgresses
                .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId == null);

            if (progress?.PreSurveyCompleted == true)
            {
                // Get the survey response with answers
                var surveyResponse = await _context.SurveyResponses
                    .Include(sr => sr.QuestionResponses)
                    .FirstOrDefaultAsync(sr => sr.Id == progress.PreSurveyResponseId);

                return Ok(new
                {
                    surveyId = course.PreCourseSurvey!.Id,
                    title = course.PreCourseSurvey!.Title,
                    description = course.PreCourseSurvey!.Description,
                    isMandatory = course.IsPreSurveyMandatory,
                    alreadyCompleted = true,
                    completedAt = progress.PreSurveyCompletedAt,
                    questions = course.PreCourseSurvey!.Questions?.OrderBy(q => q.OrderIndex).Select(q => new
                    {
                        id = q.Id,
                        questionText = q.QuestionText,
                        questionType = q.QuestionType,
                        options = string.IsNullOrEmpty(q.Options) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(q.Options),
                        isRequired = q.IsRequired,
                        minRating = q.MinRating,
                        maxRating = q.MaxRating,
                        orderIndex = q.OrderIndex,
                        response = surveyResponse?.QuestionResponses?.FirstOrDefault(qr => qr.SurveyQuestionId == q.Id) != null
                            ? new
                            {
                                answerText = surveyResponse.QuestionResponses.FirstOrDefault(qr => qr.SurveyQuestionId == q.Id)!.AnswerText,
                                selectedOptions = !string.IsNullOrEmpty(surveyResponse.QuestionResponses.FirstOrDefault(qr => qr.SurveyQuestionId == q.Id)!.SelectedOptions)
                                    ? System.Text.Json.JsonSerializer.Deserialize<List<string>>(surveyResponse.QuestionResponses.FirstOrDefault(qr => qr.SurveyQuestionId == q.Id)!.SelectedOptions!)
                                    : null,
                                ratingValue = surveyResponse.QuestionResponses.FirstOrDefault(qr => qr.SurveyQuestionId == q.Id)!.RatingValue
                            }
                            : null
                    }).ToList()
                });
            }

            var survey = course.PreCourseSurvey!;
            return Ok(new
            {
                surveyId = survey.Id,
                title = survey.Title,
                description = survey.Description,
                isMandatory = course.IsPreSurveyMandatory,
                questions = survey.Questions?.OrderBy(q => q.OrderIndex).Select(q => new
                {
                    id = q.Id,
                    questionText = q.QuestionText,
                    questionType = q.QuestionType,
                    options = string.IsNullOrEmpty(q.Options) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(q.Options),
                    isRequired = q.IsRequired,
                    minRating = q.MinRating,
                    maxRating = q.MaxRating,
                    orderIndex = q.OrderIndex
                }).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving pre-course survey for course {CourseId}", courseId);
            return StatusCode(500, "An error occurred while retrieving the survey");
        }
    }

    // GET: api/learner/courses/{courseId}/survey/post
    [HttpGet("{courseId}/survey/post")]
    public async Task<IActionResult> GetPostCourseSurvey(string courseId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var course = await _context.Courses
                .Include(c => c.PostCourseSurvey)
                    .ThenInclude(s => s!.Questions)
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == courseId && !c.IsDeleted);

            if (course == null)
                return NotFound("Course not found");

            if (course.PostCourseSurveyId == null)
                return NotFound("No post-course survey configured for this course");

            // Check if already completed
            var progress = await _context.LearnerProgresses
                .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId == null);

            if (progress?.PostSurveyCompleted == true)
            {
                // Get the survey response with answers
                var surveyResponse = await _context.SurveyResponses
                    .Include(sr => sr.QuestionResponses)
                    .FirstOrDefaultAsync(sr => sr.Id == progress.PostSurveyResponseId);

                return Ok(new
                {
                    surveyId = course.PostCourseSurvey!.Id,
                    title = course.PostCourseSurvey!.Title,
                    description = course.PostCourseSurvey!.Description,
                    isMandatory = course.IsPostSurveyMandatory,
                    alreadyCompleted = true,
                    completedAt = progress.PostSurveyCompletedAt,
                    questions = course.PostCourseSurvey!.Questions?.OrderBy(q => q.OrderIndex).Select(q => new
                    {
                        id = q.Id,
                        questionText = q.QuestionText,
                        questionType = q.QuestionType,
                        options = string.IsNullOrEmpty(q.Options) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(q.Options),
                        isRequired = q.IsRequired,
                        minRating = q.MinRating,
                        maxRating = q.MaxRating,
                        orderIndex = q.OrderIndex,
                        response = surveyResponse?.QuestionResponses?.FirstOrDefault(qr => qr.SurveyQuestionId == q.Id) != null
                            ? new
                            {
                                answerText = surveyResponse.QuestionResponses.FirstOrDefault(qr => qr.SurveyQuestionId == q.Id)!.AnswerText,
                                selectedOptions = !string.IsNullOrEmpty(surveyResponse.QuestionResponses.FirstOrDefault(qr => qr.SurveyQuestionId == q.Id)!.SelectedOptions)
                                    ? System.Text.Json.JsonSerializer.Deserialize<List<string>>(surveyResponse.QuestionResponses.FirstOrDefault(qr => qr.SurveyQuestionId == q.Id)!.SelectedOptions!)
                                    : null,
                                ratingValue = surveyResponse.QuestionResponses.FirstOrDefault(qr => qr.SurveyQuestionId == q.Id)!.RatingValue
                            }
                            : null
                    }).ToList()
                });
            }

            // Check if all lessons are completed before allowing post-survey
            var totalLessons = await _context.Lessons.CountAsync(l => l.CourseId == courseId);
            var completedLessons = await _context.LearnerProgresses
                .CountAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId != null && lp.Completed);

            if (completedLessons < totalLessons)
            {
                return BadRequest(new
                {
                    error = "All lessons must be completed before accessing the post-course survey",
                    completedLessons,
                    totalLessons
                });
            }

            var survey = course.PostCourseSurvey!;
            return Ok(new
            {
                surveyId = survey.Id,
                title = survey.Title,
                description = survey.Description,
                isMandatory = course.IsPostSurveyMandatory,
                questions = survey.Questions?.OrderBy(q => q.OrderIndex).Select(q => new
                {
                    id = q.Id,
                    questionText = q.QuestionText,
                    questionType = q.QuestionType,
                    options = string.IsNullOrEmpty(q.Options) ? new List<string>() : System.Text.Json.JsonSerializer.Deserialize<List<string>>(q.Options),
                    isRequired = q.IsRequired,
                    minRating = q.MinRating,
                    maxRating = q.MaxRating,
                    orderIndex = q.OrderIndex
                }).ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving post-course survey for course {CourseId}", courseId);
            return StatusCode(500, "An error occurred while retrieving the survey");
        }
    }

    // POST: api/learner/courses/{courseId}/survey/pre/submit
    [HttpPost("{courseId}/survey/pre/submit")]
    public async Task<IActionResult> SubmitPreCourseSurvey(string courseId, [FromBody] SubmitSurveyRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var course = await _context.Courses
                .Include(c => c.PreCourseSurvey)
                .FirstOrDefaultAsync(c => c.Id == courseId && !c.IsDeleted);

            if (course == null)
                return NotFound("Course not found");

            if (course.PreCourseSurveyId == null)
                return BadRequest("No pre-course survey configured for this course");

            // Get or create course progress
            var progress = await _context.LearnerProgresses
                .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId == null);

            if (progress == null)
            {
                progress = new LearnerProgress
                {
                    UserId = userId,
                    CourseId = courseId,
                    LessonId = null,
                    ProgressPercent = 0,
                    Completed = false,
                    LastAccessedAt = DateTime.UtcNow
                };
                _context.LearnerProgresses.Add(progress);
            }

            // Check if already completed
            if (progress.PreSurveyCompleted)
                return BadRequest("Pre-course survey already completed");

            // Create survey response
            var surveyResponse = new SurveyResponse
            {
                SurveyId = course.PreCourseSurveyId.Value,
                UserId = userId,
                CourseId = courseId,
                SubmittedAt = DateTime.UtcNow,
                SurveyType = "PreCourse"
            };

            _context.SurveyResponses.Add(surveyResponse);
            await _context.SaveChangesAsync(); // Save to get the ID

            // Save individual question responses
            if (request.Answers != null && request.Answers.Any())
            {
                foreach (var answer in request.Answers)
                {
                    var questionResponse = new SurveyQuestionResponse
                    {
                        SurveyResponseId = surveyResponse.Id,
                        SurveyQuestionId = answer.QuestionId,
                        AnswerText = answer.AnswerText,
                        SelectedOptions = answer.SelectedOptions != null && answer.SelectedOptions.Any()
                            ? System.Text.Json.JsonSerializer.Serialize(answer.SelectedOptions)
                            : null,
                        RatingValue = answer.RatingValue,
                        AnsweredAt = DateTime.UtcNow
                    };

                    _context.Set<SurveyQuestionResponse>().Add(questionResponse);
                }
            }

            // Mark pre-survey as completed
            progress.PreSurveyCompleted = true;
            progress.PreSurveyCompletedAt = DateTime.UtcNow;
            progress.PreSurveyResponseId = surveyResponse.Id;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Pre-course survey completed for course {CourseId} by user {UserId}", courseId, userId);

            return Ok(new { message = "Pre-course survey submitted successfully", responseId = surveyResponse.Id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting pre-course survey for course {CourseId}", courseId);
            return StatusCode(500, "An error occurred while submitting the survey");
        }
    }

    // POST: api/learner/courses/{courseId}/survey/post/submit
    [HttpPost("{courseId}/survey/post/submit")]
    public async Task<IActionResult> SubmitPostCourseSurvey(string courseId, [FromBody] SubmitSurveyRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var course = await _context.Courses
                .Include(c => c.PostCourseSurvey)
                .FirstOrDefaultAsync(c => c.Id == courseId && !c.IsDeleted);

            if (course == null)
                return NotFound("Course not found");

            if (course.PostCourseSurveyId == null)
                return BadRequest("No post-course survey configured for this course");

            // Get course progress
            var progress = await _context.LearnerProgresses
                .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId == null);

            if (progress == null)
                return BadRequest("Course progress not found");

            // Check if already completed
            if (progress.PostSurveyCompleted)
                return BadRequest("Post-course survey already completed");

            // Verify all lessons are completed
            var totalLessons = await _context.Lessons.CountAsync(l => l.CourseId == courseId);
            var completedLessons = await _context.LearnerProgresses
                .CountAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId != null && lp.Completed);

            if (completedLessons < totalLessons)
                return BadRequest("All lessons must be completed before submitting post-course survey");

            // Create survey response
            var surveyResponse = new SurveyResponse
            {
                SurveyId = course.PostCourseSurveyId.Value,
                UserId = userId,
                CourseId = courseId,
                SubmittedAt = DateTime.UtcNow,
                SurveyType = "PostCourse"
            };

            _context.SurveyResponses.Add(surveyResponse);
            await _context.SaveChangesAsync(); // Save to get the ID

            // Save individual question responses
            if (request.Answers != null && request.Answers.Any())
            {
                foreach (var answer in request.Answers)
                {
                    var questionResponse = new SurveyQuestionResponse
                    {
                        SurveyResponseId = surveyResponse.Id,
                        SurveyQuestionId = answer.QuestionId,
                        AnswerText = answer.AnswerText,
                        SelectedOptions = answer.SelectedOptions != null && answer.SelectedOptions.Any()
                            ? System.Text.Json.JsonSerializer.Serialize(answer.SelectedOptions)
                            : null,
                        RatingValue = answer.RatingValue,
                        AnsweredAt = DateTime.UtcNow
                    };

                    _context.Set<SurveyQuestionResponse>().Add(questionResponse);
                }
            }

            // Mark post-survey as completed
            progress.PostSurveyCompleted = true;
            progress.PostSurveyCompletedAt = DateTime.UtcNow;
            progress.PostSurveyResponseId = surveyResponse.Id;

            await _context.SaveChangesAsync();

            // Re-trigger course completion check now that post-survey is complete
            await UpdateCourseProgress(userId, courseId);

            _logger.LogInformation("Post-course survey completed for course {CourseId} by user {UserId}", courseId, userId);

            return Ok(new { message = "Post-course survey submitted successfully", responseId = surveyResponse.Id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting post-course survey for course {CourseId}", courseId);
            return StatusCode(500, "An error occurred while submitting the survey");
        }
    }
}

// DTOs
public class UpdateProgressRequest
{
    public int ProgressPercent { get; set; }
    public int? VideoTimestamp { get; set; }
    public bool Completed { get; set; }
    public int? TimeSpentSeconds { get; set; } // Session time to add
}

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
    public string? LastAccessedLessonId { get; set; } // ID of the last accessed lesson
    
    // Survey information
    public bool HasPreSurvey { get; set; }
    public bool IsPreSurveyMandatory { get; set; }
    public bool PreSurveyCompleted { get; set; }
    public bool HasPostSurvey { get; set; }
    public bool IsPostSurveyMandatory { get; set; }
    public bool PostSurveyCompleted { get; set; }
    public bool LessonsLocked { get; set; } // True if pre-survey is mandatory and not completed
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
    public string? QuizId { get; set; }
    public int? VideoTimestamp { get; set; } // Video bookmark in seconds
    public int TotalTimeSpentSeconds { get; set; } // Total time spent on this lesson
}

public class SubmitSurveyRequest
{
    public List<SurveyAnswerDto>? Answers { get; set; }
}

public class SurveyAnswerDto
{
    public long QuestionId { get; set; }
    public string? AnswerText { get; set; }
    public List<string>? SelectedOptions { get; set; }
    public int? RatingValue { get; set; }
}
