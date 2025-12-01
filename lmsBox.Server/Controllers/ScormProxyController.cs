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
    var bookmarkLocked = false; // Prevent overwriting bookmark until saved data loads
    var bookmarkRead = false; // Track if course has read the bookmark
    
    // Request data immediately on script load
    window.parent.postMessage({type:'scorm-request-data'}, '*');
    console.log('📡 API Shim: Requested saved data on load');
    
    window.API = {
        LMSInitialize: function(p) {
            console.log('🔧 API Shim: LMSInitialize called');
            bookmarkLocked = true; // Lock bookmark until data arrives
            return 'true';
        },
        LMSGetValue: function(element) {
            // If asking for bookmark/status and data hasn't loaded, wait briefly
            if (!dataLoaded && (element === 'cmi.core.lesson_location' || element === 'cmi.core.lesson_status' || element === 'cmi.suspend_data')) {
                console.log('⏳ API Shim: LMSGetValue(' + element + ') called before data loaded, waiting...');
                
                // Synchronous wait (blocking) - SCORM API must be synchronous
                var startTime = Date.now();
                var maxWait = 2000; // Wait up to 2 seconds
                
                while (!dataLoaded && (Date.now() - startTime) < maxWait) {
                    // Busy wait - not ideal but SCORM API must be synchronous
                    var dummy = 1 + 1; // Keep loop alive
                }
                
                if (dataLoaded) {
                    console.log('✅ API Shim: Data arrived, returning ' + element + ' = ' + (scormData[element] || ''));
                } else {
                    console.log('⚠️ API Shim: Timeout waiting for data, returning empty ' + element);
                }
            }
            
            var value = scormData[element] || '';
            
            // Track when course reads the bookmark - keep lock for 100ms after read
            if (element === 'cmi.core.lesson_location' && dataLoaded && !bookmarkRead && scormData[element]) {
                bookmarkRead = true;
                console.log('📖 API Shim: Course read bookmark (' + value + '), keeping lock for 100ms');
                setTimeout(function() {
                    bookmarkLocked = false;
                    console.log('🔓 API Shim: Bookmark lock released after read');
                }, 100);
            }
            
            // CRITICAL FIX: If course is completed but has a bookmark, return 'incomplete' so it resumes
            if (element === 'cmi.core.lesson_status' && value === 'completed' && scormData['cmi.core.lesson_location']) {
                console.log('🔄 API Shim: Returning incomplete instead of completed to enable bookmark resume');
                value = 'incomplete';
            }
            
            console.log('🔧 API Shim: LMSGetValue(' + element + ') = ' + value);
            return value;
        },
        LMSSetValue: function(element, value) {
            console.log('🔧 API Shim: LMSSetValue(' + element + ', ' + value + ')');
            
            // Protect completed/passed status from being overwritten by incomplete
            if (element === 'cmi.core.lesson_status') {
                var currentStatus = scormData[element];
                if ((currentStatus === 'completed' || currentStatus === 'passed') && 
                    (value === 'incomplete' || value === 'not attempted')) {
                    console.log('🔧 API Shim: Preventing status downgrade from ' + currentStatus + ' to ' + value);
                    return 'true';
                }
            }
            
            // Protect bookmark AND suspend_data from being overwritten before saved data loads
            if ((element === 'cmi.core.lesson_location' || element === 'cmi.suspend_data') && bookmarkLocked) {
                console.log('🔧 API Shim: Bookmark/suspend_data locked, ignoring SetValue until data loads');
                return 'true';
            }
            
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
            
            // Load saved status - if it's completed/passed, lock it in
            var savedStatus = e.data.data.lessonStatus || 'not attempted';
            if (savedStatus === 'completed' || savedStatus === 'passed') {
                console.log('🔒 API Shim: Lesson already completed, locking status');
                scormData['cmi.core.lesson_status'] = savedStatus;
            } else if (scormData['cmi.core.lesson_status'] === 'not attempted') {
                // Only load non-completed status if current is still 'not attempted'
                scormData['cmi.core.lesson_status'] = savedStatus;
            }
            
            if (!scormData['cmi.core.score.raw']) {
                scormData['cmi.core.score.raw'] = e.data.data.score || '';
            }
            
            // Always load saved bookmark, overwriting any course defaults
            var savedBookmark = e.data.data.lessonLocation || '';
            console.log('🔖 API Shim: Loading saved bookmark:', savedBookmark, 'Current bookmark:', scormData['cmi.core.lesson_location']);
            if (savedBookmark) {
                scormData['cmi.core.lesson_location'] = savedBookmark;
                console.log('🔖 API Shim: Bookmark set to:', scormData['cmi.core.lesson_location']);
            }
            
            // Always load saved suspend_data, overwriting any course defaults
            var savedSuspendData = e.data.data.suspendData || '';
            console.log('💾 API Shim: Loading saved suspend_data:', savedSuspendData);
            if (savedSuspendData) {
                scormData['cmi.suspend_data'] = savedSuspendData;
                console.log('💾 API Shim: Suspend data set to:', scormData['cmi.suspend_data']);
            }
            
            bookmarkLocked = false; // Unlock bookmark BEFORE setting dataLoaded to prevent race
            dataLoaded = true;
            console.log('✅ API Shim: Data loaded, status:', scormData['cmi.core.lesson_status'], 'bookmark:', scormData['cmi.core.lesson_location']);
            
            // If there was a pending commit, execute it now
            if (pendingCommit) {
                console.log('📤 API Shim: Executing deferred commit');
                window.API.LMSCommit('');
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
