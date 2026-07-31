import { useEffect, useState } from 'react';
import SlideOver from './SlideOver';
import {
  getLessonProgressEditDetails,
  getLessonProgressEditDetailsByAssignment,
  getQuizAttemptHistory,
  updateUserLessonProgress,
  upsertUserLessonProgressByAssignment
} from '../services/reports';
import { getQuiz } from '../services/quizzes';
import lessonsService from '../services/lessons';
import { formatLessonTypeLabel } from '../utils/lessonTypes';
import { quizFeatureFlags } from '../config/quizFeatureFlags';

const STANDARD_STATUS_OPTIONS = ['Not Started', 'In Progress', 'Completed'];
const QUIZ_STATUS_OPTIONS = ['Not Started', 'In Progress', 'Passed', 'Failed'];

function toDateInputValue(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function secondsToMinutes(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '';
  return String(Math.round(totalSeconds / 60));
}

function minutesToSeconds(minutes) {
  const parsed = Number(minutes);
  if (!minutes || Number.isNaN(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 60);
}

function isQuizRecord(record) {
  return String(record?.lessonType || '').toLowerCase() === 'quiz';
}

function deriveQuizStatus(record, latestAttempt) {
  if (latestAttempt) {
    return latestAttempt.passed ? 'Passed' : 'Failed';
  }

  if (record.status === 'Completed') return 'Passed';
  if (record.status === 'In Progress') return 'In Progress';
  return 'Not Started';
}

function applyDetailsToForm(data, setters) {
  const {
    setDetails,
    setStatus,
    setCompletedAt,
    setScorePercent,
    setDurationMinutes,
    setAttemptCompletedAt,
    setFailedCriticalSafety,
    setAttemptId
  } = setters;

  setDetails(data);
  setStatus(data.status || 'Not Started');
  setCompletedAt(toDateInputValue(data.completedAt));
  setScorePercent(
    data.latestAttempt?.scorePercent != null ? String(data.latestAttempt.scorePercent) : ''
  );
  setDurationMinutes(secondsToMinutes(data.latestAttempt?.durationSeconds));
  setAttemptCompletedAt(toDateInputValue(data.latestAttempt?.completedAt));
  setFailedCriticalSafety(Boolean(data.latestAttempt?.failedCriticalSafety));
  setAttemptId(data.latestAttempt?.attemptId ?? null);
}

async function loadDetailsFallback(record) {
  let quizId = record.quizId;
  const quizLesson = isQuizRecord(record);

  if (quizLesson && !quizId && record.courseId && record.lessonId) {
    try {
      const lesson = await lessonsService.getLesson(record.courseId, record.lessonId);
      quizId = lesson.quizId || lesson.QuizId;
    } catch (err) {
      console.warn('Could not resolve quiz id from lesson:', err);
    }
  }

  let quiz = null;
  let latestAttempt = null;
  let attemptCount = 0;

  if (quizLesson && quizId) {
    try {
      const [quizData, historyData] = await Promise.all([
        getQuiz(quizId),
        getQuizAttemptHistory(record.userId, quizId)
      ]);

      quiz = {
        quizId,
        title: quizData.title,
        passingScore: quizData.passingScore ?? 70,
        criticalSafetyEnabled: quizFeatureFlags.enableCriticalSafetyQuestions
      };

      const attempts = historyData.attempts || [];
      attemptCount = attempts.length;
      latestAttempt = attempts.find((attempt) => attempt.isLatest) || attempts[0] || null;
    } catch (err) {
      console.warn('Could not load quiz details from existing APIs:', err);
      quiz = {
        quizId,
        title: record.lessonTitle,
        passingScore: 70,
        criticalSafetyEnabled: quizFeatureFlags.enableCriticalSafetyQuestions
      };
    }
  }

  const isQuizLesson = quizLesson && Boolean(quizId);
  const normalizedLatestAttempt = latestAttempt
    ? {
        attemptId: latestAttempt.attemptId,
        scorePercent: latestAttempt.scorePercent,
        passed: latestAttempt.passed,
        failedCriticalSafety: latestAttempt.failedCriticalSafety,
        durationSeconds: latestAttempt.durationSeconds,
        completedAt: latestAttempt.completedAt
      }
    : null;

  return {
    progressId: record.progressId,
    userId: record.userId,
    courseId: record.courseId,
    lessonId: record.lessonId,
    lessonType: record.lessonType,
    quizId,
    isQuizLesson,
    status: isQuizLesson ? deriveQuizStatus(record, normalizedLatestAttempt) : (record.status || 'Not Started'),
    completedAt: record.completedAt,
    quiz,
    latestAttempt: normalizedLatestAttempt,
    attemptCount
  };
}

export default function LessonProgressEditSlideOver({ isOpen, record, onClose, onSaved }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Not Started');
  const [completedAt, setCompletedAt] = useState('');
  const [scorePercent, setScorePercent] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [attemptCompletedAt, setAttemptCompletedAt] = useState('');
  const [failedCriticalSafety, setFailedCriticalSafety] = useState(false);
  const [attemptId, setAttemptId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isQuizLesson = details?.isQuizLesson ?? isQuizRecord(record);
  const statusOptions = isQuizLesson ? QUIZ_STATUS_OPTIONS : STANDARD_STATUS_OPTIONS;
  const showQuizFields = isQuizLesson && (status === 'Passed' || status === 'Failed');
  const showCompletionDate = !isQuizLesson ? status === 'Completed' : status === 'Passed';

  useEffect(() => {
    if (!isOpen || !record) {
      setDetails(null);
      return;
    }

    const canLoad =
      Boolean(record.progressId) ||
      Boolean(record.userId && record.courseId && record.lessonId);

    if (!canLoad) {
      setDetails(null);
      return;
    }

    let cancelled = false;
    const setters = {
      setDetails,
      setStatus,
      setCompletedAt,
      setScorePercent,
      setDurationMinutes,
      setAttemptCompletedAt,
      setFailedCriticalSafety,
      setAttemptId
    };

    const loadDetails = async () => {
      setLoading(true);
      setError('');

      try {
        let data;

        try {
          if (record.progressId) {
            data = await getLessonProgressEditDetails(record.progressId);
          } else {
            data = await getLessonProgressEditDetailsByAssignment(
              record.userId,
              record.courseId,
              record.lessonId
            );
          }
        } catch (err) {
          if (err.response?.status !== 404) {
            throw err;
          }

          data = await loadDetailsFallback(record);
        }

        if (cancelled) return;
        applyDetailsToForm(data, setters);
      } catch (err) {
        console.error('Failed to load lesson progress details:', err);
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load lesson progress details');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadDetails();

    return () => {
      cancelled = true;
    };
  }, [isOpen, record]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!record?.progressId && !(record?.userId && record?.courseId && record?.lessonId)) {
      return;
    }

    if (showQuizFields && (scorePercent === '' || Number.isNaN(Number(scorePercent)))) {
      setError('Score is required for Passed or Failed quiz results');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        status,
        completedAt: showCompletionDate && completedAt ? completedAt : null
      };

      if (showQuizFields) {
        payload.quiz = {
          attemptId,
          scorePercent: Number(scorePercent),
          failedCriticalSafety,
          durationSeconds: minutesToSeconds(durationMinutes),
          attemptCompletedAt: attemptCompletedAt || null
        };
      }

      if (record.progressId) {
        await updateUserLessonProgress(record.progressId, payload);
      } else {
        await upsertUserLessonProgressByAssignment(
          record.userId,
          record.courseId,
          record.lessonId,
          payload
        );
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error('Failed to update lesson progress:', err);
      setError(err.response?.data?.message || 'Failed to update lesson progress');
    } finally {
      setSaving(false);
    }
  };

  if (!record) return null;

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={isQuizLesson ? 'Update Quiz Progress' : 'Update Lesson Progress'}
      widthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
          <div>
            <span className="font-medium text-gray-700">User:</span>{' '}
            <span className="text-gray-900">{record.userName}</span>
            <span className="text-gray-500"> ({record.email})</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Course:</span>{' '}
            <span className="text-gray-900">{record.courseTitle}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Lesson:</span>{' '}
            <span className="text-gray-900">{record.lessonTitle}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Type:</span>{' '}
            <span className="text-gray-900">{formatLessonTypeLabel(record.lessonType)}</span>
          </div>
          {details?.quiz && (
            <div>
              <span className="font-medium text-gray-700">Quiz:</span>{' '}
              <span className="text-gray-900">{details.quiz.title}</span>
              <span className="text-gray-500"> (passing score: {details.quiz.passingScore}%)</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">Loading progress details...</div>
        ) : (
          <>
            <div>
              <label htmlFor="lesson-progress-status" className="block text-sm font-medium text-gray-700 mb-1">
                {isQuizLesson ? 'Quiz Result Status' : 'Status'}
              </label>
              <select
                id="lesson-progress-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {showQuizFields && (
              <div className="space-y-4 rounded-lg border border-gray-200 p-4">
                <h4 className="text-sm font-semibold text-gray-900">Quiz Attempt Details</h4>

                <div>
                  <label htmlFor="quiz-score" className="block text-sm font-medium text-gray-700 mb-1">
                    Score (%)
                  </label>
                  <input
                    id="quiz-score"
                    type="number"
                    min="0"
                    max="100"
                    value={scorePercent}
                    onChange={(e) => setScorePercent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {details?.quiz?.passingScore != null && (
                    <p className="mt-1 text-xs text-gray-500">
                      Passing score is {details.quiz.passingScore}%.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="quiz-duration" className="block text-sm font-medium text-gray-700 mb-1">
                    Time Spent (minutes)
                  </label>
                  <input
                    id="quiz-duration"
                    type="number"
                    min="0"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label htmlFor="quiz-attempt-date" className="block text-sm font-medium text-gray-700 mb-1">
                    Attempt Date
                  </label>
                  <input
                    id="quiz-attempt-date"
                    type="date"
                    value={attemptCompletedAt}
                    onChange={(e) => setAttemptCompletedAt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Leave blank to use today&apos;s date.</p>
                </div>

                {details?.quiz?.criticalSafetyEnabled && (
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={failedCriticalSafety}
                      onChange={(e) => setFailedCriticalSafety(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Failed critical safety question
                  </label>
                )}

                {details?.attemptCount > 0 && (
                  <p className="text-xs text-gray-500">
                    {details.attemptCount} completed attempt{details.attemptCount === 1 ? '' : 's'} on record.
                    Saving will update the latest attempt unless a new one is needed.
                  </p>
                )}
              </div>
            )}

            {showCompletionDate && (
              <div>
                <label htmlFor="lesson-progress-completed-at" className="block text-sm font-medium text-gray-700 mb-1">
                  {isQuizLesson ? 'Lesson Completion Date' : 'Completion Date'}
                </label>
                <input
                  id="lesson-progress-completed-at"
                  type="date"
                  value={completedAt}
                  onChange={(e) => setCompletedAt(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Leave blank to use today&apos;s date.</p>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || loading}
            className="px-4 py-2 text-sm bg-[#1b365d] text-white rounded-md hover:bg-[#234a7a] transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </SlideOver>
  );
}
