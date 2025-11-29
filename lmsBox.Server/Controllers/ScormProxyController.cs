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
    const maxAttempts = 50;
    
    while (win.parent && win.parent !== win && attempts < maxAttempts) {
        attempts++;
        try {
            // Try to access the parent window's API (may throw CORS error)
            if (win.parent.API) return win.parent.API;
            if (win.parent.API_1484_11) return win.parent.API_1484_11;
            win = win.parent;
        } catch(e) {
            // Cross-origin access blocked, can't go further up
            break;
        }
    }
    
    // Try opener window
    try {
        if (window.opener && window.opener.API) return window.opener.API;
        if (window.opener && window.opener.API_1484_11) return window.opener.API_1484_11;
    } catch(e) {
        // Cross-origin access blocked
    }
    
    return null;
}

// Make API available globally
try {
    // Always use stub API when in iframe to ensure postMessage communication works
    var useStub = (window !== window.parent);
    var api = useStub ? null : findAPI(window);
    
    // Only use found API if it has actual SCORM methods
    var hasValidAPI = api && (api.LMSInitialize || api.Initialize || api.LMSGetValue || api.GetValue);
    
    if (hasValidAPI && !useStub) {
        window.API = api;
        window.API_1484_11 = api;
        
        // Create SCORM wrapper object for content that uses SCORM.* methods
        window.SCORM = {
            init: function() { return api.LMSInitialize ? api.LMSInitialize('') : (api.Initialize ? api.Initialize('') : 'true'); },
            Initialize: function() { return this.init(); },
            initialize: function() { return this.init(); },
            finish: function() { return api.LMSFinish ? api.LMSFinish('') : (api.Terminate ? api.Terminate('') : 'true'); },
            Finish: function() { return this.finish(); },
            Terminate: function() { return this.finish(); },
            terminate: function() { return this.finish(); },
            get: function(element) { return api.LMSGetValue ? api.LMSGetValue(element) : (api.GetValue ? api.GetValue(element) : ''); },
            Get: function(element) { return this.get(element); },
            GetValue: function(element) { return this.get(element); },
            getValue: function(element) { return this.get(element); },
            set: function(element, value) { return api.LMSSetValue ? api.LMSSetValue(element, value) : (api.SetValue ? api.SetValue(element, value) : 'true'); },
            Set: function(element, value) { return this.set(element, value); },
            SetValue: function(element, value) { return this.set(element, value); },
            setValue: function(element, value) { return this.set(element, value); },
            save: function() { return api.LMSCommit ? api.LMSCommit('') : (api.Commit ? api.Commit('') : 'true'); },
            Save: function() { return this.save(); },
            Commit: function() { return this.save(); },
            commit: function() { return this.save(); },
            getStatus: function() { return this.get('cmi.core.lesson_status') || this.get('cmi.completion_status'); },
            GetStatus: function() { return this.getStatus(); },
            setStatus: function(status) { return this.set('cmi.core.lesson_status', status) || this.set('cmi.completion_status', status); },
            SetStatus: function(status) { return this.setStatus(status); },
            getScore: function() { return this.get('cmi.core.score.raw') || this.get('cmi.score.raw'); },
            GetScore: function() { return this.getScore(); },
            setScore: function(score) { return this.set('cmi.core.score.raw', score) || this.set('cmi.score.raw', score); },
            SetScore: function(score) { return this.setScore(score); },
            getBookmark: function() { return this.get('cmi.core.lesson_location') || this.get('cmi.location'); },
            GetBookmark: function() { return this.getBookmark(); },
            setBookmark: function(location) { return this.set('cmi.core.lesson_location', location) || this.set('cmi.location', location); },
            SetBookmark: function(location) { return this.setBookmark(location); },
            getSuspendData: function() { return this.get('cmi.suspend_data'); },
            GetSuspendData: function() { return this.getSuspendData(); },
            setSuspendData: function(data) { return this.set('cmi.suspend_data', data); },
            SetSuspendData: function(data) { return this.setSuspendData(data); },
            getSessionTime: function() { return '0000:00:00.00'; },
            GetSessionTime: function() { return this.getSessionTime(); },
            setSessionTime: function(time) { console.log('SCORM wrapper: setSessionTime', time); return 'true'; },
            SetSessionTime: function(time) { return this.setSessionTime(time); },
            getLastError: function() { return '0'; },
            GetLastError: function() { return this.getLastError(); },
            getErrorString: function(errorCode) { return 'No error'; },
            GetErrorString: function(errorCode) { return this.getErrorString(errorCode); },
            getDiagnostic: function(errorCode) { return 'No error'; },
            GetDiagnostic: function(errorCode) { return this.getDiagnostic(errorCode); }
        };
        
        // Create helper functions that some SCORM content expects
        window.ScormProcessInitialize = function() {
            return api.LMSInitialize ? api.LMSInitialize('') : (api.Initialize ? api.Initialize('') : 'true');
        };
        window.ScormProcessFinish = function() {
            return api.LMSFinish ? api.LMSFinish('') : (api.Terminate ? api.Terminate('') : 'true');
        };
        window.ScormProcessGetValue = function(element) {
            return api.LMSGetValue ? api.LMSGetValue(element) : (api.GetValue ? api.GetValue(element) : '');
        };
        window.ScormProcessSetValue = function(element, value) {
            return api.LMSSetValue ? api.LMSSetValue(element, value) : (api.SetValue ? api.SetValue(element, value) : 'true');
        };
        
        console.log('✓ SCORM API found and injected successfully');
    } else {
        console.warn('⚠ SCORM API not found in parent windows - creating stub API');
        
        // Create a stub SCORM API that saves data via postMessage to parent
        // Initialize stub data - will be updated when parent sends saved data
        var stubData = {
            lessonStatus: 'not attempted',
            score: '',
            location: '',
            suspendData: '',
            initialized: false
        };
        
        // Listen for saved SCORM data from parent window
        window.addEventListener('message', function(event) {
            console.log('SCORM stub: received message', event.data);
            
            if (event.data && event.data.type === 'scorm-init-data') {
                console.log('📥 SCORM stub: received saved data from parent', event.data.data);
                var saved = event.data.data;
                if (saved.lessonStatus) stubData.lessonStatus = saved.lessonStatus;
                if (saved.score) stubData.score = saved.score;
                if (saved.lessonLocation) stubData.location = saved.lessonLocation;
                if (saved.suspendData) stubData.suspendData = saved.suspendData;
                stubData.initialized = true;
                console.log('✅ SCORM stub: initialized with saved data:', {
                    status: stubData.lessonStatus,
                    score: stubData.score,
                    bookmark: stubData.location,
                    suspendDataLength: stubData.suspendData.length
                });
            }
        });
        
        // Request saved data from parent on load
        try {
            console.log('📤 SCORM stub: requesting saved data from parent');
            window.parent.postMessage({
                type: 'scorm-request-data'
            }, '*');
        } catch(e) {
            console.warn('SCORM stub: could not request data from parent', e);
        }
        
        // Helper to notify parent window to save data with debouncing
        var saveTimeout = null;
        function notifyParentToSave() {
            // Debounce saves - only save once every 2 seconds
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
            
            saveTimeout = setTimeout(function() {
                saveDataImmediately();
            }, 2000); // Wait 2 seconds before saving
        }
        
        // Save immediately without debouncing (for finish/commit/unload)
        function saveDataImmediately() {
            try {
                var payload = {};
                
                // Only include non-empty values and ensure they're strings
                if (stubData.lessonStatus) payload.scormLessonStatus = String(stubData.lessonStatus);
                if (stubData.score) payload.scormScore = String(stubData.score);
                if (stubData.location) payload.scormLessonLocation = String(stubData.location);
                if (stubData.suspendData) payload.scormData = String(stubData.suspendData);
                
                window.parent.postMessage({
                    type: 'scorm-save',
                    data: payload
                }, '*');
                console.log('SCORM stub: notified parent to save data', payload);
            } catch(e) {
                console.error('SCORM stub: failed to notify parent', e);
            }
        }
        
        // Save immediately on page unload
        window.addEventListener('beforeunload', function() {
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
            saveDataImmediately();
        });
        
        window.SCORM = {
            init: function() { 
                console.log('SCORM stub: init - preserving existing state', stubData.lessonStatus); 
                // Don't reset to incomplete if already has a status - preserve resume state
                if (!stubData.lessonStatus || stubData.lessonStatus === 'not attempted') {
                    stubData.lessonStatus = 'incomplete';
                }
                return 'true'; 
            },
            Initialize: function() { return this.init(); },
            initialize: function() { return this.init(); },
            
            finish: function() { 
                console.log('SCORM stub: finish'); 
                notifyParentToSave();
                return 'true'; 
            },
            Finish: function() { return this.finish(); },
            Terminate: function() { return this.finish(); },
            terminate: function() { return this.finish(); },
            
            get: function(element) { 
                console.log('SCORM stub: get', element);
                if (element.includes('lesson_status') || element.includes('completion_status')) return stubData.lessonStatus;
                if (element.includes('score')) return stubData.score;
                if (element.includes('location')) return stubData.location;
                if (element.includes('suspend_data')) return stubData.suspendData;
                return ''; 
            },
            Get: function(element) { return this.get(element); },
            GetValue: function(element) { return this.get(element); },
            getValue: function(element) { return this.get(element); },
            
            set: function(element, value) { 
                console.log('SCORM stub: set', element, value);
                if (element.includes('lesson_status') || element.includes('completion_status')) stubData.lessonStatus = value;
                if (element.includes('score')) stubData.score = value;
                if (element.includes('location')) stubData.location = value;
                if (element.includes('suspend_data')) stubData.suspendData = value;
                notifyParentToSave();
                return 'true'; 
            },
            Set: function(element, value) { return this.set(element, value); },
            SetValue: function(element, value) { return this.set(element, value); },
            setValue: function(element, value) { return this.set(element, value); },
            
            save: function() { 
                console.log('SCORM stub: save'); 
                if (saveTimeout) clearTimeout(saveTimeout);
                saveDataImmediately();
                return 'true'; 
            },
            Save: function() { return this.save(); },
            Commit: function() { return this.save(); },
            commit: function() { return this.save(); },
            
            getStatus: function() { return stubData.lessonStatus; },
            GetStatus: function() { return this.getStatus(); },
            
            setStatus: function(status) { 
                stubData.lessonStatus = status; 
                notifyParentToSave();
                return 'true'; 
            },
            SetStatus: function(status) { return this.setStatus(status); },
            
            getScore: function() { return stubData.score; },
            GetScore: function() { return this.getScore(); },
            
            setScore: function(score) { 
                stubData.score = score; 
                notifyParentToSave();
                return 'true'; 
            },
            SetScore: function(score) { return this.setScore(score); },
            
            // Bookmark methods (for lesson location/progress)
            getBookmark: function() { return stubData.location; },
            GetBookmark: function() { return this.getBookmark(); },
            setBookmark: function(location) { 
                stubData.location = location; 
                notifyParentToSave();
                return 'true'; 
            },
            SetBookmark: function(location) { return this.setBookmark(location); },
            
            // Suspend data methods
            getSuspendData: function() { return stubData.suspendData; },
            GetSuspendData: function() { return this.getSuspendData(); },
            setSuspendData: function(data) { 
                stubData.suspendData = data; 
                notifyParentToSave();
                return 'true'; 
            },
            SetSuspendData: function(data) { return this.setSuspendData(data); },
            
            // Session time methods
            getSessionTime: function() { return '0000:00:00.00'; },
            GetSessionTime: function() { return this.getSessionTime(); },
            setSessionTime: function(time) { 
                console.log('SCORM stub: setSessionTime', time); 
                return 'true'; 
            },
            SetSessionTime: function(time) { return this.setSessionTime(time); },
            
            // Error handling methods
            getLastError: function() { return '0'; },
            GetLastError: function() { return this.getLastError(); },
            getErrorString: function(errorCode) { return 'No error'; },
            GetErrorString: function(errorCode) { return this.getErrorString(errorCode); },
            getDiagnostic: function(errorCode) { return 'No error'; },
            GetDiagnostic: function(errorCode) { return this.getDiagnostic(errorCode); }
        };
        
        // Create standard SCORM 1.2 API object
        window.API = {
            LMSInitialize: function(param) {
                console.log('SCORM 1.2: LMSInitialize');
                // Don't reset status if already set
                if (!stubData.lessonStatus || stubData.lessonStatus === 'not attempted') {
                    stubData.lessonStatus = 'incomplete';
                }
                return 'true';
            },
            LMSFinish: function(param) {
                console.log('SCORM 1.2: LMSFinish');
                if (saveTimeout) clearTimeout(saveTimeout);
                saveDataImmediately();
                return 'true';
            },
            LMSGetValue: function(element) {
                console.log('SCORM 1.2: LMSGetValue', element);
                if (element === 'cmi.core.lesson_status') return stubData.lessonStatus;
                if (element === 'cmi.core.score.raw') return stubData.score;
                if (element === 'cmi.core.lesson_location') return stubData.location;
                if (element === 'cmi.suspend_data') return stubData.suspendData;
                if (element === 'cmi.core.student_id') return 'student_001';
                if (element === 'cmi.core.student_name') return 'Student';
                return '';
            },
            LMSSetValue: function(element, value) {
                console.log('SCORM 1.2: LMSSetValue', element, value);
                if (element === 'cmi.core.lesson_status') stubData.lessonStatus = value;
                if (element === 'cmi.core.score.raw') stubData.score = value;
                if (element === 'cmi.core.lesson_location') stubData.location = value;
                if (element === 'cmi.suspend_data') stubData.suspendData = value;
                notifyParentToSave();
                return 'true';
            },
            LMSCommit: function(param) {
                console.log('SCORM 1.2: LMSCommit');
                if (saveTimeout) clearTimeout(saveTimeout);
                saveDataImmediately();
                return 'true';
            },
            LMSGetLastError: function() { return '0'; },
            LMSGetErrorString: function(errorCode) { return 'No error'; },
            LMSGetDiagnostic: function(errorCode) { return 'No error'; }
        };
        
        // Create SCORM 2004 API object (same implementation)
        window.API_1484_11 = {
            Initialize: function(param) { return window.API.LMSInitialize(param); },
            Terminate: function(param) { return window.API.LMSFinish(param); },
            GetValue: function(element) { 
                // Convert SCORM 2004 elements to 1.2 format
                element = element.replace('cmi.completion_status', 'cmi.core.lesson_status');
                element = element.replace('cmi.score.raw', 'cmi.core.score.raw');
                element = element.replace('cmi.location', 'cmi.core.lesson_location');
                return window.API.LMSGetValue(element);
            },
            SetValue: function(element, value) {
                // Convert SCORM 2004 elements to 1.2 format
                element = element.replace('cmi.completion_status', 'cmi.core.lesson_status');
                element = element.replace('cmi.score.raw', 'cmi.core.score.raw');
                element = element.replace('cmi.location', 'cmi.core.lesson_location');
                return window.API.LMSSetValue(element, value);
            },
            Commit: function(param) { return window.API.LMSCommit(param); },
            GetLastError: function() { return '0'; },
            GetErrorString: function(errorCode) { return 'No error'; },
            GetDiagnostic: function(errorCode) { return 'No error'; }
        };
        
        console.log('✓ SCORM stub API created with saved data:', stubData);
    }
} catch(e) {
    console.error('✗ Error setting up SCORM API:', e);
}
</script>";

                // Remove or replace script tag requests for scorm_api.js
                htmlContent = System.Text.RegularExpressions.Regex.Replace(
                    htmlContent,
                    @"<script[^>]*src\s*=\s*[""'][^""']*scorm_api\.js[""'][^>]*>\s*</script>",
                    "<!-- scorm_api.js replaced by injected SCORM API -->",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase
                );

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
