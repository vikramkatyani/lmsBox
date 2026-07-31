import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import Pagination from '../components/Pagination';
import QuizQuestionStatsPanel from '../components/QuizQuestionStatsPanel';
import usePageTitle from '../hooks/usePageTitle';
import { getAssessmentDifficultyOverview } from '../services/reports';
import { quizFeatureFlags } from '../config/quizFeatureFlags';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  AcademicCapIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

export default function AssessmentDifficultyReport() {
  usePageTitle('Assessment Difficulty Report');
  const navigate = useNavigate();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('quizTitle');
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedQuizId, setSelectedQuizId] = useState(null);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAssessmentDifficultyOverview({
        search: appliedSearch || undefined,
        pageNumber: page,
        pageSize,
        sortBy,
        sortDirection
      });
      setOverview(data);
    } catch (error) {
      console.error('Failed to load assessment difficulty overview:', error);
      toast.error('Failed to load assessment difficulty report');
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page, pageSize, sortBy, sortDirection]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleSearch = () => {
    setAppliedSearch(searchTerm.trim());
    setPage(1);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const summary = overview?.summary;
  const items = overview?.items || [];
  const pagination = overview?.pagination || { pageNumber: 1, pageSize: 25, totalItems: 0, totalPages: 1 };

  const sortIndicator = (column) => {
    if (sortBy !== column) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const summaryCards = [
    { label: 'Assessments', value: summary?.totalAssessments ?? 0, icon: ClipboardDocumentListIcon, color: 'text-[#1b365d]' },
    { label: 'Total attempts', value: summary?.totalAttempts ?? 0, icon: ChartBarIcon, color: 'text-teal-600' },
    { label: 'Completions', value: summary?.totalCompletions ?? 0, icon: CheckCircleIcon, color: 'text-green-600' },
    { label: 'Passed / Failed', value: `${summary?.totalPassed ?? 0} / ${summary?.totalFailed ?? 0}`, icon: XCircleIcon, color: 'text-red-600' },
    { label: 'Unique learners', value: summary?.uniqueLearners ?? 0, icon: UserGroupIcon, color: 'text-purple-600' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate('/admin/reports')}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Reports
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Assessment Difficulty Report</h1>
          <p className="text-sm text-gray-500 mt-1">
            All course assessments with attempt statistics and per-question difficulty breakdown.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <Icon className={`h-4 w-4 ${card.color}`} />
                  {card.label}
                </div>
                <div className="text-2xl font-semibold text-gray-900">{card.value}</div>
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b flex flex-wrap gap-3 items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">All assessments</h2>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search assessment or course…"
                  className="border border-gray-300 rounded-md pl-3 pr-9 py-2 text-sm w-56"
                />
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute right-3 top-2.5" />
              </div>
              <button type="button" onClick={handleSearch} className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50">
                Search
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <button type="button" onClick={() => handleSort('courseTitle')} className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-800">
                      Course {sortIndicator('courseTitle')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button type="button" onClick={() => handleSort('quizTitle')} className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-800">
                      Assessment {sortIndicator('quizTitle')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button type="button" onClick={() => handleSort('attemptCount')} className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-800">
                      Attempts {sortIndicator('attemptCount')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button type="button" onClick={() => handleSort('completionCount')} className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-800">
                      Completions {sortIndicator('completionCount')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button type="button" onClick={() => handleSort('passedCount')} className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-800">
                      Passed {sortIndicator('passedCount')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button type="button" onClick={() => handleSort('failedCount')} className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-800">
                      Failed {sortIndicator('failedCount')}
                    </button>
                  </th>
                  {quizFeatureFlags.enableCriticalSafetyQuestions && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Critical fails
                    </th>
                  )}
                  <th className="px-6 py-3 text-left">
                    <button type="button" onClick={() => handleSort('passRate')} className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-800">
                      Pass rate {sortIndicator('passRate')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <button type="button" onClick={() => handleSort('averageScore')} className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-800">
                      Avg score {sortIndicator('averageScore')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={quizFeatureFlags.enableCriticalSafetyQuestions ? 10 : 9} className="px-6 py-12 text-center text-gray-500">
                      Loading assessments…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={quizFeatureFlags.enableCriticalSafetyQuestions ? 10 : 9} className="px-6 py-12 text-center text-gray-500">
                      No assessments found.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.quizId} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{row.courseTitle}</div>
                        {row.courseCategory && <div className="text-xs text-gray-500">{row.courseCategory}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{row.quizTitle}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.attemptCount}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.completionCount}</td>
                      <td className="px-6 py-4 text-sm font-medium text-green-700">{row.passedCount}</td>
                      <td className="px-6 py-4 text-sm font-medium text-red-700">{row.failedCount}</td>
                      {quizFeatureFlags.enableCriticalSafetyQuestions && (
                        <td className="px-6 py-4 text-sm font-medium text-amber-700">{row.criticalFailCount ?? 0}</td>
                      )}
                      <td className="px-6 py-4 text-sm text-gray-900">{row.passRate}%</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{row.averageScore}%</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedQuizId(row.quizId)}
                          className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          View details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={pagination.pageNumber}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalItems}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        </div>
      </main>

      {selectedQuizId && (
        <QuizQuestionStatsPanel
          quizId={selectedQuizId}
          onClose={() => setSelectedQuizId(null)}
        />
      )}
    </div>
  );
}
