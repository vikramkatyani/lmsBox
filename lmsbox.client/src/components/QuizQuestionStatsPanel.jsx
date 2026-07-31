import { useEffect, useMemo, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getQuizQuestionStats } from '../services/reports';
import { quizFeatureFlags } from '../config/quizFeatureFlags';

const STATS_SCOPE_ORG = 'org';
const STATS_SCOPE_GLOBAL = 'global';

function readCountBlock(question, scope) {
  const nested = scope === STATS_SCOPE_ORG
    ? (question.organisation ?? question.Organization ?? question.organization)
    : (question.global ?? question.Global);

  if (nested && typeof nested === 'object') {
    return {
      presentedCount: nested.presentedCount ?? nested.PresentedCount ?? 0,
      correctCount: nested.correctCount ?? nested.CorrectCount ?? 0,
      incorrectCount: nested.incorrectCount ?? nested.IncorrectCount ?? 0,
      incorrectOptionCounts: nested.incorrectOptionCounts ?? nested.IncorrectOptionCounts ?? []
    };
  }

  // Legacy flat API shape (single scope)
  return {
    presentedCount: question.presentedCount ?? question.PresentedCount ?? 0,
    correctCount: question.correctCount ?? question.CorrectCount ?? 0,
    incorrectCount: question.incorrectCount ?? question.IncorrectCount ?? 0,
    incorrectOptionCounts: question.incorrectOptionCounts ?? question.IncorrectOptionCounts ?? []
  };
}

function StatsScopeToggle({ value, onChange, organizationName }) {
  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1"
      role="group"
      aria-label="Statistics scope"
    >
      <button
        type="button"
        onClick={() => onChange(STATS_SCOPE_ORG)}
        aria-pressed={value === STATS_SCOPE_ORG}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
          value === STATS_SCOPE_ORG
            ? 'bg-white text-[#1b365d] shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Organisation
      </button>
      <button
        type="button"
        onClick={() => onChange(STATS_SCOPE_GLOBAL)}
        aria-pressed={value === STATS_SCOPE_GLOBAL}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
          value === STATS_SCOPE_GLOBAL
            ? 'bg-white text-[#1b365d] shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        All organisations
      </button>
      <span className="sr-only">
        {value === STATS_SCOPE_ORG ? organizationName : 'All organisations'}
      </span>
    </div>
  );
}

function OptionBreakdownModal({ question, statsScope, organizationName, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = readCountBlock(question, statsScope).incorrectOptionCounts;
  const scopeLabel = statsScope === STATS_SCOPE_ORG
    ? (organizationName || 'Your organisation')
    : 'All organisations';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Incorrect option breakdown"
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      >
        <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col">
          <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-200 shrink-0">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-gray-900">Incorrect option selections</h3>
              <p className="text-sm text-gray-500 mt-0.5">{scopeLabel}</p>
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{question?.questionText}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 shrink-0"
              aria-label="Close"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </header>

          <div className="p-5 overflow-y-auto">
            {rows.length === 0 ? (
              <p className="text-sm text-gray-500">No incorrect option selections recorded for this scope.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="py-2 pr-4">Option</th>
                      <th className="py-2 text-right">Incorrect selections</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.optionId} className="border-b border-gray-100">
                        <td className="py-2 pr-4 text-gray-900">{r.text}</td>
                        <td className="py-2 text-right font-semibold text-red-700">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function QuizQuestionStatsPanel({ quizId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalQuestion, setModalQuestion] = useState(null);
  const [statsScope, setStatsScope] = useState(STATS_SCOPE_ORG);

  useEffect(() => {
    if (!quizId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getQuizQuestionStats(quizId);
        if (!cancelled) setData(res);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Failed to load assessment question stats.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [quizId]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title = useMemo(() => {
    if (!data) return 'Assessment questions';
    const parts = [data.quizTitle, data.courseName].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Assessment questions';
  }, [data]);

  const organizationName = data?.organization || 'Your organisation';
  const showScopeToggle = organizationName !== 'All Organizations';
  const activeScope = showScopeToggle ? statsScope : STATS_SCOPE_GLOBAL;
  const questions = data?.questions || [];

  const scopeDescription = activeScope === STATS_SCOPE_ORG
    ? `${organizationName} — completed attempts`
    : 'All organisations — completed attempts';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Assessment question stats"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col bg-white shadow-2xl"
      >
        <header className="border-b border-gray-200 px-6 py-4 bg-white shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 pr-4">
              <h2 className="text-lg font-semibold text-gray-900 truncate">
                {loading ? 'Loading…' : title}
              </h2>
              {!loading && (
                <p className="text-sm text-gray-500 mt-0.5">{scopeDescription}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 shrink-0"
              aria-label="Close panel"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {!loading && showScopeToggle && (
            <div className="mt-4">
              <StatsScopeToggle
                value={statsScope}
                onChange={setStatsScope}
                organizationName={organizationName}
              />
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto bg-gray-50">
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1b365d]" />
            </div>
          )}

          {!loading && error && (
            <div className="p-8 text-center text-red-600">{error}</div>
          )}

          {!loading && !error && (
            <div className="p-6">
              {questions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-10">No questions found for this assessment.</p>
              ) : (
                <div className="overflow-x-auto bg-white rounded-lg shadow-sm border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="py-3 px-4">Question</th>
                        <th className="py-3 px-4">Presented</th>
                        <th className="py-3 px-4">Correct</th>
                        <th className="py-3 px-4">Incorrect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q, idx) => {
                        const stats = readCountBlock(q, activeScope);

                        return (
                          <tr key={q.questionId} className="border-b border-gray-100 align-top">
                            <td className="py-3 px-4">
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-semibold text-gray-400 mt-0.5">Q{idx + 1}</span>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap gap-2 mb-1">
                                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                                      {q.category}
                                    </span>
                                    {quizFeatureFlags.enableCriticalSafetyQuestions && q.isCriticalSafety && (
                                      <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                                        Critical
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-gray-900 line-clamp-3">{q.questionText}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-semibold text-gray-900">{stats.presentedCount}</td>
                            <td className="py-3 px-4 font-semibold text-green-700">{stats.correctCount}</td>
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => setModalQuestion(q)}
                                disabled={!stats.incorrectCount}
                                className="font-semibold text-red-700 hover:underline disabled:opacity-50 disabled:no-underline"
                                title={stats.incorrectCount ? 'View incorrect option selections' : 'No incorrect answers'}
                              >
                                {stats.incorrectCount}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {modalQuestion && (
        <OptionBreakdownModal
          question={modalQuestion}
          statsScope={activeScope}
          organizationName={organizationName}
          onClose={() => setModalQuestion(null)}
        />
      )}
    </>
  );
}
