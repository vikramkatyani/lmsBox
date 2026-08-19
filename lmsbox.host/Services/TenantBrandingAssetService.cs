using lmsbox.domain.Models;

namespace lmsBox.Server.Services;

public class TenantBrandingAssetService
{
    private static readonly HashSet<string> AllowedExtensions =
        [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico"];

    private readonly IAzureBlobService _blobService;
    private readonly IWebHostEnvironment _environment;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<TenantBrandingAssetService> _logger;

    public TenantBrandingAssetService(
        IAzureBlobService blobService,
        IWebHostEnvironment environment,
        IHttpContextAccessor httpContextAccessor,
        ILogger<TenantBrandingAssetService> logger)
    {
        _blobService = blobService;
        _environment = environment;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    public async Task<string> SaveAsync(Tenant tenant, IFormFile file, string assetType)
    {
        var normalizedType = NormalizeAssetType(assetType);
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
        {
            throw new InvalidOperationException($"Invalid image format. Allowed: {string.Join(", ", AllowedExtensions)}");
        }

        if (file.Length > 10_485_760)
        {
            throw new InvalidOperationException("Image file size must be less than 10 MB");
        }

        var fileName = $"{normalizedType}_{Guid.NewGuid():N}{extension}";
        string url;

        if (_blobService.IsConfigured())
        {
            var folder = $"tenants/{tenant.Code}";
            using var stream = file.OpenReadStream();
            url = await _blobService.UploadToBrandingContainerAsync(
                stream,
                fileName,
                folder,
                file.ContentType,
                organisationId: null);
        }
        else
        {
            url = await SaveLocalAsync(tenant.Code, fileName, file);
            _logger.LogInformation("Saved tenant branding asset locally for {TenantCode}: {Url}", tenant.Code, url);
        }

        switch (normalizedType)
        {
            case "logo":
                tenant.BannerUrl = url;
                break;
            case "favicon":
                tenant.FaviconUrl = url;
                break;
            case "loginhero":
                tenant.LoginHeroUrl = url;
                break;
        }

        return url;
    }

    public static string NormalizeAssetType(string? assetType)
    {
        var value = (assetType ?? "").Trim().ToLowerInvariant();
        return value switch
        {
            "banner" or "logo" => "logo",
            "favicon" => "favicon",
            "loginhero" or "hero" or "login-hero" => "loginhero",
            _ => throw new InvalidOperationException("assetType must be logo, favicon, or loginHero")
        };
    }

    private async Task<string> SaveLocalAsync(string tenantCode, string fileName, IFormFile file)
    {
        var webRoot = _environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRoot))
        {
            webRoot = Path.Combine(_environment.ContentRootPath, "wwwroot");
        }

        var folder = Path.Combine(webRoot, "uploads", "tenants", tenantCode);
        Directory.CreateDirectory(folder);
        var fullPath = Path.Combine(folder, fileName);
        await using (var stream = File.Create(fullPath))
        {
            await file.CopyToAsync(stream);
        }

        var request = _httpContextAccessor.HttpContext?.Request;
        var relative = $"/uploads/tenants/{Uri.EscapeDataString(tenantCode)}/{fileName}";
        if (request == null)
        {
            return relative;
        }

        return $"{request.Scheme}://{request.Host}{relative}";
    }
}
