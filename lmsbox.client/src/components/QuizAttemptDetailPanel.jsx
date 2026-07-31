import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import {
  XMarkIcon,
  PrinterIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { getQuizAttemptDetail } from '../services/reports';
import { quizFeatureFlags } from '../config/quizFeatureFlags';
import { formatAppDateTime } from '../utils/dateFormat';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function formatDuration(seconds) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function questionTypeLabel(type) {
  const map = {
    mc_single: 'Single choice',
    mc_multi: 'Multiple choice',
    true_false: 'True / False',
    short_answer: 'Short answer'
  };
  return map[type] || type;
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, max: 100 }
  }
};

const timingChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true } }
};

const QuestionCard = memo(function QuestionCard({ question, index }) {
  return (
    <article
      className={`rounded-lg border p-4 ${
        question.isCorrect ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/30'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-500">Q{index + 1}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">
              {question.category}
            </span>
            <span className="text-xs text-gray-500">{questionTypeLabel(question.type)}</span>
            {quizFeatureFlags.enableCriticalSafetyQuestions && question.isCriticalSafety && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                Critical
              </span>
            )}
            <span className="text-xs text-gray-500">{question.points} pt{question.points !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-sm font-medium text-gray-900">{question.question}</p>
        </div>
        {question.isCorrect ? (
          <CheckCircleIcon className="h-6 w-6 text-green-600 shrink-0" />
        ) : (
          <XCircleIcon className="h-6 w-6 text-red-600 shrink-0" />
        )}
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-gray-500">Learner answer</dt>
          <dd className="font-medium text-gray-900">
            {question.wasAnswered
              ? (question.selectedAnswerTexts.length ? question.selectedAnswerTexts.join('; ') : '—')
              : <span className="text-amber-700">No answer submitted</span>}
          </dd>
        </div>
        {!question.isCorrect && question.correctAnswerTexts?.length > 0 && (
          <div>
            <dt className="text-gray-500">Correct answer</dt>
            <dd className="font-medium text-green-800">
              {question.correctAnswerTexts.join('; ')}
            </dd>
          </div>
        )}
        {question.explanation && (
          <div>
            <dt className="text-gray-500">Explanation</dt>
            <dd className="text-gray-700">{question.explanation}</dd>
          </div>
        )}
      </dl>
    </article>
  );
});

export default function QuizAttemptDetailPanel({ attemptId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartsReady, setChartsReady] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    if (!attemptId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setChartsReady(false);
      try {
        const result = await getQuizAttemptDetail(attemptId);
        if (!cancelled) setData(result);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Failed to load attempt details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [attemptId]);

  useEffect(() => {
    if (loading || error || !data) {
      setChartsReady(false);
      return undefined;
    }

    const frameId = requestAnimationFrame(() => {
      setChartsReady(true);
    });

    return () => cancelAnimationFrame(frameId);
  }, [loading, error, data]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const attempt = data?.attempt;
  const categories = data?.categories || [];
  const questions = data?.questions || [];

  const categoryChartData = useMemo(() => (
    categories.length
      ? {
          labels: categories.map((c) => c.category),
          datasets: [{
            label: '% Correct',
            data: categories.map((c) => c.percentCorrect),
            backgroundColor: 'rgba(42, 254, 174, 0.75)',
            borderColor: 'rgba(27, 54, 93, 1)',
            borderWidth: 1
          }]
        }
      : null
  ), [categories]);

  const timingChartData = useMemo(() => (
    questions.length
      ? {
          labels: questions.map((_, i) => `Q${i + 1}`),
          datasets: [{
            label: 'Response time (s)',
            data: questions.map((q) => q.responseTimeSeconds),
            backgroundColor: 'rgba(27, 54, 93, 0.8)'
          }]
        }
      : null
  ), [questions]);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 no-print"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Assessment attempt detail"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col bg-white shadow-2xl"
      >
        <div className="flex flex-col h-full">
          <header className="flex items-start justify-between border-b border-gray-200 px-6 py-4 bg-white shrink-0 no-print">
            <div className="min-w-0 flex-1 pr-4">
              <h2 className="text-lg font-semibold text-gray-900 truncate">
                {loading ? 'Loading…' : attempt?.quizTitle || 'Assessment attempt'}
              </h2>
              {!loading && attempt && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {attempt.userName} · {attempt.courseName} · Attempt #{attempt.attemptNumber}
                  {attempt.totalAttempts != null && ` (Total attempts: ${attempt.totalAttempts})`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                disabled={!data}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#1b365d] bg-[#2afeae] rounded-md hover:bg-[#25e89e] disabled:opacity-50 transition"
              >
                <PrinterIcon className="h-4 w-4" />
                Print / PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
                aria-label="Close panel"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </header>

          <div ref={printRef} className="flex-1 overflow-y-auto bg-gray-50 quiz-attempt-print-area">
            {loading && (
              <div className="flex items-center justify-center py-24">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1b365d]" />
              </div>
            )}

            {!loading && error && (
              <div className="p-8 text-center text-red-600">{error}</div>
            )}

            {!loading && !error && attempt && (
              <div className="p-6 space-y-6">
                <div className="print-only mb-4">
                  <h1 className="text-2xl font-bold text-gray-900">Assessment Attempt Report</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Generated {formatAppDateTime(data.generatedAt)}
                  </p>
                </div>

                <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{attempt.userName}</h3>
                      <p className="text-sm text-gray-500">{attempt.userEmail}</p>
                      <p className="text-sm text-gray-600 mt-2">
                        <span className="font-medium">{attempt.courseName}</span>
                        {' · '}
                        {attempt.quizTitle}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-[#1b365d]">{attempt.scorePercent}%</div>
                      <p className="text-sm text-gray-500">
                        {attempt.earnedPoints} / {attempt.totalPoints} pts · Pass {attempt.passingScore}%
                      </p>
                      <div className="mt-2 flex justify-end gap-2 flex-wrap">
                        {attempt.passed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleIcon className="h-4 w-4" /> Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircleIcon className="h-4 w-4" /> Failed
                          </span>
                        )}
                        {quizFeatureFlags.enableCriticalSafetyQuestions && attempt.failedCriticalSafety && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-900">
                            <ExclamationTriangleIcon className="h-4 w-4" /> Critical safety
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <dt className="text-gray-500">Attempt</dt>
                      <dd className="font-medium text-gray-900">
                        #{attempt.attemptNumber}
                        {attempt.totalAttempts != null && (
                          <span className="text-gray-600 font-normal"> (Total attempts: {attempt.totalAttempts})</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Duration</dt>
                      <dd className="font-medium text-gray-900">{formatDuration(attempt.durationSeconds)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Started</dt>
                      <dd className="font-medium text-gray-900">{formatAppDateTime(attempt.startedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Completed</dt>
                      <dd className="font-medium text-gray-900">{formatAppDateTime(attempt.completedAt)}</dd>
                    </div>
                  </dl>
                  {attempt.isTimed && (
                    <p className="mt-3 text-xs text-gray-500">
                      Timed assessment · limit {attempt.timeLimitMinutes} min
                    </p>
                  )}
                </section>

                <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Questions &amp; responses</h3>
                  <div className="space-y-4">
                    {questions.map((q, index) => (
                      <QuestionCard key={q.questionId} question={q} index={index} />
                    ))}
                  </div>
                </section>

                {categories.length > 0 && (
                  <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Category performance</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-left text-gray-500">
                              <th className="py-2 pr-4">Category</th>
                              <th className="py-2 pr-4">Correct</th>
                              <th className="py-2 pr-4">%</th>
                              <th className="py-2">Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categories.map((cat) => (
                              <tr key={cat.category} className="border-b border-gray-100">
                                <td className="py-2 pr-4 font-medium text-gray-900">{cat.category}</td>
                                <td className="py-2 pr-4">{cat.correctCount}/{cat.questionCount}</td>
                                <td className="py-2 pr-4">{cat.percentCorrect}%</td>
                                <td className="py-2">{cat.pointsEarned}/{cat.pointsPossible}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {chartsReady && categoryChartData && (
                        <div className="h-56">
                          <Bar data={categoryChartData} options={chartOptions} />
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {chartsReady && timingChartData && (
                  <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Response time per question</h3>
                    <div className="h-48">
                      <Bar data={timingChartData} options={timingChartOptions} />
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            margin: 12mm;
          }

          html,
          body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }

          #root {
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            text-align: left !important;
          }

          .no-print {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          /* Slide-over panel must participate in normal document flow when printing */
          [role="dialog"][aria-label="Assessment attempt detail"],
          [role="dialog"][aria-label="Assessment attempt detail"] > div {
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            box-shadow: none !important;
            background: white !important;
          }

          .quiz-attempt-print-area {
            position: static !important;
            overflow: visible !important;
            flex: none !important;
            height: auto !important;
            max-height: none !important;
            width: 100% !important;
            background: white !important;
          }

          /* Page wrapper: drop min-height so an empty viewport is not reserved */
          .quiz-attempt-print-page {
            min-height: 0 !important;
            background: white !important;
          }

          /* Other fixed UI in the app shell (not the attempt dialog) */
          #root .fixed:not([role="dialog"]) {
            display: none !important;
          }

          /* Portals attached to body (e.g. toast notifications) */
          body > div:not(#root) {
            display: none !important;
          }

          .quiz-attempt-print-area section,
          .quiz-attempt-print-area article {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .quiz-attempt-print-area .shadow-sm {
            box-shadow: none !important;
          }
        }
        .print-only { display: none; }
      `}</style>
    </>
  );
}