using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using lmsBox.Server.Services;

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
    /// Proxy SCORM content from Azure Blob Storage to avoid CORS issues
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

            // For HTML files, inject SCORM API script
            if (contentType.Contains("text/html") || url.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
            {
                var htmlContent = System.Text.Encoding.UTF8.GetString(content);
                
                // Inject SCORM API script at the beginning of the body or head
                var scormApiScript = @"
<script>
// SCORM API finder - looks for API in parent/opener windows
function findAPI(win) {
    let attempts = 0;
    const maxAttempts = 500;
    
    while (!win.API && !win.API_1484_11 && win.parent && win.parent !== win && attempts < maxAttempts) {
        attempts++;
        win = win.parent;
    }
    
    if (win.API) return win.API;
    if (win.API_1484_11) return win.API_1484_11;
    
    // Try opener window
    if (window.opener) {
        if (window.opener.API) return window.opener.API;
        if (window.opener.API_1484_11) return window.opener.API_1484_11;
    }
    
    return null;
}

// Make API available globally
try {
    var api = findAPI(window);
    if (api) {
        window.API = api;
        window.API_1484_11 = api;
        
        // Create helper functions that some SCORM content expects
        window.ScormProcessInitialize = function() {
            return api.LMSInitialize ? api.LMSInitialize('') : api.Initialize('');
        };
        window.ScormProcessFinish = function() {
            return api.LMSFinish ? api.LMSFinish('') : api.Terminate('');
        };
        window.ScormProcessGetValue = function(element) {
            return api.LMSGetValue ? api.LMSGetValue(element) : api.GetValue(element);
        };
        window.ScormProcessSetValue = function(element, value) {
            return api.LMSSetValue ? api.LMSSetValue(element, value) : api.SetValue(element, value);
        };
        
        console.log('SCORM API found and injected successfully');
    } else {
        console.warn('SCORM API not found in parent windows');
    }
} catch(e) {
    console.error('Error setting up SCORM API:', e);
}
</script>";

                // Try to inject after <head> tag or at the beginning of <body>
                if (htmlContent.Contains("<head>", StringComparison.OrdinalIgnoreCase))
                {
                    htmlContent = htmlContent.Replace("<head>", "<head>" + scormApiScript, StringComparison.OrdinalIgnoreCase);
                }
                else if (htmlContent.Contains("<body>", StringComparison.OrdinalIgnoreCase))
                {
                    htmlContent = htmlContent.Replace("<body>", "<body>" + scormApiScript, StringComparison.OrdinalIgnoreCase);
                }
                else
                {
                    // Fallback: prepend to the content
                    htmlContent = scormApiScript + htmlContent;
                }

                content = System.Text.Encoding.UTF8.GetBytes(htmlContent);
                contentType = "text/html; charset=utf-8";
            }

            return File(content, contentType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error proxying SCORM content from {Url}", url);
            return StatusCode(500, new { message = "An error occurred while loading SCORM content" });
        }
    }
}
