// SCORM Player JavaScript - Handles messages from injected SCORM API

(function() {
    'use strict';
    
    // Get parameters from URL
    var urlParams = new URLSearchParams(window.location.search);
    var lessonId = urlParams.get('lessonId');
    var courseId = urlParams.get('courseId');
    var requestedScormVersion = urlParams.get('scormVersion') || '1.2';
    var apiBase = window.location.origin;
    
    console.log('🎬 SCORM Player initialized with:', {
        lessonId: lessonId,
        courseId: courseId,
        apiBase: apiBase,
        hasLocalStorage: typeof(Storage) !== "undefined"
    });
    
    // Get auth token from localStorage (same origin).
    // In local dev the React app runs on :5174 and the player runs on :5132, so
    // localStorage is origin-scoped and the player cannot read the app token.
    // CourseContent passes token via query string as a fallback.
    var authToken = null;
    try {
        authToken = localStorage.getItem('token');
        console.log('🔑 Auth token from localStorage:', authToken ? 'Found (' + authToken.substring(0, 20) + '...)' : 'Not found');
    } catch (e) {
        console.error('❌ Could not access localStorage for auth token:', e);
    }

    if (!authToken) {
        authToken = urlParams.get('token');
        console.log('🔑 Auth token from URL:', authToken ? 'Found (' + authToken.substring(0, 20) + '...)' : 'Not found');
    }

    function decodeJwtPayload(token) {
        if (!token) return null;
        try {
            var parts = token.split('.');
            if (parts.length < 2) return null;
            var base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            var padded = base64 + '==='.slice((base64.length + 3) % 4);
            var json = decodeURIComponent(atob(padded).split('').map(function(ch) {
                return '%' + ('00' + ch.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(json);
        } catch (e) {
            return null;
        }
    }

    function getStoredUserName() {
        try {
            return localStorage.getItem('userName') || '';
        } catch (e) {
            return '';
        }
    }

    var authPayload = decodeJwtPayload(authToken);
    console.log('🔐 JWT Payload decoded:', authPayload);
    var learnerId = '';
    var learnerName = '';

    if (authPayload) {
        learnerId = authPayload.nameid || authPayload.sub || authPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || '';
        learnerName = authPayload.unique_name || authPayload.name || authPayload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || authPayload.email || '';
        console.log('📝 From JWT - learnerId:', learnerId, 'learnerName:', learnerName);
    } else {
        console.log('⚠️ No JWT payload decoded');
    }

    if (!learnerName) {
        learnerName = getStoredUserName() || 'Learner';
        console.log('📝 Using stored/fallback learnerName:', learnerName);
    }

    if (!learnerId) {
        learnerId = 'learner-id';
        console.log('📝 Using fallback learnerId:', learnerId);
    }
    
    console.log('✅ Final learner identity - ID:', learnerId, 'Name:', learnerName);
    
    // Store to pass saved SCORM data to iframe
    var savedScormData = {
        scormVersion: requestedScormVersion,
        lessonStatus: "not attempted",
        score: "",
        lessonLocation: "",
        suspendData: "",
        scormCompletionStatus: "unknown",
        scormSuccessStatus: "unknown",
        scormScoreRaw: "",
        scormScoreMin: "",
        scormScoreMax: "",
        scormScoreScaled: "",
        scormLocation: "",
        scormSuspendData: "",
        scormObjectives: "",
        scormInteractions: ""
    };
    
    // SCORM data that tracks changes made during the session
    var currentScormData = {};
    var isInitialized = false;
    var isSaving = false; // Prevent concurrent saves
    var pendingSaveData = null; // Queue for pending save
    var autoSaveTimer = null; // Debounce timer for SetValue auto-save
    var traceCallsCount = 0; // Diagnostic trace counter
    var tracedElements = {}; // Track which elements we've traced
    var lastPersistSignature = '';
    var lastPersistAt = 0;

    function appendQueryParam(url, key, value) {
        var hashIndex = url.indexOf('#');
        var hash = '';
        var base = url;
        if (hashIndex >= 0) {
            hash = url.substring(hashIndex);
            base = url.substring(0, hashIndex);
        }
        var separator = base.indexOf('?') >= 0 ? '&' : '?';
        return base + separator + key + '=' + value + hash;
    }

    function buildIframeScormUrl(baseUrl) {
        try {
            var initData = Object.assign({}, savedScormData, { learnerId: learnerId, learnerName: learnerName });
            var initPayload = encodeURIComponent(JSON.stringify(initData));
            return appendQueryParam(baseUrl, 'scormInit', initPayload);
        } catch (e) {
            console.warn('⚠️ Could not embed scormInit payload in iframe URL:', e);
            return baseUrl;
        }
    }

    function normalizeLessonStatus(payload) {
        var status = payload.scormLessonStatus;
        if (status) return status;

        if (payload.scormSuccessStatus === 'passed') return 'passed';
        if (payload.scormSuccessStatus === 'failed') return 'failed';
        if (payload.scormCompletionStatus === 'completed') return 'completed';
        if (payload.scormCompletionStatus === 'incomplete') return 'incomplete';

        return '';
    }

    function deriveScorm12LocationFromSuspend(payload) {
        if (!payload || payload.scormVersion !== '1.2') return;
        var locationText = String(payload.scormLessonLocation || '').trim();
        var suspendText = String(payload.scormData || '').trim();
        if (!suspendText) return;

        try {
            var parsed = JSON.parse(suspendText);
            if (!parsed || typeof parsed !== 'object') return;
            var slide = String(parsed.slide || '').trim();
            if (!slide) return;

            // If package resets lesson_location to 1 while suspend_data still has progress,
            // trust suspend_data.slide for resume continuity.
            if (!locationText || locationText === '1') {
                if (slide !== '1') {
                    payload.scormLessonLocation = slide;
                }
            }
        } catch (e) {
            // Non-JSON suspend_data is valid for some packages.
        }
    }

    function looksLikeEmbeddedScormPayload(value) {
        if (typeof value !== 'string') return false;
        var text = value.trim();
        if (text.charAt(0) !== '{') return false;
        return text.indexOf('"completionStatus"') >= 0 &&
               text.indexOf('"successStatus"') >= 0 &&
               text.indexOf('"scoreRaw"') >= 0;
    }

    function deriveInProgressFromSuspendData(status, suspendData) {
        if (!suspendData || typeof suspendData !== 'string') return status;
        if (!(status === 'completed' || status === 'passed')) return status;
        try {
            var parsed = JSON.parse(suspendData);
            if (parsed && typeof parsed === 'object' && parsed.completed === false) {
                return 'incomplete';
            }
        } catch (e) {
            // Non-JSON suspend_data is valid for many packages.
        }
        return status;
    }

    function normalizeScorm12ResumePayload() {
        var suspendText = savedScormData.suspendData;
        if (!suspendText || typeof suspendText !== 'string') return;
        try {
            var parsed = JSON.parse(suspendText);
            if (!parsed || typeof parsed !== 'object') return;

            if (typeof parsed.slide !== 'undefined' && (savedScormData.lessonLocation === '' || savedScormData.lessonLocation == null)) {
                savedScormData.lessonLocation = String(parsed.slide);
            }

            if (typeof parsed.completed === 'boolean' && parsed.completed === true) {
                parsed.completed = false;
                savedScormData.suspendData = JSON.stringify(parsed);
            }
        } catch (e) {
            // Ignore non-JSON suspend_data.
        }
    }

    function getRuntimeScorm12Status() {
        var status = currentScormData.scormLessonStatus || savedScormData.lessonStatus || 'not attempted';
        if (!(status === 'completed' || status === 'passed')) return status;

        var location = (currentScormData.scormLessonLocation || savedScormData.lessonLocation || '').toString().trim();
        var suspendData = (currentScormData.scormData || savedScormData.suspendData || '').toString().trim();
        if (location || suspendData) {
            return 'incomplete';
        }

        return status;
    }

    function hasScorm12ResumeData() {
        var location = (currentScormData.scormLessonLocation || savedScormData.lessonLocation || '').toString().trim();
        var suspendData = (currentScormData.scormData || savedScormData.suspendData || '').toString().trim();
        return !!(location || suspendData);
    }

    // Build a complete save payload from current + saved state.
    // When the lesson is tagged as SCORM 2004 but the package actually uses a SCORM 1.2
    // runtime driver (e.g. Rustici's scormdriver.js), the driver calls window.parent.API
    // (1.2 interface) and populates 1.2-style keys: scormLessonStatus, scormScore,
    // scormLessonLocation, scormData.  We bridge those into the 2004 payload so data
    // is never lost regardless of which runtime the content uses.
    function buildCurrentPayload() {
        var is2004 = requestedScormVersion && requestedScormVersion.indexOf('2004') >= 0;
        if (is2004) {
            // SCORM 1.2 runtime fields that may have been set via window.API.LMSSetValue
            var legacyStatus   = currentScormData.scormLessonStatus   || savedScormData.lessonStatus  || '';
            var legacyScore    = currentScormData.scormScore           || savedScormData.score         || '';
            var legacyLocation = currentScormData.scormLessonLocation  || savedScormData.lessonLocation || '';
            var legacySuspend  = currentScormData.scormData            || '';

            // Map legacy lesson_status to 2004 completion/success terms
            var legacyCompletion = '';
            var legacySuccess    = '';
            if (legacyStatus === 'completed' || legacyStatus === 'passed' || legacyStatus === 'failed') {
                legacyCompletion = 'completed';
                legacySuccess    = (legacyStatus === 'passed') ? 'passed' : (legacyStatus === 'failed' ? 'failed' : 'unknown');
            } else if (legacyStatus === 'incomplete' || legacyStatus === 'browsed') {
                legacyCompletion = 'incomplete';
            }

            var p = {
                scormVersion: requestedScormVersion || '2004-2nd',
                scormCompletionStatus: currentScormData.scormCompletionStatus || legacyCompletion || savedScormData.scormCompletionStatus || 'unknown',
                scormSuccessStatus:    currentScormData.scormSuccessStatus    || legacySuccess    || savedScormData.scormSuccessStatus    || 'unknown',
                scormScoreRaw:         currentScormData.scormScoreRaw         || legacyScore      || savedScormData.scormScoreRaw         || '',
                scormScoreMin:         currentScormData.scormScoreMin         || savedScormData.scormScoreMin         || '',
                scormScoreMax:         currentScormData.scormScoreMax         || savedScormData.scormScoreMax         || '',
                scormScoreScaled:      currentScormData.scormScoreScaled      || savedScormData.scormScoreScaled      || '',
                scormLocation:         currentScormData.scormLocation         || legacyLocation   || savedScormData.scormLocation         || '',
                scormSuspendData:      currentScormData.scormSuspendData      || savedScormData.scormSuspendData || legacySuspend || '',
                scormObjectives:       currentScormData.scormObjectives       || savedScormData.scormObjectives       || '',
                scormInteractions:     currentScormData.scormInteractions     || savedScormData.scormInteractions     || ''
            };
            p.scormLessonStatus = normalizeLessonStatus(p);
            p.scormScore = p.scormScoreRaw;
            p.scormLessonLocation = p.scormLocation;
            p.scormData = p.scormSuspendData;
            return p;
        } else {
            return Object.assign({}, currentScormData);
        }
    }

    // Persist current SCORM state to the backend directly (no postMessage indirection).
    // Pass keepalive=true when called from beforeunload so the request survives navigation.
    function persistToBackend(payload, keepalive) {
        if (!lessonId || !authToken) return;
        if (!payload || Object.keys(payload).length === 0) return;

        // Avoid rapid duplicate saves caused by packages calling Commit repeatedly.
        // Keepalive/unload saves should bypass this guard.
        if (!keepalive) {
            var signature = JSON.stringify(payload);
            var now = Date.now();
            if (signature === lastPersistSignature && (now - lastPersistAt) < 1500) {
                return;
            }
            lastPersistSignature = signature;
            lastPersistAt = now;
        }

        var isCompleted = payload.scormLessonStatus === 'completed' || payload.scormLessonStatus === 'passed';
        var opts = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
            body: JSON.stringify(payload)
        };
        if (keepalive) opts.keepalive = true;
        fetch(apiBase + '/api/learner/progress/lessons/' + lessonId + '/scorm', opts)
            .then(function(r) {
                if (r.ok) {
                    console.log('✅ SCORM persisted to backend');
                    mergeSavedScormDataFromPayload(payload);
                    if (isCompleted && window.parent && window.parent !== window) {
                        window.parent.postMessage({ type: 'scorm-lesson-completed', lessonId: lessonId }, '*');
                    }
                } else {
                    console.error('❌ SCORM persist failed:', r.status);
                }
            })
            .catch(function(e) { console.error('❌ SCORM persist error:', e); });
    }

    // Schedule an auto-save 2 seconds after any SetValue call.
    // This ensures data is captured even if the package never explicitly calls Commit().
    function scheduleAutoSave() {
        if (autoSaveTimer) clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(function() {
            autoSaveTimer = null;
            if (Object.keys(currentScormData).length === 0) return;
            console.log('⏱️ Auto-save triggered after SetValue');
            persistToBackend(buildCurrentPayload(), false);
        }, 2000);
    }

    function mergeSavedScormDataFromPayload(payload) {
        if (!payload) return;

        var payloadIs2004 = payload.scormVersion && payload.scormVersion.indexOf('2004') >= 0;

        if (payload.scormVersion) savedScormData.scormVersion = payload.scormVersion;
        if (payload.scormLessonStatus) savedScormData.lessonStatus = payload.scormLessonStatus;
        if (payload.scormScore) savedScormData.score = payload.scormScore;
        if (payload.scormLessonLocation) savedScormData.lessonLocation = payload.scormLessonLocation;
        if (payload.scormData && !payloadIs2004 && !looksLikeEmbeddedScormPayload(payload.scormData)) {
            savedScormData.suspendData = payload.scormData;
        }

        if (!payloadIs2004) {
            savedScormData.lessonStatus = deriveInProgressFromSuspendData(
                savedScormData.lessonStatus,
                savedScormData.suspendData
            );
            normalizeScorm12ResumePayload();
        }

        if (payload.scormCompletionStatus) savedScormData.scormCompletionStatus = payload.scormCompletionStatus;
        if (payload.scormSuccessStatus) savedScormData.scormSuccessStatus = payload.scormSuccessStatus;
        if (payload.scormScoreRaw) savedScormData.scormScoreRaw = payload.scormScoreRaw;
        if (payload.scormScoreMin) savedScormData.scormScoreMin = payload.scormScoreMin;
        if (payload.scormScoreMax) savedScormData.scormScoreMax = payload.scormScoreMax;
        if (payload.scormScoreScaled) savedScormData.scormScoreScaled = payload.scormScoreScaled;
        if (payload.scormLocation) savedScormData.scormLocation = payload.scormLocation;
        if (payload.scormSuspendData && !looksLikeEmbeddedScormPayload(payload.scormSuspendData)) savedScormData.scormSuspendData = payload.scormSuspendData;
        if (payload.scormObjectives) savedScormData.scormObjectives = payload.scormObjectives;
        if (payload.scormInteractions) savedScormData.scormInteractions = payload.scormInteractions;
    }
    
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
            // === DIAGNOSTIC TRACE FOR FIRE SAFETY RESUME ===
            if (traceCallsCount < 20 && !tracedElements[element]) {
                tracedElements[element] = true;
                traceCallsCount++;
            }
            
            // Capture the returned value for tracing
            var returnValue = "";
            
            // Return from current session data if set, otherwise from saved data
            if (element === "cmi.core.lesson_status") {
                returnValue = getRuntimeScorm12Status();
            } else if (element === "cmi.core.score.raw") {
                returnValue = currentScormData.scormScore || savedScormData.score || "";
            } else if (element === "cmi.core.lesson_location") {
                returnValue = currentScormData.scormLessonLocation || savedScormData.lessonLocation || "";
            } else if (element === "cmi.suspend_data") {
                returnValue = currentScormData.scormData || savedScormData.suspendData || "";
            } else if (element === "cmi.core.entry") {
                returnValue = hasScorm12ResumeData() ? "resume" : "ab-initio";
            } else if (element === "cmi.core.lesson_mode") {
                returnValue = "normal";
            } else if (element === "cmi.core.student_name") {
                returnValue = "Learner";
            } else if (element === "cmi.core.student_id") {
                returnValue = "learner-id";
            }
            
            // Log trace for first 20 unique elements queried (one-time per element)
            if (tracedElements[element] && Object.keys(tracedElements).length <= 20) {
                console.log(`[SCORM-TRACE] 📥 GetValue(${element}) => "${returnValue}"`);
                
                // Extra detail for critical resume fields
                if (element === "cmi.core.lesson_status") {
                    console.log(`  [TRACE] Current: "${currentScormData.scormLessonStatus}" | Saved: "${savedScormData.lessonStatus}"`);
                }
                if (element === "cmi.core.lesson_location") {
                    console.log(`  [TRACE] Current: "${currentScormData.scormLessonLocation}" | Saved: "${savedScormData.lessonLocation}"`);
                }
                if (element === "cmi.suspend_data") {
                    var suspendVal = (currentScormData.scormData || savedScormData.suspendData || "");
                    console.log(`  [TRACE] Length: ${suspendVal.length} | First 80 chars: "${suspendVal.substring(0, 80)}"`);
                }
                if (element === "cmi.core.entry") {
                    console.log(`  [TRACE] HasResumeData: ${hasScorm12ResumeData()} | LessonLocation: "${savedScormData.lessonLocation}"`);
                }
            }
            
            console.log('📥 API.LMSGetValue:', element);
            return returnValue;
        },
        
        LMSSetValue: function(element, value) {
            console.log('📤 API.LMSSetValue:', element, '=', value);
            
            // === RESUME INTERCEPT: Detect and prevent slide 1 reset ===
            // Fire Safety hardcodes slide 1 on startup, overwriting saved bookmark.
            // If this is a resume attempt (saved data exists) and package tries to set slide 1,
            // force it to use the saved slide instead.
            var originalValue = String(value);
            var interceptedValue = originalValue;
            
            if (element === "cmi.core.lesson_location") {
                // Check if package is trying to reset to slide 1 during resume
                if (originalValue === "1" && savedScormData.lessonLocation && savedScormData.lessonLocation !== "1") {
                    interceptedValue = savedScormData.lessonLocation;
                    console.log(`🚫 INTERCEPT: Bypassed slide 1 reset. Restoring saved location: ${interceptedValue}`);
                }
            } else if (element === "cmi.suspend_data") {
                // Check if suspend_data is being set to slide 1 during resume
                try {
                    var incomingData = JSON.parse(originalValue);
                    if (incomingData && incomingData.slide === 1 && savedScormData.suspendData) {
                        var savedData = JSON.parse(savedScormData.suspendData);
                        if (savedData && savedData.slide && savedData.slide !== 1) {
                            // Keep the incoming structure but restore saved slide
                            incomingData.slide = savedData.slide;
                            incomingData.completed = savedData.completed; // Also restore completed status
                            interceptedValue = JSON.stringify(incomingData);
                            console.log(`🚫 INTERCEPT: Bypassed suspend_data slide 1 reset. Restoring saved slide: ${savedData.slide}`);
                        }
                    }
                } catch (e) {
                    // suspend_data might not be JSON, fall through to normal handling
                }
            }
            
            if (element === "cmi.core.lesson_status") {
                currentScormData.scormLessonStatus = String(value);
            } else if (element === "cmi.core.score.raw") {
                currentScormData.scormScore = String(value);
            } else if (element === "cmi.core.lesson_location") {
                currentScormData.scormLessonLocation = interceptedValue;
            } else if (element === "cmi.suspend_data") {
                currentScormData.scormData = interceptedValue;
            } else if (element === "cmi.core.session_time") {
                console.log('⏱️ Session time:', value);
            }

            scheduleAutoSave();
            return "true";
        },
        
        LMSCommit: function(param) {
            console.log('💾 API.LMSCommit called - saving data to backend');

            // Commit is an explicit save signal from the package, so cancel any pending
            // debounced auto-save to avoid duplicate POST requests for the same payload.
            if (autoSaveTimer) {
                clearTimeout(autoSaveTimer);
                autoSaveTimer = null;
            }
            
            // Use persistToBackend so that 1.2→2004 bridging in buildCurrentPayload is applied.
            if (Object.keys(currentScormData).length === 0) {
                console.log('ℹ️ LMSCommit: no data to commit');
                return "true";
            }
            console.log('💾 LMSCommit: committing SCORM 1.2 data via persistToBackend');
            persistToBackend(buildCurrentPayload(), false);
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

    // Create SCORM 2004 2nd Edition API for content that uses window.parent.API_1484_11
    window.API_1484_11 = {
        // Add cmi object with direct properties for packages that read them as properties
        cmi: {
            learner_id: learnerId,      // Set immediately with extracted learner ID
            learner_name: learnerName,  // Set immediately with extracted learner name
            mode: 'normal',
            completion_status: 'unknown',
            success_status: 'unknown',
            score: { raw: '', min: '', max: '', scaled: '' },
            location: '',
            suspend_data: '',
            objectives: [],
            interactions: []
        },

        Initialize: function(param) {
            console.log('📘 API_1484_11.Initialize called');
            console.log('🔧 Current cmi object at Initialize:', { learner_id: this.cmi.learner_id, learner_name: this.cmi.learner_name, mode: this.cmi.mode });
            isInitialized = true;
            return "true";
        },

        Terminate: function(param) {
            console.log('📕 API_1484_11.Terminate called');
            this.Commit("");
            isInitialized = false;
            return "true";
        },

        GetValue: function(element) {
            if (element === 'cmi.completion_status') return currentScormData.scormCompletionStatus || savedScormData.scormCompletionStatus || 'unknown';
            if (element === 'cmi.success_status') return currentScormData.scormSuccessStatus || savedScormData.scormSuccessStatus || 'unknown';
            if (element === 'cmi.score.raw') return currentScormData.scormScoreRaw || savedScormData.scormScoreRaw || '';
            if (element === 'cmi.score.min') return currentScormData.scormScoreMin || savedScormData.scormScoreMin || '';
            if (element === 'cmi.score.max') return currentScormData.scormScoreMax || savedScormData.scormScoreMax || '';
            if (element === 'cmi.score.scaled') return currentScormData.scormScoreScaled || savedScormData.scormScoreScaled || '';
            if (element === 'cmi.location') return currentScormData.scormLocation || savedScormData.scormLocation || savedScormData.lessonLocation || '';
            if (element === 'cmi.suspend_data') return currentScormData.scormSuspendData || savedScormData.scormSuspendData || savedScormData.suspendData || '';
            if (element === 'cmi.learner_id') {
                console.log('🎯 GetValue(cmi.learner_id) returning:', learnerId);
                return learnerId;
            }
            if (element === 'cmi.learner_name') {
                console.log('🎯 GetValue(cmi.learner_name) returning:', learnerName);
                return learnerName;
            }
            if (element === 'cmi.mode') {
                console.log('🎯 GetValue(cmi.mode) returning: normal');
                return 'normal';
            }
            return '';
        },

        SetValue: function(element, value) {
            var text = String(value || '');
            if (element === 'cmi.completion_status') {
                currentScormData.scormCompletionStatus = text;
                this.cmi.completion_status = text;
            }
            else if (element === 'cmi.success_status') {
                currentScormData.scormSuccessStatus = text;
                this.cmi.success_status = text;
            }
            else if (element === 'cmi.score.raw') {
                currentScormData.scormScoreRaw = text;
                this.cmi.score.raw = text;
            }
            else if (element === 'cmi.score.min') {
                currentScormData.scormScoreMin = text;
                this.cmi.score.min = text;
            }
            else if (element === 'cmi.score.max') {
                currentScormData.scormScoreMax = text;
                this.cmi.score.max = text;
            }
            else if (element === 'cmi.score.scaled') {
                currentScormData.scormScoreScaled = text;
                this.cmi.score.scaled = text;
            }
            else if (element === 'cmi.location') {
                currentScormData.scormLocation = text;
                this.cmi.location = text;
            }
            else if (element === 'cmi.suspend_data') {
                currentScormData.scormSuspendData = text;
                this.cmi.suspend_data = text;
            }
            else if (element.indexOf('cmi.objectives.') === 0) currentScormData.scormObjectives = text;
            else if (element.indexOf('cmi.interactions.') === 0) currentScormData.scormInteractions = text;

            scheduleAutoSave();
            return 'true';
        },

        Commit: function(param) {
            if (!lessonId || !authToken) return 'true';

            if (autoSaveTimer) {
                clearTimeout(autoSaveTimer);
                autoSaveTimer = null;
            }

            persistToBackend(buildCurrentPayload(), false);
            return 'true';
        },

        GetLastError: function() { return '0'; },
        GetErrorString: function() { return 'No error'; },
        GetDiagnostic: function() { return 'No error'; }
    };

    console.log('✅ SCORM 2004 API created on window.API_1484_11 for content access via window.parent.API_1484_11');
    console.log('📦 API_1484_11.cmi populated with:', { learner_id: window.API_1484_11.cmi.learner_id, learner_name: window.API_1484_11.cmi.learner_name, mode: window.API_1484_11.cmi.mode });
    
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
                mergeSavedScormDataFromPayload(data);
                if (requestedScormVersion && requestedScormVersion.indexOf('2004') >= 0 && savedScormData.scormVersion === '1.2') {
                    savedScormData.scormVersion = requestedScormVersion;
                }
                if (!savedScormData.lessonStatus || savedScormData.lessonStatus === 'not attempted') {
                    var derivedStatus = normalizeLessonStatus(data);
                    if (derivedStatus) savedScormData.lessonStatus = derivedStatus;
                }
                
                console.log('✅ Loaded saved SCORM data:', {
                    version: savedScormData.scormVersion,
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
                    data: Object.assign({}, savedScormData, { learnerId: learnerId, learnerName: learnerName })
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
            
            // Prevent concurrent saves - queue instead of skipping
            if (isSaving) {
                console.log('⏳ Save already in progress, queuing this save...');
                // Merge with pending save or create new one
                if (!pendingSaveData) {
                    pendingSaveData = {};
                }
                // Merge data - completed status takes priority
                Object.assign(pendingSaveData, event.data.data);
                return;
            }
            
            isSaving = true;

            var normalizedStatus = normalizeLessonStatus(event.data.data);
            if (!event.data.data.scormLessonStatus && normalizedStatus) {
                event.data.data.scormLessonStatus = normalizedStatus;
            }
            deriveScorm12LocationFromSuspend(event.data.data);
            
            // Keep latest package-reported status for SCORM 1.2 so resume/bookmark logic
            // in content that depends on lesson_status can continue from the last screen.
            if (event.data.data.scormLessonStatus === 'completed' || event.data.data.scormLessonStatus === 'passed') {
                savedScormData.lessonStatus = event.data.data.scormLessonStatus;
                currentScormData.scormLessonStatus = event.data.data.scormLessonStatus;
                console.log('🔒 Locked completion status:', event.data.data.scormLessonStatus);
            }
            
            // Update local saved data
            mergeSavedScormDataFromPayload(event.data.data);
            
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
                
                // Process pending save if any
                if (pendingSaveData) {
                    console.log('📤 Processing queued save:', pendingSaveData);
                    var dataToSave = pendingSaveData;
                    pendingSaveData = null;
                    
                    // Trigger the save by posting a message to self
                    window.postMessage({
                        type: 'scorm-save',
                        data: dataToSave
                    }, '*');
                }
            });
        }
    });

    // Final save when learner navigates away from the player page.
    // fetch with keepalive:true allows the request to complete even after the page unloads.
    window.addEventListener('beforeunload', function() {
        if (!lessonId || !authToken) return;
        if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
        var payload = buildCurrentPayload();
        // For SCORM 2004, buildCurrentPayload always returns a full object (using savedScormData
        // fallbacks), so we check a meaningful field to avoid a no-op save.
        // For SCORM 1.2, payload is a copy of currentScormData which may be empty.
        var hasData = Object.keys(payload).length > 0 &&
                      (payload.scormVersion ||
                       (payload.scormLessonStatus && payload.scormLessonStatus !== 'not attempted') ||
                       (payload.scormCompletionStatus && payload.scormCompletionStatus !== 'unknown') ||
                       payload.scormLocation || payload.scormSuspendData || payload.scormData);
        if (!hasData) return;
        persistToBackend(payload, true);
    });
    
    // Load SCORM content from proxy (which injects the stub API)
    window.addEventListener('DOMContentLoaded', function() {
        var scormUrl = urlParams.get('url');
        var iframe = document.getElementById('scorm-iframe');
        var loading = document.getElementById('loading');
        
        // Setup fullscreen controls
        var fullscreenBtn = document.getElementById('fullscreen-btn');
        var minimizeBtn = document.getElementById('minimize-btn');
        
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', function() {
                if (document.body.requestFullscreen) {
                    document.body.requestFullscreen();
                } else if (document.body.webkitRequestFullscreen) {
                    document.body.webkitRequestFullscreen();
                } else if (document.body.mozRequestFullScreen) {
                    document.body.mozRequestFullScreen();
                } else if (document.body.msRequestFullscreen) {
                    document.body.msRequestFullscreen();
                }
            });
        }
        
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', function() {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            });
        }
        
        // Listen for fullscreen changes to toggle buttons
        document.addEventListener('fullscreenchange', toggleButtons);
        document.addEventListener('webkitfullscreenchange', toggleButtons);
        document.addEventListener('mozfullscreenchange', toggleButtons);
        document.addEventListener('MSFullscreenChange', toggleButtons);
        
        function toggleButtons() {
            var isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || 
                                 document.mozFullScreenElement || document.msFullscreenElement);
            
            if (fullscreenBtn) fullscreenBtn.style.display = isFullscreen ? 'none' : 'flex';
            if (minimizeBtn) minimizeBtn.style.display = isFullscreen ? 'flex' : 'none';
        }
        
        if (scormUrl) {
            // First load saved SCORM data, then load the content
            loadSavedScormData().then(function() {
                var iframeSrc = buildIframeScormUrl(scormUrl);
                console.log('📦 Loading SCORM content from proxy:', iframeSrc);

                iframe.onload = function() {
                    loading.style.display = 'none';
                    console.log('✅ SCORM content loaded successfully');
                    console.log('🔌 Stub SCORM API injected by proxy - listening for postMessage events');
                    
                    // Send saved SCORM data to iframe after it loads
                    setTimeout(function() {
                        console.log('📤 Sending saved SCORM data to iframe:', savedScormData);
                        iframe.contentWindow.postMessage({
                            type: 'scorm-init-data',
                            data: Object.assign({}, savedScormData, { learnerId: learnerId, learnerName: learnerName })
                        }, '*');
                    }, 500); // Small delay to ensure iframe scripts are ready
                };
                
                iframe.onerror = function() {
                    loading.textContent = 'Error loading SCORM content';
                    console.error('❌ Failed to load SCORM content from:', iframeSrc);
                };
                
                // Load from proxy which will inject stub API
                iframe.src = iframeSrc;
            });
        } else {
            loading.textContent = 'No SCORM content URL provided';
            console.error('❌ No URL parameter found in query string');
        }
    });
})();
