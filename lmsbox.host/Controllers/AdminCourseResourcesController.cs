using lmsbox.domain.Models;
using lmsbox.infrastructure.Data;
using lmsBox.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/admin/courses/{courseId}/resources")]
[Authorize(Roles = "Admin,OrgAdmin,TenantAdmin,SuperAdmin")]
public class AdminCourseResourcesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAzureBlobService _blobService;
    private readonly IStorageQuotaService _storageQuotaService;
    private readonly ILogger<AdminCourseResourcesController> _logger;

    private static readonly string[] ValidResourceTypes = ["pdf", "html", "video"];

    public AdminCourseResourcesController(
        ApplicationDbContext context,
        IAzureBlobService blobService,
        IStorageQuotaService storageQuotaService,
        ILogger<AdminCourseResourcesController> logger)
    {
        _context = context;
        _blobService = blobService;
        _storageQuotaService = storageQuotaService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<CourseResourceDetailDto>>> GetResources(string courseId)
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
                .Include(c => c.Resources.OrderBy(r => r.Ordinal))
                .FirstOrDefaultAsync(c => c.Id == courseId);

            if (course == null)
            {
                return NotFound(new { message = "Course not found" });
            }

            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != course.OrganisationId)
                {
                    return Forbid();
                }
            }

            var resources = new List<CourseResourceDetailDto>();
            foreach (var resource in course.Resources)
            {
                var dto = MapToDto(resource);
                if (!string.IsNullOrEmpty(resource.ThumbnailUrl))
                {
                    dto.ThumbnailUrl = await _blobService.GetSasUrlAsync(resource.ThumbnailUrl, 24);
                }
                resources.Add(dto);
            }
            return Ok(resources);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting resources for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while retrieving resources" });
        }
    }

    [HttpGet("{resourceId}")]
    public async Task<ActionResult<CourseResourceDetailDto>> GetResource(string courseId, long resourceId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            var resource = await _context.CourseResources
                .Include(r => r.Course)
                .FirstOrDefaultAsync(r => r.Id == resourceId && r.CourseId == courseId);

            if (resource == null)
            {
                return NotFound(new { message = "Resource not found" });
            }

            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != resource.Course?.OrganisationId)
                {
                    return Forbid();
                }
            }

            var dto = MapToDto(resource);
            await ApplySasTokensAsync(dto, resource);
            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting resource {ResourceId} for course {CourseId}", resourceId, courseId);
            return StatusCode(500, new { message = "An error occurred while retrieving the resource" });
        }
    }

    [HttpPost]
    public async Task<ActionResult<CourseResourceDetailDto>> CreateResource(string courseId, [FromBody] CreateCourseResourceRequest request)
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

            // Resources are supplementary (not part of the lesson sequence), so they may be
            // added even when the course is published.

            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != course.OrganisationId)
                {
                    return Forbid();
                }
            }

            var validationError = ValidateResourceRequest(request);
            if (validationError != null)
            {
                return validationError;
            }

            var resource = new CourseResource
            {
                CourseId = courseId,
                Title = request.Title.Trim(),
                Description = request.Description?.Trim(),
                Ordinal = request.Ordinal > 0
                    ? request.Ordinal
                    : (await _context.CourseResources.Where(r => r.CourseId == courseId).MaxAsync(r => (int?)r.Ordinal) ?? 0) + 1,
                Type = request.Type,
                VideoUrl = request.VideoUrl,
                DocumentUrl = request.DocumentUrl,
                HtmlContent = request.HtmlContent,
                HtmlUrl = request.HtmlUrl,
                ThumbnailUrl = request.ThumbnailUrl,
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.CourseResources.Add(resource);
            course.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(MapToDto(resource));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating resource for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while creating the resource" });
        }
    }

    [HttpPut("{resourceId}")]
    public async Task<ActionResult<CourseResourceDetailDto>> UpdateResource(
        string courseId,
        long resourceId,
        [FromBody] UpdateCourseResourceRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            var resource = await _context.CourseResources
                .Include(r => r.Course)
                .FirstOrDefaultAsync(r => r.Id == resourceId && r.CourseId == courseId);

            if (resource == null)
            {
                return NotFound(new { message = "Resource not found" });
            }

            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != resource.Course?.OrganisationId)
                {
                    return Forbid();
                }
            }

            var validationError = ValidateResourceRequest(request);
            if (validationError != null)
            {
                return validationError;
            }

            resource.Title = request.Title.Trim();
            resource.Description = request.Description?.Trim();
            resource.Ordinal = request.Ordinal;
            resource.Type = request.Type;
            resource.VideoUrl = request.VideoUrl;
            resource.DocumentUrl = request.DocumentUrl;
            resource.HtmlContent = request.HtmlContent;
            resource.HtmlUrl = request.HtmlUrl;
            resource.ThumbnailUrl = request.ThumbnailUrl;

            if (resource.Course != null)
            {
                resource.Course.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return Ok(MapToDto(resource));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating resource {ResourceId} for course {CourseId}", resourceId, courseId);
            return StatusCode(500, new { message = "An error occurred while updating the resource" });
        }
    }

    [HttpDelete("{resourceId}")]
    public async Task<IActionResult> DeleteResource(string courseId, long resourceId)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            var resource = await _context.CourseResources
                .Include(r => r.Course)
                .FirstOrDefaultAsync(r => r.Id == resourceId && r.CourseId == courseId);

            if (resource == null)
            {
                return NotFound(new { message = "Resource not found" });
            }

            if (userRole == "OrgAdmin")
            {
                var user = await _context.Users.FindAsync(userId);
                if (user?.OrganisationID != resource.Course?.OrganisationId)
                {
                    return Forbid();
                }
            }

            _context.CourseResources.Remove(resource);
            if (resource.Course != null)
            {
                resource.Course.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Resource deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting resource {ResourceId} for course {CourseId}", resourceId, courseId);
            return StatusCode(500, new { message = "An error occurred while deleting the resource" });
        }
    }

    [HttpPost("upload-video")]
    [RequestSizeLimit(524_288_000)]
    public async Task<ActionResult<ResourceVideoUploadResponse>> UploadVideo(string courseId, IFormFile video)
    {
        return await UploadMediaAsync(courseId, video, "video", [".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".webm"], url => new ResourceVideoUploadResponse { VideoUrl = url });
    }

    [HttpPost("upload-pdf")]
    [RequestSizeLimit(104_857_600)]
    public async Task<ActionResult<ResourceDocumentUploadResponse>> UploadPdf(string courseId, IFormFile pdf)
    {
        if (pdf != null && pdf.ContentType != "application/pdf")
        {
            return BadRequest(new { message = "Invalid file type. Only PDF documents are allowed." });
        }

        return await UploadMediaAsync(courseId, pdf, "pdf", [".pdf"], url => new ResourceDocumentUploadResponse { DocumentUrl = url });
    }

    [HttpPost("upload-thumbnail")]
    [RequestSizeLimit(10_485_760)]
    public async Task<ActionResult<ResourceThumbnailUploadResponse>> UploadThumbnail(string courseId, IFormFile thumbnail)
    {
        return await UploadMediaAsync(
            courseId,
            thumbnail,
            "thumbnail",
            [".jpg", ".jpeg", ".png", ".gif", ".webp"],
            url => new ResourceThumbnailUploadResponse { ThumbnailUrl = url });
    }

    [HttpPost("html")]
    public async Task<ActionResult<ResourceHtmlUploadResponse>> UploadHtmlContent(string courseId, [FromBody] UploadResourceHtmlRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userRole = User.FindFirstValue(ClaimTypes.Role);

            if (request == null || string.IsNullOrWhiteSpace(request.HtmlContent))
            {
                return BadRequest(new { message = "HTML content is required" });
            }

            if (string.IsNullOrWhiteSpace(request.Title))
            {
                return BadRequest(new { message = "Title is required" });
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
                    return Forbid();
                }
            }

            if (!_blobService.IsConfigured())
            {
                return StatusCode(501, new { message = "Azure Blob Storage is not configured." });
            }

            var htmlBytes = System.Text.Encoding.UTF8.GetBytes(request.HtmlContent);
            var (hasQuota, quotaMessage, _) = await _storageQuotaService.CheckQuotaAsync(course.OrganisationId, htmlBytes.Length, "content");
            if (!hasQuota)
            {
                return BadRequest(new { message = quotaMessage });
            }

            var sanitizedTitle = string.Join("_", request.Title.Split(Path.GetInvalidFileNameChars()));
            var fileName = $"{sanitizedTitle}_{Guid.NewGuid()}.html";

            using var stream = new MemoryStream(htmlBytes);
            var htmlUrl = await _blobService.UploadFileAsync(stream, fileName, course.OrganisationId.ToString(), "text/html");

            return Ok(new ResourceHtmlUploadResponse { HtmlUrl = htmlUrl });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading HTML resource for course {CourseId}", courseId);
            return StatusCode(500, new { message = "An error occurred while uploading HTML content" });
        }
    }

    private async Task<ActionResult<T>> UploadMediaAsync<T>(
        string courseId,
        IFormFile? file,
        string fileCategory,
        string[] allowedExtensions,
        Func<string, T> mapResponse) where T : class
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
                    return Forbid();
                }
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file provided" });
            }

            var extension = Path.GetExtension(file.FileName).ToLower();
            if (!allowedExtensions.Contains(extension))
            {
                return BadRequest(new { message = $"Invalid file format. Allowed: {string.Join(", ", allowedExtensions)}" });
            }

            if (!_blobService.IsConfigured())
            {
                return StatusCode(501, new { message = "Azure Blob Storage is not configured." });
            }

            var uniqueFileName = $"{Guid.NewGuid()}{extension}";
            using var stream = file.OpenReadStream();
            var blobUrl = await _blobService.UploadFileAsync(stream, uniqueFileName, course.OrganisationId.ToString(), file.ContentType);

            return Ok(mapResponse(blobUrl));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading {Category} resource for course {CourseId}", fileCategory, courseId);
            return StatusCode(500, new { message = "An error occurred while uploading the file" });
        }
    }

    private static CourseResourceDetailDto MapToDto(CourseResource resource) => new()
    {
        Id = resource.Id,
        CourseId = resource.CourseId,
        Title = resource.Title,
        Description = resource.Description,
        Ordinal = resource.Ordinal,
        Type = resource.Type,
        VideoUrl = resource.VideoUrl,
        DocumentUrl = resource.DocumentUrl,
        HtmlContent = resource.HtmlContent,
        HtmlUrl = resource.HtmlUrl,
        ThumbnailUrl = resource.ThumbnailUrl,
        CreatedAt = resource.CreatedAt
    };

    private async Task ApplySasTokensAsync(CourseResourceDetailDto dto, CourseResource resource)
    {
        if (!string.IsNullOrEmpty(resource.VideoUrl))
        {
            dto.VideoUrl = await _blobService.GetSasUrlAsync(resource.VideoUrl, 24);
        }

        if (!string.IsNullOrEmpty(resource.DocumentUrl))
        {
            dto.DocumentUrl = await _blobService.GetSasUrlAsync(resource.DocumentUrl, 24);
        }

        if (!string.IsNullOrEmpty(resource.HtmlUrl))
        {
            dto.HtmlUrl = await _blobService.GetSasUrlAsync(resource.HtmlUrl, 24);
        }

        if (!string.IsNullOrEmpty(resource.ThumbnailUrl))
        {
            dto.ThumbnailUrl = await _blobService.GetSasUrlAsync(resource.ThumbnailUrl, 24);
        }
    }

    private static ActionResult? ValidateResourceRequest(CreateCourseResourceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return new BadRequestObjectResult(new { message = "Title is required" });
        }

        if (!ValidResourceTypes.Contains(request.Type))
        {
            return new BadRequestObjectResult(new
            {
                message = $"Invalid resource type. Must be one of: {string.Join(", ", ValidResourceTypes)}"
            });
        }

        return request.Type switch
        {
            "video" when string.IsNullOrWhiteSpace(request.VideoUrl) =>
                new BadRequestObjectResult(new { message = "Video URL is required for video resources" }),
            "pdf" when string.IsNullOrWhiteSpace(request.DocumentUrl) =>
                new BadRequestObjectResult(new { message = "Document URL is required for PDF resources" }),
            "html" when string.IsNullOrWhiteSpace(request.HtmlUrl) && string.IsNullOrWhiteSpace(request.HtmlContent) =>
                new BadRequestObjectResult(new { message = "HTML content or URL is required for HTML resources" }),
            _ => null
        };
    }
}

public class CourseResourceDetailDto
{
    public long Id { get; set; }
    public string CourseId { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public int Ordinal { get; set; }
    public string Type { get; set; } = null!;
    public string? VideoUrl { get; set; }
    public string? DocumentUrl { get; set; }
    public string? HtmlContent { get; set; }
    public string? HtmlUrl { get; set; }
    public string? ThumbnailUrl { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateCourseResourceRequest
{
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public int Ordinal { get; set; }
    public string Type { get; set; } = "pdf";
    public string? VideoUrl { get; set; }
    public string? DocumentUrl { get; set; }
    public string? HtmlContent { get; set; }
    public string? HtmlUrl { get; set; }
    public string? ThumbnailUrl { get; set; }
}

public class UpdateCourseResourceRequest : CreateCourseResourceRequest
{
}

public class UploadResourceHtmlRequest
{
    public string Title { get; set; } = null!;
    public string HtmlContent { get; set; } = null!;
}

public class ResourceVideoUploadResponse
{
    public string VideoUrl { get; set; } = null!;
}

public class ResourceDocumentUploadResponse
{
    public string DocumentUrl { get; set; } = null!;
}

public class ResourceHtmlUploadResponse
{
    public string HtmlUrl { get; set; } = null!;
}

public class ResourceThumbnailUploadResponse
{
    public string ThumbnailUrl { get; set; } = null!;
}
