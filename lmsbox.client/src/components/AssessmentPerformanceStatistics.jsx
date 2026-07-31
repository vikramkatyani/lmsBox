import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Doughnut } from 'react-chartjs-2';
import QuizHeatmap from './QuizHeatmap';
import QuizQuestionStatsPanel from './QuizQuestionStatsPanel';
import { getQuizAttemptsReportAnalytics } from '../services/reports';
import { quizFeatureFlags } from '../config/quizFeatureFlags';
import toast from 'react-hot-toast';
import {
  ChartBarIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

export default function AssessmentPerformanceStatistics({ showViewDetailsLink = true }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedQuizIdForStats, setSelectedQuizIdForStats] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadAnalytics = async () => {
      try {
        setLoading(true);
        const data = await getQuizAttemptsReportAnalytics();
        if (!cancelled) setAnalytics(data);
      } catch (error) {
        console.error('Failed to load assessment performance analytics:', error);
        if (!cancelled) {
          toast.error('Failed to load assessment performance statistics');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = analytics?.summary;
  const passFailChart = analytics?.passFailBreakdown?.length
    ? {
        labels: analytics.passFailBreakdown.map((x) => x.label),
        datasets: [{
          data: analytics.passFailBreakdown.map((x) => x.count),
          backgroundColor: ['rgba(34, 197, 94, 0.85)', 'rgba(239, 68, 68, 0.85)', 'rgba(245, 158, 11, 0.85)']
        }]
      }
    : null;

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5 text-[#1b365d]" />
            <h2 className="text-lg font-semibold text-gray-900">Assessment Performance Statistics</h2>
          </div>
          {showViewDetailsLink && (
            <Link
              to="/admin/reports/quiz-attempts"
              className="text-sm font-semibold text-gray-900 hover:text-gray-700 flex items-center gap-1 shrink-0"
            >
              View details
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-6">
          Aggregate metrics and difficulty analysis across all assessment attempts in your scope.
        </p>

        {loading && !analytics && (
          <div className="text-center py-12 text-gray-500">Loading assessment performance statistics…</div>
        )}

        {!loading && !summary && (
          <div className="text-center py-12 text-gray-400">No assessment performance data available.</div>
        )}

        {summary && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {[
                { label: 'Total attempts', value: summary.totalAttempts, Icon: ClipboardDocumentListIcon, iconClass: 'text-[#1b365d]' },
                { label: 'Attempted by', value: summary.uniqueLearners, Icon: UserGroupIcon, iconClass: 'text-[#2afeae]' },
                { label: 'Pass rate', value: `${summary.passRate}%`, Icon: CheckCircleIcon, iconClass: 'text-green-600' },
                { label: 'Avg score', value: `${summary.averageScore}%`, Icon: ChartBarIcon, iconClass: 'text-purple-600' },
                ...(quizFeatureFlags.enableCriticalSafetyQuestions
                  ? [{ label: 'Critical fails', value: summary.criticalFailCount, Icon: ExclamationTriangleIcon, iconClass: 'text-orange-600' }]
                  : []),
              ].map(({ label, value, Icon, iconClass }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <div className="flex items-center">
                    <Icon className={`h-10 w-10 shrink-0 ${iconClass}`} />
                    <div className="ml-3 min-w-0">
                      <p className="text-sm font-medium text-gray-500">{label}</p>
                      <p className="text-2xl font-semibold text-gray-900">{value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {passFailChart && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Overall pass / fail</h3>
                  <div className="h-48 flex justify-center">
                    <Doughnut data={passFailChart} options={{ maintainAspectRatio: false }} />
                  </div>
                </div>
              )}
              <QuizHeatmap
                title="Assessment difficulty"
                description="Fail rate per assessment (darker = harder)"
                items={analytics.quizHeatmap}
                valueKey="failRate"
                labelKey="quizTitle"
                subLabelKey="attemptCount"
                showCourseDetails
                onItemClick={(item) => item?.quizId && setSelectedQuizIdForStats(item.quizId)}
              />
            </div>

            {quizFeatureFlags.enableCriticalSafetyQuestions && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                  Critical safety failures
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Attempts with critical fail</p>
                    <p className="text-xl font-bold text-amber-700">
                      {analytics.criticalSafety?.criticalFailAttempts ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Unique users affected</p>
                    <p className="text-xl font-bold text-amber-700">
                      {analytics.criticalSafety?.uniqueUsersFailedCritical ?? 0}
                    </p>
                  </div>
                </div>
                {(analytics.criticalSafety?.criticalQuestions?.length > 0) && (
                  <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                    {analytics.criticalSafety.criticalQuestions.slice(0, 8).map((q) => (
                      <li key={q.questionId} className="flex justify-between gap-2 border-b border-gray-100 py-1">
                        <span className="truncate text-gray-700">{q.question}</span>
                        <span className="shrink-0 font-medium text-red-600">{q.usersFailed} users</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {selectedQuizIdForStats && (
        <QuizQuestionStatsPanel quizId={selectedQuizIdForStats} onClose={() => setSelectedQuizIdForStats(null)} />
      )}
    </>
  );
}
