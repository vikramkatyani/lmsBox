import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import QuizPlayer from '../components/QuizPlayer';
import InteractiveLessonPlayer from '../components/InteractiveLessonPlayer';
import { formatLessonTypeLabel } from '../utils/lessonTypes';
import SurveyPlayer from '../components/SurveyPlayer';
import LearnerAIAssistant from '../components/LearnerAIAssistant';
import { getCourseDetails, getAdminCoursePreview, getCourseResources, getCourseResource } from '../services/courseDetails';
import { learnerSurveyService, adminSurveyService } from '../services/surveys';
import toast from 'react-hot-toast';
import usePageTitle from '../hooks/usePageTitle';
import { API_BASE } from '../utils/apiBase';
import { learnerFeatureFlags } from '../config/learnerFeatureFlags';

const LESSON_COMPLETED_MESSAGE = 'Lesson completed';

/**
 * TextTrack <track> src must be same-origin as the page (port included).
 * Fetch VTT via the Vite/same-host /api proxy and expose a blob: URL.
 */
function useSameOriginCaptionSrc(captionUrl) {
  const [trackSrc, setTrackSrc] = React.useState(null);

  React.useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    const load = async () => {
      if (!captionUrl) {
        setTrackSrc(null);
        return;
      }

      const isAzureBlob =
        /^https?:\/\//i.test(captionUrl) && captionUrl.includes('blob.core.windows.net');

      if (!isAzureBlob) {
        setTrackSrc(captionUrl);
        return;
      }

      try {
        // Relative /api so Vite proxy (dev) and same-host deploy stay same-origin.
        const proxyUrl = `/api/scorm-proxy?url=${encodeURIComponent(captionUrl)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) {
          throw new Error(`Caption proxy returned ${response.status}`);
        }
        const text = await response.text();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }));
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setTrackSrc(objectUrl);
      } catch (error) {
        console.error('Failed to load video captions:', error);
        if (!cancelled) setTrackSrc(null);
      }
    };

    setTrackSrc(null);
    load();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [captionUrl]);

  return trackSrc;
}

function notifyLessonCompleted(lessonId, lessons) {
  const targetLesson = lessons?.find((lesson) => String(lesson.id) === String(lessonId));
  if (!targetLesson?.isCompleted) {
    toast.success(LESSON_COMPLETED_MESSAGE);
    return true;
  }
  return false;
}

/**
 * Fallback player when HTML is rendered inline (no blob URL).
 * Mirrors html-lesson-bridge.js: trigger marker or end-of-content completion.
 */
function HtmlInlineLessonContent({ html, lessonId, isCompleted, onComplete }) {
  const containerRef = React.useRef(null);
  const completedRef = React.useRef(false);

  React.useEffect(() => {
    completedRef.current = false;
  }, [lessonId, html]);

  React.useEffect(() => {
    if (isCompleted || !containerRef.current) {
      return undefined;
    }

    const root = containerRef.current;
    let observer;
    let dwellTimer;
    let hasScrolled = false;

    const complete = () => {
      if (completedRef.current || isCompleted) {
        return;
      }
      completedRef.current = true;
      onComplete?.();
    };

    const onScroll = () => {
      hasScrolled = true;
      const nearEnd =
        root.scrollTop + root.clientHeight >= root.scrollHeight - 48;
      if (nearEnd && !root.querySelector('[data-lmsbox-complete-trigger]')) {
        complete();
      }
    };

    const trigger = root.querySelector('[data-lmsbox-complete-trigger]');
    const target = trigger || (() => {
      const sentinel = document.createElement('div');
      sentinel.setAttribute('data-lmsbox-end-sentinel', '');
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.cssText = 'height:1px;width:100%;pointer-events:none;';
      root.appendChild(sentinel);
      return sentinel;
    })();

    const allowImmediate = !trigger;
    const wasInitiallyVisible =
      target.getBoundingClientRect().top < (root.getBoundingClientRect().bottom) &&
      target.getBoundingClientRect().bottom > root.getBoundingClientRect().top;

    target.addEventListener('click', complete);
    root.addEventListener('scroll', onScroll, { passive: true });

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            if (allowImmediate || !wasInitiallyVisible || hasScrolled) {
              complete();
              observer?.disconnect();
              return;
            }
          }
        },
        { root, threshold: 0.15 }
      );
      observer.observe(target);
    }

    if (allowImmediate && wasInitiallyVisible) {
      dwellTimer = setTimeout(() => {
        complete();
      }, 1500);
    }

    return () => {
      root.removeEventListener('scroll', onScroll);
      target.removeEventListener('click', complete);
      observer?.disconnect();
      if (dwellTimer) clearTimeout(dwellTimer);
    };
  }, [html, lessonId, isCompleted, onComplete]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-auto p-8">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function isPracticalOutcomeRecorded(lesson) {
  const status = String(lesson?.practicalStatus ?? '').toLowerCase();
  return status === 'passed' || status === 'failed';
}

function isLessonSatisfiedForSurvey(lesson) {
  if (String(lesson?.type ?? '').toLowerCase() === 'external') {
    return isPracticalOutcomeRecorded(lesson) || !!lesson?.isCompleted;
  }
  return !!lesson?.isCompleted;
}

function areAllLessonsComplete(lessons) {
  return (lessons ?? []).length === 0 || (lessons ?? []).every((lesson) => lesson.isCompleted);
}

function areLessonsReadyForPostSurvey(lessons) {
  return (lessons ?? []).length === 0 || (lessons ?? []).every(isLessonSatisfiedForSurvey);
}

function hasPracticalLesson(lessons) {
  return (lessons ?? []).some((lesson) => String(lesson?.type ?? '').toLowerCase() === 'external');
}

function isPracticalPassed(lesson) {
  return String(lesson?.practicalStatus ?? '').toLowerCase() === 'passed' || !!lesson?.isCompleted;
}

function isCertificateEnabled(courseData) {
  return courseData?.certificateEnabled !== false;
}

function buildCertificateItem(courseData) {
  if (!isCertificateEnabled(courseData)) {
    return null;
  }

  const eligible = isCertificateEligible(courseData);

  return {
    id: 'certificate',
    title: 'Certificate',
    type: 'certificate',
    order: 10000,
    isCompleted: eligible,
    isLocked: !eligible,
  };
}

async function fetchCourseCertificate(courseId) {
  const response = await fetch(`${API_BASE}/api/learner/courses/${courseId}/certificate`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to load certificate. Please try again.');
  }

  const data = await response.json();
  if (!data.certificateUrl) {
    throw new Error('Certificate URL not found');
  }

  return data.certificateUrl;
}

function isCertificateEligible(courseData) {
  if (!courseData) {
    return false;
  }

  if (!isCertificateEnabled(courseData)) {
    return false;
  }

  if (typeof courseData.certificateEligible === 'boolean') {
    return courseData.certificateEligible;
  }

  const lessons = courseData.lessons ?? [];
  if (lessons.length === 0) {
    return !!courseData.isCompleted;
  }

  if (hasPracticalLesson(lessons)) {
    const allLessonsPassed = lessons.every((lesson) => {
      if (String(lesson?.type ?? '').toLowerCase() === 'external') {
        return isPracticalPassed(lesson) && String(lesson?.practicalStatus ?? '').toLowerCase() !== 'failed';
      }
      return !!lesson.isCompleted;
    });
    const surveyOk = !courseData.hasPostSurvey || !!courseData.postSurveyCompleted;
    return allLessonsPassed && surveyOk;
  }

  return !!courseData.isCompleted && areAllLessonsComplete(lessons);
}

function applySequentialLocks(lessons, lessonsLocked, requireSequentialLessons) {
  if (!requireSequentialLessons && !lessonsLocked) {
    return lessons;
  }

  const sorted = [...lessons].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));

  return lessons.map((lesson) => {
    if (lesson.isCompleted) {
      return { ...lesson, isLocked: lessonsLocked };
    }

    let isLocked = lessonsLocked;
    if (!isLocked && requireSequentialLessons) {
      const previousLesson = sorted
        .filter((l) => (l.ordinal ?? 0) < (lesson.ordinal ?? 0))
        .sort((a, b) => (b.ordinal ?? 0) - (a.ordinal ?? 0))[0];
      isLocked = previousLesson ? !previousLesson.isCompleted : false;
    }

    return { ...lesson, isLocked };
  });
}

function getNewlyUnlockedLessonIds(prevLessons, nextLessons) {
  const prevLockedById = new Map(prevLessons.map((lesson) => [String(lesson.id), !!lesson.isLocked]));
  return nextLessons
    .filter((lesson) => prevLockedById.get(String(lesson.id)) === true && lesson.isLocked === false)
    .map((lesson) => lesson.id);
}

function getNextSequentialLessonId(lessons, completedLessonId) {
  const sorted = [...lessons].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
  const completedIndex = sorted.findIndex((lesson) => String(lesson.id) === String(completedLessonId));
  if (completedIndex < 0 || completedIndex >= sorted.length - 1) {
    return null;
  }

  const nextLesson = sorted[completedIndex + 1];
  return nextLesson.isCompleted ? null : nextLesson.id;
}

function resolveLessonIdsToAnimateUnlock(prevCourse, completedLessonId, nextLessons) {
  const fromLockTransition = getNewlyUnlockedLessonIds(prevCourse.lessons, nextLessons);
  if (fromLockTransition.length > 0) {
    return fromLockTransition;
  }

  if (!prevCourse.requireSequentialLessons || prevCourse.lessonsLocked) {
    return [];
  }

  const nextLessonId = getNextSequentialLessonId(prevCourse.lessons, completedLessonId);
  if (!nextLessonId) {
    return [];
  }

  const nextLessonAfterUpdate = nextLessons.find((lesson) => String(lesson.id) === String(nextLessonId));
  return nextLessonAfterUpdate && nextLessonAfterUpdate.isLocked === false ? [nextLessonId] : [];
}

function markLessonCompletedInCourse(prevCourse, lessonId) {
  const updatedLessons = prevCourse.lessons.map((lesson) =>
    String(lesson.id) === String(lessonId)
      ? { ...lesson, isCompleted: true, progressPercent: 100 }
      : lesson
  );
  const nextLessons = applySequentialLocks(
    updatedLessons,
    prevCourse.lessonsLocked,
    prevCourse.requireSequentialLessons
  );

  return {
    updatedCourse: { ...prevCourse, lessons: nextLessons },
    newlyUnlockedLessonIds: resolveLessonIdsToAnimateUnlock(prevCourse, lessonId, nextLessons),
  };
}

function normalizeCourseData(courseData) {
  if (!courseData) {
    return courseData;
  }

  const lessonsLocked = courseData.lessonsLocked ?? false;
  const requireSequentialLessons = courseData.requireSequentialLessons ?? false;
  const normalizedLessons = applySequentialLocks(
    courseData.lessons ?? [],
    lessonsLocked,
    requireSequentialLessons
  );

  return {
    ...courseData,
    lessonsLocked,
    requireSequentialLessons,
    showLessonNavigation: courseData.showLessonNavigation === true,
    lessons: normalizedLessons,
  };
}

function LessonStatusIcon({ isLocked, lesson, isInProgress, showUnlockAnimation }) {
  const colorClass = isLocked
    ? 'text-gray-400'
    : lesson.isCompleted
      ? 'text-green-600'
      : isInProgress
        ? 'text-amber-600'
        : 'text-slate-500';

  return (
    <div className={`relative flex h-5 w-5 shrink-0 items-center justify-center overflow-visible ${colorClass}`}>
      {showUnlockAnimation && !isLocked && (
        <>
          <span className="lesson-unlock-pulse-ring" aria-hidden="true" />
          <span className="lesson-unlock-pulse-ring lesson-unlock-pulse-ring--delay" aria-hidden="true" />
        </>
      )}
      <div className="relative z-10">
        {isLocked ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        ) : lesson.isCompleted ? (
          <CompletedStatusIcon />
        ) : isInProgress ? (
          <InProgressStatusIcon />
        ) : (
          <NotStartedStatusIcon />
        )}
      </div>
    </div>
  );
}

function CompletedStatusIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="white" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 12.3l2.3 2.3 4.7-5.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InProgressStatusIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NotStartedStatusIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ModulesToggleIcon({ menuOpen }) {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="2.5" />
      <path d="M8 3v14" />
      {menuOpen ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12.5 7.5 9.5 10 12.5 12.5" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 7.5 12.5 10 9.5 12.5" />
      )}
    </svg>
  );
}

function getResourceHostname(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname || null;
  } catch {
    return null;
  }
}

function getResourceCategory(type) {
  switch (type) {
    case 'video':
      return 'Course video';
    case 'html':
      return 'Web resource';
    case 'pdf':
    default:
      return 'Course materials';
  }
}

function getResourceMetaLine(resource) {
  const hostname = getResourceHostname(resource.url);

  switch (resource.type) {
    case 'video':
      return resource.description?.trim() || 'Video resource';
    case 'html':
      return hostname ? `External link • ${hostname}` : 'External link';
    case 'pdf':
    default:
      return resource.description?.trim() || 'PDF document';
  }
}

function ResourceTypeBadge({ type }) {
  if (type === 'video') {
    return (
      <span className="absolute bottom-1.5 right-1.5 inline-flex h-6 items-center gap-1 rounded bg-black/80 px-1.5 text-white">
        <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.34-5.89a1.5 1.5 0 000-2.54L6.3 2.84z" />
        </svg>
      </span>
    );
  }

  if (type === 'html') {
    return (
      <span className="absolute bottom-1.5 right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-white">
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 11.5l3-3m-5.25.75a3.25 3.25 0 004.6 4.6l1.4-1.4a3.25 3.25 0 000-4.6m1.5 1.5a3.25 3.25 0 00-4.6-4.6L7.75 5.75a3.25 3.25 0 000 4.6" />
        </svg>
      </span>
    );
  }

  return (
    <span className="absolute bottom-1.5 right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-white">
      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 3.5v9m0 0l-3.25-3.25M10 12.5l3.25-3.25M4 15.5h12" />
      </svg>
    </span>
  );
}

function ResourceThumbnail({ type, thumbnailUrl }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = thumbnailUrl && !imageFailed;

  let fallbackClass = 'bg-[#4a5560] text-[#c5ccd3]';
  let fallbackIcon;

  switch (type) {
    case 'video':
      fallbackClass = 'bg-[#5a3a3a] text-[#f0b4b4]';
      fallbackIcon = (
        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12 0a2 2 0 012-2h2a2 2 0 012 2v8a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
        </svg>
      );
      break;
    case 'html':
      fallbackClass = 'bg-[#4a4535] text-[#e0d4a8]';
      fallbackIcon = (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.91a4.25 4.25 0 015.99.12 4.2 4.2 0 01-.12 5.99l-3.35 3.35a4.25 4.25 0 01-6.11-5.91m1.52-1.52a4.25 4.25 0 00-5.99-.12 4.2 4.2 0 00.12 5.99l3.35 3.35a4.25 4.25 0 006.11-5.91" />
        </svg>
      );
      break;
    case 'pdf':
    default:
      fallbackIcon = (
        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
      break;
  }

  return (
    <div className="relative h-[5rem] w-[8.25rem] shrink-0 overflow-hidden rounded-lg bg-[#2f3438]">
      {showImage ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className={`flex h-full w-full items-center justify-center ${fallbackClass}`}>
          {fallbackIcon}
        </div>
      )}
      <ResourceTypeBadge type={type} />
    </div>
  );
}

function CourseResourcesPanel({ isOpen, onClose, resources, loading, onOpenResource }) {
  if (!isOpen) return null;

  const resourceCount = resources.length;

  return (
    <aside
      className="fixed bottom-0 right-0 top-14 z-50 flex w-full max-w-md flex-col bg-[#3d4246]/95 text-white shadow-2xl backdrop-blur-[2px]"
      role="dialog"
      aria-label="Course resources"
    >
        <div className="flex items-start justify-between px-5 pb-3 pt-5">
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-semibold tracking-tight text-white">Resources</h2>
              {!loading && (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/15 px-2 text-xs font-semibold text-white">
                  {resourceCount}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-white/55">Supplementary materials for this module</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close resources panel"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4 pt-1">
          {loading ? (
            <div className="px-4 py-10 text-center text-sm text-white/50">Loading resources...</div>
          ) : resources.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-white/50">No resources available for this course.</div>
          ) : (
            <ul className="space-y-1">
              {resources.map((resource) => (
                <li key={resource.id}>
                  <button
                    type="button"
                    onClick={() => onOpenResource(resource)}
                    className="group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/10"
                  >
                    <ResourceThumbnail type={resource.type} thumbnailUrl={resource.thumbnailUrl} />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="text-sm font-semibold leading-snug text-white">
                        {resource.title}
                      </div>
                      <div className="mt-1 text-xs text-white/55">
                        {getResourceCategory(resource.type)}
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-xs text-white/40">
                        {getResourceMetaLine(resource)}
                      </div>
                    </div>
                    <svg
                      className="mt-1 h-4 w-4 shrink-0 text-white/35 transition-colors group-hover:text-white/70"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 5h8m0 0v8m0-8L7 13" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
    </aside>
  );
}

function LessonItem({ lesson, isActive, isLocked = false, showUnlockAnimation = false, onClick }) {
  const getIcon = (type) => {
    switch (type) {
      case 'video':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12 0a2 2 0 012-2h2a2 2 0 012 2v8a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
          </svg>
        );
      case 'pdf':
      case 'document':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'quiz':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        );
      case 'scorm':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
          </svg>
        );
      case 'html':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        );
      case 'interactive':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v2H7V5zm0 4h6v2H7V9zm0 4h4v2H7v-2z" />
          </svg>
        );
      case 'external':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
          </svg>
        );
      case 'content':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        );
      case 'survey':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
          </svg>
        );
      case 'certificate':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  // Determine if lesson is in progress (accessed but not completed)
  // A lesson is "in progress" if it has been accessed (progress >= 0 and lastAccessedAt exists) but not completed
  const isInProgress = !lesson.isCompleted && (lesson.progress >= 0 && lesson.lastAccessedAt);

  return (
    <div
      data-lesson-id={lesson.id}
      onClick={onClick}
      className={`flex items-center space-x-3 p-3 rounded transition ${
        showUnlockAnimation ? 'relative z-20 overflow-visible' : ''
      } ${
        isLocked
          ? 'cursor-not-allowed bg-gray-50'
          : `cursor-pointer ${isActive ? 'bg-[#e8fdf6] border-l-4 border-[#2afeae]' : 'hover:bg-gray-50'}`
      }`}
    >
      <LessonStatusIcon
        isLocked={isLocked}
        lesson={lesson}
        isInProgress={isInProgress}
        showUnlockAnimation={showUnlockAnimation}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <div className={isLocked ? 'text-gray-400' : 'text-gray-500'}>{getIcon(lesson.type)}</div>
          <p className={`text-sm font-medium truncate ${
            isLocked ? 'text-gray-500' : isActive ? 'text-blue-600' : 'text-gray-900'
          }`}>
            {lesson.title}
          </p>
        </div>
        {lesson.duration && lesson.duration !== "15:00" && (
          <p className="text-xs text-gray-500 ml-6">{lesson.duration}</p>
        )}
        {lesson.questions && (
          <p className="text-xs text-gray-500 ml-6">{lesson.questions} questions</p>
        )}
      </div>
    </div>
  );
}

function shouldSkipVideoIntro(lesson) {
  if (!lesson || lesson.type !== 'video') return false;
  // Only skip the intro when there is no description text.
  // Lessons with a description always show the intro overlay when the learner opens them.
  return !Boolean(lesson.content && lesson.content.trim().length > 0);
}

function transformAdminSurveyForPlayer(adminSurvey, isMandatory) {
  const questions = (adminSurvey.questions || []).map((q) => ({
    id: q.id,
    questionText: q.questionText,
    questionType: q.questionType,
    options: q.options || [],
    isRequired: q.isRequired,
    minRating: q.minRating,
    maxRating: q.maxRating,
    orderIndex: q.orderIndex,
  }));

  return {
    surveyId: adminSurvey.id,
    title: adminSurvey.title,
    description: adminSurvey.description,
    isMandatory,
    questions,
  };
}

function ContentPanel({ lesson, courseId: _courseId, onProgressUpdate, previewMode = false }) {
  const videoRef = React.useRef(null);
  const videoContainerRef = React.useRef(null);
  const scormContainerRef = React.useRef(null);
  const [hasStarted, setHasStarted] = React.useState(false);
  const [showVideo, setShowVideo] = React.useState(() => shouldSkipVideoIntro(lesson));
  const videoIntroDismissedRef = React.useRef(shouldSkipVideoIntro(lesson));
  const videoIntroLessonIdRef = React.useRef(lesson?.id);
  const sessionStartTimeRef = React.useRef(null);
  const timeTrackingIntervalRef = React.useRef(null);
  const hasTrackedAccessRef = React.useRef(false);
  const legacyScormCompletionHandledRef = React.useRef(false);
  const htmlCompletionHandledRef = React.useRef(false);
  const captionTrackSrc = useSameOriginCaptionSrc(lesson?.type === 'video' ? lesson.captionUrl : null);

  // Track session time for video lessons only (PDF/HTML don't need continuous tracking)
  React.useEffect(() => {
    if (!lesson || lesson.type !== 'video') return;

    // Start tracking time for this lesson
    sessionStartTimeRef.current = Date.now();

    // Send time update every 30 seconds for video lessons only
    timeTrackingIntervalRef.current = setInterval(() => {
      if (sessionStartTimeRef.current) {
        const timeSpentSeconds = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
        
        if (timeSpentSeconds > 0) {
          // Send time update - DON'T send completion status, only time
          onProgressUpdate?.(lesson.id, {
            progressPercent: lesson.progress || 0,
            videoTimestamp: lesson.videoTimestamp,
            completed: false, // Never auto-complete
            timeSpentSeconds: timeSpentSeconds
          });
          
          // Reset the start time for next interval
          sessionStartTimeRef.current = Date.now();
        }
      }
    }, 30000); // Every 30 seconds

    // Cleanup on lesson change or unmount
    return () => {
      if (timeTrackingIntervalRef.current) {
        clearInterval(timeTrackingIntervalRef.current);
      }
      
      // Send final time update when leaving the lesson
      if (sessionStartTimeRef.current) {
        const timeSpentSeconds = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
        if (timeSpentSeconds > 0) {
          onProgressUpdate?.(lesson.id, {
            progressPercent: lesson.progress || 0,
            videoTimestamp: lesson.videoTimestamp,
            completed: false, // Never auto-complete
            timeSpentSeconds: timeSpentSeconds
          });
        }
      }
    };
  }, [lesson, onProgressUpdate]);

  // Resume video from saved timestamp
  React.useEffect(() => {
    if (lesson && lesson.type === 'video' && lesson.videoTimestamp && videoRef.current && !hasStarted) {
      videoRef.current.currentTime = lesson.videoTimestamp;
      setHasStarted(true);
    }
  }, [lesson, hasStarted]);

  // Listen for HTML lesson completion (trigger marker or end-of-content)
  React.useEffect(() => {
    if (!lesson || lesson.type !== 'html') return;

    htmlCompletionHandledRef.current = false;

    const handleHtmlMessage = (event) => {
      if (!event.data || event.data.type !== 'html-lesson-completed') {
        return;
      }

      const messageLessonId = event.data.lessonId != null ? String(event.data.lessonId) : null;
      if (messageLessonId && messageLessonId !== String(lesson.id)) {
        return;
      }

      if (lesson.isCompleted || htmlCompletionHandledRef.current) {
        return;
      }

      htmlCompletionHandledRef.current = true;
      onProgressUpdate?.(lesson.id, {
        progressPercent: 100,
        videoTimestamp: null,
        completed: true
      });
    };

    window.addEventListener('message', handleHtmlMessage);
    return () => window.removeEventListener('message', handleHtmlMessage);
  }, [lesson, onProgressUpdate]);

  // Listen for SCORM completion messages
  React.useEffect(() => {
    if (!lesson || lesson.type !== 'scorm') return;

    legacyScormCompletionHandledRef.current = false;

    const handleScormMessage = (event) => {
      // The modern message is handled in CourseContent.
      // Keep this listener only as a legacy fallback for older SCORM packages.
      if (!event.data) return;
      const isModern = event.data.type === 'scorm-lesson-completed';
      const isLegacy = event.data.type === 'scorm';
      if (isModern) return;
      if (!isLegacy) return;

      const { status, score: _score } = event.data;
      const isCompleted = status === 'completed' || status === 'passed';
      if (!isCompleted) return;

      if (lesson.isCompleted || legacyScormCompletionHandledRef.current) {
        return;
      }

      legacyScormCompletionHandledRef.current = true;

      if (isCompleted) {
        onProgressUpdate?.(lesson.id, {
          progressPercent: 100,
          videoTimestamp: null,
          completed: true
        });
      }
    };

    window.addEventListener('message', handleScormMessage);
    return () => window.removeEventListener('message', handleScormMessage);
  }, [lesson, onProgressUpdate]);

  // Track PDF and HTML lesson access when loaded
  React.useEffect(() => {
    if (!lesson) return;
    
    // Track access for PDF, HTML, and document type lessons when they're loaded
    const shouldTrack = (lesson.type === 'pdf' || lesson.type === 'document' || 
                        lesson.type === 'html' || lesson.type === 'content' ||
                        lesson.type === 'external');
    
    if (shouldTrack && !hasTrackedAccessRef.current) {
      hasTrackedAccessRef.current = true;
      
      // Call trackLessonAccess from parent component
      const trackAccess = async () => {
        try {
          const token = localStorage.getItem('token');
          const courseId = _courseId;
          await fetch(`${API_BASE}/api/learner/courses/${courseId}/lessons/${lesson.id}/access`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
        } catch (error) {
          console.error('Error tracking lesson access:', error);
        }
      };
      
      trackAccess();
    }
    
    // Reset tracking flag when lesson changes
    return () => {
      hasTrackedAccessRef.current = false;
    };
  }, [lesson, _courseId]);

  // Save progress periodically
  const handleTimeUpdate = React.useCallback((e) => {
    if (!lesson || lesson.type !== 'video') return;
    
    const video = e.target;
    const currentTime = Math.floor(video.currentTime);
    const duration = video.duration;
    
    if (duration > 0) {
      const progressPercent = Math.floor((currentTime / duration) * 100);
      
      // Save progress every 5 seconds
      if (currentTime % 5 === 0) {
        onProgressUpdate?.(lesson.id, {
          progressPercent,
          videoTimestamp: currentTime,
          completed: false // Don't mark complete until video ends
        });
      }
    }
  }, [lesson, onProgressUpdate]);

  // Handle video end - mark as complete
  const handleVideoEnded = React.useCallback((e) => {
    if (!lesson || lesson.type !== 'video') return;
    
    const video = e.target;
    const duration = video.duration;
    
    onProgressUpdate?.(lesson.id, {
      progressPercent: 100,
      videoTimestamp: Math.floor(duration),
      completed: true
    });
  }, [lesson, onProgressUpdate]);

  // Save timestamp when video pauses (but don't mark complete)
  const handlePause = React.useCallback((e) => {
    if (!lesson || lesson.type !== 'video') return;
    
    const video = e.target;
    const currentTime = Math.floor(video.currentTime);
    const duration = video.duration;
    const progressPercent = duration > 0 ? Math.floor((currentTime / duration) * 100) : 0;
    
    // Only save timestamp, don't mark complete unless video actually ended
    onProgressUpdate?.(lesson.id, {
      progressPercent,
      videoTimestamp: currentTime,
      completed: false
    });
  }, [lesson, onProgressUpdate]);

  // Video lessons with a description always show the intro overlay when opened.
  // After Play is clicked, keep it dismissed for this lesson until the learner
  // navigates away (lesson id change) — including across soft progress refreshes.
  React.useEffect(() => {
    if (!lesson || lesson.type !== 'video') return;

    if (videoIntroLessonIdRef.current !== lesson.id) {
      videoIntroLessonIdRef.current = lesson.id;
      videoIntroDismissedRef.current = false;
      setHasStarted(false);
    }

    if (videoIntroDismissedRef.current || shouldSkipVideoIntro(lesson)) {
      videoIntroDismissedRef.current = true;
      setShowVideo(true);
    } else {
      setShowVideo(false);
    }
  }, [lesson?.id, lesson?.type, lesson?.content]);

  // When the video becomes visible, attempt to start playback for self-hosted videos.
  // (Embeds use autoplay query params instead.)
  React.useEffect(() => {
    if (!lesson || lesson.type !== 'video') return;
    if (!showVideo) return;

    const isYouTube = lesson.url && (lesson.url.includes('youtube.com') || lesson.url.includes('youtu.be'));
    const isVimeo = lesson.url && lesson.url.includes('vimeo.com');
    if (isYouTube || isVimeo) return;

    const el = videoRef.current;
    if (el?.play) {
      const p = el.play();
      if (p?.catch) p.catch(() => {});
    }
  }, [showVideo, lesson?.id, lesson?.type]);

  if (!lesson) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a lesson to start learning
      </div>
    );
  }

  const renderContent = () => {
    switch (lesson.type) {
      case 'video': {
        // Check if it's a YouTube or Vimeo embed URL
        const isYouTube = lesson.url && (lesson.url.includes('youtube.com') || lesson.url.includes('youtu.be'));
        const isVimeo = lesson.url && lesson.url.includes('vimeo.com');
        
        // Convert YouTube URLs to embed format
        let embedUrl = lesson.url;
        if (isYouTube) {
          const youtubeId = lesson.url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1];
          if (youtubeId) {
            embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
          }
        } else if (isVimeo) {
          const vimeoId = lesson.url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];
          if (vimeoId) {
            embedUrl = `https://player.vimeo.com/video/${vimeoId}`;
          }
        }

        // Autoplay embeds only after the intro overlay is dismissed.
        if (showVideo && (isYouTube || isVimeo) && embedUrl) {
          const join = embedUrl.includes('?') ? '&' : '?';
          embedUrl = `${embedUrl}${join}autoplay=1`;
        }

        const dismissVideoIntro = () => {
          videoIntroDismissedRef.current = true;
          setShowVideo(true);
        };
        
        return (
          <div ref={videoContainerRef} className="w-full h-full bg-black relative">
            {lesson.url ? (
              <>
                {/* Video always mounts underneath so the intro reads as an overlay */}
                {isYouTube || isVimeo ? (
                  <iframe
                    src={embedUrl}
                    className={`w-full h-full ${!showVideo ? 'pointer-events-none' : ''}`}
                    title="Video Player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video 
                    ref={videoRef}
                    controls={showVideo}
                    className={`w-full h-full ${!showVideo ? 'pointer-events-none' : ''}`}
                    src={lesson.url}
                    controlsList="nodownload"
                    preload="metadata"
                    onTimeUpdate={handleTimeUpdate}
                    onPause={handlePause}
                    onEnded={handleVideoEnded}
                    onError={(e) => {
                      console.error('Video load error:', e);
                      console.error('Video URL:', lesson.url);
                      console.error('Error details:', e.target.error);
                      toast.error('Failed to load video. Please check the video URL or file format.');
                    }}
                  >
                    <source src={lesson.url} type="video/mp4" />
                    <source src={lesson.url} type="video/webm" />
                    <source src={lesson.url} type="video/ogg" />
                    {captionTrackSrc && (
                      <track
                        kind="captions"
                        src={captionTrackSrc}
                        srcLang="en"
                        label="English"
                        default
                      />
                    )}
                    Your browser does not support the video tag.
                  </video>
                )}

                {!showVideo && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-black/70 backdrop-blur-[2px]">
                    <div className="max-w-3xl w-full text-center">
                      <h2 className="text-white text-xl md:text-2xl font-semibold mb-3">
                        {lesson.title}
                      </h2>
                      <div className="text-gray-200 text-sm md:text-base whitespace-pre-wrap mb-8 max-h-[40vh] overflow-y-auto">
                        {lesson.content}
                      </div>
                      <button
                        type="button"
                        onClick={dismissVideoIntro}
                        aria-label="Play video"
                        className="inline-flex flex-col items-center gap-3 group focus:outline-none"
                      >
                        <span className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full bg-[#2afeae] text-[#1b365d] shadow-lg transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-[#2afeae] group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-black">
                          <svg className="w-8 h-8 md:w-10 md:h-10 ml-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </span>
                        <span className="text-sm font-medium text-white/90 group-hover:text-white">
                          Play
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-white text-center">
                <div>
                  <svg className="w-20 h-20 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                  </svg>
                  <p>Video Player</p>
                  <p className="text-sm text-gray-400 mt-2">{lesson.duration}</p>
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'pdf':
      case 'document': {
        return (
          <div className="w-full h-full bg-gray-100 relative">
            {lesson.url ? (
              <>
                <object 
                  data={lesson.url}
                  type="application/pdf"
                  className="w-full h-full"
                  title="PDF Viewer"
                >
                  <div className="flex flex-col items-center justify-center h-full p-8">
                    <svg className="w-20 h-20 mb-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <p className="text-gray-600 mb-4">Unable to display PDF in browser</p>
                    <a 
                      href={lesson.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-[#2afeae] hover:bg-[#25e89e] text-[#1b365d] px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Open PDF in New Tab</span>
                    </a>
                  </div>
                </object>
                {!lesson.isCompleted && !previewMode && (
                  <div className="absolute bottom-4 right-4 z-10">
                    <button
                      onClick={() => {
                        onProgressUpdate?.(lesson.id, {
                          progressPercent: 100,
                          videoTimestamp: null,
                          completed: true
                        });
                      }}
                      className="bg-[#2afeae] hover:bg-[#25e89e] text-[#1b365d] px-6 py-3 rounded-lg shadow-lg font-medium transition-colors flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Mark as Complete</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-600 text-center">
                  <svg className="w-20 h-20 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <p>PDF Viewer</p>
                  <p className="text-sm text-gray-500 mt-2">Document content will load here</p>
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'quiz':
        return lesson.quizId ? (
          <QuizPlayer 
            quizId={lesson.quizId}
            previewMode={previewMode}
            onComplete={(_score) => {
              if (previewMode) return;
              // Mark lesson as complete when quiz is passed
              onProgressUpdate?.(lesson.id, {
                progressPercent: 100,
                videoTimestamp: null,
                completed: true
              });
            }}
            onProgressUpdate={previewMode ? undefined : onProgressUpdate}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Assessment not configured</p>
          </div>
        );
      case 'scorm': {
        // Use scorm-player.html in iframe to handle SCORM content with API
        const proxyUrl = lesson.url ? `${API_BASE}/api/scorm-proxy?url=${encodeURIComponent(lesson.url)}` : null;
        const scormVersion = lesson.scormVersion || '1.2';
        const token = localStorage.getItem('token') || '';
        const scormPlayerUrl = proxyUrl
          ? `${API_BASE}/scorm-player.html?url=${encodeURIComponent(proxyUrl)}&lessonId=${lesson.id}&courseId=${_courseId}&scormVersion=${encodeURIComponent(scormVersion)}&token=${encodeURIComponent(token)}`
          : null;

        return (
          <div ref={scormContainerRef} className="w-full h-full bg-white relative">
            {scormPlayerUrl ? (
              <iframe
                src={scormPlayerUrl}
                className="w-full h-full border-0"
                title="SCORM Content"
                allow="autoplay; fullscreen"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                  <p className="text-lg">SCORM content not available</p>
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'html': {
        const htmlUrl = lesson.htmlUrl || lesson.url;
        
        return (
          <div className="w-full h-full bg-white relative">
            {htmlUrl ? (
              <iframe
                src={`${API_BASE}/api/scorm-proxy/html?url=${encodeURIComponent(htmlUrl)}&lessonId=${encodeURIComponent(lesson.id)}`}
                className="w-full h-full border-0"
                title="HTML Content"
                sandbox="allow-scripts allow-same-origin"
                onError={() => {
                  console.error('Failed to load HTML content from URL:', htmlUrl);
                  toast.error('Failed to load HTML content');
                }}
              />
            ) : lesson.content ? (
              // Fallback to inline HTML content if URL is not available
              <HtmlInlineLessonContent
                html={lesson.content}
                lessonId={lesson.id}
                isCompleted={lesson.isCompleted}
                onComplete={() => {
                  onProgressUpdate?.(lesson.id, {
                    progressPercent: 100,
                    videoTimestamp: null,
                    completed: true
                  });
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <p className="text-lg">HTML content not available</p>
                </div>
              </div>
            )}
          </div>
        );
      }
      case 'content':
        return (
          <div className="w-full h-full bg-white p-8 overflow-auto">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold mb-4">{lesson.title}</h2>
              <div 
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: lesson.content || '<p>No content available</p>' }}
              />
              {!lesson.isCompleted && !previewMode && (
                <div className="mt-8">
                  <button
                    onClick={() => {
                      onProgressUpdate?.(lesson.id, {
                        progressPercent: 100,
                        videoTimestamp: null,
                        completed: true
                      });
                    }}
                    className="bg-[#2afeae] hover:bg-[#25e89e] text-[#1b365d] px-6 py-3 rounded-lg shadow font-medium transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Mark as Complete</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      case 'interactive':
        return (
          <div className="w-full h-full bg-white p-4 overflow-auto">
            <InteractiveLessonPlayer
              courseId={_courseId}
              lessonId={lesson.id}
              preview={previewMode}
              onLessonComplete={() => {
                if (previewMode) return;
                onProgressUpdate?.(lesson.id, {
                  progressPercent: 100,
                  videoTimestamp: null,
                  completed: true,
                });
              }}
            />
          </div>
        );
      case 'external': {
        const practicalStatus = String(lesson.practicalStatus ?? '').toLowerCase();
        const isPassed = lesson.isCompleted || practicalStatus === 'passed';
        const isFailed = practicalStatus === 'failed';
        const outcomeDateValue = lesson.completedAt || lesson.lastAccessedAt;
        const outcomeDate = outcomeDateValue
          ? new Date(outcomeDateValue).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : null;
        const defaultPendingMessage =
          'This activity is completed outside the learning platform. Your progress will be updated automatically once completion is recorded.';
        const pendingMessage = lesson.externalPendingMessage || defaultPendingMessage;

        return (
          <div className="flex h-full items-center justify-center bg-white p-8">
            <div className="max-w-2xl text-center">
              {isPassed || isFailed ? (
                <>
                  {isPassed ? (
                    <svg className="mx-auto mb-4 h-16 w-16 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="mx-auto mb-4 h-16 w-16 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <h2 className="text-2xl font-bold text-gray-900">{lesson.title}</h2>
                  <div className="mt-4 space-y-1 text-gray-700">
                    <p>
                      Status:{' '}
                      <span className={`font-semibold ${isPassed ? 'text-green-700' : 'text-red-700'}`}>
                        {isPassed ? 'Pass' : 'Fail'}
                      </span>
                    </p>
                    {outcomeDate && <p>Date: {outcomeDate}</p>}
                  </div>
                  <p className="mt-4 text-gray-600">
                    Well done on completing your practical assessment and reaching the end of your course.
                  </p>
                  <p className="mt-3 text-gray-600">
                    Please take a few moments to complete the course evaluation. Your feedback helps us monitor
                    the quality of our training and supports continuous improvement.
                  </p>
                </>
              ) : (
                <>
                  <svg className="mx-auto mb-4 h-16 w-16 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-2xl font-bold text-gray-900">{lesson.title}</h2>
                  <p className="mt-4 whitespace-pre-wrap text-gray-600">{pendingMessage}</p>
                  <p className="mt-6 text-sm text-gray-500">Pending completion</p>
                </>
              )}
            </div>
          </div>
        );
      }
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-600 text-center">
              <svg className="w-20 h-20 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-lg font-medium">Unknown content type: {formatLessonTypeLabel(lesson.type)}</p>
              <p className="text-sm text-gray-500 mt-2">This lesson type is not supported yet</p>
            </div>
          </div>
        );
    }
  };

  return <div className="h-full">{renderContent()}</div>;
}

function CertificatePanel({ courseId, course }) {
  const eligible = isCertificateEligible(course);
  const [certificateUrl, setCertificateUrl] = React.useState(null);
  const [certificateError, setCertificateError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (!eligible) {
      setCertificateUrl(null);
      setCertificateError('');
      setIsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setCertificateUrl(null);
    setCertificateError('');
    setIsLoading(true);

    fetchCourseCertificate(courseId)
      .then((url) => {
        if (!cancelled) {
          setCertificateUrl(url);
        }
      })
      .catch((error) => {
        console.error('Error fetching certificate:', error);
        if (!cancelled) {
          setCertificateError(error.message || 'Network error. Please check your connection and try again.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, eligible, reloadKey]);

  if (!eligible) {
    const hasFailedPractical = (course?.lessons ?? []).some(
      (lesson) =>
        String(lesson.type).toLowerCase() === 'external' &&
        String(lesson.practicalStatus ?? '').toLowerCase() === 'failed'
    );

    return (
      <div className="flex h-full items-center justify-center bg-gray-50 p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Certificate</h2>
          <p className="mt-2 text-sm text-gray-600">
            {hasFailedPractical
              ? 'A passed practical is required before your certificate can be issued.'
              : hasPracticalLesson(course?.lessons) && course?.hasPostSurvey && !course?.postSurveyCompleted
                ? 'Complete the evaluation survey to unlock your certificate.'
                : 'Complete all course requirements to unlock your certificate.'}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading certificate...</p>
      </div>
    );
  }

  if (certificateError) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 p-8">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-semibold text-gray-900">Unable to load certificate</h2>
          <p className="mt-2 text-sm text-gray-600">{certificateError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="mt-6 rounded border border-[#2afeae] bg-[#2afeae] px-6 py-2 text-[#1b365d] transition-colors hover:bg-[#25e89e]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return certificateUrl ? (
    <iframe
      src={certificateUrl}
      title={`Certificate for ${course?.title || 'course'}`}
      className="h-full w-full border-0 bg-white"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  ) : null;
}

export default function CourseContent({ previewMode = false }) {
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const SHOW_COURSE_INFO_PANEL = false;
  const [course, setCourse] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Survey states
  const [surveyItems, setSurveyItems] = useState([]);
  const [activeSurvey, setActiveSurvey] = useState(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [surveyLoading, setSurveyLoading] = useState(false);
  
  // AI Assistant state
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const processedScormCompletionRef = useRef(new Set());
  const contentViewportRef = useRef(null);
  const courseRef = useRef(null);
  const [isContentFullscreen, setIsContentFullscreen] = useState(false);
  const [isResourcesPanelOpen, setIsResourcesPanelOpen] = useState(false);
  const [courseResources, setCourseResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [recentlyUnlockedLessonIds, setRecentlyUnlockedLessonIds] = useState([]);

  const clearUnlockAnimationForLesson = (lessonId) => {
    setRecentlyUnlockedLessonIds((prev) =>
      prev.filter((id) => String(id) !== String(lessonId))
    );
  };

  const queueUnlockAnimation = (lessonIds) => {
    if (!lessonIds?.length) {
      return;
    }

    const normalizedIds = lessonIds.map(String);
    setRecentlyUnlockedLessonIds((prev) => [...new Set([...prev, ...normalizedIds])]);
    setIsMobileSidebarOpen(true);
    setIsSidebarCollapsed(false);

    requestAnimationFrame(() => {
      window.setTimeout(() => {
        const firstUnlockedId = normalizedIds[0];
        document
          .querySelector(`[data-lesson-id="${firstUnlockedId}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 320);
    });
  };

  const completeLessonLocally = (lessonId) => {
    const prevCourse = courseRef.current;
    if (!prevCourse) {
      return null;
    }

    const targetLesson = prevCourse.lessons.find((lesson) => String(lesson.id) === String(lessonId));
    if (!targetLesson || targetLesson.isCompleted) {
      return null;
    }

    const { updatedCourse, newlyUnlockedLessonIds } = markLessonCompletedInCourse(prevCourse, lessonId);
    setCourse(updatedCourse);
    queueUnlockAnimation(newlyUnlockedLessonIds);

    setActiveLesson((prev) => {
      if (!prev || String(prev.id) !== String(lessonId)) {
        return prev;
      }
      return { ...prev, isCompleted: true, progressPercent: 100 };
    });

    return updatedCourse;
  };

  usePageTitle(
    previewMode
      ? (course ? `Preview: ${course.title}` : 'Course Preview')
      : (course ? `${course.title} - Course Content` : 'Course Content')
  );

  useEffect(() => {
    courseRef.current = course;
  }, [course]);

  useEffect(() => {
    setRecentlyUnlockedLessonIds([]);
  }, [courseId]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement;

      setIsContentFullscreen(!!fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    processedScormCompletionRef.current.clear();
  }, [courseId]);

  // Listen for SCORM completion messages
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'scorm-lesson-completed') {
        const lessonId = Number(event.data.lessonId);
        if (Number.isNaN(lessonId)) {
          return;
        }

        if (processedScormCompletionRef.current.has(lessonId)) {
          return;
        }

        if (previewMode) {
          return;
        }

        processedScormCompletionRef.current.add(lessonId);
        console.log('📥 Received SCORM completion for lesson:', lessonId);
        // SCORM data has already been saved by the backend endpoint
        // Just update the local UI state to reflect completion
        notifyLessonCompleted(lessonId, courseRef.current?.lessons);

        const updatedCourse = completeLessonLocally(lessonId);
        if (updatedCourse?.lessons.every((lesson) => lesson.isCompleted)) {
          toast.success('🎉 Congratulations! You\'ve completed all lessons!');
          loadCourseDetails(null, { soft: true }).catch((err) => console.error('Failed to reload course:', err));
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProgressUpdate = async (lessonId, progressData) => {
    if (previewMode) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/api/learner/courses/${courseId}/lessons/${lessonId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(progressData)
      });
      
      // Only update the local state when lesson is marked as completed
      // This prevents interrupting video playback and avoids full page reload
      if (progressData.completed) {
        notifyLessonCompleted(lessonId, courseRef.current?.lessons);

        const wereAllAlreadyComplete = courseRef.current?.lessons.every((lesson) => lesson.isCompleted);
        const updatedCourse = completeLessonLocally(lessonId);

        if (updatedCourse) {
          const allLessonsComplete = updatedCourse.lessons.every((lesson) => lesson.isCompleted);

          if (allLessonsComplete && !wereAllAlreadyComplete) {
            loadCourseDetails(null, { soft: true }).then(() => {
              toast.success('🎉 Congratulations! You\'ve completed all lessons!');
            });

            if (updatedCourse.hasPostSurvey && !updatedCourse.postSurveyCompleted) {
              upsertPostSurveyItem(updatedCourse);
              loadPostSurvey(updatedCourse);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      // Don't show error to user, it's background sync
    }
  };

  const trackLessonAccess = async (lessonId) => {
    if (previewMode) {
      return;
    }

    clearUnlockAnimationForLesson(lessonId);

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/api/learner/courses/${courseId}/lessons/${lessonId}/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Update local lesson state to mark as accessed (in-progress)
      setCourse(prevCourse => {
        if (!prevCourse) return prevCourse;
        
        return {
          ...prevCourse,
          lessons: prevCourse.lessons.map(lesson => 
            lesson.id === lessonId 
              ? { ...lesson, lastAccessedAt: new Date().toISOString() }
              : lesson
          )
        };
      });
      
      // Also update active lesson if it's the one being tracked
      if (activeLesson?.id === lessonId) {
        setActiveLesson(prev => prev ? { ...prev, lastAccessedAt: new Date().toISOString() } : prev);
      }
    } catch (error) {
      console.error('Error tracking lesson access:', error);
    }
  };

  const loadPreSurvey = async (courseData = null) => {
    const currentCourse = courseData ?? courseRef.current;
    if (previewMode && currentCourse?.preCourseSurveyId) {
      try {
        const surveyData = await adminSurveyService.getSurvey(currentCourse.preCourseSurveyId);
        const playerData = transformAdminSurveyForPlayer(surveyData, currentCourse.isPreSurveyMandatory);
        const preSurveyItem = {
          id: 'pre-survey',
          title: playerData.title || 'Pre-Course Survey',
          type: 'survey',
          isCompleted: false,
          isMandatory: playerData.isMandatory,
          surveyType: 'pre',
          surveyData: playerData,
          order: -1,
        };
        setSurveyItems((prev) => [preSurveyItem, ...prev.filter((s) => s.surveyType !== 'pre')]);
        return preSurveyItem;
      } catch (error) {
        console.log('No pre-survey configured or error loading preview survey:', error);
        return null;
      }
    }

    try {
      const surveyData = await learnerSurveyService.getPreCourseSurvey(courseId);
      if (surveyData.alreadyCompleted) {
        // Add as completed survey item
        setSurveyItems(prev => [{
          id: 'pre-survey',
          title: surveyData.title || 'Pre-Course Survey',
          type: 'survey',
          isCompleted: true,
          surveyType: 'pre',
          order: -1 // Show before lessons
        }, ...prev.filter((s) => s.surveyType !== 'pre')]);
        return null; // Return null to indicate completed
      }
      // Add as active survey item
      const preSurveyItem = {
        id: 'pre-survey',
        title: surveyData.title || 'Pre-Course Survey',
        type: 'survey',
        isCompleted: false,
        isMandatory: surveyData.isMandatory,
        surveyType: 'pre',
        surveyData: surveyData,
        order: -1
      };
      setSurveyItems(prev => [preSurveyItem, ...prev.filter((s) => s.surveyType !== 'pre')]);
      return preSurveyItem; // Return the survey item to set as active
    } catch (error) {
      console.log('No pre-survey configured or error loading:', error);
      return null;
    }
  };

  const buildPostSurveyItem = (courseData, surveyData = null) => {
    const isCompleted = courseData.postSurveyCompleted || surveyData?.alreadyCompleted || false;
    const allLessonsComplete = areLessonsReadyForPostSurvey(courseData.lessons);

    return {
      id: 'post-survey',
      title: surveyData?.title || courseData.postSurveyTitle || 'Post-Course Survey',
      type: 'survey',
      isCompleted,
      isMandatory: courseData.isPostSurveyMandatory,
      surveyType: 'post',
      order: 9999,
      isLocked: !isCompleted && !allLessonsComplete,
      surveyData: isCompleted || allLessonsComplete ? surveyData : null,
    };
  };

  const upsertPostSurveyItem = (courseData, surveyData = null) => {
    const postItem = buildPostSurveyItem(courseData, surveyData);
    setSurveyItems((prev) => [...prev.filter((s) => s.surveyType !== 'post'), postItem]);
    return postItem;
  };

  const loadPostSurvey = async (courseData) => {
    if (!courseData?.hasPostSurvey) {
      return null;
    }

    const allLessonsComplete = areLessonsReadyForPostSurvey(courseData.lessons);
    const isCompleted = courseData.postSurveyCompleted;

    if (previewMode && courseData.postCourseSurveyId) {
      try {
        const surveyData = await adminSurveyService.getSurvey(courseData.postCourseSurveyId);
        const playerData = transformAdminSurveyForPlayer(surveyData, courseData.isPostSurveyMandatory);
        return upsertPostSurveyItem(courseData, playerData);
      } catch (error) {
        console.log('No post-survey configured or error loading preview survey:', error);
        upsertPostSurveyItem(courseData);
        return null;
      }
    }

    // Always list the post-survey at the end; fetch questions only when unlocked or completed.
    if (!allLessonsComplete && !isCompleted) {
      upsertPostSurveyItem(courseData);
      return null;
    }

    try {
      const surveyData = await learnerSurveyService.getPostCourseSurvey(courseId);
      return upsertPostSurveyItem(courseData, surveyData);
    } catch (error) {
      console.log('No post-survey configured or error loading:', error);
      upsertPostSurveyItem(courseData);
      return null;
    }
  };

  const handleSidebarItemClick = async (item, isLocked, isPreSurveyLocked) => {
    if (isLocked) {
      toast(
        isPreSurveyLocked
          ? 'Please complete the pre-course survey first'
          : item.type === 'certificate'
            ? 'Complete all course requirements to unlock your certificate'
          : item.type === 'survey' && item.surveyType === 'post'
            ? 'Complete all lessons (including practical outcome) to unlock this survey'
            : 'Complete the previous lesson to unlock this content',
        { icon: '🔒' }
      );
      return;
    }

    if (item.type === 'certificate') {
      setShowCertificate(true);
      setActiveSurvey(null);
      setActiveLesson(null);
    } else if (item.type === 'survey') {
      let surveyItem = item;

      if (item.surveyType === 'post' && !item.surveyData) {
        setSurveyLoading(true);
        try {
          const surveyData = await learnerSurveyService.getPostCourseSurvey(courseId);
          surveyItem = upsertPostSurveyItem(course, surveyData);
        } catch (error) {
          console.error('Error loading post-survey:', error);
          toast.error('Failed to load survey');
          return;
        } finally {
          setSurveyLoading(false);
        }
      }

      setActiveSurvey(surveyItem);
      setActiveLesson(null);
      setShowCertificate(false);
    } else {
      setActiveLesson(item);
      setActiveSurvey(null);
      setShowCertificate(false);
      trackLessonAccess(item.id);
    }

    setIsMobileSidebarOpen(false);
  };

  const handleSurveySubmit = async (answers, surveyType) => {
    setSurveyLoading(true);
    try {
      if (surveyType === 'pre') {
        await learnerSurveyService.submitPreCourseSurvey(courseId, answers);
      } else {
        await learnerSurveyService.submitPostCourseSurvey(courseId, answers);
      }
      if (surveyType === 'post') {
        toast.success('🎉 Course complete! Your certificate is ready.');
      } else {
        toast.success('Survey submitted successfully!');
      }
      
      // Mark survey as completed
      setSurveyItems(prev => prev.map(item => 
        item.surveyType === surveyType ? { ...item, isCompleted: true } : item
      ));
      setActiveSurvey(null);

      if (surveyType === 'post') {
        setCourse((prev) =>
          prev
            ? {
                ...prev,
                postSurveyCompleted: true,
                certificateEligible: isCertificateEligible({
                  ...prev,
                  postSurveyCompleted: true,
                }),
              }
            : prev
        );
      }
      
      // Reload course to update overall completion status, then open certificate when unlocked.
      await loadCourseDetails(null, {
        soft: true,
        focusCertificate: surveyType === 'post',
      });
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast.error('Failed to submit survey');
    } finally {
      setSurveyLoading(false);
    }
  };



  const loadCourseDetails = async (signal = null, { soft = false, focusCertificate = false } = {}) => {
    // Soft refresh updates course/survey state without unmounting the content panel
    // (avoids resetting the video intro screen after lesson completion).
    if (!soft) {
      setLoading(true);
    }
    try {
      const courseData = previewMode
        ? await getAdminCoursePreview(courseId, signal)
        : await getCourseDetails(courseId, signal);
      
      if (!courseData && (!signal || !signal.aborted)) {
        toast.error(previewMode ? 'Course not found' : 'Course not found or access denied');
        navigate(previewMode ? '/admin/courses' : '/courses/all');
        return;
      }
      
      if (!signal || !signal.aborted) {
        const normalizedCourse = normalizeCourseData(courseData);
        setCourse(normalizedCourse);
        
        // Check for pre-survey and load it (both completed and incomplete)
        let preSurveyItem = null;
        if (normalizedCourse.hasPreSurvey) {
          preSurveyItem = await loadPreSurvey();
        }
        
        // Load post-survey if it exists (always listed at end; locked until all lessons complete)
        if (normalizedCourse.hasPostSurvey) {
          await loadPostSurvey(normalizedCourse);
        }

        if (soft) {
          // Keep the learner on the current lesson/survey; only sync lesson fields.
          setActiveLesson((prev) => {
            if (!prev) return prev;
            const refreshed = normalizedCourse.lessons?.find(
              (lesson) => String(lesson.id) === String(prev.id)
            );
            return refreshed ?? prev;
          });

          if (focusCertificate) {
            const certificateItem = buildCertificateItem(normalizedCourse);
            if (certificateItem && !certificateItem.isLocked) {
              setShowCertificate(true);
              setActiveLesson(null);
              setActiveSurvey(null);
            }
          }
        } else if (preSurveyItem && !normalizedCourse.preSurveyCompleted && !previewMode) {
          // Show pre-survey as the first active item if not completed
          setActiveSurvey(preSurveyItem);
          setActiveLesson(null);
        } else if (normalizedCourse.lessons && normalizedCourse.lessons.length > 0) {
          const sortedLessons = [...normalizedCourse.lessons].sort(
            (a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0)
          );
          const firstUnlockedLesson = sortedLessons.find((lesson) => !lesson.isLocked) || sortedLessons[0];

          // Set active lesson based on: query param > last accessed > first unlocked lesson
          let lessonToShow = firstUnlockedLesson;

          const lessonIdParam = searchParams.get('lessonId');
          if (lessonIdParam) {
            const requestedLesson = normalizedCourse.lessons.find(
              (lesson) => String(lesson.id) === String(lessonIdParam)
            );
            if (requestedLesson && (previewMode || !requestedLesson.isLocked)) {
              lessonToShow = requestedLesson;
            }
          } else if (!previewMode && normalizedCourse.lastAccessedLessonId) {
            const lastLesson = normalizedCourse.lessons.find(
              (lesson) => lesson.id === normalizedCourse.lastAccessedLessonId
            );
            if (lastLesson && !lastLesson.isLocked) {
              lessonToShow = lastLesson;
            }
          }

          setActiveLesson(lessonToShow);
          setActiveSurvey(null);
          setShowCertificate(false);

          if (!lessonToShow.isLocked || previewMode) {
            trackLessonAccess(lessonToShow.id);
          }
        }
      }
    } catch (error) {
      if (!signal || !signal.aborted) {
        console.error('Error loading course details:', error);
        toast.error('Failed to load course details');
        navigate(previewMode ? '/admin/courses' : '/courses/all');
      }
    } finally {
      if (!soft && (!signal || !signal.aborted)) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Create an AbortController for this request
    const abortController = new AbortController();

    if (courseId) {
      loadCourseDetails(abortController.signal);
    } else {
      navigate('/courses/all');
    }

    // Cleanup function to abort the request if component unmounts or courseId changes
    return () => {
      abortController.abort();
    };
  }, [courseId, navigate]);

  const toggleCourseViewportFullscreen = () => {
    const element = contentViewportRef.current;
    const fullscreenElement =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;

    if (!fullscreenElement) {
      if (element?.requestFullscreen) {
        element.requestFullscreen();
      } else if (element?.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element?.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      } else if (element?.msRequestFullscreen) {
        element.msRequestFullscreen();
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  };

  const loadCourseResources = async () => {
    if (!courseId) return;
    setResourcesLoading(true);
    try {
      const data = await getCourseResources(courseId, previewMode);
      setCourseResources(data || []);
    } catch (error) {
      console.error('Error loading course resources:', error);
      toast.error('Failed to load course resources');
      setCourseResources([]);
    } finally {
      setResourcesLoading(false);
    }
  };

  const handleToggleResourcesPanel = async () => {
    if (isResourcesPanelOpen) {
      setIsResourcesPanelOpen(false);
      return;
    }

    setIsResourcesPanelOpen(true);
    await loadCourseResources();
  };

  const handleOpenCourseResource = async (resource) => {
    try {
      if (resource.url) {
        window.open(resource.url, '_blank', 'noopener,noreferrer');
        return;
      }

      const detail = await getCourseResource(courseId, resource.id, previewMode);
      if (detail?.url) {
        window.open(detail.url, '_blank', 'noopener,noreferrer');
        return;
      }

      if (detail?.htmlContent) {
        const blob = new Blob([detail.htmlContent], { type: 'text/html' });
        const objectUrl = URL.createObjectURL(blob);
        const newWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer');
        if (!newWindow) {
          URL.revokeObjectURL(objectUrl);
          toast.error('Pop-up blocked. Please allow pop-ups to open this resource.');
          return;
        }
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        return;
      }

      toast.error('This resource is not available to open.');
    } catch (error) {
      console.error('Error opening course resource:', error);
      toast.error('Failed to open resource');
    }
  };

  const handleLessonMenuToggle = () => {
    if (window.innerWidth < 1024) {
      setIsMobileSidebarOpen(prev => !prev);
      return;
    }

    setIsSidebarCollapsed(prev => !prev);
  };

  const completedLessonCount = course?.lessons?.filter(l => l.isCompleted).length ?? 0;
  const totalLessonCount = course?.lessons?.length ?? 0;
  const completedSurveyCount = surveyItems.filter(s => s.isCompleted).length;
  const totalSurveyCount = surveyItems.length;
  const certificateItem = buildCertificateItem(course);
  const certificateComplete = certificateItem?.isCompleted ? 1 : 0;
  const certificateTotal = certificateItem ? 1 : 0;
  const completedItemCount = completedLessonCount + completedSurveyCount + certificateComplete;
  const totalItemCount = totalLessonCount + totalSurveyCount + certificateTotal;
  const activeItemTitle = showCertificate
    ? 'Certificate'
    : activeLesson?.title || activeSurvey?.title || course?.title || 'Course';
  const courseProgressPercent = totalItemCount > 0
    ? Math.round((completedItemCount / totalItemCount) * 100)
    : 0;
  const isModulesMenuOpen = isMobileSidebarOpen || !isSidebarCollapsed;

  const isPreSurveyLockedForNav = previewMode
    ? false
    : surveyItems.some((s) => s.surveyType === 'pre' && s.isMandatory && !s.isCompleted);
  const isCurriculumItemLocked = (item) =>
    previewMode
      ? false
      : (item.type === 'survey' && item.isLocked) ||
        (item.type === 'certificate' && item.isLocked) ||
        (item.type !== 'survey' && item.type !== 'certificate' && (isPreSurveyLockedForNav || item.isLocked));

  const curriculumItems = [
    ...surveyItems,
    ...(course?.lessons ?? []).map((l) => ({ ...l, order: l.ordinal ?? 0 })),
    ...(certificateItem ? [certificateItem] : []),
  ].sort((a, b) => a.order - b.order);

  const activeCurriculumIndex = curriculumItems.findIndex((item) => {
    if (item.type === 'certificate') return showCertificate;
    if (item.type === 'survey') return activeSurvey?.id === item.id;
    return activeLesson?.id === item.id;
  });
  const previousCurriculumItem =
    activeCurriculumIndex > 0 ? curriculumItems[activeCurriculumIndex - 1] : null;
  const nextCurriculumItem =
    activeCurriculumIndex >= 0 && activeCurriculumIndex < curriculumItems.length - 1
      ? curriculumItems[activeCurriculumIndex + 1]
      : null;
  const canGoPrevious = Boolean(previousCurriculumItem);
  const canGoNext =
    Boolean(nextCurriculumItem) && !isCurriculumItemLocked(nextCurriculumItem);
  const showLessonNav =
    course?.showLessonNavigation === true &&
    activeCurriculumIndex >= 0 &&
    curriculumItems.length > 1;

  const handleNavigateToAdjacentItem = (item) => {
    if (!item) return;
    handleSidebarItemClick(item, isCurriculumItemLocked(item), isPreSurveyLockedForNav);
  };

  if (loading || !course) {
    return (
      <div className="min-h-screen bg-page-bg">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">{loading ? 'Loading course...' : 'Course not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={contentViewportRef} className="min-h-screen bg-page-bg flex flex-col">
      <div
        className="bg-boxlms-navbar text-white px-3 py-1.5 sm:px-5"
        style={{
          backgroundColor: 'var(--tenant-primary, var(--color-boxlms-navbar))',
        }}
      >
        <div className="flex items-center justify-between gap-2 min-h-10">
          <button
            onClick={() => {
              if (previewMode) {
                window.close();
              } else {
                navigate('/courses/all');
              }
            }}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-[15px] font-semibold text-white hover:bg-white/10 transition-colors"
            title={previewMode ? 'Close preview' : 'Exit course'}
            aria-label={previewMode ? 'Close preview' : 'Exit course'}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span>{previewMode ? 'Close preview' : 'Exit course'}</span>
          </button>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:gap-4">
            <button
              onClick={handleLessonMenuToggle}
              className={`
                inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold
                transition-all duration-200
                ${isModulesMenuOpen
                  ? 'border-white bg-white text-boxlms-navbar shadow-sm hover:bg-white/90'
                  : 'border-white/40 bg-white/15 text-white hover:border-white hover:bg-white hover:text-boxlms-navbar hover:shadow-sm'}
              `}
              title="Toggle modules menu"
              aria-label="Toggle modules menu"
              aria-expanded={isModulesMenuOpen}
            >
              <span className="lg:hidden">
                <ModulesToggleIcon menuOpen={isMobileSidebarOpen} />
              </span>
              <span className="hidden lg:inline-flex">
                <ModulesToggleIcon menuOpen={!isSidebarCollapsed} />
              </span>
              <span className="hidden sm:inline">Modules</span>
            </button>

            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-white/10 border border-white/20 px-2.5 py-0.5 text-xs font-medium text-white">
                {completedItemCount} of {totalItemCount} completed
              </span>
              <span className="truncate text-sm font-medium text-white">
                {activeItemTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleResourcesPanel}
              className={`inline-flex items-center justify-center rounded-md p-2 transition-colors ${
                isResourcesPanelOpen
                  ? 'bg-white/20 text-white'
                  : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
              title="Course resources"
              aria-label="Course resources"
              aria-expanded={isResourcesPanelOpen}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 4h10a2 2 0 012 2v14l-5-3-5 3V6a2 2 0 012-2z" />
              </svg>
            </button>

            <button
              onClick={toggleCourseViewportFullscreen}
              className="inline-flex items-center justify-center rounded-md p-2 text-white/90 hover:text-white hover:bg-white/10 transition-colors"
              title={isContentFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              aria-label={isContentFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isContentFullscreen ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <CourseResourcesPanel
        isOpen={isResourcesPanelOpen}
        onClose={() => setIsResourcesPanelOpen(false)}
        resources={courseResources}
        loading={resourcesLoading}
        onOpenResource={handleOpenCourseResource}
      />

      <div
        className="h-1 w-full bg-black/10"
        aria-label="Course progress border"
        style={{ backgroundColor: 'color-mix(in srgb, var(--tenant-primary, var(--color-boxlms-navbar)) 25%, transparent)' }}
      >
        <div
          className="h-full bg-boxlms-navbar-active transition-all duration-300"
          style={{ width: `${courseProgressPercent}%` }}
        />
      </div>

      {/* Mobile overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      
      <div className="flex-1 flex overflow-hidden">
        {/* Panel 1: Lessons Sidebar */}
        <div className={`
          fixed lg:relative inset-y-0 left-0
          w-80 bg-white border-r overflow-y-auto z-50
          transform transition-transform duration-300 ease-in-out
          ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isSidebarCollapsed ? 'lg:hidden' : 'lg:translate-x-0'}
        `}>
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <div />
              <div className="flex items-center gap-1">
                {/* Mobile: close button */}
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="lg:hidden text-gray-600 hover:text-gray-900 p-1"
                  aria-label="Close menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{course.title}</h2>
          </div>
          <div className="p-4 space-y-2">{/* Combine lessons, surveys, and certificate, sorted by order */}
            {[...surveyItems, ...course.lessons.map((l) => ({ ...l, order: l.ordinal ?? 0 })), ...(certificateItem ? [certificateItem] : [])]
              .sort((a, b) => a.order - b.order)
              .map((item) => {
                const isPreSurveyLocked = surveyItems.some(
                  (s) => s.surveyType === 'pre' && s.isMandatory && !s.isCompleted
                );
                const isLocked =
                  (item.type === 'survey' && item.isLocked) ||
                  (item.type === 'certificate' && item.isLocked) ||
                  (item.type !== 'survey' && item.type !== 'certificate' && (isPreSurveyLocked || item.isLocked));

                const isActive = item.type === 'certificate'
                  ? showCertificate
                  : item.type === 'survey' 
                  ? activeSurvey?.id === item.id
                  : activeLesson?.id === item.id;
                
                return (
                  <div key={item.id}>
                    <LessonItem
                      lesson={item}
                      isActive={isActive}
                      isLocked={isLocked}
                      showUnlockAnimation={recentlyUnlockedLessonIds.includes(String(item.id))}
                      onClick={() => handleSidebarItemClick(item, isLocked, isPreSurveyLocked)}
                    />
                  </div>
                );
              })}
          </div>
        </div>

        {/* Panel 2: Content Display */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 bg-gray-900 overflow-hidden min-h-[300px] lg:min-h-0">
            {showCertificate ? (
              <CertificatePanel courseId={courseId} course={course} />
            ) : activeSurvey ? (
              <div className="h-full overflow-y-auto bg-gray-50">
                {surveyLoading || (!activeSurvey.surveyData && !activeSurvey.isCompleted) ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-gray-500">Loading survey...</p>
                  </div>
                ) : (
                  <SurveyPlayer
                    survey={activeSurvey.surveyData}
                    onSubmit={(answers) => handleSurveySubmit(answers, activeSurvey.surveyType)}
                    onCancel={null}
                    surveyType={activeSurvey.surveyType}
                    previewMode={previewMode}
                  />
                )}
              </div>
            ) : (
              <ContentPanel 
                lesson={activeLesson} 
                courseId={courseId}
                onProgressUpdate={handleProgressUpdate}
                previewMode={previewMode}
              />
            )}
          </div>

          {showLessonNav && (
            <div className="flex-shrink-0 border-t border-gray-200 bg-white">
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 sm:px-4">
                <button
                  type="button"
                  onClick={() => handleNavigateToAdjacentItem(previousCurriculumItem)}
                  disabled={!canGoPrevious}
                  aria-label={
                    previousCurriculumItem
                      ? `Previous: ${previousCurriculumItem.title}`
                      : 'No previous item'
                  }
                  title={previousCurriculumItem?.title}
                  className={`
                    inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium
                    transition-colors sm:text-sm
                    ${canGoPrevious
                      ? 'border-gray-200 bg-white text-[#1b365d] hover:border-[#2afeae] hover:bg-[#e8fdf6]'
                      : 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'}
                  `}
                >
                  <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigateToAdjacentItem(nextCurriculumItem)}
                  disabled={!canGoNext}
                  aria-label={
                    nextCurriculumItem
                      ? canGoNext
                        ? `Next: ${nextCurriculumItem.title}`
                        : `Next locked: ${nextCurriculumItem.title}`
                      : 'No next item'
                  }
                  title={
                    nextCurriculumItem && !canGoNext
                      ? nextCurriculumItem.type === 'certificate'
                        ? 'Complete all course requirements to unlock your certificate'
                        : nextCurriculumItem.type === 'survey'
                          ? 'Complete all lessons to unlock this survey'
                          : 'Complete the previous lesson to unlock the next one'
                      : nextCurriculumItem?.title
                  }
                  className={`
                    inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium
                    transition-colors sm:text-sm
                    ${canGoNext
                      ? 'border-[#2afeae] bg-[#2afeae] text-[#1b365d] hover:bg-[#25e89e]'
                      : 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'}
                  `}
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {SHOW_COURSE_INFO_PANEL && (
            <div className="lg:h-48 bg-white border-t overflow-y-auto">
              <div className="p-4 lg:p-6">
                {(activeLesson || activeSurvey) && (
                  <>
                    <h3 className="text-lg lg:text-xl font-semibold text-gray-900 mb-1">
                      {activeLesson?.title || activeSurvey?.title}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">{course.title}</p>

                    {activeLesson && (
                      <div className="mb-4 pb-4 border-b">
                        <h4 className="text-base font-semibold text-gray-900 mb-2">Certificates</h4>
                        <p className="text-sm text-gray-600 mb-3">Get certificate by completing entire course</p>
                        {isCertificateEligible(course) ? (
                          <button
                            onClick={async () => {
                              try {
                                toast.loading('Generating certificate...', { id: 'cert-gen' });
                                const certificateUrl = await fetchCourseCertificate(course.id);
                                toast.dismiss('cert-gen');
                                toast.success('Certificate ready! Opening...');
                                window.open(certificateUrl, '_blank', 'noopener,noreferrer');
                              } catch (error) {
                                toast.dismiss('cert-gen');
                                console.error('Error fetching certificate:', error);
                                toast.error(error.message || 'Network error. Please check your connection and try again.');
                              }
                            }}
                            className="px-6 py-2 rounded border border-[#2afeae] bg-[#2afeae] text-[#1b365d] transition-colors hover:bg-[#25e89e]"
                          >
                            View Certificate
                          </button>
                        ) : (
                          <button
                            disabled
                            className="px-6 py-2 rounded border border-gray-300 text-gray-400 cursor-not-allowed"
                          >
                            {hasPracticalLesson(course.lessons) && course.hasPostSurvey && !course.postSurveyCompleted
                              ? 'Complete Survey to Get Certificate'
                              : hasPracticalLesson(course.lessons) &&
                                  course.lessons.some(
                                    (l) =>
                                      String(l.type).toLowerCase() === 'external' &&
                                      String(l.practicalStatus ?? '').toLowerCase() === 'failed'
                                  )
                                ? 'Practical Must Be Passed for Certificate'
                                : 'Complete Course to Get Certificate'}
                          </button>
                        )}
                      </div>
                    )}

                    <div>
                      <h4 className="text-base font-semibold text-gray-900 mb-2">Description</h4>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {activeSurvey?.surveyData?.description || course.description}
                      </p>
                    </div>
                  </>
                )}
                {!activeLesson && (
                  <p className="text-gray-500">Choose a lesson from the sidebar to begin learning.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {learnerFeatureFlags.showLearnerAiAssistant && !previewMode && (
        <>
          {/* Floating AI Assistant Button */}
          <button
            onClick={() => setIsAIAssistantOpen(true)}
            className="fixed bottom-6 right-6 bg-[#1b365d] text-[#2afeae] p-4 rounded-full shadow-lg hover:shadow-xl hover:bg-[#152d4d] transition-all duration-200 z-50 flex items-center gap-2 group font-medium"
            title="AI Assistant"
          >
            <Sparkles className="w-6 h-6" />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">
              AI Assistant
            </span>
          </button>
          {/* AI Assistant Modal */}
          {course && (
            <LearnerAIAssistant
              courseTitle={course.title}
              currentLessonTitle={activeLesson?.title}
              currentLessonContent={activeLesson?.htmlContent || activeLesson?.description || course.description}
              isOpen={isAIAssistantOpen}
              onClose={() => setIsAIAssistantOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
