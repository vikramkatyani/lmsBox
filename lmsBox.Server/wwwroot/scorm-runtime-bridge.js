(function () {
    'use strict';

    var state = {
        scorm12: {
            lessonStatus: 'not attempted',
            score: '',
            lessonLocation: '',
            suspendData: ''
        },
        scorm2004: {
            completionStatus: 'unknown',
            successStatus: 'unknown',
            scoreRaw: '',
            scoreMin: '',
            scoreMax: '',
            scoreScaled: '',
            location: '',
            suspendData: '',
            objectives: '',
            interactions: ''
        }
    };

    var learnerId = '';
    var learnerName = '';

    var dataLoaded = false;
    var pendingCommit12 = false;
    var pendingCommit2004 = false;
    var autoSaveTimer12 = null;
    var autoSaveTimer2004 = null;
    var requestDataRetryTimer = null;
    var requestDataRetryCount = 0;
    var scorm2004Version = ''; // updated from scorm-init-data
    var isScorm2004Launch = false;

    function doAutoSave12() {
        autoSaveTimer12 = null;
        if (!dataLoaded) { autoSaveTimer12 = setTimeout(doAutoSave12, 500); return; }
        saveScorm12();
    }

    function doAutoSave2004() {
        autoSaveTimer2004 = null;
        if (!dataLoaded) { autoSaveTimer2004 = setTimeout(doAutoSave2004, 500); return; }
        saveScorm2004();
    }

    function scheduleAutoSave12() {
        if (autoSaveTimer12) clearTimeout(autoSaveTimer12);
        autoSaveTimer12 = setTimeout(doAutoSave12, 2000);
    }

    function scheduleAutoSave2004() {
        if (autoSaveTimer2004) clearTimeout(autoSaveTimer2004);
        autoSaveTimer2004 = setTimeout(doAutoSave2004, 2000);
    }

    function normalizeLegacyStatus(lessonStatus, completionStatus, successStatus) {
        if (lessonStatus) {
            return lessonStatus;
        }

        if (successStatus === 'passed') {
            return 'passed';
        }

        if (successStatus === 'failed') {
            return 'failed';
        }

        if (completionStatus === 'completed') {
            return 'completed';
        }

        if (completionStatus === 'incomplete') {
            return 'incomplete';
        }

        return 'not attempted';
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

    function normalizeScorm12SuspendDataForResume() {
        var suspendText = state.scorm12.suspendData;
        if (!suspendText || typeof suspendText !== 'string') return;
        try {
            var parsed = JSON.parse(suspendText);
            if (!parsed || typeof parsed !== 'object') return;

            if (typeof parsed.slide !== 'undefined' && (state.scorm12.lessonLocation === '' || state.scorm12.lessonLocation == null)) {
                state.scorm12.lessonLocation = String(parsed.slide);
            }

            if (typeof parsed.completed === 'boolean' && parsed.completed === true) {
                parsed.completed = false;
                state.scorm12.suspendData = JSON.stringify(parsed);
            }
        } catch (e) {
            // Ignore non-JSON suspend_data.
        }
    }

    function getRuntimeScorm12Status() {
        var status = state.scorm12.lessonStatus || 'not attempted';
        if (!(status === 'completed' || status === 'passed')) return status;

        var location = String(state.scorm12.lessonLocation || '').trim();
        var suspendData = String(state.scorm12.suspendData || '').trim();
        if (location || suspendData) {
            return 'incomplete';
        }

        return status;
    }

    function hasScorm12ResumeData() {
        var location = String(state.scorm12.lessonLocation || '').trim();
        var suspendData = String(state.scorm12.suspendData || '').trim();
        return !!(location || suspendData);
    }

    function applyInitData(payload) {
        var data = payload || {};
        var versionHint = String(data.scormVersion || '').toLowerCase();
        if (versionHint.indexOf('2004') >= 0) {
            isScorm2004Launch = true;
        }
        if (data.scormCompletionStatus || data.scormSuccessStatus || data.scormLocation || data.scormSuspendData) {
            isScorm2004Launch = true;
        }
        var legacySuspend = (data.suspendData || data.scormData || '');
        if (looksLikeEmbeddedScormPayload(legacySuspend)) {
            legacySuspend = '';
        }

        var scorm2004Suspend = data.scormSuspendData || '';
        if (looksLikeEmbeddedScormPayload(scorm2004Suspend)) {
            scorm2004Suspend = '';
        }

        state.scorm12.lessonStatus = data.lessonStatus || data.scormLessonStatus || state.scorm12.lessonStatus;
        state.scorm12.score = data.score || data.scormScore || state.scorm12.score;
        state.scorm12.lessonLocation = data.lessonLocation || data.scormLessonLocation || state.scorm12.lessonLocation;
        state.scorm12.suspendData = legacySuspend || state.scorm12.suspendData;
        normalizeScorm12SuspendDataForResume();
        state.scorm12.lessonStatus = deriveInProgressFromSuspendData(state.scorm12.lessonStatus, state.scorm12.suspendData);

        state.scorm2004.completionStatus = data.scormCompletionStatus || state.scorm2004.completionStatus;
        state.scorm2004.successStatus = data.scormSuccessStatus || state.scorm2004.successStatus;
        state.scorm2004.scoreRaw = data.scormScoreRaw || state.scorm2004.scoreRaw || state.scorm12.score;
        state.scorm2004.scoreMin = data.scormScoreMin || state.scorm2004.scoreMin;
        state.scorm2004.scoreMax = data.scormScoreMax || state.scorm2004.scoreMax;
        state.scorm2004.scoreScaled = data.scormScoreScaled || state.scorm2004.scoreScaled;
        state.scorm2004.location = data.scormLocation || state.scorm2004.location || state.scorm12.lessonLocation;
        state.scorm2004.suspendData = scorm2004Suspend || state.scorm2004.suspendData || state.scorm12.suspendData;
        state.scorm2004.objectives = data.scormObjectives || state.scorm2004.objectives;
        state.scorm2004.interactions = data.scormInteractions || state.scorm2004.interactions;

        if (data.learnerId) learnerId = data.learnerId;
        if (data.learnerName) learnerName = data.learnerName;
        console.log('SCORM bridge: learner identity set -', learnerId, learnerName);

        if (data.scormVersion && data.scormVersion.indexOf('2004') >= 0) {
            scorm2004Version = data.scormVersion;
        }

        if (state.scorm2004.completionStatus === 'unknown') {
            var fromLegacy = state.scorm12.lessonStatus;
            if (fromLegacy === 'completed' || fromLegacy === 'passed' || fromLegacy === 'failed') {
                state.scorm2004.completionStatus = 'completed';
            } else if (fromLegacy === 'incomplete') {
                state.scorm2004.completionStatus = 'incomplete';
            }
        }

        if (state.scorm2004.successStatus === 'unknown') {
            if (state.scorm12.lessonStatus === 'passed') {
                state.scorm2004.successStatus = 'passed';
            } else if (state.scorm12.lessonStatus === 'failed') {
                state.scorm2004.successStatus = 'failed';
            }
        }

        dataLoaded = true;

        if (requestDataRetryTimer) {
            clearInterval(requestDataRetryTimer);
            requestDataRetryTimer = null;
        }
    }

    function postToHostWindows(message) {
        try {
            var current = window;
            var hops = 0;
            while (current && current.parent && current.parent !== current && hops < 10) {
                current = current.parent;
                current.postMessage(message, '*');
                hops += 1;
            }
        } catch (e) {
            // Ignore cross-origin traversal issues; at least one ancestor may still receive the message.
        }

        try {
            if (window.top && window.top !== window) {
                window.top.postMessage(message, '*');
            }
        } catch (e) {
            // Ignore cross-origin access errors.
        }
    }

    function requestInitData() {
        postToHostWindows({ type: 'scorm-request-data' });
    }

    function tryHydrateFromQueryString() {
        try {
            var params = new URLSearchParams(window.location.search || '');
            var raw = params.get('scormInit');
            if (!raw) return;
            var parsed = JSON.parse(raw);
            applyInitData(parsed);
            console.log('SCORM bridge: hydrated init data from query payload');
        } catch (e) {
            // Ignore malformed scormInit payload and continue with postMessage flow.
        }
    }

    function tryHydrateFromParent() {
        try {
            if (window.parent && window.parent !== window && window.parent.savedScormData) {
                applyInitData(window.parent.savedScormData);
            }
        } catch (e) {
            // Cross-origin parent access should be ignored; postMessage fallback still works.
        }
    }

    function saveScorm12() {
        postToHostWindows({
            type: 'scorm-save',
            data: {
                scormVersion: '1.2',
                scormLessonStatus: state.scorm12.lessonStatus,
                scormScore: String(state.scorm12.score || ''),
                scormLessonLocation: String(state.scorm12.lessonLocation || ''),
                scormData: String(state.scorm12.suspendData || '')
            }
        });
    }

    function saveScorm2004() {
        postToHostWindows({
            type: 'scorm-save',
            data: {
                scormVersion: scorm2004Version,
                scormCompletionStatus: String(state.scorm2004.completionStatus || 'unknown'),
                scormSuccessStatus: String(state.scorm2004.successStatus || 'unknown'),
                scormScoreRaw: String(state.scorm2004.scoreRaw || ''),
                scormScoreMin: String(state.scorm2004.scoreMin || ''),
                scormScoreMax: String(state.scorm2004.scoreMax || ''),
                scormScoreScaled: String(state.scorm2004.scoreScaled || ''),
                scormLocation: String(state.scorm2004.location || ''),
                scormSuspendData: String(state.scorm2004.suspendData || ''),
                scormObjectives: String(state.scorm2004.objectives || ''),
                scormInteractions: String(state.scorm2004.interactions || ''),
                scormLessonStatus: normalizeLegacyStatus('', state.scorm2004.completionStatus, state.scorm2004.successStatus),
                scormScore: String(state.scorm2004.scoreRaw || ''),
                scormLessonLocation: String(state.scorm2004.location || ''),
                scormData: String(state.scorm2004.suspendData || '')
            }
        });
    }

    // Hydrate as early as possible so launch version is known before API assignment.
    tryHydrateFromQueryString();
    tryHydrateFromParent();

    // Guard: only define window.API if nothing has claimed that name yet.
    // Some SCORM packages use window.API as an internal EventEmitter or service bus;
    // overwriting it causes runtime crashes (e.g., "listener must be a function").
    // The SCORM player window already exposes window.API via scorm-player-v2.js, so
    // content that calls window.parent.API will always find it there. The bridge only
    // needs to exist for content that calls window.API on its own (local) window.
    var _api12 = {
        _isBridge: true,
        LMSInitialize: function () { return 'true'; },
        LMSGetValue: function (element) {
            if (!dataLoaded) {
                tryHydrateFromQueryString();
            }
            if (!dataLoaded && (element === 'cmi.core.lesson_location' || element === 'cmi.core.lesson_status' || element === 'cmi.suspend_data')) {
                return '';
            }

            switch (element) {
                case 'cmi.core.lesson_status': return getRuntimeScorm12Status();
                case 'cmi.core.score.raw': return state.scorm12.score || '';
                case 'cmi.core.lesson_location': return state.scorm12.lessonLocation || '';
                case 'cmi.suspend_data': return state.scorm12.suspendData || '';
                case 'cmi.core.entry': return hasScorm12ResumeData() ? 'resume' : 'ab-initio';
                case 'cmi.core.lesson_mode': return 'normal';
                default: return '';
            }
        },
        LMSSetValue: function (element, value) {
            // === RESUME INTERCEPT: Prevent slide 1 reset ===
            var originalValue = String(value || '');
            var interceptedValue = originalValue;
            var savedLocation = String(state.scorm12.lessonLocation || '').trim();
            var savedSuspend = String(state.scorm12.suspendData || '').trim();
            
            if (element === 'cmi.core.lesson_location') {
                // Check if trying to reset to slide 1 during resume
                if (originalValue === '1' && savedLocation && savedLocation !== '1') {
                    interceptedValue = savedLocation;
                    console.log(`🚫 BRIDGE INTERCEPT: Bypassed slide 1 reset. Restoring: ${interceptedValue}`);
                }
            } else if (element === 'cmi.suspend_data') {
                // Check if suspend_data is being set to slide 1 during resume
                try {
                    var incomingData = JSON.parse(originalValue);
                    if (incomingData && incomingData.slide === 1 && savedSuspend) {
                        var savedData = JSON.parse(savedSuspend);
                        if (savedData && savedData.slide && savedData.slide !== 1) {
                            incomingData.slide = savedData.slide;
                            incomingData.completed = savedData.completed;
                            interceptedValue = JSON.stringify(incomingData);
                            console.log(`🚫 BRIDGE INTERCEPT: Bypassed suspend_data slide 1 reset. Restoring: ${savedData.slide}`);
                        }
                    }
                } catch (e) {
                    // Non-JSON suspend_data is fine
                }
            }
            
            switch (element) {
                case 'cmi.core.lesson_status':
                    state.scorm12.lessonStatus = String(value || '');
                    break;
                case 'cmi.core.score.raw':
                    state.scorm12.score = String(value || '');
                    break;
                case 'cmi.core.lesson_location':
                    state.scorm12.lessonLocation = interceptedValue;
                    break;
                case 'cmi.suspend_data':
                    state.scorm12.suspendData = interceptedValue;
                    break;
            }
            scheduleAutoSave12();
            return 'true';
        },
        LMSCommit: function () {
            if (!dataLoaded) {
                pendingCommit12 = true;
                return 'true';
            }
            saveScorm12();
            pendingCommit12 = false;
            return 'true';
        },
        LMSFinish: function () {
            this.LMSCommit('');
            return 'true';
        },
        LMSGetLastError: function () { return '0'; },
        LMSGetErrorString: function () { return ''; },
        LMSGetDiagnostic: function () { return ''; }
    };

    if (!isScorm2004Launch && (typeof window.API === 'undefined' || window.API === null)) {
        window.API = _api12;
    }

    var _api2004 = {
        Initialize: function () { return 'true'; },
        GetValue: function (element) {
            switch (element) {
                case 'cmi.completion_status': return state.scorm2004.completionStatus || 'unknown';
                case 'cmi.success_status': return state.scorm2004.successStatus || 'unknown';
                case 'cmi.score.raw': return state.scorm2004.scoreRaw || '';
                case 'cmi.score.min': return state.scorm2004.scoreMin || '';
                case 'cmi.score.max': return state.scorm2004.scoreMax || '';
                case 'cmi.score.scaled': return state.scorm2004.scoreScaled || '';
                case 'cmi.location': return state.scorm2004.location || '';
                case 'cmi.suspend_data': return state.scorm2004.suspendData || '';
                case 'cmi.learner_id': return learnerId || '';
                case 'cmi.learner_name': return learnerName || '';
                case 'cmi.mode': return 'normal';
                default: return '';
            }
        },
        SetValue: function (element, value) {
            var text = String(value || '');

            if (element === 'cmi.completion_status') {
                state.scorm2004.completionStatus = text;
            } else if (element === 'cmi.success_status') {
                state.scorm2004.successStatus = text;
            } else if (element === 'cmi.score.raw') {
                state.scorm2004.scoreRaw = text;
            } else if (element === 'cmi.score.min') {
                state.scorm2004.scoreMin = text;
            } else if (element === 'cmi.score.max') {
                state.scorm2004.scoreMax = text;
            } else if (element === 'cmi.score.scaled') {
                state.scorm2004.scoreScaled = text;
            } else if (element === 'cmi.location') {
                state.scorm2004.location = text;
            } else if (element === 'cmi.suspend_data') {
                state.scorm2004.suspendData = text;
            } else if (element.indexOf('cmi.objectives.') === 0) {
                state.scorm2004.objectives = text;
            } else if (element.indexOf('cmi.interactions.') === 0) {
                state.scorm2004.interactions = text;
            }

            scheduleAutoSave2004();
            return 'true';
        },
        Commit: function () {
            if (!dataLoaded) {
                pendingCommit2004 = true;
                return 'true';
            }
            saveScorm2004();
            pendingCommit2004 = false;
            return 'true';
        },
        Terminate: function () {
            this.Commit('');
            return 'true';
        },
        GetLastError: function () { return '0'; },
        GetErrorString: function () { return ''; },
        GetDiagnostic: function () { return ''; }
    };

    if (typeof window.API_1484_11 === 'undefined' || window.API_1484_11 === null) {
        window.API_1484_11 = _api2004;
    }

    // At this point immediate hydration was already attempted before API assignment.

    if (!dataLoaded) {
        requestInitData();
        requestDataRetryTimer = setInterval(function() {
            if (dataLoaded || requestDataRetryCount >= 20) {
                clearInterval(requestDataRetryTimer);
                requestDataRetryTimer = null;
                return;
            }
            requestDataRetryCount += 1;
            requestInitData();
        }, 250);
    }

    window.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'scorm-init-data' && event.data.data) {
            applyInitData(event.data.data);

            if (pendingCommit12) {
                saveScorm12();
                pendingCommit12 = false;
            }

            if (pendingCommit2004) {
                saveScorm2004();
                pendingCommit2004 = false;
            }
        }
    });
})();
