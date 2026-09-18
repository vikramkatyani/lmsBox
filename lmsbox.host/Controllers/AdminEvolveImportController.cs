using System.Security.Claims;
using System.Text.Json;
using lmsbox.domain.Models;
using lmsbox.domain.Utils;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace lmsBox.Server.Controllers;

/**
 * Sprint 2 — Evolve → LMSBox draft course import.
 * Accepts a pre-mapped payload from the TypeScript import-engine (no ZIP re-parse).
 * Creates Draft course + interactive lessons + Draft blocks. No AI / generate / publish.
 */
[ApiController]
[Route("api/admin/import")]
[Authorize(Roles = "Admin,OrgAdmin,TenantAdmin,SuperAdmin")]
public class AdminEvolveImportController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IInteractiveBlockPromptService _promptService;
    private readonly ILogger<AdminEvolveImportController> _logger;

    public AdminEvolveImportController(
        ApplicationDbContext context,
        IInteractiveBlockPromptService promptService,
        ILogger<AdminEvolveImportController> logger)
    {
        _context = context;
        _promptService = promptService;
        _logger = logger;
    }

    /// <summary>
    /// Create a Draft course from a mapped Evolve import plan.
    /// </summary>
    [HttpPost("evolve")]
    public async Task<ActionResult<EvolveImportResultDto>> ImportEvolveDraft(
        [FromBody] EvolveImportRequest request)
    {
        if (request == null)
        {
            return BadRequest(new { message = "Request body is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Title is required." });
        }

        if (request.Lessons == null || request.Lessons.Count == 0)
        {
            return BadRequest(new { message = "At least one lesson with mapped blocks is required." });
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized(new { message = "User not authenticated." });
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null || !user.OrganisationID.HasValue || user.OrganisationID == 0)
        {
            return BadRequest(new { message = "User must belong to an organisation to import courses." });
        }

        var organisationId = user.OrganisationID.Value;
        var title = request.Title.Trim();

        var duplicateExists = await _context.Courses.AnyAsync(c =>
            c.OrganisationId == organisationId &&
            c.Title.ToLower() == title.ToLower() &&
            !c.IsDeleted);

        if (duplicateExists)
        {
            return BadRequest(new
            {
                message = $"A course with the title '{title}' already exists in your organisation. Change the title and try again."
            });
        }

        var validationErrors = new List<string>();
        for (var li = 0; li < request.Lessons.Count; li++)
        {
            var lesson = request.Lessons[li];
            if (string.IsNullOrWhiteSpace(lesson.Title))
            {
                validationErrors.Add($"Lesson {li + 1}: title is required.");
                continue;
            }

            if (lesson.Blocks == null || lesson.Blocks.Count == 0)
            {
                validationErrors.Add($"Lesson '{lesson.Title}': at least one block is required.");
                continue;
            }

            if (lesson.Blocks.Count > InteractiveLessonConstants.MaxBlocksPerLesson)
            {
                validationErrors.Add(
                    $"Lesson '{lesson.Title}': exceeds max {InteractiveLessonConstants.MaxBlocksPerLesson} blocks.");
                continue;
            }

            for (var bi = 0; bi < lesson.Blocks.Count; bi++)
            {
                var block = lesson.Blocks[bi];
                if (string.IsNullOrWhiteSpace(block.Title))
                {
                    validationErrors.Add($"Lesson '{lesson.Title}' block {bi + 1}: title is required.");
                    continue;
                }

                if (string.IsNullOrWhiteSpace(block.BlockType))
                {
                    validationErrors.Add($"Lesson '{lesson.Title}' block {bi + 1}: blockType is required.");
                    continue;
                }

                var type = block.BlockType.Trim().ToLowerInvariant();
                if (_promptService.GetBlockTypeSchema(type) == null)
                {
                    validationErrors.Add(
                        $"Lesson '{lesson.Title}' block '{block.Title}': unsupported block type '{type}'.");
                    continue;
                }

                var payloadJson = ResolvePayloadJson(block);
                if (string.IsNullOrWhiteSpace(payloadJson))
                {
                    validationErrors.Add(
                        $"Lesson '{lesson.Title}' block '{block.Title}': form payload is required.");
                    continue;
                }

                try
                {
                    _promptService.ValidateFormPayload(type, payloadJson);
                }
                catch (ArgumentException ex)
                {
                    validationErrors.Add(
                        $"Lesson '{lesson.Title}' block '{block.Title}': {ex.Message}");
                }
            }
        }

        if (validationErrors.Count > 0)
        {
            return BadRequest(new
            {
                message = "Import validation failed.",
                errors = validationErrors
            });
        }

        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var categoryName = string.IsNullOrWhiteSpace(request.Category)
                ? "Imported"
                : request.Category.Trim();

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
            }

            var course = new Course
            {
                Id = ShortGuid.Generate(),
                Title = title,
                Description = request.Description?.Trim(),
                ShortDescription = request.ShortDescription?.Trim(),
                Category = categoryName,
                Tags = request.Tags?.Length > 0
                    ? JsonSerializer.Serialize(request.Tags)
                    : JsonSerializer.Serialize(new[] { "evolve", "import" }),
                Status = "Draft",
                CertificateEnabled = request.CertificateEnabled,
                OrganisationId = organisationId,
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                RequireSequentialLessons = request.RequireSequentialLessons,
                ShowLessonNavigation = request.ShowLessonNavigation
            };

            _context.Courses.Add(course);
            await _context.SaveChangesAsync();

            var createdLessons = new List<EvolveImportedLessonDto>();
            var ordinal = 0;

            foreach (var lessonReq in request.Lessons)
            {
                ordinal += 1;
                var lesson = new Lesson
                {
                    CourseId = course.Id,
                    Title = lessonReq.Title.Trim(),
                    Content = lessonReq.Description,
                    Type = "interactive",
                    Ordinal = lessonReq.SourceOrder > 0
                        ? lessonReq.SourceOrder
                        : ordinal,
                    IsOptional = false,
                    CreatedByUserId = userId,
                    CreatedAt = DateTime.UtcNow
                };

                var settings = new InteractiveLessonSettings
                {
                    Lesson = lesson,
                    Description = lessonReq.Description,
                    LockNextBlockUntilComplete = true
                };

                _context.Lessons.Add(lesson);
                _context.InteractiveLessonSettings.Add(settings);
                await _context.SaveChangesAsync();

                var blockOrdinal = 0;
                var createdBlockEntities = new List<(InteractiveBlock Block, EvolveImportBlockDto Request)>();

                foreach (var blockReq in lessonReq.Blocks)
                {
                    blockOrdinal += 1;
                    var blockType = blockReq.BlockType.Trim().ToLowerInvariant();
                    var payloadJson = ResolvePayloadJson(blockReq)!;
                    var mediaJson = string.IsNullOrWhiteSpace(blockReq.MediaAssetsJson)
                        ? "[]"
                        : blockReq.MediaAssetsJson;

                    var block = new InteractiveBlock
                    {
                        InteractiveLessonSettingsId = settings.Id,
                        Ordinal = blockReq.SourceOrder > 0 ? blockReq.SourceOrder : blockOrdinal,
                        BlockType = blockType,
                        Title = blockReq.Title.Trim(),
                        Status = "Draft",
                        FormPayloadJson = payloadJson,
                        MediaAssetsJson = mediaJson,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    _context.InteractiveBlocks.Add(block);
                    createdBlockEntities.Add((block, blockReq));
                }

                await _context.SaveChangesAsync();

                var createdBlocks = createdBlockEntities.Select(pair => new EvolveImportedBlockDto
                {
                    BlockId = pair.Block.Id,
                    Title = pair.Block.Title,
                    BlockType = pair.Block.BlockType,
                    SourceComponentId = pair.Request.SourceComponentId,
                    SourceType = pair.Request.SourceType
                }).ToList();

                createdLessons.Add(new EvolveImportedLessonDto
                {
                    LessonId = lesson.Id,
                    Title = lesson.Title,
                    BlockCount = createdBlocks.Count,
                    SourceLessonId = lessonReq.SourceLessonId,
                    SourcePageId = lessonReq.SourcePageId,
                    Blocks = createdBlocks
                });
            }

            await transaction.CommitAsync();

            _logger.LogInformation(
                "Evolve import created draft course {CourseId} with {LessonCount} lessons for org {OrganisationId}",
                course.Id,
                createdLessons.Count,
                organisationId);

            return Ok(new EvolveImportResultDto
            {
                CourseId = course.Id,
                Title = course.Title,
                Status = course.Status,
                LessonCount = createdLessons.Count,
                BlockCount = createdLessons.Sum(l => l.BlockCount),
                Lessons = createdLessons,
                Report = request.Report ?? new List<EvolveImportReportItemDto>()
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Evolve import failed");
            return StatusCode(500, new { message = "Import failed. No course was created." });
        }
    }

    private static string? ResolvePayloadJson(EvolveImportBlockDto block)
    {
        if (!string.IsNullOrWhiteSpace(block.FormPayloadJson))
        {
            return block.FormPayloadJson;
        }

        if (block.FormPayload != null)
        {
            return JsonSerializer.Serialize(block.FormPayload);
        }

        return null;
    }
}

public class EvolveImportRequest
{
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public string? ShortDescription { get; set; }
    public string? Category { get; set; }
    public string[]? Tags { get; set; }
    public bool CertificateEnabled { get; set; } = true;
    public bool RequireSequentialLessons { get; set; } = true;
    public bool ShowLessonNavigation { get; set; } = true;
    public List<EvolveImportLessonDto> Lessons { get; set; } = new();
    public List<EvolveImportReportItemDto>? Report { get; set; }
}

public class EvolveImportLessonDto
{
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public string? SourcePageId { get; set; }
    public string? SourceLessonId { get; set; }
    /** 1-based Evolve presentation order (preferred for Lesson.Ordinal). */
    public int SourceOrder { get; set; }
    public List<EvolveImportBlockDto> Blocks { get; set; } = new();
}

public class EvolveImportBlockDto
{
    public string Title { get; set; } = null!;
    public string BlockType { get; set; } = null!;
    public string? FormPayloadJson { get; set; }
    public object? FormPayload { get; set; }
    public string? MediaAssetsJson { get; set; }
    public string? SourceComponentId { get; set; }
    public string? SourceType { get; set; }
    /** 1-based order within the lesson (preferred for InteractiveBlock.Ordinal). */
    public int SourceOrder { get; set; }
}

public class EvolveImportReportItemDto
{
    public string SourceComponentId { get; set; } = "";
    public string SourceType { get; set; } = "";
    public string SourceTitle { get; set; } = "";
    public string Status { get; set; } = "";
    public string? TargetBlockType { get; set; }
    public string Message { get; set; } = "";
    public string? ReasonCode { get; set; }
    public string? PagePath { get; set; }
}

public class EvolveImportResultDto
{
    public string CourseId { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Status { get; set; } = null!;
    public int LessonCount { get; set; }
    public int BlockCount { get; set; }
    public List<EvolveImportedLessonDto> Lessons { get; set; } = new();
    public List<EvolveImportReportItemDto> Report { get; set; } = new();
}

public class EvolveImportedLessonDto
{
    public long LessonId { get; set; }
    public string Title { get; set; } = null!;
    public int BlockCount { get; set; }
    public string? SourceLessonId { get; set; }
    public string? SourcePageId { get; set; }
    public List<EvolveImportedBlockDto> Blocks { get; set; } = new();
}

public class EvolveImportedBlockDto
{
    public long BlockId { get; set; }
    public string Title { get; set; } = null!;
    public string BlockType { get; set; } = null!;
    public string? SourceComponentId { get; set; }
    public string? SourceType { get; set; }
}
