/**
 * SCORM 1.2 API Wrapper
 * LMS Box Standard Template
 */

var SCORM = (function() {
    var api = null;
    var initialized = false;
    var terminated = false;
    var startTime = null;

    function findAPI(win) {
        var attempts = 0;
        var maxAttempts = 500;
        
        while ((!win.API) && (win.parent) && (win.parent != win) && (attempts < maxAttempts)) {
            attempts++;
            win = win.parent;
        }
        
        if (win.API) {
            return win.API;
        }
        
        if (window.opener && typeof(window.opener) !== "undefined") {
            attempts = 0;
            win = window.opener;
            while ((!win.API) && (win.parent) && (win.parent != win) && (attempts < maxAttempts)) {
                attempts++;
                win = win.parent;
            }
            if (win.API) {
                return win.API;
            }
        }
        
        return null;
    }

    function initialize() {
        if (initialized) return true;
        
        api = findAPI(window);
        
        if (api) {
            var result = api.LMSInitialize("");
            if (result === "true" || result === true) {
                initialized = true;
                startTime = new Date();
                
                var status = api.LMSGetValue("cmi.core.lesson_status");
                if (status === "" || status === "not attempted") {
                    api.LMSSetValue("cmi.core.lesson_status", "incomplete");
                    api.LMSCommit("");
                }
                
                console.log("SCORM: Initialized successfully");
                return true;
            } else {
                console.log("SCORM: LMSInitialize failed");
                return false;
            }
        } else {
            console.log("SCORM: No API found - running in standalone mode");
            initialized = true;
            startTime = new Date();
            return true;
        }
    }

    function getValue(element) {
        if (!initialized || !api) return "";
        return api.LMSGetValue(element);
    }

    function setValue(element, value) {
        if (!initialized || !api) return false;
        var result = api.LMSSetValue(element, value);
        return (result === "true" || result === true);
    }

    function commit() {
        if (!initialized || !api) return false;
        var result = api.LMSCommit("");
        return (result === "true" || result === true);
    }

    function getSessionTime() {
        if (!startTime) return "0000:00:00";
        
        var now = new Date();
        var elapsed = now - startTime;
        
        var hours = Math.floor(elapsed / 3600000);
        elapsed -= hours * 3600000;
        var minutes = Math.floor(elapsed / 60000);
        elapsed -= minutes * 60000;
        var seconds = Math.floor(elapsed / 1000);
        
        var hoursStr = String(hours).padStart(4, '0');
        var minutesStr = String(minutes).padStart(2, '0');
        var secondsStr = String(seconds).padStart(2, '0');
        
        return hoursStr + ":" + minutesStr + ":" + secondsStr;
    }

    function setBookmark(location) {
        return setValue("cmi.core.lesson_location", String(location));
    }

    function getBookmark() {
        var location = getValue("cmi.core.lesson_location");
        return location ? parseInt(location, 10) : 0;
    }

    function setSuspendData(data) {
        return setValue("cmi.suspend_data", data);
    }

    function getSuspendData() {
        return getValue("cmi.suspend_data");
    }

    function setStatus(status) {
        return setValue("cmi.core.lesson_status", status);
    }

    function getStatus() {
        return getValue("cmi.core.lesson_status");
    }

    function complete() {
        setValue("cmi.core.lesson_status", "completed");
        setValue("cmi.core.session_time", getSessionTime());
        commit();
        console.log("SCORM: Course marked as completed");
    }

    function saveProgress(slideIndex, additionalData) {
        setBookmark(slideIndex);
        
        var data = {
            slide: slideIndex,
            timestamp: new Date().toISOString()
        };
        
        if (additionalData) {
            data = Object.assign(data, additionalData);
        }
        
        setSuspendData(JSON.stringify(data));
        commit();
        console.log("SCORM: Progress saved at slide " + slideIndex);
    }

    function loadProgress() {
        var bookmark = getBookmark();
        var suspendData = getSuspendData();
        
        var data = {
            slide: bookmark
        };
        
        if (suspendData) {
            try {
                data = JSON.parse(suspendData);
            } catch (e) {
                console.log("SCORM: Could not parse suspend data");
            }
        }
        
        return data;
    }

    function terminate() {
        if (terminated || !initialized) return true;
        
        setValue("cmi.core.session_time", getSessionTime());
        commit();
        
        if (api) {
            var result = api.LMSFinish("");
            terminated = true;
            console.log("SCORM: Terminated");
            return (result === "true" || result === true);
        }
        
        return true;
    }

    return {
        initialize: initialize,
        getValue: getValue,
        setValue: setValue,
        commit: commit,
        setBookmark: setBookmark,
        getBookmark: getBookmark,
        setSuspendData: setSuspendData,
        getSuspendData: getSuspendData,
        setStatus: setStatus,
        getStatus: getStatus,
        complete: complete,
        saveProgress: saveProgress,
        loadProgress: loadProgress,
        terminate: terminate,
        isAvailable: function() { return api !== null; }
    };
})();

window.addEventListener('load', function() {
    SCORM.initialize();
});

window.addEventListener('beforeunload', function() {
    SCORM.terminate();
});
