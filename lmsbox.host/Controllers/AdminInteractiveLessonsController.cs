using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace lmsBox.Server.Controllers;

public static class InteractiveLessonHelper
{
    public const int MaxBlocksPerLesson = InteractiveLessonConstants.MaxBlocksPerLesson;

    public static string ComputeStatus(IEnumerable<InteractiveBlock> blocks)
    {
        var list = blocks.ToList();
        if (list.Count == 0)
        {
            return "Draft";
        }

        return list.All(b => b.Status == "Approved") ? "Ready" : "Draft";
    }

    public static bool IsUsableForLearners(IEnumerable<InteractiveBlock> blocks)
    {
        var list = blocks.ToList();
        return list.Count > 0 && list.All(b => b.Status == "Approved");
    }

    public static string? GetDisplayHtml(InteractiveBlock block)
        => !string.IsNullOrWhiteSpace(block.EditedHtml) ? block.EditedHtml : block.GeneratedHtml;
}

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin,OrgAdmin,SuperAdmin")]
public class AdminInteractiveLessonsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IInteractiveBlockPromptService _promptService;
    private readonly IInteractiveBlockTemplateService _templateService;
    private readonly IInteractiveBlockDisplayService _displayService;
    private readonly IAIAssistantService _aiService;
    private readonly IAzureBlobService _blobService;
    private readonly IStorageQuotaService _storageQuotaService;
    private readonly ILogger<AdminInteractiveLessonsController> _logger;

    public AdminInteractiveLessonsController(
        ApplicationDbContext context,
        IInteractiveBlockPromptService promptService,
        IInteractiveBlockTemplateService templateService,
        IInteractiveBlockDisplayService displayService,
        IAIAssistantService aiService,
        IAzureBlobService azureBlobService,
        IStorageQuotaService storageQuotaService,
        ILogger<AdminInteractiveLessonsController> logger)
    {
        _context = context;
        _promptService = promptService;
        _templateService = templateService;
        _displayService = displayService;
        _aiService = aiService;
        _blobService = azureBlobService;
        _storageQuotaService = storageQuotaService;
        _logger = logger;
    }

    [HttpPost("courses/{courseId}/interactive-lessons")]
    public async Task<ActionResult<InteractiveLessonDetailDto>> CreateInteractiveLesson(
        string courseId,
        [FromBody] CreateInteractiveLessonRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Title is required." });
        }

        var accessError = await ValidateCourseMutationAsync(courseId);
        if (accessError != null)
        {
            return accessError;
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var maxOrdinal = await _context.Lessons
            .Where(l => l.CourseId == courseId)
            .Select(l => (int?)l.Ordinal)
            .MaxAsync() ?? 0;

        var lesson = new Lesson
        {
            CourseId = courseId,
            Title = request.Title.Trim(),
            Content = request.Description,
            Type = "interactive",
            Ordinal = maxOrdinal + 1,
            IsOptional = request.IsOptional,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        var settings = new InteractiveLessonSettings
        {
            Lesson = lesson,
            Description = request.Description,
            LockNextBlockUntilComplete = request.LockNextBlockUntilComplete
        };

        _context.Lessons.Add(lesson);
        _context.InteractiveLessonSettings.Add(settings);
        await _context.SaveChangesAsync();

        return Ok(MapToDetailDto(lesson, settings));
    }

    [HttpGet("interactive-lessons/{lessonId:long}")]
    public async Task<ActionResult<InteractiveLessonDetailDto>> GetInteractiveLesson(long lessonId)
    {
        var loaded = await LoadInteractiveLessonAsync(lessonId);
        if (loaded == null)
        {
            return NotFound();
        }

        var accessError = await ValidateCourseViewAsync(loaded.Value.Lesson.CourseId);
        if (accessError != null)
        {
            return accessError;
        }

        return Ok(MapToDetailDto(loaded.Value.Lesson, loaded.Value.Settings));
    }

    [HttpPut("interactive-lessons/{lessonId:long}")]
    public async Task<ActionResult<InteractiveLessonDetailDto>> UpdateInteractiveLesson(
        long lessonId,
        [FromBody] UpdateInteractiveLessonRequest request)
    {
        var loaded = await LoadInteractiveLessonAsync(lessonId);
        if (loaded == null)
        {
            return NotFound();
        }

        var accessError = await ValidateCourseMutationAsync(loaded.Value.Lesson.CourseId);
        if (accessError != null)
        {
            return accessError;
        }

        if (!string.IsNullOrWhiteSpace(request.Title))
        {
            loaded.Value.Lesson.Title = request.Title.Trim();
        }

        if (request.Description != null)
        {
            loaded.Value.Lesson.Content = request.Description;
            loaded.Value.Settings.Description = request.Description;
        }

        if (request.IsOptional.HasValue)
        {
            loaded.Value.Lesson.IsOptional = request.IsOptional.Value;
        }

        if (request.LockNextBlockUntilComplete.HasValue)
        {
            loaded.Value.Settings.LockNextBlockUntilComplete = request.LockNextBlockUntilComplete.Value;
        }

        loaded.Value.Settings.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(MapToDetailDto(loaded.Value.Lesson, loaded.Value.Settings));
    }

    [HttpGet("interactive-lessons/block-types")]
    public ActionResult<IReadOnlyList<InteractiveBlockTypeSchema>> GetBlockTypes()
    {
        return Ok(_promptService.GetAvailableBlockTypes());
    }

    [HttpPost("interactive-lessons/generate-questionnaire-questions")]
    public async Task<ActionResult<GenerateQuestionnaireQuestionsResponse>> GenerateQuestionnaireQuestions(
        [FromBody] GenerateQuestionnaireQuestionsRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ContentDescription))
        {
            return BadRequest(new { message = "Content description is required." });
        }

        if (request.QuestionCount < 1 ||
            request.QuestionCount > InteractiveLessonConstants.EffectiveMaxAiQuestionnaireQuestions)
        {
            return BadRequest(new
            {
                message = $"Question count must be between 1 and {InteractiveLessonConstants.EffectiveMaxAiQuestionnaireQuestions}."
            });
        }

        try
        {
            var generated = await _aiService.GenerateQuestionnaireMcqsAsync(
                request.ContentDescription.Trim(),
                request.QuestionCount);

            return Ok(new GenerateQuestionnaireQuestionsResponse
            {
                Questions = generated.Select(q => new GeneratedQuestionnaireQuestionDto
                {
                    Text = q.Text,
                    Type = q.Type,
                    Options = q.Options.Select(o => new GeneratedQuestionnaireOptionDto
                    {
                        Text = o.Text,
                        IsCorrect = o.IsCorrect
                    }).ToList()
                }).ToList()
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate questionnaire questions");
            return StatusCode(500, new { message = "Failed to generate questions. Please try again." });
        }
    }

    [HttpPost("interactive-lessons/generate-carousel-slides")]
    public async Task<ActionResult<GenerateCarouselSlidesResponse>> GenerateCarouselSlides(
        [FromBody] GenerateCarouselSlidesRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ContentDescription))
        {
            return BadRequest(new { message = "Content description is required." });
        }

        if (request.SlideCount < 1 ||
            request.SlideCount > InteractiveLessonConstants.MaxAiCarouselSlides)
        {
            return BadRequest(new
            {
                message = $"Slide count must be between 1 and {InteractiveLessonConstants.MaxAiCarouselSlides}."
            });
        }

        try
        {
            var generated = await _aiService.GenerateCarouselSlidesAsync(
                request.ContentDescription.Trim(),
                request.SlideCount);

            return Ok(new GenerateCarouselSlidesResponse
            {
                Slides = generated.Select(s => new GeneratedCarouselSlideDto
                {
                    Title = s.Title,
                    Body = s.Body,
                    ImageUrl = s.ImageUrl
                }).ToList()
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate carousel slides");
            return StatusCode(500, new { message = "Failed to generate slides. Please try again." });
        }
    }

    [HttpPost("interactive-lessons/templates/{blockType}/render")]
    public ActionResult<RenderInteractiveBlockTemplateResponse> RenderBlockTemplate(
        string blockType,
        [FromBody] RenderInteractiveBlockTemplateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FormPayloadJson))
        {
            return BadRequest(new { message = "Form payload is required." });
        }

        if (!_templateService.SupportsTemplate(blockType))
        {
            return BadRequest(new { message = $"No fixed template for block type: {blockType}" });
        }

        try
        {
            var blockId = request.BlockId is > 0 ? request.BlockId.Value : 0;
            var (html, _) = _templateService.Render(blockType, blockId, request.FormPayloadJson);
            return Ok(new RenderInteractiveBlockTemplateResponse { Html = html });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (FileNotFoundException ex)
        {
            _logger.LogError(ex, "Template file missing for {BlockType}", blockType);
            return StatusCode(500, new { message = "Block template is not available." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to render {BlockType} template", blockType);
            return StatusCode(500, new { message = "Failed to render block preview." });
        }
    }

    [HttpPost("interactive-lessons/generate-accordion-panels")]
    public async Task<ActionResult<GenerateAccordionPanelsResponse>> GenerateAccordionPanels(
        [FromBody] GenerateAccordionPanelsRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ContentDescription))
        {
            return BadRequest(new { message = "Content description is required." });
        }

        if (request.PanelCount < 1 ||
            request.PanelCount > InteractiveLessonConstants.MaxAiAccordionPanels)
        {
            return BadRequest(new
            {
                message = $"Panel count must be between 1 and {InteractiveLessonConstants.MaxAiAccordionPanels}."
            });
        }

        try
        {
            var generated = await _aiService.GenerateAccordionPanelsAsync(
                request.ContentDescription.Trim(),
                request.PanelCount);

            return Ok(new GenerateAccordionPanelsResponse
            {
                Panels = generated.Select(p => new GeneratedAccordionPanelDto
                {
                    Title = p.Title,
                    Body = p.Body
                }).ToList()
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate accordion panels");
            return StatusCode(500, new { message = "Failed to generate panels. Please try again." });
        }
    }

    [HttpPost("interactive-lessons/{lessonId:long}/blocks")]
    public async Task<ActionResult<InteractiveBlockDto>> CreateBlock(
        long lessonId,
        [FromBody] SaveInteractiveBlockRequest request)
    {
        var loaded = await LoadInteractiveLessonAsync(lessonId);
        if (loaded == null)
        {
            return NotFound();
        }

        var accessError = await ValidateCourseMutationAsync(loaded.Value.Lesson.CourseId);
        if (accessError != null)
        {
            return accessError;
        }

        if (loaded.Value.Settings.Blocks.Count >= InteractiveLessonHelper.MaxBlocksPerLesson)
        {
            return BadRequest(new { message = $"A maximum of {InteractiveLessonHelper.MaxBlocksPerLesson} blocks is allowed per interactive lesson." });
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Block title is required." });
        }

        if (string.IsNullOrWhiteSpace(request.BlockType))
        {
            return BadRequest(new { message = "Block type is required." });
        }

        if (_promptService.GetBlockTypeSchema(request.BlockType) == null)
        {
            return BadRequest(new { message = "Unsupported block type." });
        }

        try
        {
            _promptService.ValidateFormPayload(request.BlockType, request.FormPayloadJson ?? "{}");
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var block = new InteractiveBlock
        {
            InteractiveLessonSettingsId = loaded.Value.Settings.Id,
            Ordinal = loaded.Value.Settings.Blocks.Count > 0
                ? loaded.Value.Settings.Blocks.Max(b => b.Ordinal) + 1
                : 1,
            BlockType = request.BlockType.ToLowerInvariant(),
            Title = request.Title.Trim(),
            Status = "Draft",
            FormPayloadJson = request.FormPayloadJson,
            MediaAssetsJson = request.MediaAssetsJson ?? "[]"
        };

        _context.InteractiveBlocks.Add(block);
        await _context.SaveChangesAsync();

        return Ok(MapBlockDto(block));
    }

    [HttpPut("interactive-lessons/{lessonId:long}/blocks/{blockId:long}")]
    public async Task<ActionResult<InteractiveBlockDto>> UpdateBlock(
        long lessonId,
        long blockId,
        [FromBody] SaveInteractiveBlockRequest request)
    {
        var block = await GetBlockForLessonAsync(lessonId, blockId);
        if (block == null)
        {
            return NotFound();
        }

        var lesson = block.InteractiveLessonSettings!.Lesson!;
        var accessError = await ValidateCourseMutationAsync(lesson.CourseId);
        if (accessError != null)
        {
            return accessError;
        }

        if (!string.IsNullOrWhiteSpace(request.Title))
        {
            block.Title = request.Title.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.BlockType))
        {
            block.BlockType = request.BlockType.ToLowerInvariant();
        }

        if (request.FormPayloadJson != null)
        {
            try
            {
                _promptService.ValidateFormPayload(block.BlockType, request.FormPayloadJson);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }

            block.FormPayloadJson = request.FormPayloadJson;
        }

        if (request.MediaAssetsJson != null)
        {
            block.MediaAssetsJson = request.MediaAssetsJson;
        }

        if (block.Status == "Approved")
        {
            block.Status = "Draft";
            block.ApprovedAt = null;
        }

        block.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(MapBlockDto(block));
    }

    [HttpDelete("interactive-lessons/{lessonId:long}/blocks/{blockId:long}")]
    public async Task<IActionResult> DeleteBlock(long lessonId, long blockId)
    {
        var block = await GetBlockForLessonAsync(lessonId, blockId);
        if (block == null)
        {
            return NotFound();
        }

        var lesson = block.InteractiveLessonSettings!.Lesson!;
        var accessError = await ValidateCourseMutationAsync(lesson.CourseId);
        if (accessError != null)
        {
            return accessError;
        }

        _context.InteractiveBlocks.Remove(block);
        await _context.SaveChangesAsync();

        var remaining = await _context.InteractiveBlocks
            .Where(b => b.InteractiveLessonSettingsId == block.InteractiveLessonSettingsId)
            .OrderBy(b => b.Ordinal)
            .ToListAsync();

        for (var i = 0; i < remaining.Count; i++)
        {
            remaining[i].Ordinal = i + 1;
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("interactive-lessons/{lessonId:long}/blocks/reorder")]
    public async Task<ActionResult<List<InteractiveBlockDto>>> ReorderBlocks(
        long lessonId,
        [FromBody] ReorderInteractiveBlocksRequest request)
    {
        var loaded = await LoadInteractiveLessonAsync(lessonId);
        if (loaded == null)
        {
            return NotFound();
        }

        var accessError = await ValidateCourseMutationAsync(loaded.Value.Lesson.CourseId);
        if (accessError != null)
        {
            return accessError;
        }

        var blocks = loaded.Value.Settings.Blocks.ToDictionary(b => b.Id);
        if (request.BlockIds.Count != blocks.Count || request.BlockIds.Any(id => !blocks.ContainsKey(id)))
        {
            return BadRequest(new { message = "Invalid block order." });
        }

        for (var i = 0; i < request.BlockIds.Count; i++)
        {
            blocks[request.BlockIds[i]].Ordinal = i + 1;
            blocks[request.BlockIds[i]].UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        var ordered = blocks.Values.OrderBy(b => b.Ordinal).Select(MapBlockDto).ToList();
        return Ok(ordered);
    }

    [HttpPost("interactive-lessons/{lessonId:long}/blocks/{blockId:long}/generate")]
    public async Task<ActionResult<InteractiveBlockDto>> GenerateBlock(long lessonId, long blockId)
    {
        return await GenerateBlockInternalAsync(lessonId, blockId, isRegenerate: false);
    }

    [HttpPost("interactive-lessons/{lessonId:long}/blocks/{blockId:long}/regenerate")]
    public async Task<ActionResult<InteractiveBlockDto>> RegenerateBlock(long lessonId, long blockId)
    {
        return await GenerateBlockInternalAsync(lessonId, blockId, isRegenerate: true);
    }

    [HttpPut("interactive-lessons/{lessonId:long}/blocks/{blockId:long}/html")]
    public async Task<ActionResult<InteractiveBlockDto>> UpdateBlockHtml(
        long lessonId,
        long blockId,
        [FromBody] UpdateInteractiveBlockHtmlRequest request)
    {
        var block = await GetBlockForLessonAsync(lessonId, blockId);
        if (block == null)
        {
            return NotFound();
        }

        var lesson = block.InteractiveLessonSettings!.Lesson!;
        var accessError = await ValidateCourseMutationAsync(lesson.CourseId);
        if (accessError != null)
        {
            return accessError;
        }

        if (string.IsNullOrWhiteSpace(request.Html))
        {
            return BadRequest(new { message = "HTML content is required." });
        }

        if (_templateService.SupportsTemplate(block.BlockType))
        {
            return BadRequest(new
            {
                message = "This block uses a fixed system template. Edit the form content instead of HTML."
            });
        }

        block.EditedHtml = request.Html;
        if (block.Status == "Approved")
        {
            block.Status = "Draft";
            block.ApprovedAt = null;
        }
        else if (block.Status == "Draft" && !string.IsNullOrWhiteSpace(block.GeneratedHtml))
        {
            block.Status = "Generated";
        }

        block.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(MapBlockDto(block));
    }

    [HttpPost("interactive-lessons/{lessonId:long}/blocks/{blockId:long}/approve")]
    public async Task<ActionResult<InteractiveBlockDto>> ApproveBlock(long lessonId, long blockId)
    {
        var block = await GetBlockForLessonAsync(lessonId, blockId);
        if (block == null)
        {
            return NotFound();
        }

        var lesson = block.InteractiveLessonSettings!.Lesson!;
        var accessError = await ValidateCourseMutationAsync(lesson.CourseId);
        if (accessError != null)
        {
            return accessError;
        }

        if (string.IsNullOrWhiteSpace(_displayService.GetDisplayHtml(block)))
        {
            return BadRequest(new { message = "Block must be generated before approval." });
        }

        block.Status = "Approved";
        block.ApprovedAt = DateTime.UtcNow;
        block.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(MapBlockDto(block));
    }

    [HttpPost("interactive-lessons/{lessonId:long}/blocks/{blockId:long}/unapprove")]
    public async Task<ActionResult<InteractiveBlockDto>> UnapproveBlock(long lessonId, long blockId)
    {
        var block = await GetBlockForLessonAsync(lessonId, blockId);
        if (block == null)
        {
            return NotFound();
        }

        var lesson = block.InteractiveLessonSettings!.Lesson!;
        var accessError = await ValidateCourseMutationAsync(lesson.CourseId);
        if (accessError != null)
        {
            return accessError;
        }

        block.Status = string.IsNullOrWhiteSpace(_displayService.GetDisplayHtml(block)) ? "Draft" : "Generated";
        block.ApprovedAt = null;
        block.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(MapBlockDto(block));
    }

    [HttpPost("interactive-lessons/{lessonId:long}/blocks/{blockId:long}/media")]
    public async Task<ActionResult<InteractiveBlockMediaUploadResponse>> UploadBlockMedia(
        long lessonId,
        long blockId,
        IFormFile file)
    {
        var block = await GetBlockForLessonAsync(lessonId, blockId);
        if (block == null)
        {
            return NotFound();
        }

        var lesson = block.InteractiveLessonSettings!.Lesson!;
        var accessError = await ValidateCourseMutationAsync(lesson.CourseId);
        if (accessError != null)
        {
            return accessError;
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "File is required." });
        }

        if (!_blobService.IsConfigured())
        {
            return StatusCode(500, new { message = "Azure Blob Storage is not configured." });
        }

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await _context.Users.FindAsync(userId);
        if (user?.OrganisationID == null)
        {
            return BadRequest(new { message = "User organisation not found." });
        }

        var (hasQuota, quotaMessage, _) = await _storageQuotaService.CheckQuotaAsync(user.OrganisationID.Value, file.Length, "content");
        if (!hasQuota)
        {
            return BadRequest(new { message = quotaMessage });
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var imageExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg" };
        var videoExtensions = new[] { ".mp4", ".webm", ".mov", ".avi", ".mkv", ".wmv" };
        var isVideoBlock = string.Equals(block.BlockType, "video", StringComparison.OrdinalIgnoreCase);
        var allowed = isVideoBlock ? videoExtensions : imageExtensions;
        if (!allowed.Contains(extension))
        {
            return BadRequest(new
            {
                message = isVideoBlock
                    ? "Only video files are allowed (MP4, WebM, MOV, AVI, MKV, WMV)."
                    : "Only image files are allowed."
            });
        }

        var blobPath = $"interactive-lessons/{lessonId}/blocks/{blockId}";
        await using var stream = file.OpenReadStream();
        var url = await _blobService.UploadToCustomPathAsync(
            stream,
            $"{Guid.NewGuid():N}{extension}",
            blobPath,
            file.ContentType,
            organisationId: user.OrganisationID.Value);

        var assets = ParseMediaAssets(block.MediaAssetsJson);
        assets.Add(new JsonObject
        {
            ["url"] = url,
            ["fileName"] = file.FileName,
            ["contentType"] = file.ContentType
        });
        block.MediaAssetsJson = assets.ToJsonString();
        block.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new InteractiveBlockMediaUploadResponse
        {
            Url = url,
            FileName = file.FileName,
            MediaAssetsJson = block.MediaAssetsJson
        });
    }

    private async Task<ActionResult<InteractiveBlockDto>> GenerateBlockInternalAsync(long lessonId, long blockId, bool isRegenerate)
    {
        var block = await GetBlockForLessonAsync(lessonId, blockId);
        if (block == null)
        {
            return NotFound();
        }

        var lesson = block.InteractiveLessonSettings!.Lesson!;
        var accessError = await ValidateCourseMutationAsync(lesson.CourseId);
        if (accessError != null)
        {
            return accessError;
        }

        if (string.IsNullOrWhiteSpace(block.FormPayloadJson))
        {
            return BadRequest(new { message = "Block form data is required before generation." });
        }

        try
        {
            string html;
            string completionRule;

            if (_templateService.SupportsTemplate(block.BlockType))
            {
                (html, completionRule) = _templateService.Render(
                    block.BlockType,
                    block.Id,
                    block.FormPayloadJson);

                block.Status = "Generating";
                block.CompletionRuleJson = completionRule;
                await _context.SaveChangesAsync();
            }
            else
            {
                var (completionRuleFromPrompt, prompt) = _promptService.BuildGenerationPrompt(
                    block.BlockType,
                    block.Title,
                    block.FormPayloadJson,
                    block.MediaAssetsJson);

                var promptWithBlockId = prompt + $"\n\nBlock id for postMessage: {block.Id}";

                block.Status = "Generating";
                block.CompletionRuleJson = completionRuleFromPrompt;
                await _context.SaveChangesAsync();

                html = await _aiService.GenerateInteractiveBlockHtmlAsync(promptWithBlockId);
            }

            block.GeneratedHtml = html;
            // Template-backed blocks must never keep stale custom HTML overrides.
            if (isRegenerate || _templateService.SupportsTemplate(block.BlockType))
            {
                block.EditedHtml = null;
            }

            block.Status = "Generated";
            block.ApprovedAt = null;
            block.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(MapBlockDto(block));
        }
        catch (ArgumentException ex)
        {
            block.Status = "Draft";
            await _context.SaveChangesAsync();
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate interactive block {BlockId}", blockId);
            block.Status = "Draft";
            await _context.SaveChangesAsync();
            return StatusCode(500, new { message = "Failed to generate block content. Your form data has been preserved." });
        }
    }

    private async Task<(Lesson Lesson, InteractiveLessonSettings Settings)?> LoadInteractiveLessonAsync(long lessonId)
    {
        var settings = await _context.InteractiveLessonSettings
            .Include(s => s.Lesson)
            .Include(s => s.Blocks.OrderBy(b => b.Ordinal))
            .FirstOrDefaultAsync(s => s.LessonId == lessonId);

        if (settings?.Lesson == null || !string.Equals(settings.Lesson.Type, "interactive", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return (settings.Lesson, settings);
    }

    private async Task<InteractiveBlock?> GetBlockForLessonAsync(long lessonId, long blockId)
    {
        return await _context.InteractiveBlocks
            .Include(b => b.InteractiveLessonSettings!)
            .ThenInclude(s => s.Lesson)
            .FirstOrDefaultAsync(b => b.Id == blockId && b.InteractiveLessonSettings!.LessonId == lessonId);
    }

    private async Task<ActionResult?> ValidateCourseMutationAsync(string courseId)
    {
        var course = await _context.Courses.FindAsync(courseId);
        if (course == null)
        {
            return NotFound(new { message = "Course not found." });
        }

        if (course.Status == "Published")
        {
            return BadRequest(new { message = "Cannot modify interactive lessons on a published course." });
        }

        return await ValidateCourseViewAsync(courseId);
    }

    private async Task<ActionResult?> ValidateCourseViewAsync(string courseId)
    {
        var course = await _context.Courses.FindAsync(courseId);
        if (course == null)
        {
            return NotFound(new { message = "Course not found." });
        }

        if (User.IsInRole("OrgAdmin"))
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.FindAsync(userId);
            var role = User.FindFirstValue(ClaimTypes.Role);
            if (!OrganisationContentAccess.CanViewCourse(course.OrganisationId, role, user?.OrganisationID))
            {
                return Forbid();
            }
        }

        return null;
    }

    private InteractiveLessonDetailDto MapToDetailDto(Lesson lesson, InteractiveLessonSettings settings)
    {
        var blocks = settings.Blocks.OrderBy(b => b.Ordinal).Select(MapBlockDto).ToList();
        return new InteractiveLessonDetailDto
        {
            LessonId = lesson.Id,
            CourseId = lesson.CourseId,
            Title = lesson.Title,
            Description = settings.Description,
            IsOptional = lesson.IsOptional,
            Ordinal = lesson.Ordinal,
            LockNextBlockUntilComplete = settings.LockNextBlockUntilComplete,
            Status = InteractiveLessonHelper.ComputeStatus(settings.Blocks),
            Blocks = blocks
        };
    }

    private InteractiveBlockDto MapBlockDto(InteractiveBlock block) => new()
    {
        Id = block.Id,
        Ordinal = block.Ordinal,
        BlockType = block.BlockType,
        Title = block.Title,
        Status = block.Status,
        FormPayloadJson = block.FormPayloadJson,
        GeneratedHtml = block.GeneratedHtml,
        EditedHtml = block.EditedHtml,
        DisplayHtml = _displayService.GetDisplayHtml(block),
        CompletionRuleJson = block.CompletionRuleJson,
        MediaAssetsJson = block.MediaAssetsJson,
        CreatedAt = block.CreatedAt,
        UpdatedAt = block.UpdatedAt,
        ApprovedAt = block.ApprovedAt
    };

    private static JsonArray ParseMediaAssets(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new JsonArray();
        }

        try
        {
            return JsonNode.Parse(json) as JsonArray ?? new JsonArray();
        }
        catch
        {
            return new JsonArray();
        }
    }
}

public class CreateInteractiveLessonRequest
{
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsOptional { get; set; }
    public bool LockNextBlockUntilComplete { get; set; } = true;
}

public class UpdateInteractiveLessonRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public bool? IsOptional { get; set; }
    public bool? LockNextBlockUntilComplete { get; set; }
}

public class SaveInteractiveBlockRequest
{
    public string? Title { get; set; }
    public string? BlockType { get; set; }
    public string? FormPayloadJson { get; set; }
    public string? MediaAssetsJson { get; set; }
}

public class ReorderInteractiveBlocksRequest
{
    public List<long> BlockIds { get; set; } = new();
}

public class UpdateInteractiveBlockHtmlRequest
{
    public string Html { get; set; } = null!;
}

public class InteractiveLessonDetailDto
{
    public long LessonId { get; set; }
    public string CourseId { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsOptional { get; set; }
    public int Ordinal { get; set; }
    public bool LockNextBlockUntilComplete { get; set; }
    public string Status { get; set; } = "Draft";
    public List<InteractiveBlockDto> Blocks { get; set; } = new();
}

public class InteractiveBlockDto
{
    public long Id { get; set; }
    public int Ordinal { get; set; }
    public string BlockType { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Status { get; set; } = null!;
    public string? FormPayloadJson { get; set; }
    public string? GeneratedHtml { get; set; }
    public string? EditedHtml { get; set; }
    public string? DisplayHtml { get; set; }
    public string? CompletionRuleJson { get; set; }
    public string? MediaAssetsJson { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? ApprovedAt { get; set; }
}

public class InteractiveBlockMediaUploadResponse
{
    public string Url { get; set; } = null!;
    public string FileName { get; set; } = null!;
    public string? MediaAssetsJson { get; set; }
}

public class GenerateQuestionnaireQuestionsRequest
{
    public string ContentDescription { get; set; } = null!;
    public int QuestionCount { get; set; }
}

public class GenerateQuestionnaireQuestionsResponse
{
    public List<GeneratedQuestionnaireQuestionDto> Questions { get; set; } = new();
}

public class GeneratedQuestionnaireQuestionDto
{
    public string Text { get; set; } = null!;
    public string Type { get; set; } = "single";
    public List<GeneratedQuestionnaireOptionDto> Options { get; set; } = new();
}

public class GeneratedQuestionnaireOptionDto
{
    public string Text { get; set; } = null!;
    public bool IsCorrect { get; set; }
}

public class GenerateCarouselSlidesRequest
{
    public string ContentDescription { get; set; } = null!;
    public int SlideCount { get; set; }
}

public class RenderInteractiveBlockTemplateRequest
{
    public string FormPayloadJson { get; set; } = null!;
    public long? BlockId { get; set; }
}

public class RenderInteractiveBlockTemplateResponse
{
    public string Html { get; set; } = null!;
}

public class GenerateCarouselSlidesResponse
{
    public List<GeneratedCarouselSlideDto> Slides { get; set; } = new();
}

public class GeneratedCarouselSlideDto
{
    public string Title { get; set; } = null!;
    public string Body { get; set; } = null!;
    public string ImageUrl { get; set; } = string.Empty;
}

public class GenerateAccordionPanelsRequest
{
    public string ContentDescription { get; set; } = null!;
    public int PanelCount { get; set; }
}

public class GenerateAccordionPanelsResponse
{
    public List<GeneratedAccordionPanelDto> Panels { get; set; } = new();
}

public class GeneratedAccordionPanelDto
{
    public string Title { get; set; } = null!;
    public string Body { get; set; } = null!;
}
