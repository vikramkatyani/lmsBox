# SCORM Testing & Tracking Guide

## Quick Test Setup

### 1. Test SCORM Content Locally

The fastest way to test SCORM tracking without database setup:

```
1. Start the backend server (dotnet run)
2. Open browser to: http://localhost:5132/api/scorm-test/player
3. The test player will load the Ladder Safety SCORM course
4. Track progress in the debug panel at the top
5. Use "Reset Progress" button to clear saved data
```

**What you'll see:**
- Live SCORM data (status, score, location, suspend data)
- API call counter
- Browser console logs for all SCORM API calls
- Data persists in localStorage between sessions

### 2. Test with Real LMS Integration

To test with actual learner progress tracking in the database:

```
1. Create a course with a SCORM lesson
2. Upload the Ladder-Safety-SCORM.zip package
3. Enroll as a learner and launch the lesson
4. Progress will be saved to database via ScormProxyController
```

## SCORM Tracking Approaches

### Current Approach: Script Injection (ScormProxyController.cs)

**How it works:**
- SCORM content is served through `/api/scorm-proxy`
- Backend injects SCORM API script into HTML files
- Injected script creates stub API or finds parent API
- Data saved via postMessage to parent window

**Pros:**
✅ Works with any SCORM content without modification
✅ Handles content that doesn't include scorm_api.js
✅ Provides fallback when parent API not found

**Cons:**
❌ Modifies HTML content on-the-fly
❌ Adds processing overhead
❌ Can interfere with CSP (Content Security Policy)
❌ Regex-based injection may miss edge cases

### Alternative Approach: Window Communication (Recommended)

Instead of injecting scripts, rely on native window communication:

**Requirements:**
1. SCORM content must include scorm_api.js (standard practice)
2. Parent window (scorm-player.html) provides API
3. Content finds API via window.parent or window.opener

**Implementation:**

```javascript
// Parent window (scorm-player.html) - Already implemented
window.API = {
    LMSInitialize: function() { /* ... */ },
    LMSGetValue: function(element) { /* ... */ },
    LMSSetValue: function(element, value) { /* ... */ },
    // ... other SCORM methods
};

// SCORM content (scorm_api.js) - Standard SCORM finder
function findAPI(win) {
    while (win.parent && win.parent !== win) {
        if (win.parent.API) return win.parent.API;
        win = win.parent;
    }
    return null;
}

var api = findAPI(window);
if (api) {
    // Use found API - no injection needed!
}
```

**Benefits:**
✅ No HTML modification required
✅ Better performance (no regex processing)
✅ CSP-friendly
✅ Standard SCORM behavior
✅ Works with most SCORM packages out-of-the-box

**Limitations:**
⚠️ Requires SCORM content to include API finder script
⚠️ Doesn't work with poorly-authored SCORM packages

## Removing Script Injection

To disable script injection and use native window communication:

### Option 1: Conditional Injection

Modify `ScormProxyController.cs` to only inject when needed:

```csharp
// Check if content already has SCORM API script
if (contentType.Contains("text/html") && !htmlContent.Contains("scorm_api.js"))
{
    // Only inject if scorm_api.js is missing
    htmlContent = InjectScormApi(htmlContent);
}
```

### Option 2: Disable Injection Completely

Remove the injection block from `ScormProxyController.cs`:

```csharp
// For HTML files, inject SCORM API script
if (contentType.Contains("text/html") || url.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
{
    // REMOVE THIS ENTIRE BLOCK (lines 64-458)
}
```

Then rely entirely on:
1. Content's own `scorm_api.js`
2. Parent window API in `scorm-player.html`

## Testing Without Injection

### Test Ladder Safety Course

The included test course (`Assets/test/Ladder-Safety-SCORM/`) includes `scorm_api.js`, so it works without injection:

```html
<!-- index.html includes -->
<script src="scorm_api.js"></script>

<!-- scorm_api.js includes API finder -->
function findAPI(win) {
    // Searches parent windows for API
}
```

**Test with injection disabled:**

1. Comment out injection code in ScormProxyController.cs
2. Run server
3. Open http://localhost:5132/api/scorm-test/player
4. SCORM should still work via window.parent.API

### Verify API Communication

Open browser console and look for:

```
✓ SCORM API found and injected successfully  // If injection is ON
SCORM: Initialized successfully              // From scorm_api.js
📥 LMSGetValue: cmi.core.lesson_status       // API calls
📤 LMSSetValue: cmi.core.lesson_location = 5 // Progress tracking
```

## SCORM Data Flow

### With Injection (Current)

```
1. Browser requests SCORM content
2. ScormProxyController intercepts request
3. Fetches from Azure Blob Storage
4. Injects API script into HTML
5. Returns modified HTML
6. Injected script creates API
7. Content uses injected API
8. Data flows: Content → API → postMessage → Parent → Database
```

### Without Injection (Recommended)

```
1. Browser requests SCORM content
2. ScormProxyController serves content as-is
3. Content loads with its own scorm_api.js
4. scorm_api.js finds window.parent.API
5. Content uses parent API
6. Data flows: Content → Parent API → Database
```

## Database Tracking

Both approaches save data to the same database tables:

```sql
-- LearnerProgress table
ScormData (NVARCHAR(MAX))  -- JSON with all SCORM data
ScormLessonStatus          -- completed, incomplete, passed, failed
ScormLessonLocation        -- Bookmark/location
ScormScore                 -- Numeric score
StartedAt                  -- First launch timestamp
UpdatedAt                  -- Last update timestamp
```

## Best Practices

### For Content Authors

✅ Always include scorm_api.js in your SCORM packages
✅ Use standard API finder pattern
✅ Test content in both standalone and LMS modes
✅ Don't hardcode API location

### For LMS Developers

✅ Provide API in parent window (scorm-player.html)
✅ Use injection as fallback, not primary method
✅ Log API calls for debugging
✅ Implement proper error handling
✅ Save data frequently (on commit, not just finish)

## Troubleshooting

### Content can't find API

**Symptoms:**
- Console shows "SCORM: No API found"
- Progress not saving
- Content runs but doesn't track

**Solutions:**
1. Verify parent window has API (check window.parent.API)
2. Check for CORS issues between iframe and parent
3. Enable script injection as fallback
4. Verify content includes scorm_api.js

### Data not persisting

**Symptoms:**
- Progress resets on page reload
- API calls succeed but data lost

**Solutions:**
1. Check LMSCommit is being called
2. Verify postMessage events are received
3. Check database connection
4. Verify learner is authenticated

### Script injection breaking content

**Symptoms:**
- Layout issues after injection
- Duplicate scripts
- CSP errors

**Solutions:**
1. Disable injection for specific content
2. Use conditional injection (check if script exists)
3. Switch to window communication approach
4. Update CSP headers to allow inline scripts

## Migration Path

To migrate from injection to window communication:

```
1. Test current SCORM content without injection
2. Identify content that needs injection (legacy/broken)
3. Keep injection for legacy content only
4. New content uses window communication
5. Gradually phase out injection as content is updated
```

## Performance Comparison

| Approach | HTML Processing | Memory | Network | Compatibility |
|----------|----------------|---------|---------|---------------|
| **Injection** | High (regex) | Medium | Same | 95% |
| **Window Comm** | None | Low | Same | 85% |

**Recommendation:** Use window communication for new content, keep injection as fallback for legacy content.

## Example: Hybrid Approach

```csharp
// ScormProxyController.cs
if (contentType.Contains("text/html"))
{
    var htmlContent = System.Text.Encoding.UTF8.GetString(content);
    
    // Only inject if content doesn't have its own SCORM script
    bool hasOwnScormScript = htmlContent.Contains("scorm_api.js") || 
                            htmlContent.Contains("findAPI");
    
    if (!hasOwnScormScript)
    {
        _logger.LogInformation("Injecting SCORM API for legacy content: {Url}", url);
        htmlContent = InjectScormApi(htmlContent);
        content = System.Text.Encoding.UTF8.GetBytes(htmlContent);
    }
    else
    {
        _logger.LogInformation("Using native SCORM API finder: {Url}", url);
        // Serve content as-is
    }
}
```

This gives you:
- Native performance for modern SCORM content
- Fallback support for legacy content
- Gradual migration path
- Better debugging (logs which approach is used)
