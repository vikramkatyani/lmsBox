using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using lmsBox.Server.Services;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.WebUtilities;

namespace lmsBox.Server.Controllers;

[ApiController]
[Route("api/scorm-proxy")]
[AllowAnonymous] // Allow anonymous access since SCORM content loads in iframe without auth headers
public class ScormProxyController : ControllerBase
{
    private readonly IAzureBlobService _blobService;
    private readonly ILogger<ScormProxyController> _logger;
    private readonly HttpClient _httpClient;

    public ScormProxyController(
        IAzureBlobService blobService, 
        ILogger<ScormProxyController> logger,
        IHttpClientFactory httpClientFactory)
    {
        _blobService = blobService;
        _logger = logger;
        _httpClient = httpClientFactory.CreateClient();
        _httpClient.Timeout = TimeSpan.FromMinutes(5);
    }

    /// <summary>
    /// Proxy SCORM content from Azure Blob Storage to avoid CORS issues.
    /// Rewrites relative URLs to load through proxy. No script injection - SCORM content uses native scorm_api.js.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> ProxyScormContent([FromQuery] string url)
    {
        if (string.IsNullOrEmpty(url))
        {
            return BadRequest(new { message = "URL parameter is required" });
        }

        try
        {
            // Generate SAS URL if it's a blob storage URL
            string targetUrl = url;
            if (_blobService.IsConfigured() && url.Contains("blob.core.windows.net"))
            {
                targetUrl = await _blobService.GetSasUrlAsync(url, 24);
            }

            // Fetch the content from blob storage
            var response = await _httpClient.GetAsync(targetUrl);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch SCORM content from {Url}, Status: {Status}", targetUrl, response.StatusCode);
                return StatusCode((int)response.StatusCode, new { message = "Failed to fetch SCORM content" });
            }

            var content = await response.Content.ReadAsByteArrayAsync();
            var contentType = response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
            var baseUrl = url.Substring(0, url.LastIndexOf('/') + 1);

            // For CSS files, rewrite relative url(...) references to load through proxy.
            if (contentType.Contains("text/css") || url.EndsWith(".css", StringComparison.OrdinalIgnoreCase))
            {
                var cssContent = System.Text.Encoding.UTF8.GetString(content);

                cssContent = Regex.Replace(
                    cssContent,
                    @"url\((['""']?)(?!https?:|//|data:|#)([^)'""?]+(?:\?[^)'""]*)?)\1\)",
                    match =>
                    {
                        var path = match.Groups[2].Value;
                        var fullUrl = baseUrl + path;
                        var encodedUrl = Uri.EscapeDataString(fullUrl);
                        return $"url('/api/scorm-proxy?url={encodedUrl}')";
                    },
                    RegexOptions.IgnoreCase
                );

                content = System.Text.Encoding.UTF8.GetBytes(cssContent);
                Response.Headers.CacheControl = "no-store, no-cache, must-revalidate, max-age=0";
                Response.Headers.Pragma = "no-cache";
                Response.Headers.Expires = "0";
                return File(content, contentType);
            }

            // For HTML files, rewrite relative URLs to load through proxy
            if (contentType.Contains("text/html") || url.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
            {
                var htmlContent = System.Text.Encoding.UTF8.GetString(content);
                
                _logger.LogInformation("Rewriting relative URLs for SCORM content: {Url}", url);

                // Check for own SCORM scripts BEFORE rewriting src/href so the literal filenames
                // are still present in the HTML.  After rewriting, every src becomes a proxy URL
                // that still contains the original filename as a substring, making the check a
                // false-positive that silently skips bridge injection for most packages.
                var hasOwnScormScript =
                    Regex.IsMatch(htmlContent, @"<script[^>]+src=[""'][^""']*scorm[^""']*\.js[""']", RegexOptions.IgnoreCase);

                // Some SCORM 2004 driver packages (notably scormdriver/indexAPI.html variants)
                // use their own runtime event bus and can crash if any bridge script is injected
                // into the package window. Those packages talk to window.parent.API_1484_11 directly.
                var isLikelyScorm2004Driver =
                    url.Contains("scorm2004", StringComparison.OrdinalIgnoreCase) ||
                    url.Contains("2004_", StringComparison.OrdinalIgnoreCase) ||
                    url.Contains("/scormdriver/", StringComparison.OrdinalIgnoreCase) ||
                    Regex.IsMatch(htmlContent, @"API_1484_11|adl\.nav\.request|SCORM\s*2004", RegexOptions.IgnoreCase);

                var isScormDriverPage = url.Contains("/scormdriver/", StringComparison.OrdinalIgnoreCase);
                var isScormContentPage = url.Contains("/scormcontent/", StringComparison.OrdinalIgnoreCase);
                var shouldSkipBridge = isLikelyScorm2004Driver && isScormContentPage && !isScormDriverPage;

                // Rewrite src and href attributes to use proxy
                // This ensures scorm_api.js and other resources load through the proxy
                htmlContent = Regex.Replace(
                    htmlContent,
                    @"(src|href)=""(?!http|https|//|data:|#)([^""]+)""",
                    match => {
                        var attr = match.Groups[1].Value;
                        var path = match.Groups[2].Value;
                        var fullUrl = baseUrl + path;
                        var encodedUrl = Uri.EscapeDataString(fullUrl);
                        return $"{attr}=\"/api/scorm-proxy?url={encodedUrl}\"";
                    },
                    RegexOptions.IgnoreCase
                );

                // Rewrite single-quoted src/href attributes too.
                htmlContent = Regex.Replace(
                    htmlContent,
                    @"(src|href)='(?!http|https|//|data:|#)([^']+)'",
                    match => {
                        var attr = match.Groups[1].Value;
                        var path = match.Groups[2].Value;
                        var fullUrl = baseUrl + path;
                        var encodedUrl = Uri.EscapeDataString(fullUrl);
                        return $"{attr}='/api/scorm-proxy?url={encodedUrl}'";
                    },
                    RegexOptions.IgnoreCase
                );

                if (!shouldSkipBridge)
                {
                    // Inject bridge in head to ensure APIs are available before external scripts load.
                    var bridgeInjection = "<script src=\"/scorm-runtime-bridge.js\"></script>";
                    var headCloseIndex = htmlContent.IndexOf("</head>", StringComparison.OrdinalIgnoreCase);
                    if (headCloseIndex > 0)
                    {
                        htmlContent = htmlContent.Insert(headCloseIndex, bridgeInjection);
                    }
                    else
                    {
                        // No </head> tag, inject at start
                        htmlContent = bridgeInjection + htmlContent;
                    }

                    if (hasOwnScormScript)
                    {
                        _logger.LogInformation("Injected scorm-runtime-bridge.js into {Url} (package has own scorm script)", url);
                    }
                    else
                    {
                        _logger.LogInformation("Injected scorm-runtime-bridge.js into {Url} (standard injection)", url);
                    }
                }
                else
                {
                    _logger.LogInformation("Skipped bridge injection for SCORM 2004 content page: {Url}", url);
                }
                
                content = System.Text.Encoding.UTF8.GetBytes(htmlContent);
                Response.Headers.CacheControl = "no-store, no-cache, must-revalidate, max-age=0";
                Response.Headers.Pragma = "no-cache";
                Response.Headers.Expires = "0";
                return File(content, contentType);
            }

            Response.Headers.CacheControl = "no-store, no-cache, must-revalidate, max-age=0";
            Response.Headers.Pragma = "no-cache";
            Response.Headers.Expires = "0";
            return File(content, contentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying SCORM content from {Url}", url);
            return StatusCode(500, new { message = "An error occurred while loading SCORM content" });
        }
    }

    /// <summary>
    /// Fallback for SCORM packages that hardcode root-relative paths like /scormcontent/index.html.
    /// Resolves the requested path against the proxied launch file URL from the Referer.
    /// </summary>
    [HttpGet("/scormcontent/{*path}")]
    public async Task<IActionResult> ProxyRootRelativeScormContent([FromRoute] string? path)
    {
        try
        {
            const string scormSourceCookie = "scorm_proxy_source_url";
            var referer = Request.Headers.Referer.ToString();
            string originalUrl;

            if (!string.IsNullOrWhiteSpace(referer) && Uri.TryCreate(referer, UriKind.Absolute, out var refererUri))
            {
                var refererQuery = QueryHelpers.ParseQuery(refererUri.Query);
                if (refererQuery.TryGetValue("url", out var encodedOriginalUrl) && !string.IsNullOrWhiteSpace(encodedOriginalUrl))
                {
                    originalUrl = Uri.UnescapeDataString(encodedOriginalUrl.ToString());
                    Response.Cookies.Append(scormSourceCookie, originalUrl, new CookieOptions
                    {
                        Path = "/",
                        HttpOnly = true,
                        IsEssential = true,
                        SameSite = SameSiteMode.Lax,
                        Expires = DateTimeOffset.UtcNow.AddMinutes(30)
                    });
                }
                else if (Request.Cookies.TryGetValue(scormSourceCookie, out var cookieOriginalUrl) && !string.IsNullOrWhiteSpace(cookieOriginalUrl))
                {
                    originalUrl = cookieOriginalUrl;
                }
                else
                {
                    _logger.LogWarning("Referer missing url query and no cookie context for /scormcontent request. Referer: {Referer}", referer);
                    return NotFound(new { message = "SCORM root-relative request could not be resolved" });
                }
            }
            else if (Request.Cookies.TryGetValue(scormSourceCookie, out var cookieOriginalUrl) && !string.IsNullOrWhiteSpace(cookieOriginalUrl))
            {
                originalUrl = cookieOriginalUrl;
            }
            else
            {
                _logger.LogWarning("Received /scormcontent request without Referer and no cookie context. Path: {Path}", path);
                return NotFound(new { message = "SCORM root-relative request could not be resolved" });
            }

            if (!Uri.TryCreate(originalUrl, UriKind.Absolute, out var originalUri))
            {
                return NotFound(new { message = "SCORM root-relative request could not be resolved" });
            }

            var cleanPath = (path ?? string.Empty).TrimStart('/');
            var launchPath = originalUri.AbsolutePath;
            var segmentIndex = launchPath.IndexOf("/scormcontent/", StringComparison.OrdinalIgnoreCase);
            var launchDirectory = launchPath.Substring(0, launchPath.LastIndexOf('/') + 1);

            string packageRootPath;
            if (segmentIndex >= 0)
            {
                // Keep everything up to package root, then append the requested scormcontent file.
                packageRootPath = launchPath.Substring(0, segmentIndex).TrimEnd('/');
            }
            else
            {
                // Fallback: use launch file directory as package root.
                var lastSlash = launchPath.LastIndexOf('/');
                packageRootPath = lastSlash > 0 ? launchPath.Substring(0, lastSlash).TrimEnd('/') : string.Empty;
            }

            var packageParentPath = string.Empty;
            if (!string.IsNullOrWhiteSpace(packageRootPath))
            {
                var rootLastSlash = packageRootPath.LastIndexOf('/');
                packageParentPath = rootLastSlash > 0 ? packageRootPath.Substring(0, rootLastSlash).TrimEnd('/') : string.Empty;
            }

            var baseOrigin = $"{originalUri.Scheme}://{originalUri.Host}{(originalUri.IsDefaultPort ? string.Empty : $":{originalUri.Port}")}";
            var candidateUrls = new List<string>
            {
                $"{baseOrigin}{packageRootPath}/scormcontent/{cleanPath}",
                $"{baseOrigin}{packageParentPath}/scormcontent/{cleanPath}",
                $"{baseOrigin}{launchDirectory}{cleanPath}",
                $"{baseOrigin}{packageRootPath}/{cleanPath}"
            };

            if (!string.IsNullOrWhiteSpace(Request.QueryString.Value))
            {
                var query = Request.QueryString.Value ?? string.Empty;
                if (query.StartsWith("?", StringComparison.Ordinal))
                {
                    query = query.Substring(1);
                }

                if (!string.IsNullOrWhiteSpace(query))
                {
                    for (var i = 0; i < candidateUrls.Count; i++)
                    {
                        candidateUrls[i] += $"?{query}";
                    }
                }
            }

            foreach (var candidateUrl in candidateUrls.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                _logger.LogInformation("Trying /scormcontent fallback candidate {TargetUrl}", candidateUrl);
                var result = await ProxyScormContent(candidateUrl);

                if (result is FileContentResult)
                {
                    return result;
                }

                if (result is StatusCodeResult statusCodeResult && statusCodeResult.StatusCode < 400)
                {
                    return result;
                }

                if (result is ObjectResult objectResult && (objectResult.StatusCode ?? 500) < 400)
                {
                    return result;
                }
            }

            _logger.LogWarning("All /scormcontent fallback candidates failed for path {Path}", path);
            return NotFound(new { message = "Failed to fetch SCORM content" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resolving root-relative /scormcontent request for path {Path}", path);
            return StatusCode(500, new { message = "An error occurred while loading SCORM content" });
        }
    }

    /// <summary>
    /// Proxy HTML lesson content from Azure Blob Storage to avoid CORS/auth issues.
    /// </summary>
    [HttpGet("html")]
    public async Task<IActionResult> ProxyHtmlContent([FromQuery] string url)
    {
        if (string.IsNullOrEmpty(url))
        {
            return BadRequest(new { message = "URL parameter is required" });
        }

        try
        {
            _logger.LogInformation("Proxying HTML content from: {Url}", url);

            // Generate SAS URL if it's a blob storage URL
            string targetUrl = url;
            if (_blobService.IsConfigured() && url.Contains("blob.core.windows.net"))
            {
                targetUrl = await _blobService.GetSasUrlAsync(url, 24);
                _logger.LogInformation("Generated SAS URL for HTML content: {TargetUrl}", targetUrl);
            }

            // Create Uri object to prevent double-encoding
            var requestUri = new Uri(targetUrl, UriKind.Absolute);
            using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
            var response = await _httpClient.SendAsync(request);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch HTML content. Status: {StatusCode}, RequestUri: {RequestUri}", response.StatusCode, request.RequestUri);
                return StatusCode((int)response.StatusCode, new { message = "Failed to load HTML content" });
            }

            var content = await response.Content.ReadAsByteArrayAsync();
            var contentType = response.Content.Headers.ContentType?.ToString() ?? "text/html";

            _logger.LogInformation("Successfully proxied HTML content, size: {Size} bytes", content.Length);

            return File(content, contentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying HTML content from {Url}", url);
            return StatusCode(500, new { message = "An error occurred while loading HTML content" });
        }
    }
}
