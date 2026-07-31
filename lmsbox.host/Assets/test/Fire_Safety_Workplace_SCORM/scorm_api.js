/**
 * SCORM 1.2 API Wrapper
 * Handles communication between the course and the LMS
 */

var SCORM = {
  version: "1.2",
  API: null,
  isInitialized: false,
  isTerminated: false,
  
  // Find the SCORM API in the window hierarchy
  findAPI: function(win) {
    var attempts = 0;
    var maxAttempts = 500;
    
    while ((!win.API) && (win.parent) && (win.parent != win) && (attempts < maxAttempts)) {
      attempts++;
      win = win.parent;
    }
    
    if (win.API) {
      return win.API;
    }
    
    // Try opener window
    if (win.opener && typeof(win.opener) !== "undefined") {
      attempts = 0;
      while ((!win.opener.API) && (win.opener.parent) && (win.opener.parent != win.opener) && (attempts < maxAttempts)) {
        attempts++;
        win.opener = win.opener.parent;
      }
      if (win.opener.API) {
        return win.opener.API;
      }
    }
    
    return null;
  },
  
  // Get the API handle
  getAPI: function() {
    if (this.API == null) {
      this.API = this.findAPI(window);
    }
    return this.API;
  },
  
  // Initialize connection to LMS
  Initialize: function() {
    var api = this.getAPI();
    
    if (api == null) {
      console.log("SCORM API not found. Running in standalone mode.");
      this.isInitialized = true;
      return true;
    }
    
    var result = api.LMSInitialize("");
    
    if (result.toString() === "true" || result === true || result === 1) {
      this.isInitialized = true;
      console.log("SCORM Initialize successful");
      return true;
    } else {
      console.log("SCORM Initialize failed");
      return false;
    }
  },
  
  // Terminate connection to LMS
  Terminate: function() {
    if (this.isTerminated) return true;
    
    var api = this.getAPI();
    
    if (api == null) {
      this.isTerminated = true;
      return true;
    }
    
    var result = api.LMSFinish("");
    
    if (result.toString() === "true" || result === true || result === 1) {
      this.isTerminated = true;
      console.log("SCORM Terminate successful");
      return true;
    } else {
      console.log("SCORM Terminate failed");
      return false;
    }
  },
  
  // Get a value from the LMS
  GetValue: function(element) {
    var api = this.getAPI();
    
    if (api == null) {
      return "";
    }
    
    var value = api.LMSGetValue(element);
    var error = api.LMSGetLastError();
    
    if (error !== "0" && error !== 0) {
      console.log("SCORM GetValue error for " + element + ": " + error);
    }
    
    return value;
  },
  
  // Set a value in the LMS
  SetValue: function(element, value) {
    var api = this.getAPI();
    
    if (api == null) {
      console.log("SCORM SetValue (standalone): " + element + " = " + value);
      return true;
    }
    
    var result = api.LMSSetValue(element, value);
    var error = api.LMSGetLastError();
    
    if (error !== "0" && error !== 0) {
      console.log("SCORM SetValue error for " + element + ": " + error);
      return false;
    }
    
    console.log("SCORM SetValue: " + element + " = " + value);
    return true;
  },
  
  // Commit data to LMS
  Commit: function() {
    var api = this.getAPI();
    
    if (api == null) {
      return true;
    }
    
    var result = api.LMSCommit("");
    
    if (result.toString() === "true" || result === true || result === 1) {
      console.log("SCORM Commit successful");
      return true;
    } else {
      console.log("SCORM Commit failed");
      return false;
    }
  },
  
  // Get last error code
  GetLastError: function() {
    var api = this.getAPI();
    
    if (api == null) {
      return "0";
    }
    
    return api.LMSGetLastError();
  },
  
  // Get error description
  GetErrorString: function(errorCode) {
    var api = this.getAPI();
    
    if (api == null) {
      return "";
    }
    
    return api.LMSGetErrorString(errorCode);
  },
  
  // Get diagnostic info
  GetDiagnostic: function(errorCode) {
    var api = this.getAPI();
    
    if (api == null) {
      return "";
    }
    
    return api.LMSGetDiagnostic(errorCode);
  },
  
  // Helper: Set lesson status
  SetStatus: function(status) {
    return this.SetValue("cmi.core.lesson_status", status);
  },
  
  // Helper: Get lesson status
  GetStatus: function() {
    return this.GetValue("cmi.core.lesson_status");
  },
  
  // Helper: Set score
  SetScore: function(score, min, max) {
    this.SetValue("cmi.core.score.raw", score);
    if (min !== undefined) this.SetValue("cmi.core.score.min", min);
    if (max !== undefined) this.SetValue("cmi.core.score.max", max);
    return this.Commit();
  },
  
  // Helper: Set bookmark (lesson location)
  SetBookmark: function(location) {
    return this.SetValue("cmi.core.lesson_location", location);
  },
  
  // Helper: Get bookmark
  GetBookmark: function() {
    return this.GetValue("cmi.core.lesson_location");
  },
  
  // Helper: Set session time
  SetSessionTime: function(milliseconds) {
    var hours = Math.floor(milliseconds / 3600000);
    var minutes = Math.floor((milliseconds % 3600000) / 60000);
    var seconds = Math.floor((milliseconds % 60000) / 1000);
    
    var timeString = 
      String(hours).padStart(4, '0') + ":" +
      String(minutes).padStart(2, '0') + ":" +
      String(seconds).padStart(2, '0');
    
    return this.SetValue("cmi.core.session_time", timeString);
  },
  
  // Helper: Set suspend data
  SetSuspendData: function(data) {
    return this.SetValue("cmi.suspend_data", data);
  },
  
  // Helper: Get suspend data
  GetSuspendData: function() {
    return this.GetValue("cmi.suspend_data");
  }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SCORM;
}
