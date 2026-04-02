using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/learner/progress")]
[Authorize] // Requires authenticated user (learners)
public class LearnerProgressController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<LearnerProgressController> _logger;
    private readonly IEngagementTrackingService _engagementService;

    public LearnerProgressController(
        ApplicationDbContext context, 
        ILogger<LearnerProgressController> logger,
        IEngagementTrackingService engagementService)
    {
        _context = context;
        _logger = logger;
        _engagementService = engagementService;
    }

    /// <summary>
    /// Initialize or update course progress when a learner launches a course
    /// This creates both course-level and lesson-level progress records
    /// </summary>
    [HttpPost("courses/{courseId}/start")]
    public async Task<ActionResult<CourseProgressResponse>> StartCourse(string courseId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            // Verify user has access to this course (group or pathway)
            var hasAccess = await _context.LearnerGroups
                .Where(lg => lg.UserId == userId && lg.IsActive)
                .Join(_context.GroupCourses, lg => lg.LearningGroupId, gc => gc.LearningGroupId, (lg, gc) => gc)
                .AnyAsync(gc => gc.CourseId == courseId);

            if (!hasAccess)
            {
                hasAccess = await _context.LearnerPathwayProgresses
                    .Where(lp => lp.UserId == userId)
                    .Join(_context.PathwayCourses, lp => lp.LearningPathwayId, pc => pc.LearningPathwayId, (lp, pc) => pc)
                    .AnyAsync(pc => pc.CourseId == courseId);
            }

            if (!hasAccess)
            {
                return StatusCode(403, new { message = "You don't have access to this course" });
            }

            // Get course with lessons
            var course = await _context.Courses
                .Include(c => c.Lessons)
                .FirstOrDefaultAsync(c => c.Id == courseId);

            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // Check if course progress exists
            var courseProgress = await _context.LearnerProgresses
                .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId == null);

            if (courseProgress == null)
            {
                // Create course-level progress record
                courseProgress = new LearnerProgress
                {
                    UserId = userId,
                    CourseId = courseId,
                    LessonId = null,
                    ProgressPercent = 0,
                    Completed = false,
                    StartedAt = null, // Will be set when first lesson is accessed
                    CompletedAt = null
                };
                _context.LearnerProgresses.Add(courseProgress);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Created course progress for user {UserId} on course {CourseId}", userId, courseId);
            }

            // Initialize lesson progress records if they don't exist
            var existingLessonProgress = await _context.LearnerProgresses
                .Where(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId != null)
                .Select(lp => lp.LessonId)
                .ToListAsync();

            var lessonsToInitialize = course.Lessons
                .Where(l => !existingLessonProgress.Contains(l.Id))
                .ToList();

            if (lessonsToInitialize.Any())
            {
                foreach (var lesson in lessonsToInitialize)
                {
                    _context.LearnerProgresses.Add(new LearnerProgress
                    {
                        UserId = userId,
                        CourseId = courseId,
                        LessonId = lesson.Id,
                        ProgressPercent = 0,
                        StartedAt = null, // Will be set when lesson is first accessed
                        Completed = false,
                        CompletedAt = null
                    });
                }
                await _context.SaveChangesAsync();
                _logger.LogInformation("Initialized {Count} lesson progress records for user {UserId} on course {CourseId}", 
                    lessonsToInitialize.Count, userId, courseId);
            }

            return Ok(new CourseProgressResponse
            {
                CourseId = courseId,
                ProgressPercent = courseProgress.ProgressPercent,
                Completed = courseProgress.Completed,
                TotalLessons = course.Lessons.Count,
                CompletedLessons = await _context.LearnerProgresses
                    .CountAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId != null && lp.Completed)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting course {CourseId} for user", courseId);
            return StatusCode(500, new { message = "An error occurred while starting the course" });
        }
    }

    /// <summary>
    /// Update lesson progress when a learner progresses through a lesson
    /// </summary>
    [HttpPut("lessons/{lessonId}")]
    public async Task<ActionResult<LessonProgressResponse>> UpdateLessonProgress(
        long lessonId,
        [FromBody] UpdateLessonProgressRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            // Get lesson with course info
            var lesson = await _context.Lessons
                .Include(l => l.Course)
                .FirstOrDefaultAsync(l => l.Id == lessonId);

            if (lesson == null)
            {
                return NotFound(new { message = "Lesson not found" });
            }

            // Verify user has access to this course (group or pathway)
            var hasAccess = await _context.LearnerGroups
                .Where(lg => lg.UserId == userId && lg.IsActive)
                .Join(_context.GroupCourses, lg => lg.LearningGroupId, gc => gc.LearningGroupId, (lg, gc) => gc)
                .AnyAsync(gc => gc.CourseId == lesson.CourseId);

            if (!hasAccess)
            {
                hasAccess = await _context.LearnerPathwayProgresses
                    .Where(lp => lp.UserId == userId)
                    .Join(_context.PathwayCourses, lp => lp.LearningPathwayId, pc => pc.LearningPathwayId, (lp, pc) => pc)
                    .AnyAsync(pc => pc.CourseId == lesson.CourseId);
            }

            if (!hasAccess)
            {
                return StatusCode(403, new { message = "You don't have access to this lesson" });
            }

            // Get or create lesson progress
            var lessonProgress = await _context.LearnerProgresses
                .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.LessonId == lessonId);

            if (lessonProgress == null)
            {
                lessonProgress = new LearnerProgress
                {
                    UserId = userId,
                    CourseId = lesson.CourseId,
                    LessonId = lessonId,
                    ProgressPercent = 0,
                    Completed = false,
                    StartedAt = DateTime.UtcNow
                };
                _context.LearnerProgresses.Add(lessonProgress);
                
                // Also set course-level StartedAt if this is the first lesson accessed
                await SetCourseStartedAtIfNeeded(userId, lesson.CourseId);
            }
            else if (lessonProgress.StartedAt == null)
            {
                lessonProgress.StartedAt = DateTime.UtcNow;
                
                // Also set course-level StartedAt if not already set
                await SetCourseStartedAtIfNeeded(userId, lesson.CourseId);
            }

            // Update lesson progress
            lessonProgress.ProgressPercent = Math.Clamp(request.ProgressPercent, 0, 100);
            
            var shouldTrackCompletion = request.ProgressPercent >= 100 && !lessonProgress.Completed;
            
            if (shouldTrackCompletion)
            {
                lessonProgress.Completed = true;
                lessonProgress.CompletedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            // Track lesson completion AFTER SaveChanges to avoid transaction conflicts
            if (shouldTrackCompletion)
            {
                var orgId = await _context.Users
                    .Where(u => u.Id == userId)
                    .Select(u => u.OrganisationID)
                    .FirstOrDefaultAsync();
                
                if (orgId.HasValue)
                {
                    _logger.LogInformation("📊 Tracking lesson completion: User={UserId}, Org={OrgId}, Lesson={LessonId}", userId, orgId.Value, lessonId);
                    await _engagementService.TrackAsync(
                        userId,
                        orgId.Value,
                        EngagementTrackingService.EVENT_LESSON_COMPLETE,
                        courseId: lesson.CourseId,
                        lessonId: lessonId
                    );
                }
                else
                {
                    _logger.LogWarning("📊 Cannot track lesson completion - user {UserId} has no OrganisationID", userId);
                }
            }

            // Recalculate course progress
            await UpdateCourseProgress(userId, lesson.CourseId);

            return Ok(new LessonProgressResponse
            {
                LessonId = lessonId,
                ProgressPercent = lessonProgress.ProgressPercent,
                Completed = lessonProgress.Completed,
                CompletedAt = lessonProgress.CompletedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating lesson progress for lesson {LessonId}", lessonId);
            return StatusCode(500, new { message = "An error occurred while updating lesson progress" });
        }
    }

    /// <summary>
    /// Mark a lesson as completed
    /// </summary>
    [HttpPost("lessons/{lessonId}/complete")]
    public async Task<ActionResult<LessonProgressResponse>> CompleteLesson(long lessonId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            // Get lesson with course info
            var lesson = await _context.Lessons
                .Include(l => l.Course)
                .FirstOrDefaultAsync(l => l.Id == lessonId);

            if (lesson == null)
            {
                return NotFound(new { message = "Lesson not found" });
            }

            // Verify user has access (group or pathway)
            var hasAccess = await _context.LearnerGroups
                .Where(lg => lg.UserId == userId && lg.IsActive)
                .Join(_context.GroupCourses, lg => lg.LearningGroupId, gc => gc.LearningGroupId, (lg, gc) => gc)
                .AnyAsync(gc => gc.CourseId == lesson.CourseId);

            if (!hasAccess)
            {
                hasAccess = await _context.LearnerPathwayProgresses
                    .Where(lp => lp.UserId == userId)
                    .Join(_context.PathwayCourses, lp => lp.LearningPathwayId, pc => pc.LearningPathwayId, (lp, pc) => pc)
                    .AnyAsync(pc => pc.CourseId == lesson.CourseId);
            }

            if (!hasAccess)
            {
                return StatusCode(403, new { message = "You don't have access to this lesson" });
            }

            // Get or create lesson progress
            var lessonProgress = await _context.LearnerProgresses
                .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.LessonId == lessonId);

            if (lessonProgress == null)
            {
                lessonProgress = new LearnerProgress
                {
                    UserId = userId,
                    CourseId = lesson.CourseId,
                    LessonId = lessonId,
                    ProgressPercent = 100,
                    Completed = true,
                    StartedAt = DateTime.UtcNow,
                    CompletedAt = DateTime.UtcNow
                };
                _context.LearnerProgresses.Add(lessonProgress);
                
                // Set course-level StartedAt if this is the first lesson accessed
                await SetCourseStartedAtIfNeeded(userId, lesson.CourseId);
            }
            else if (!lessonProgress.Completed)
            {
                if (lessonProgress.StartedAt == null)
                {
                    lessonProgress.StartedAt = DateTime.UtcNow;
                    await SetCourseStartedAtIfNeeded(userId, lesson.CourseId);
                }
                lessonProgress.ProgressPercent = 100;
                lessonProgress.Completed = true;
                lessonProgress.CompletedAt = DateTime.UtcNow;
            }

            var wasJustCompleted = lessonProgress.Completed && lessonProgress.CompletedAt.HasValue && 
                                  (DateTime.UtcNow - lessonProgress.CompletedAt.Value).TotalSeconds < 5;

            await _context.SaveChangesAsync();

            // Track lesson completion AFTER SaveChanges
            if (wasJustCompleted)
            {
                var orgId = await _context.Users
                    .Where(u => u.Id == userId)
                    .Select(u => u.OrganisationID)
                    .FirstOrDefaultAsync();
                
                if (orgId.HasValue)
                {
                    _logger.LogInformation("📊 Tracking lesson completion (CompleteLesson): User={UserId}, Org={OrgId}, Lesson={LessonId}", userId, orgId.Value, lessonId);
                    await _engagementService.TrackAsync(
                        userId,
                        orgId.Value,
                        EngagementTrackingService.EVENT_LESSON_COMPLETE,
                        courseId: lesson.CourseId,
                        lessonId: lessonId
                    );
                }
                else
                {
                    _logger.LogWarning("📊 Cannot track lesson completion - user {UserId} has no OrganisationID", userId);
                }
            }

            // Recalculate course progress
            await UpdateCourseProgress(userId, lesson.CourseId);

            return Ok(new LessonProgressResponse
            {
                LessonId = lessonId,
                ProgressPercent = 100,
                Completed = true,
                CompletedAt = lessonProgress.CompletedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error completing lesson {LessonId}", lessonId);
            return StatusCode(500, new { message = "An error occurred while completing the lesson" });
        }
    }

    /// <summary>
    /// Get progress for a specific course
    /// </summary>
    [HttpGet("courses/{courseId}")]
    public async Task<ActionResult<CourseProgressDetailResponse>> GetCourseProgress(string courseId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            // Get course with lessons
            var course = await _context.Courses
                .Include(c => c.Lessons.OrderBy(l => l.Ordinal))
                .FirstOrDefaultAsync(c => c.Id == courseId);

            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            // Get all progress records for this course
            var allProgress = await _context.LearnerProgresses
                .Where(lp => lp.UserId == userId && lp.CourseId == courseId)
                .ToListAsync();

            var courseProgress = allProgress.FirstOrDefault(lp => lp.LessonId == null);
            var lessonProgress = allProgress.Where(lp => lp.LessonId != null).ToList();

            var response = new CourseProgressDetailResponse
            {
                CourseId = courseId,
                CourseTitle = course.Title,
                ProgressPercent = courseProgress?.ProgressPercent ?? 0,
                Completed = courseProgress?.Completed ?? false,
                CompletedAt = courseProgress?.CompletedAt,
                TotalLessons = course.Lessons.Count,
                CompletedLessons = lessonProgress.Count(lp => lp.Completed),
                Lessons = course.Lessons.Select(lesson =>
                {
                    var progress = lessonProgress.FirstOrDefault(lp => lp.LessonId == lesson.Id);
                    return new LessonProgressInfo
                    {
                        LessonId = lesson.Id,
                        LessonTitle = lesson.Title,
                        Ordinal = lesson.Ordinal,
                        ProgressPercent = progress?.ProgressPercent ?? 0,
                        Completed = progress?.Completed ?? false,
                        CompletedAt = progress?.CompletedAt
                    };
                }).ToList()
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting course progress for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while fetching course progress" });
        }
    }

    /// <summary>
    /// Helper method to recalculate and update course-level progress based on lesson completion
    /// </summary>
    private async Task UpdateCourseProgress(string userId, string courseId)
    {
        // Get total lessons count
        var totalLessons = await _context.Lessons
            .CountAsync(l => l.CourseId == courseId);

        if (totalLessons == 0)
        {
            return; // No lessons to track
        }

        // Get completed lessons count
        var completedLessons = await _context.LearnerProgresses
            .CountAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId != null && lp.Completed);

        // Calculate progress percentage
        var progressPercent = (int)Math.Round((double)completedLessons / totalLessons * 100);

        // Get or create course progress
        var courseProgress = await _context.LearnerProgresses
            .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId == null);

        if (courseProgress == null)
        {
            courseProgress = new LearnerProgress
            {
                UserId = userId,
                CourseId = courseId,
                LessonId = null,
                ProgressPercent = progressPercent,
                Completed = progressPercent >= 100,
                CompletedAt = progressPercent >= 100 ? DateTime.UtcNow : null
            };
            _context.LearnerProgresses.Add(courseProgress);
        }
        else
        {
            courseProgress.ProgressPercent = progressPercent;
            
            if (progressPercent >= 100 && !courseProgress.Completed)
            {
                courseProgress.Completed = true;
                courseProgress.CompletedAt = DateTime.UtcNow;
            }
            else if (progressPercent < 100 && courseProgress.Completed)
            {
                // Handle case where completion status might need to be reverted
                courseProgress.Completed = false;
                courseProgress.CompletedAt = null;
            }
        }

        await _context.SaveChangesAsync();
        
        _logger.LogInformation("Updated course progress for user {UserId} on course {CourseId}: {Progress}% ({Completed}/{Total} lessons)", 
            userId, courseId, progressPercent, completedLessons, totalLessons);
    }

    /// <summary>
    /// Set course-level StartedAt timestamp if not already set (when first lesson is accessed)
    /// </summary>
    private async Task SetCourseStartedAtIfNeeded(string userId, string courseId)
    {
        var courseProgress = await _context.LearnerProgresses
            .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.CourseId == courseId && lp.LessonId == null);
        
        if (courseProgress != null && courseProgress.StartedAt == null)
        {
            courseProgress.StartedAt = DateTime.UtcNow;
            _logger.LogInformation("Set course StartedAt for user {UserId} on course {CourseId}", userId, courseId);
        }
    }

    /// <summary>
    /// Get SCORM data for a lesson to support resume/bookmarking
    /// </summary>
    [HttpGet("lessons/{lessonId}/scorm")]
    public async Task<ActionResult<ScormDataResponse>> GetScormData(long lessonId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                return Unauthorized(new { message = "User not authenticated" });
            }

            var lessonScormVersion = await _context.Lessons
                .Where(l => l.Id == lessonId)
                .Select(l => l.ScormVersion)
                .FirstOrDefaultAsync();

            var defaultScormVersion = IsScorm2004(lessonScormVersion) ? (lessonScormVersion ?? "2004-2nd") : "1.2";

            // Get lesson progress with SCORM data
            var lessonProgress = await _context.LearnerProgresses
                .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.LessonId == lessonId);

            if (lessonProgress == null)
            {
                // No progress yet - return default values
                return Ok(new ScormDataResponse
                {
                    ScormVersion = defaultScormVersion,
                    ScormData = "",
                    ScormLessonLocation = "",
                    ScormLessonStatus = "not attempted",
                    ScormScore = "",
                    ScormCompletionStatus = "unknown",
                    ScormSuccessStatus = "unknown",
                    ScormScoreRaw = "",
                    ScormScoreMin = "",
                    ScormScoreMax = "",
                    ScormScoreScaled = "",
                    ScormLocation = "",
                    ScormSuspendData = "",
                    ScormObjectives = "",
                    ScormInteractions = ""
                });
            }

            var response = new ScormDataResponse
            {
                ScormVersion = defaultScormVersion,
                ScormData = lessonProgress.ScormData ?? "",
                ScormLessonLocation = lessonProgress.ScormLessonLocation ?? "",
                ScormLessonStatus = lessonProgress.ScormLessonStatus ?? "not attempted",
                ScormScore = lessonProgress.ScormScore ?? "",
                ScormCompletionStatus = "unknown",
                ScormSuccessStatus = "unknown",
                ScormScoreRaw = lessonProgress.ScormScore ?? "",
                ScormScoreMin = "",
                ScormScoreMax = "",
                ScormScoreScaled = "",
                ScormLocation = lessonProgress.ScormLessonLocation ?? "",
                ScormSuspendData = "",
                ScormObjectives = "",
                ScormInteractions = ""
            };

            if (!string.IsNullOrWhiteSpace(lessonProgress.ScormData))
            {
                try
                {
                    using var doc = JsonDocument.Parse(lessonProgress.ScormData);
                    if (doc.RootElement.ValueKind == JsonValueKind.Object)
                    {
                        if (TryGetString(doc.RootElement, "scormVersion", out var version) && IsScorm2004(version))
                        {
                            response.ScormVersion = version;
                        }

                        response.ScormCompletionStatus = GetStringOrDefault(doc.RootElement, "completionStatus", "unknown");
                        response.ScormSuccessStatus = GetStringOrDefault(doc.RootElement, "successStatus", "unknown");
                        response.ScormScoreRaw = GetStringOrDefault(doc.RootElement, "scoreRaw", response.ScormScoreRaw);
                        response.ScormScoreMin = GetStringOrDefault(doc.RootElement, "scoreMin", "");
                        response.ScormScoreMax = GetStringOrDefault(doc.RootElement, "scoreMax", "");
                        response.ScormScoreScaled = GetStringOrDefault(doc.RootElement, "scoreScaled", "");
                        response.ScormLocation = GetStringOrDefault(doc.RootElement, "location", response.ScormLocation);
                        response.ScormSuspendData = GetStringOrDefault(doc.RootElement, "suspendData", "");
                        response.ScormObjectives = GetStringOrDefault(doc.RootElement, "objectives", "");
                        response.ScormInteractions = GetStringOrDefault(doc.RootElement, "interactions", "");
                    }
                }
                catch
                {
                    // Keep backward-compatible response values when ScormData is legacy plain text.
                }
            }

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving SCORM data for lesson {LessonId}", lessonId);
            return StatusCode(500, new { message = "An error occurred while retrieving SCORM data" });
        }
    }

    /// <summary>
    /// Update SCORM lesson data (bookmark, suspend data, score, status)
    /// </summary>
    [HttpPost("lessons/{lessonId}/scorm")]
    public async Task<ActionResult<LessonProgressResponse>> UpdateScormData(long lessonId, [FromBody] UpdateScormDataRequest request)
    {
        try
        {
            _logger.LogInformation("SCORM data update request received for lesson {LessonId}: Request={@Request}", 
                lessonId, request);
            
            if (request == null)
            {
                _logger.LogWarning("SCORM update failed - request body is null");
                return BadRequest(new { message = "Request body is required" });
            }
            
            if (!ModelState.IsValid)
            {
                _logger.LogWarning("SCORM update failed - invalid model state: {@ModelState}", ModelState);
                return BadRequest(new { message = "Invalid request", errors = ModelState });
            }

            PopulateMissingScorm2004FieldsFromEmbeddedPayload(request);
            
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userId))
            {
                _logger.LogWarning("SCORM update unauthorized - no user ID");
                return Unauthorized(new { message = "User not authenticated" });
            }

            // Get lesson with course info
            var lesson = await _context.Lessons
                .Include(l => l.Course)
                .FirstOrDefaultAsync(l => l.Id == lessonId);

            if (lesson == null)
            {
                return NotFound(new { message = "Lesson not found" });
            }

            // Verify user has access to this course (either through group enrollment or existing progress)
            var hasAccess = await _context.LearnerGroups
                .Where(lg => lg.UserId == userId && lg.IsActive)
                .Join(_context.GroupCourses, lg => lg.LearningGroupId, gc => gc.LearningGroupId, (lg, gc) => gc)
                .AnyAsync(gc => gc.CourseId == lesson.CourseId);

            // Also allow access through assigned learning pathways.
            if (!hasAccess)
            {
                hasAccess = await _context.LearnerPathwayProgresses
                    .Where(lp => lp.UserId == userId)
                    .Join(_context.PathwayCourses,
                        lp => lp.LearningPathwayId,
                        pc => pc.LearningPathwayId,
                        (lp, pc) => pc)
                    .AnyAsync(pc => pc.CourseId == lesson.CourseId);

                if (hasAccess)
                {
                    _logger.LogInformation("SCORM update allowed - user {UserId} has pathway access for course {CourseId}", userId, lesson.CourseId);
                }
            }

            // Also check if user has existing progress (means they already started the course)
            if (!hasAccess)
            {
                hasAccess = await _context.LearnerProgresses
                    .AnyAsync(lp => lp.UserId == userId && lp.CourseId == lesson.CourseId);
                
                if (hasAccess)
                {
                    _logger.LogInformation("SCORM update allowed - user {UserId} has existing progress for course {CourseId}", userId, lesson.CourseId);
                }
            }

            if (!hasAccess)
            {
                _logger.LogWarning("SCORM update forbidden - user {UserId} doesn't have access to lesson {LessonId} or course {CourseId}", userId, lessonId, lesson.CourseId);
                return StatusCode(403, new { message = "You don't have access to this lesson" });
            }

            // Get or create lesson progress
            var lessonProgress = await _context.LearnerProgresses
                .Where(lp => lp.UserId == userId && lp.LessonId == lessonId)
                .FirstOrDefaultAsync();

            if (lessonProgress == null)
            {
                lessonProgress = new LearnerProgress
                {
                    UserId = userId,
                    CourseId = lesson.CourseId,
                    LessonId = lessonId,
                    ProgressPercent = 0,
                    Completed = false,
                    StartedAt = DateTime.UtcNow
                };
                _context.LearnerProgresses.Add(lessonProgress);
                
                // Set course-level StartedAt if this is the first lesson accessed
                await SetCourseStartedAtIfNeeded(userId, lesson.CourseId);
            }
            else if (lessonProgress.StartedAt == null)
            {
                // Set StartedAt if this is the first time accessing after creation
                lessonProgress.StartedAt = DateTime.UtcNow;
                await SetCourseStartedAtIfNeeded(userId, lesson.CourseId);
            }

            // Track completion state BEFORE we update it
            var wasCompleted = lessonProgress.Completed;

            void ApplyScormUpdate()
            {
                if (!string.IsNullOrEmpty(request.ScormLessonLocation))
                    lessonProgress.ScormLessonLocation = request.ScormLessonLocation;

                if (!string.IsNullOrEmpty(request.ScormLocation))
                    lessonProgress.ScormLessonLocation = request.ScormLocation;

                var computedLessonStatus = request.ScormLessonStatus;
                if (string.IsNullOrWhiteSpace(computedLessonStatus) && IsScorm2004(request.ScormVersion))
                {
                    computedLessonStatus = MapScorm2004ToLessonStatus(request.ScormCompletionStatus, request.ScormSuccessStatus);
                }

                if (!string.IsNullOrEmpty(computedLessonStatus))
                {
                    _logger.LogInformation("SCORM Status Update: User={UserId}, Lesson={LessonId}, NewStatus={NewStatus}, WasCompleted={WasCompleted}, CurrentStatus={CurrentStatus}",
                        userId, lessonId, computedLessonStatus, wasCompleted, lessonProgress.ScormLessonStatus);

                    // PROTECT: Never allow downgrading from completed/passed to incomplete/not attempted
                    if (lessonProgress.Completed &&
                        (computedLessonStatus == "incomplete" || computedLessonStatus == "not attempted"))
                    {
                        _logger.LogWarning("BLOCKING status downgrade: Lesson {LessonId} already completed, ignoring status '{NewStatus}'",
                            lessonId, computedLessonStatus);
                    }
                    else
                    {
                        lessonProgress.ScormLessonStatus = computedLessonStatus;

                        if (computedLessonStatus == "completed" || computedLessonStatus == "passed")
                        {
                            if (!lessonProgress.Completed)
                            {
                                _logger.LogInformation("Marking lesson {LessonId} as completed for user {UserId}", lessonId, userId);
                                lessonProgress.Completed = true;
                                lessonProgress.CompletedAt = DateTime.UtcNow;
                                lessonProgress.ProgressPercent = 100;
                            }
                            else
                            {
                                _logger.LogInformation("Lesson {LessonId} already completed for user {UserId}, skipping re-completion", lessonId, userId);
                            }
                        }
                    }
                }

                var normalizedScore = !string.IsNullOrWhiteSpace(request.ScormScoreRaw)
                    ? request.ScormScoreRaw
                    : request.ScormScore;

                if (!string.IsNullOrEmpty(normalizedScore))
                    lessonProgress.ScormScore = normalizedScore;

                lessonProgress.ScormData = BuildScormDataPayload(lessonProgress.ScormData, request);
                lessonProgress.LastAccessedAt = DateTime.UtcNow;
            }

            ApplyScormUpdate();

            var saveAttempts = 0;
            while (true)
            {
                try
                {
                    await _context.SaveChangesAsync();
                    break;
                }
                catch (DbUpdateConcurrencyException ex) when (saveAttempts < 2)
                {
                    saveAttempts++;
                    _logger.LogWarning(ex, "SCORM save concurrency conflict for lesson {LessonId}, user {UserId}. Retrying attempt {Attempt}.", lessonId, userId, saveAttempts);

                    foreach (var entry in ex.Entries)
                    {
                        await entry.ReloadAsync();
                    }

                    wasCompleted = lessonProgress.Completed;
                    ApplyScormUpdate();
                }
                catch (DbUpdateException ex) when (saveAttempts < 2)
                {
                    saveAttempts++;
                    _logger.LogWarning(ex, "SCORM save DB update conflict for lesson {LessonId}, user {UserId}. Retrying attempt {Attempt}.", lessonId, userId, saveAttempts);

                    var existingProgress = await _context.LearnerProgresses
                        .Where(lp => lp.UserId == userId && lp.LessonId == lessonId)
                        .FirstOrDefaultAsync();

                    if (existingProgress == null)
                    {
                        throw;
                    }

                    if (_context.Entry(lessonProgress).State == EntityState.Added)
                    {
                        _context.Entry(lessonProgress).State = EntityState.Detached;
                    }

                    lessonProgress = existingProgress;
                    wasCompleted = lessonProgress.Completed;
                    ApplyScormUpdate();
                }
            }

            // Update course progress after saving lesson progress (only if newly completed)
            if (lessonProgress.Completed && !wasCompleted)
            {
                await UpdateCourseProgress(userId, lesson.CourseId);
            }

            _logger.LogInformation("Updated SCORM data for user {UserId} on lesson {LessonId}, Status: {Status}", 
                userId, lessonId, request.ScormLessonStatus);

            return Ok(new LessonProgressResponse
            {
                LessonId = lessonId,
                ProgressPercent = lessonProgress.ProgressPercent,
                Completed = lessonProgress.Completed,
                CompletedAt = lessonProgress.CompletedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating SCORM data for lesson {LessonId}", lessonId);
            return StatusCode(500, new { message = "An error occurred while updating SCORM data" });
        }
    }

    private static bool IsScorm2004(string? version)
    {
        if (string.IsNullOrWhiteSpace(version))
        {
            return false;
        }

        return version.Contains("2004", StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizeScorm2004Version(string? version)
    {
        if (string.IsNullOrWhiteSpace(version)) return "2004-2nd";
        if (version.Contains("4th", StringComparison.OrdinalIgnoreCase)) return "2004-4th";
        if (version.Contains("3rd", StringComparison.OrdinalIgnoreCase)) return "2004-3rd";
        if (version.Contains("2nd", StringComparison.OrdinalIgnoreCase)) return "2004-2nd";
        return IsScorm2004(version) ? "2004-2nd" : version;
    }

    private static string MapScorm2004ToLessonStatus(string? completionStatus, string? successStatus)
    {
        if (string.Equals(successStatus, "passed", StringComparison.OrdinalIgnoreCase))
        {
            return "passed";
        }

        if (string.Equals(successStatus, "failed", StringComparison.OrdinalIgnoreCase))
        {
            return "failed";
        }

        if (string.Equals(completionStatus, "completed", StringComparison.OrdinalIgnoreCase))
        {
            return "completed";
        }

        if (string.Equals(completionStatus, "incomplete", StringComparison.OrdinalIgnoreCase))
        {
            return "incomplete";
        }

        return "not attempted";
    }

    private static string BuildScormDataPayload(string? existingScormData, UpdateScormDataRequest request)
    {
        if (!IsScorm2004(request.ScormVersion))
        {
            return !string.IsNullOrWhiteSpace(request.ScormData) ? request.ScormData : (existingScormData ?? string.Empty);
        }

        var payload = new
        {
            scormVersion = NormalizeScorm2004Version(request.ScormVersion),
            completionStatus = request.ScormCompletionStatus ?? "unknown",
            successStatus = request.ScormSuccessStatus ?? "unknown",
            scoreRaw = request.ScormScoreRaw ?? request.ScormScore ?? string.Empty,
            scoreMin = request.ScormScoreMin ?? string.Empty,
            scoreMax = request.ScormScoreMax ?? string.Empty,
            scoreScaled = request.ScormScoreScaled ?? string.Empty,
            location = request.ScormLocation ?? request.ScormLessonLocation ?? string.Empty,
            suspendData = request.ScormSuspendData ?? request.ScormData ?? string.Empty,
            objectives = request.ScormObjectives ?? string.Empty,
            interactions = request.ScormInteractions ?? string.Empty
        };

        return JsonSerializer.Serialize(payload);
    }

    private static void PopulateMissingScorm2004FieldsFromEmbeddedPayload(UpdateScormDataRequest request)
    {
        if (!IsScorm2004(request.ScormVersion))
        {
            return;
        }

        var candidate = request.ScormSuspendData;
        if (string.IsNullOrWhiteSpace(candidate) || !candidate.TrimStart().StartsWith("{"))
        {
            candidate = request.ScormData;
        }

        if (string.IsNullOrWhiteSpace(candidate) || !candidate.TrimStart().StartsWith("{"))
        {
            return;
        }

        try
        {
            using var doc = JsonDocument.Parse(candidate);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            var hasEmbedded2004Payload = doc.RootElement.TryGetProperty("completionStatus", out _) ||
                                         doc.RootElement.TryGetProperty("successStatus", out _) ||
                                         doc.RootElement.TryGetProperty("scoreRaw", out _) ||
                                         doc.RootElement.TryGetProperty("location", out _) ||
                                         doc.RootElement.TryGetProperty("suspendData", out _);

            if (!hasEmbedded2004Payload)
            {
                return;
            }

            if (string.IsNullOrWhiteSpace(request.ScormVersion) && TryGetString(doc.RootElement, "scormVersion", out var version))
            {
                request.ScormVersion = NormalizeScorm2004Version(version);
            }

            if (string.IsNullOrWhiteSpace(request.ScormCompletionStatus) && TryGetString(doc.RootElement, "completionStatus", out var completionStatus))
            {
                request.ScormCompletionStatus = completionStatus;
            }

            if (string.IsNullOrWhiteSpace(request.ScormSuccessStatus) && TryGetString(doc.RootElement, "successStatus", out var successStatus))
            {
                request.ScormSuccessStatus = successStatus;
            }

            if (string.IsNullOrWhiteSpace(request.ScormScoreRaw) && TryGetString(doc.RootElement, "scoreRaw", out var scoreRaw))
            {
                request.ScormScoreRaw = scoreRaw;
            }

            if (string.IsNullOrWhiteSpace(request.ScormScoreMin) && TryGetString(doc.RootElement, "scoreMin", out var scoreMin))
            {
                request.ScormScoreMin = scoreMin;
            }

            if (string.IsNullOrWhiteSpace(request.ScormScoreMax) && TryGetString(doc.RootElement, "scoreMax", out var scoreMax))
            {
                request.ScormScoreMax = scoreMax;
            }

            if (string.IsNullOrWhiteSpace(request.ScormScoreScaled) && TryGetString(doc.RootElement, "scoreScaled", out var scoreScaled))
            {
                request.ScormScoreScaled = scoreScaled;
            }

            if (string.IsNullOrWhiteSpace(request.ScormLocation) && TryGetString(doc.RootElement, "location", out var location))
            {
                request.ScormLocation = location;
            }

            if (string.IsNullOrWhiteSpace(request.ScormSuspendData) && TryGetString(doc.RootElement, "suspendData", out var suspendData))
            {
                request.ScormSuspendData = suspendData;
            }

            if (string.IsNullOrWhiteSpace(request.ScormObjectives) && TryGetString(doc.RootElement, "objectives", out var objectives))
            {
                request.ScormObjectives = objectives;
            }

            if (string.IsNullOrWhiteSpace(request.ScormInteractions) && TryGetString(doc.RootElement, "interactions", out var interactions))
            {
                request.ScormInteractions = interactions;
            }
        }
        catch
        {
            // Ignore parse failures and keep original request values.
        }
    }

    private static bool TryGetString(JsonElement root, string propertyName, out string value)
    {
        value = string.Empty;
        if (!root.TryGetProperty(propertyName, out var property))
        {
            return false;
        }

        value = property.ValueKind == JsonValueKind.String ? property.GetString() ?? string.Empty : property.ToString();
        return true;
    }

    private static string GetStringOrDefault(JsonElement root, string propertyName, string defaultValue)
    {
        return TryGetString(root, propertyName, out var value) ? value : defaultValue;
    }
}

// Request/Response DTOs
public class UpdateLessonProgressRequest
{
    public int ProgressPercent { get; set; }
}

public class UpdateScormDataRequest
{
    public string? ScormVersion { get; set; }
    public string? ScormData { get; set; }
    public string? ScormLessonLocation { get; set; }
    public string? ScormLessonStatus { get; set; }
    public string? ScormScore { get; set; }
    public string? ScormCompletionStatus { get; set; }
    public string? ScormSuccessStatus { get; set; }
    public string? ScormScoreRaw { get; set; }
    public string? ScormScoreMin { get; set; }
    public string? ScormScoreMax { get; set; }
    public string? ScormScoreScaled { get; set; }
    public string? ScormLocation { get; set; }
    public string? ScormSuspendData { get; set; }
    public string? ScormObjectives { get; set; }
    public string? ScormInteractions { get; set; }
}

public class ScormDataResponse
{
    public string ScormVersion { get; set; } = "1.2";
    public string ScormData { get; set; } = string.Empty;
    public string ScormLessonLocation { get; set; } = string.Empty;
    public string ScormLessonStatus { get; set; } = string.Empty;
    public string ScormScore { get; set; } = string.Empty;
    public string ScormCompletionStatus { get; set; } = string.Empty;
    public string ScormSuccessStatus { get; set; } = string.Empty;
    public string ScormScoreRaw { get; set; } = string.Empty;
    public string ScormScoreMin { get; set; } = string.Empty;
    public string ScormScoreMax { get; set; } = string.Empty;
    public string ScormScoreScaled { get; set; } = string.Empty;
    public string ScormLocation { get; set; } = string.Empty;
    public string ScormSuspendData { get; set; } = string.Empty;
    public string ScormObjectives { get; set; } = string.Empty;
    public string ScormInteractions { get; set; } = string.Empty;
}

public class CourseProgressResponse
{
    public string CourseId { get; set; } = string.Empty;
    public int ProgressPercent { get; set; }
    public bool Completed { get; set; }
    public int TotalLessons { get; set; }
    public int CompletedLessons { get; set; }
}

public class LessonProgressResponse
{
    public long LessonId { get; set; }
    public int ProgressPercent { get; set; }
    public bool Completed { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public class CourseProgressDetailResponse
{
    public string CourseId { get; set; } = string.Empty;
    public string CourseTitle { get; set; } = string.Empty;
    public int ProgressPercent { get; set; }
    public bool Completed { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int TotalLessons { get; set; }
    public int CompletedLessons { get; set; }
    public List<LessonProgressInfo> Lessons { get; set; } = new();
}

public class LessonProgressInfo
{
    public long LessonId { get; set; }
    public string LessonTitle { get; set; } = string.Empty;
    public int Ordinal { get; set; }
    public int ProgressPercent { get; set; }
    public bool Completed { get; set; }
    public DateTime? CompletedAt { get; set; }
}
