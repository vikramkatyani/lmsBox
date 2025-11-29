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
        // Handle request for saved data from iframe
        if (event.data && event.data.type === 'scorm-request-data') {
            console.log('📥 Received request for saved data from iframe');
            console.log('📤 Sending saved SCORM data:', savedScormData);
            event.source.postMessage({
                type: 'scorm-init-data',
                data: savedScormData
            }, '*');
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
