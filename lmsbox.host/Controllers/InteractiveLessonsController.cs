using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/courses/{courseId}/lessons/{lessonId:long}/interactive")]
[Authorize]
public class InteractiveLessonsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IInteractiveBlockDisplayService _displayService;
    private readonly ILogger<InteractiveLessonsController> _logger;

    public InteractiveLessonsController(
        ApplicationDbContext context,
        IInteractiveBlockDisplayService displayService,
        ILogger<InteractiveLessonsController> logger)
    {
        _context = context;
        _displayService = displayService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<LearnerInteractiveLessonDto>> GetInteractiveLesson(
        string courseId,
        long lessonId,
        [FromQuery] bool preview = false)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        if (!preview && !User.IsInRole("Admin") && !User.IsInRole("OrgAdmin") && !User.IsInRole("SuperAdmin"))
        {
            var hasAccessThroughGroup = await _context.LearnerGroups
                .Where(lg => lg.UserId == userId && lg.IsActive)
                .Join(_context.GroupCourses, lg => lg.LearningGroupId, gc => gc.LearningGroupId, (lg, gc) => gc)
                .AnyAsync(gc => gc.CourseId == courseId);

            var hasAccessThroughPathway = await _context.LearnerPathwayProgresses
                .Where(lpp => lpp.UserId == userId)
                .Join(_context.PathwayCourses, lpp => lpp.LearningPathwayId, pc => pc.LearningPathwayId, (lpp, pc) => pc)
                .AnyAsync(pc => pc.CourseId == courseId);

            if (!hasAccessThroughGroup && !hasAccessThroughPathway)
            {
                return Forbid();
            }
        }

        var settings = await _context.InteractiveLessonSettings
            .Include(s => s.Lesson)
            .Include(s => s.Blocks.OrderBy(b => b.Ordinal))
            .FirstOrDefaultAsync(s => s.LessonId == lessonId && s.Lesson!.CourseId == courseId);

        if (settings?.Lesson == null || !string.Equals(settings.Lesson.Type, "interactive", StringComparison.OrdinalIgnoreCase))
        {
            return NotFound();
        }

        var isAdminPreview = preview && (User.IsInRole("Admin") || User.IsInRole("OrgAdmin") || User.IsInRole("SuperAdmin"));
        var blocks = settings.Blocks.AsEnumerable();

        if (!isAdminPreview)
        {
            if (!InteractiveLessonHelper.IsUsableForLearners(settings.Blocks))
            {
                return BadRequest(new { message = "This interactive lesson is not yet available." });
            }

            blocks = settings.Blocks.Where(b => b.Status == "Approved");
        }

        var blockProgress = await _context.InteractiveBlockProgresses
            .Where(p => p.UserId == userId && p.LessonId == lessonId)
            .ToDictionaryAsync(p => p.BlockId);

        var blockDtos = blocks.OrderBy(b => b.Ordinal).Select(b =>
        {
            blockProgress.TryGetValue(b.Id, out var progress);
            return new LearnerInteractiveBlockDto
            {
                Id = b.Id,
                Ordinal = b.Ordinal,
                BlockType = b.BlockType,
                Title = b.Title,
                Html = _displayService.GetDisplayHtml(b),
                IsComplete = progress?.IsComplete ?? false,
                IsLocked = false
            };
        }).ToList();

        if (settings.LockNextBlockUntilComplete && !isAdminPreview)
        {
            var firstIncompleteFound = false;
            foreach (var block in blockDtos)
            {
                if (!firstIncompleteFound)
                {
                    if (!block.IsComplete)
                    {
                        firstIncompleteFound = true;
                    }
                }
                else
                {
                    block.IsLocked = true;
                }
            }
        }

        return Ok(new LearnerInteractiveLessonDto
        {
            LessonId = lessonId,
            CourseId = courseId,
            Title = settings.Lesson.Title,
            LockNextBlockUntilComplete = settings.LockNextBlockUntilComplete,
            Blocks = blockDtos,
            IsPreview = isAdminPreview
        });
    }

    [HttpPost("blocks/{blockId:long}/progress")]
    public async Task<ActionResult<InteractiveBlockProgressResponse>> UpdateBlockProgress(
        string courseId,
        long lessonId,
        long blockId,
        [FromBody] UpdateInteractiveBlockProgressRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var block = await _context.InteractiveBlocks
            .Include(b => b.InteractiveLessonSettings!)
            .ThenInclude(s => s.Lesson)
            .FirstOrDefaultAsync(b =>
                b.Id == blockId &&
                b.InteractiveLessonSettings!.LessonId == lessonId &&
                b.InteractiveLessonSettings.Lesson!.CourseId == courseId);

        if (block == null)
        {
            return NotFound();
        }

        if (block.Status != "Approved")
        {
            return BadRequest(new { message = "Block is not available." });
        }

        var progress = await _context.InteractiveBlockProgresses
            .FirstOrDefaultAsync(p => p.UserId == userId && p.BlockId == blockId);

        if (progress == null)
        {
            progress = new lmsbox.domain.Models.InteractiveBlockProgress
            {
                UserId = userId,
                LessonId = lessonId,
                BlockId = blockId
            };
            _context.InteractiveBlockProgresses.Add(progress);
        }

        if (request.ProgressDataJson != null)
        {
            progress.ProgressDataJson = request.ProgressDataJson;
        }

        if (request.IsComplete && !progress.IsComplete)
        {
            progress.IsComplete = true;
            progress.CompletedAt = DateTime.UtcNow;
        }

        progress.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var allBlocks = await _context.InteractiveBlocks
            .Where(b => b.InteractiveLessonSettings!.LessonId == lessonId && b.Status == "Approved")
            .Select(b => b.Id)
            .ToListAsync();

        var completedBlockIds = await _context.InteractiveBlockProgresses
            .Where(p => p.UserId == userId && p.LessonId == lessonId && p.IsComplete)
            .Select(p => p.BlockId)
            .ToListAsync();

        var lessonComplete = allBlocks.Count > 0 && allBlocks.All(id => completedBlockIds.Contains(id));
        var lessonProgressUpdated = false;

        if (lessonComplete)
        {
            var lessonProgress = await _context.LearnerProgresses
                .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.LessonId == lessonId);

            if (lessonProgress == null)
            {
                lessonProgress = new lmsbox.domain.Models.LearnerProgress
                {
                    UserId = userId,
                    CourseId = courseId,
                    LessonId = lessonId,
                    StartedAt = DateTime.UtcNow
                };
                _context.LearnerProgresses.Add(lessonProgress);
            }

            if (!lessonProgress.Completed)
            {
                lessonProgress.Completed = true;
                lessonProgress.CompletedAt = DateTime.UtcNow;
                lessonProgress.ProgressPercent = 100;
                lessonProgressUpdated = true;
            }

            lessonProgress.LastAccessedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return Ok(new InteractiveBlockProgressResponse
        {
            BlockId = blockId,
            IsComplete = progress.IsComplete,
            LessonComplete = lessonComplete,
            LessonProgressUpdated = lessonProgressUpdated
        });
    }
}

public class LearnerInteractiveLessonDto
{
    public long LessonId { get; set; }
    public string CourseId { get; set; } = null!;
    public string Title { get; set; } = null!;
    public bool LockNextBlockUntilComplete { get; set; }
    public bool IsPreview { get; set; }
    public List<LearnerInteractiveBlockDto> Blocks { get; set; } = new();
}

public class LearnerInteractiveBlockDto
{
    public long Id { get; set; }
    public int Ordinal { get; set; }
    public string BlockType { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string? Html { get; set; }
    public bool IsComplete { get; set; }
    public bool IsLocked { get; set; }
}

public class UpdateInteractiveBlockProgressRequest
{
    public bool IsComplete { get; set; }
    public string? ProgressDataJson { get; set; }
}

public class InteractiveBlockProgressResponse
{
    public long BlockId { get; set; }
    public bool IsComplete { get; set; }
    public bool LessonComplete { get; set; }
    public bool LessonProgressUpdated { get; set; }
}
