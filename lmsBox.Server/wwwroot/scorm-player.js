// SCORM Player JavaScript - Handles messages from injected SCORM API

(function() {
    'use strict';
    
    // Get parameters from URL
    var urlParams = new URLSearchParams(window.location.search);
    var lessonId = urlParams.get('lessonId');
    var courseId = urlParams.get('courseId');
    var apiBase = window.location.origin;
    
    console.log('🎬 SCORM Player initialized with:', {
        lessonId: lessonId,
        courseId: courseId,
        apiBase: apiBase,
        hasLocalStorage: typeof(Storage) !== "undefined"
    });
    
    // Get auth token from localStorage (same origin)
    var authToken = null;
    try {
        authToken = localStorage.getItem('token');
        console.log('🔑 Auth token from localStorage:', authToken ? 'Found (' + authToken.substring(0, 20) + '...)' : 'Not found');
    } catch (e) {
        console.error('❌ Could not access localStorage for auth token:', e);
    }
    
    // Store to pass saved SCORM data to iframe
    var savedScormData = {
        lessonStatus: "not attempted",
        score: "",
        lessonLocation: "",
        suspendData: ""
    };
    
    // SCORM data that tracks changes made during the session
    var currentScormData = {};
    var isInitialized = false;
    var isSaving = false; // Prevent concurrent saves
    
    // Create SCORM 1.2 API for content that uses window.parent.API
    window.API = {
        LMSInitialize: function(param) {
            console.log('📘 API.LMSInitialize called');
            isInitialized = true;
            return "true";
        },
        
        LMSFinish: function(param) {
            console.log('📕 API.LMSFinish called');
            this.LMSCommit("");
            isInitialized = false;
            return "true";
        },
        
        LMSGetValue: function(element) {
            console.log('📥 API.LMSGetValue:', element);
            
            // Return from current session data if set, otherwise from saved data
            if (element === "cmi.core.lesson_status") {
                return currentScormData.scormLessonStatus || savedScormData.lessonStatus || "not attempted";
            } else if (element === "cmi.core.score.raw") {
                return currentScormData.scormScore || savedScormData.score || "";
            } else if (element === "cmi.core.lesson_location") {
                return currentScormData.scormLessonLocation || savedScormData.lessonLocation || "";
            } else if (element === "cmi.suspend_data") {
                return currentScormData.scormData || savedScormData.suspendData || "";
            } else if (element === "cmi.core.student_name") {
                return "Learner";
            } else if (element === "cmi.core.student_id") {
                return "learner-id";
            }
            
            return "";
        },
        
        LMSSetValue: function(element, value) {
            console.log('📤 API.LMSSetValue:', element, '=', value);
            
            if (element === "cmi.core.lesson_status") {
                // Protect completed/passed status from being downgraded
                var currentStatus = currentScormData.scormLessonStatus || savedScormData.lessonStatus;
                
                // NEVER allow setting to incomplete - always upgrade to completed instead
                if (value === 'incomplete' || value === 'not attempted') {
                    // If we already have a better status, keep it
                    if (currentStatus === 'completed' || currentStatus === 'passed') {
                        console.log('🔒 Preventing status downgrade from', currentStatus, 'to', value);
                        return "true";
                    }
                    // Block "incomplete" entirely - SCORM content should use "completed" or "not attempted"
                    console.log('🚫 Blocking "incomplete" status - ignoring:', value);
                    return "true";
                }
                
                currentScormData.scormLessonStatus = String(value);
            } else if (element === "cmi.core.score.raw") {
                currentScormData.scormScore = String(value);
            } else if (element === "cmi.core.lesson_location") {
                currentScormData.scormLessonLocation = String(value);
            } else if (element === "cmi.suspend_data") {
                currentScormData.scormData = String(value);
            } else if (element === "cmi.core.session_time") {
                // Track session time but don't save it
                console.log('⏱️ Session time:', value);
            }
            
            return "true";
        },
        
        LMSCommit: function(param) {
            console.log('💾 API.LMSCommit called - saving data to backend');
            
            // Save current data to backend
            if (!lessonId || !authToken) {
                console.warn('❌ Cannot commit: missing lessonId or authToken');
                return "true";
            }
            
            // Only save if there's actual data to save
            if (Object.keys(currentScormData).length === 0) {
                console.log('ℹ️ No data to commit');
                return "true";
            }
            
            // Prevent concurrent saves
            if (isSaving) {
                console.log('⏳ Save already in progress, skipping...');
                return "true";
            }
            
            isSaving = true;
            
            var isCompleted = currentScormData.scormLessonStatus === 'completed' || 
                             currentScormData.scormLessonStatus === 'passed';
            
            console.log('💾 Committing SCORM data:', currentScormData);
            
            fetch(apiBase + '/api/learner/progress/lessons/' + lessonId + '/scorm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + authToken
                },
                body: JSON.stringify(currentScormData)
            })
            .then(function(response) {
                if (response.ok) {
                    console.log('✅ SCORM data committed successfully');
                    
                    // Update saved data with current data
                    Object.assign(savedScormData, currentScormData);
                    
                    // Notify parent window if lesson was completed
                    if (isCompleted && window.parent && window.parent !== window) {
                        console.log('📢 Notifying parent of SCORM completion');
                        window.parent.postMessage({
                            type: 'scorm-lesson-completed',
                            lessonId: lessonId
                        }, '*');
                    }
                    
                    return response.json();
                } else {
                    console.error('❌ Failed to commit SCORM data:', response.status);
                    return response.text().then(function(text) {
                        console.error('Error details:', text);
                    });
                }
            })
            .then(function(data) {
                if (data) console.log('Backend response:', data);
            })
            .catch(function(error) {
                console.error('❌ Error committing SCORM data:', error);
            })
            .finally(function() {
                isSaving = false;
            });
            
            return "true";
        },
        
        LMSGetLastError: function() {
            return "0";
        },
        
        LMSGetErrorString: function(errorCode) {
            return "No error";
        },
        
        LMSGetDiagnostic: function(errorCode) {
            return "No error";
        }
    };
    
    console.log('✅ SCORM 1.2 API created on window.API for content access via window.parent.API');
    
    // Fetch existing SCORM data for bookmarking/resume
    function loadSavedScormData() {
        if (!lessonId || !authToken) {
            console.warn('⚠️ Cannot load saved SCORM data: missing lessonId or authToken');
            return Promise.resolve();
        }
        
        console.log('📖 Loading saved SCORM data for lesson', lessonId);
        
        return fetch(apiBase + '/api/learner/progress/lessons/' + lessonId + '/scorm', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + authToken
            }
        })
        .then(function(response) {
            if (response.ok) {
                return response.json();
            } else {
                console.warn('⚠️ Could not load saved SCORM data:', response.status);
                return null;
            }
        })
        .then(function(data) {
            if (data) {
                savedScormData.lessonStatus = data.scormLessonStatus || "not attempted";
                savedScormData.score = data.scormScore || "";
                savedScormData.lessonLocation = data.scormLessonLocation || "";
                savedScormData.suspendData = data.scormData || "";
                
                console.log('✅ Loaded saved SCORM data:', {
                    status: savedScormData.lessonStatus,
                    score: savedScormData.score,
                    bookmark: savedScormData.lessonLocation,
                    suspendDataLength: savedScormData.suspendData.length
                });
                
                // Inject saved data into iframe for stub API to use
                window.savedScormData = savedScormData;
            }
        })
        .catch(function(error) {
            console.error('❌ Error loading saved SCORM data:', error);
        });
    }
    
    // Listen for messages from the injected SCORM API in the iframe
    window.addEventListener('message', function(event) {
        // Handle scorm-request-data - send saved data immediately when iframe requests it
        if (event.data && event.data.type === 'scorm-request-data') {
            console.log('📨 Iframe requested SCORM data, sending:', savedScormData);
            
            // Send data to the requesting iframe
            if (event.source) {
                event.source.postMessage({
                    type: 'scorm-init-data',
                    data: savedScormData
                }, '*');
            }
            return;
        }
        
        // Handle scorm-save messages from the stub API injected by proxy
        if (event.data && event.data.type === 'scorm-save') {
            console.log('📩 Received scorm-save message from iframe:', event.data.data);
            
            if (!lessonId || !authToken) {
                console.warn('❌ Cannot save SCORM data: missing lessonId or authToken', {
                    lessonId: lessonId,
                    hasToken: !!authToken
                });
                return;
            }
            
            // Prevent concurrent saves
            if (isSaving) {
                console.log('⏳ Save already in progress from postMessage, skipping...');
                return;
            }
            
            isSaving = true;
            
            // AUTO-FIX: Replace "incomplete" with "completed" if we already have completed status
            if (event.data.data.scormLessonStatus === 'incomplete' || event.data.data.scormLessonStatus === 'not attempted') {
                var currentStatus = currentScormData.scormLessonStatus || savedScormData.lessonStatus;
                if (currentStatus === 'completed' || currentStatus === 'passed') {
                    console.log('🔄 AUTO-FIX: Replacing', event.data.data.scormLessonStatus, 'with', currentStatus);
                    event.data.data.scormLessonStatus = currentStatus; // Replace with completed
                } else {
                    // If not completed yet, completely ignore incomplete status
                    console.log('🚫 IGNORING incomplete status - no save performed');
                    isSaving = false;
                    return;
                }
            }
            
            // Update local saved data
            if (event.data.data.scormLessonStatus) savedScormData.lessonStatus = event.data.data.scormLessonStatus;
            if (event.data.data.scormScore) savedScormData.score = event.data.data.scormScore;
            if (event.data.data.scormLessonLocation) savedScormData.lessonLocation = event.data.data.scormLessonLocation;
            if (event.data.data.scormData) savedScormData.suspendData = event.data.data.scormData;
            
            // Check if lesson was marked as completed
            var isCompleted = event.data.data.scormLessonStatus === 'completed' || 
                             event.data.data.scormLessonStatus === 'passed';
            
            // Save to backend API
            console.log('💾 Saving SCORM data to backend...', event.data.data);
            fetch(apiBase + '/api/learner/progress/lessons/' + lessonId + '/scorm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + authToken
                },
                body: JSON.stringify(event.data.data)
            })
            .then(function(response) {
                if (response.ok) {
                    console.log('✅ SCORM data saved successfully');
                    
                    // Notify parent window if lesson was completed
                    if (isCompleted && window.parent && window.parent !== window) {
                        console.log('📢 Notifying parent window of SCORM completion');
                        window.parent.postMessage({
                            type: 'scorm-lesson-completed',
                            lessonId: lessonId
                        }, '*');
                    }
                    
                    return response.json();
                } else {
                    console.error('❌ Failed to save SCORM data:', response.status, response.statusText);
                    return response.text().then(function(text) {
                        console.error('Error details:', text);
                        throw new Error('Failed to save: ' + response.statusText);
                    });
                }
            })
            .then(function(data) {
                if (data) console.log('Backend response:', data);
            })
            .catch(function(error) {
                console.error('❌ Error saving SCORM data:', error);
            })
            .finally(function() {
                isSaving = false;
            });
        }
    });
    
    // Load SCORM content from proxy (which injects the stub API)
    window.addEventListener('DOMContentLoaded', function() {
        var scormUrl = urlParams.get('url');
        var iframe = document.getElementById('scorm-iframe');
        var loading = document.getElementById('loading');
        
        
        if (scormUrl) {
            console.log('📦 Loading SCORM content from proxy:', scormUrl);
            
            // First load saved SCORM data, then load the content
            loadSavedScormData().then(function() {
                iframe.onload = function() {
                    loading.style.display = 'none';
                    console.log('✅ SCORM content loaded successfully');
                    console.log('🔌 Stub SCORM API injected by proxy - listening for postMessage events');
                    
                    // Send saved SCORM data to iframe after it loads
                    setTimeout(function() {
                        console.log('📤 Sending saved SCORM data to iframe:', savedScormData);
                        iframe.contentWindow.postMessage({
                            type: 'scorm-init-data',
                            data: savedScormData
                        }, '*');
                    }, 500); // Small delay to ensure iframe scripts are ready
                };
                
                iframe.onerror = function() {
                    loading.textContent = 'Error loading SCORM content';
                    console.error('❌ Failed to load SCORM content from:', scormUrl);
                };
                
                // Load from proxy which will inject stub API
                iframe.src = scormUrl;
            });
        } else {
            loading.textContent = 'No SCORM content URL provided';
            console.error('❌ No URL parameter found in query string');
        }
    });
})();
