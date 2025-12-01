using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using lmsBox.Server.Services;
using System.Text.RegularExpressions;

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

            // For HTML files, rewrite relative URLs to load through proxy
            if (contentType.Contains("text/html") || url.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
            {
                var htmlContent = System.Text.Encoding.UTF8.GetString(content);
                
                _logger.LogInformation("Rewriting relative URLs for SCORM content: {Url}", url);
                
                // Rewrite relative URLs to go through the proxy
                // Get the base URL (directory of the current HTML file)
                var baseUrl = url.Substring(0, url.LastIndexOf('/') + 1);
                
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
                
                // Inject postMessage-based API shim before </head> to avoid CORS
                // This runs before scorm_api.js and provides window.API via postMessage
                var apiShim = @"<script>
(function() {
    console.log('🔧 SCORM API Shim: Initializing...');
    
    // Create window.API that communicates with parent via postMessage (CORS-safe)
    var scormData = {
        'cmi.core.lesson_status': 'not attempted',
        'cmi.core.score.raw': '',
        'cmi.core.lesson_location': '',
        'cmi.suspend_data': ''
    };
    
    var dataLoaded = false;
    var pendingCommit = false;
    
    window.API = {
        LMSInitialize: function(p) {
            console.log('🔧 API Shim: LMSInitialize - requesting saved data from parent');
            window.parent.postMessage({type:'scorm-request-data'}, '*');
            
            // Give parent 100ms to respond with saved data before allowing commits
            setTimeout(function() {
                if (!dataLoaded) {
                    console.log('⚠️ API Shim: No saved data received after 100ms, allowing saves');
                    dataLoaded = true;
                    if (pendingCommit) {
                        window.API.LMSCommit('');
                    }
                }
            }, 100);
            
            return 'true';
        },
        LMSGetValue: function(element) {
            var value = scormData[element] || '';
            console.log('🔧 API Shim: LMSGetValue(' + element + ') = ' + value);
            return value;
        },
        LMSSetValue: function(element, value) {
            console.log('🔧 API Shim: LMSSetValue(' + element + ', ' + value + ')');
            scormData[element] = value;
            return 'true';
        },
        LMSCommit: function(p) {
            if (!dataLoaded) {
                console.log('⏳ API Shim: LMSCommit called but data not loaded yet, deferring...');
                pendingCommit = true;
                return 'true';
            }
            
            console.log('🔧 API Shim: LMSCommit - sending data to parent');
            window.parent.postMessage({
                type: 'scorm-save',
                data: {
                    scormLessonStatus: scormData['cmi.core.lesson_status'],
                    scormScore: String(scormData['cmi.core.score.raw'] || ''),
                    scormLessonLocation: String(scormData['cmi.core.lesson_location'] || ''),
                    scormData: String(scormData['cmi.suspend_data'] || '')
                }
            }, '*');
            pendingCommit = false;
            return 'true';
        },
        LMSFinish: function(p) { 
            console.log('🔧 API Shim: LMSFinish');
            this.LMSCommit(''); 
            return 'true'; 
        },
        LMSGetLastError: function() { return '0'; },
        LMSGetErrorString: function(e) { return ''; },
        LMSGetDiagnostic: function(e) { return ''; }
    };
    
    window.addEventListener('message', function(e) {
        if (e.data?.type === 'scorm-init-data' && e.data.data) {
            console.log('🔧 API Shim: Received saved data from parent:', e.data.data);
            scormData['cmi.core.lesson_status'] = e.data.data.lessonStatus || 'not attempted';
            scormData['cmi.core.score.raw'] = e.data.data.score || '';
            scormData['cmi.core.lesson_location'] = e.data.data.lessonLocation || '';
            scormData['cmi.suspend_data'] = e.data.data.suspendData || '';
            dataLoaded = true;
            console.log('✅ API Shim: Data loaded, bookmark:', scormData['cmi.core.lesson_location']);
            
            // If there was a pending commit, execute it now
            if (pendingCommit) {
                console.log('📤 API Shim: Executing deferred commit');
                window.API.LMSCommit('');
            }
            
            // Try to help SCORM content navigate to bookmarked slide
            if (scormData['cmi.core.lesson_location']) {
                setTimeout(function() {
                    var bookmark = scormData['cmi.core.lesson_location'];
                    console.log('🎯 API Shim: Attempting to navigate to bookmark:', bookmark);
                    
                    // Try common SCORM navigation methods
                    if (window.loadSlide) window.loadSlide(bookmark);
                    if (window.GoToSlide) window.GoToSlide(bookmark);
                    if (window.gotoSlide) window.gotoSlide(bookmark);
                    if (window.jumpToSlide) window.jumpToSlide(bookmark);
                    if (window.SCORM && window.SCORM.loadProgress) window.SCORM.loadProgress();
                    
                    // Dispatch custom event that content might listen for
                    var event = new CustomEvent('scorm-bookmark-ready', { 
                        detail: { bookmark: bookmark } 
                    });
                    window.dispatchEvent(event);
                }, 200);
            }
        }
    });
    
    console.log('✅ SCORM API Shim: window.API created');
})();
</script>";
                
                var headCloseIndex = htmlContent.IndexOf("</head>", StringComparison.OrdinalIgnoreCase);
                if (headCloseIndex > 0)
                {
                    htmlContent = htmlContent.Insert(headCloseIndex, apiShim);
                }
                else
                {
                    // No </head> tag, inject at start
                    htmlContent = apiShim + htmlContent;
                }
                
                content = System.Text.Encoding.UTF8.GetBytes(htmlContent);
                return File(content, contentType);
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
