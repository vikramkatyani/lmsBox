import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import Pagination from '../components/Pagination';
import QuizAttemptDetailPanel from '../components/QuizAttemptDetailPanel';
import usePageTitle from '../hooks/usePageTitle';
import {
  getQuizAttemptsReport,
  getQuizAttemptRecordScopes,
  getQuizAttemptHistory,
  exportToCSV,
  exportToJSON
} from '../services/reports';
import { adminCourseService } from '../services/adminCourses';
import toast from 'react-hot-toast';
import { quizFeatureFlags } from '../config/quizFeatureFlags';
import { listQuizzes } from '../services/quizzes';
import { formatAppDateTime } from '../utils/dateFormat';
import {
  ArrowLeftIcon,
  EyeIcon,
  ClipboardDocumentListIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowRightStartOnRectangleIcon,
  ClockIcon,
  ChartBarIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const RECORD_SCOPE_SINCE_LOGIN = 'sinceLastLogin';
const RECORD_SCOPE_LAST_90_DAYS = 'last90Days';
const RECORD_SCOPE_ALL = 'all';

const RECORD_SCOPE_CARDS = [
  {
    id: RECORD_SCOPE_SINCE_LOGIN,
    label: 'Records: since last login',
    countKey: 'sinceLastLogin',
    Icon: ArrowRightStartOnRectangleIcon,
    iconClass: 'text-[#1b365d]'
  },
  {
    id: RECORD_SCOPE_LAST_90_DAYS,
    label: 'Records: Last 90 days',
    countKey: 'last90Days',
    Icon: ClockIcon,
    iconClass: 'text-[#2afeae]'
  },
  {
    id: RECORD_SCOPE_ALL,
    label: 'All Records',
    countKey: 'all',
    Icon: ChartBarIcon,
    iconClass: 'text-purple-600'
  }
];

function pickScopeCount(scopeCounts, key) {
  if (!scopeCounts) return 0;
  const value = scopeCounts[key];
  if (typeof value === 'number') return value;
  if (value && typeof value.count === 'number') return value.count;
  if (value && typeof value.Count === 'number') return value.Count;
  return 0;
}

function normalizeScopeCounts(scopeCounts) {
  if (!scopeCounts) return null;
  return {
    sinceLastLogin: pickScopeCount(scopeCounts, 'sinceLastLogin'),
    last90Days: pickScopeCount(scopeCounts, 'last90Days'),
    all: pickScopeCount(scopeCounts, 'all')
  };
}

function formatDuration(seconds) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function PassBadge({ passed, failedCriticalSafety }) {
  if (quizFeatureFlags.enableCriticalSafetyQuestions && failedCriticalSafety) {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-900">
        Critical fail
      </span>
    );
  }
  if (passed) {
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Passed
      </span>
    );
  }
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
      Failed
    </span>
  );
}

export default function QuizAttemptsReport() {
  usePageTitle('Assessment Attempts Report');
  const navigate = useNavigate();

  const [attempts, setAttempts] = useState([]);
  const [pagination, setPagination] = useState({
    pageNumber: 1,
    pageSize: 50,
    totalAttempts: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false
  });
  const [loadingAttempts, setLoadingAttempts] = useState(true);
  const [courses, setCourses] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [filters, setFilters] = useState({
    courseId: '',
    quizId: '',
    startDate: '',
    endDate: '',
    passStatus: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [sortBy, setSortBy] = useState('completedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [pageSize, setPageSize] = useState(50);
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [historyCache, setHistoryCache] = useState({});
  const [loadingHistory, setLoadingHistory] = useState({});
  const [recordScope, setRecordScope] = useState(RECORD_SCOPE_SINCE_LOGIN);
  const [scopeCounts, setScopeCounts] = useState({
    sinceLastLogin: 0,
    last90Days: 0,
    all: 0
  });
  const [loadingScopeCounts, setLoadingScopeCounts] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const dateFiltersEnabled = recordScope === RECORD_SCOPE_ALL;

  const tableParams = useCallback((searchOverride, scopeOverride) => {
    const searchValue = searchOverride !== undefined ? searchOverride : appliedSearch;
    const scopeValue = scopeOverride !== undefined ? scopeOverride : recordScope;
    const useDateFilters = scopeValue === RECORD_SCOPE_ALL;
    return {
      courseId: filters.courseId || undefined,
      quizId: filters.quizId || undefined,
      startDate: useDateFilters && filters.startDate ? filters.startDate : undefined,
      endDate: useDateFilters && filters.endDate ? filters.endDate : undefined,
      search: searchValue || undefined,
      passStatus: filters.passStatus || undefined,
      recordScope: scopeValue || undefined
    };
  }, [filters, appliedSearch, recordScope]);

  const applyScopeCounts = (raw) => {
    const normalized = normalizeScopeCounts(raw);
    if (!normalized) return;
    setScopeCounts(normalized);
    setLoadingScopeCounts(false);
  };

  const loadScopeCounts = async () => {
    try {
      setLoadingScopeCounts(true);
      const data = await getQuizAttemptRecordScopes();
      applyScopeCounts(data);
    } catch (error) {
      console.error('Failed to load record scope counts:', error);
      setLoadingScopeCounts(false);
    }
  };

  const loadAttempts = async (
    requestedPage = 1,
    requestedPageSize = pageSize,
    requestedSortBy = sortBy,
    requestedSortDirection = sortDirection,
    searchOverride,
    scopeOverride
  ) => {
    try {
      setLoadingAttempts(true);
      const data = await getQuizAttemptsReport({
        ...tableParams(searchOverride, scopeOverride),
        pageNumber: requestedPage,
        pageSize: requestedPageSize,
        sortBy: requestedSortBy,
        sortDirection: requestedSortDirection
      });
      setAttempts(data.attempts || []);
      setPagination(data.pagination || {
        pageNumber: requestedPage,
        pageSize: requestedPageSize,
        totalAttempts: 0,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false
      });
    } catch (error) {
      console.error('Failed to load quiz attempts:', error);
      toast.error('Failed to load attempt table');
    } finally {
      setLoadingAttempts(false);
    }
  };

  useEffect(() => {
    adminCourseService.listCourses({ page: 1, pageSize: 100, status: 'all' })
      .then((data) => setCourses(data.courses || []))
      .catch(() => toast.error('Failed to load courses'));
    listQuizzes().then(setQuizzes).catch(console.error);
    loadScopeCounts();
    loadAttempts(1, pageSize, sortBy, sortDirection, undefined, RECORD_SCOPE_SINCE_LOGIN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRecordScopeChange = (scope) => {
    if (scope === recordScope) return;
    setRecordScope(scope);
    setFilters((prev) => ({ ...prev, startDate: '', endDate: '' }));
    loadAttempts(1, pageSize, sortBy, sortDirection, appliedSearch, scope);
  };

  const filteredQuizzes = useMemo(() => {
    if (!filters.courseId) return quizzes;
    return quizzes.filter((q) => q.courseId === filters.courseId);
  }, [quizzes, filters.courseId]);

  const rowKey = (row) => `${row.userId}::${row.quizId}`;

  const toggleExpand = async (row) => {
    const key = rowKey(row);
    const next = new Set(expandedKeys);
    if (next.has(key)) {
      next.delete(key);
      setExpandedKeys(next);
      return;
    }
    next.add(key);
    setExpandedKeys(next);

    if (!historyCache[key]) {
      setLoadingHistory((prev) => ({ ...prev, [key]: true }));
      try {
        const data = await getQuizAttemptHistory(row.userId, row.quizId);
        setHistoryCache((prev) => ({ ...prev, [key]: data.attempts || [] }));
      } catch (err) {
        console.error(err);
        toast.error('Failed to load attempt history');
        next.delete(key);
        setExpandedKeys(new Set(next));
      } finally {
        setLoadingHistory((prev) => ({ ...prev, [key]: false }));
      }
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    if ((name === 'startDate' || name === 'endDate') && !dateFiltersEnabled) return;
    setFilters((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'courseId') next.quizId = '';
      return next;
    });
  };

  const handleApplyFilters = () => {
    setAppliedSearch(searchTerm.trim());
    loadAttempts(1, pageSize, sortBy, sortDirection, searchTerm.trim());
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setFilters({ courseId: '', quizId: '', startDate: '', endDate: '', passStatus: '' });
    setSearchTerm('');
    setAppliedSearch('');
    setRecordScope(RECORD_SCOPE_SINCE_LOGIN);
    loadScopeCounts();
    loadAttempts(1, pageSize, sortBy, sortDirection, '', RECORD_SCOPE_SINCE_LOGIN);
  };

  const handleRefreshReport = async () => {
    await Promise.all([
      loadScopeCounts(),
      loadAttempts(pagination.pageNumber, pageSize, sortBy, sortDirection)
    ]);
  };

  const handleSort = (column) => {
    const nextDirection = sortBy === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortBy(column);
    setSortDirection(nextDirection);
    loadAttempts(1, pageSize, column, nextDirection);
  };

  const renderSortIcon = (column) => {
    if (sortBy !== column) return <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />;
    return sortDirection === 'asc'
      ? <ChevronUpIcon className="h-4 w-4 text-gray-700" />
      : <ChevronDownIcon className="h-4 w-4 text-gray-700" />;
  };

  const handleExportCSV = () => {
    if (!attempts.length) return;
    exportToCSV(
      attempts.map((a) => ({
        User: a.userName,
        Email: a.userEmail,
        Course: a.courseName,
        Assessment: a.quizTitle,
        'Latest attempt': a.attemptNumber,
        'Total attempts': a.totalAttempts,
        Score: `${a.scorePercent}%`,
        Status: quizFeatureFlags.enableCriticalSafetyQuestions && a.failedCriticalSafety ? 'Critical fail' : a.passed ? 'Passed' : 'Failed',
        Completed: formatAppDateTime(a.completedAt)
      })),
      'quiz-attempts-latest'
    );
  };

  const handleExportJSON = () => {
    if (!attempts.length) return;
    exportToJSON(
      {
        recordScope,
        scopeCounts,
        attempts,
        pagination
      },
      'quiz-attempts-report'
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 quiz-attempt-print-page">
      <div className="no-print">
        <AdminHeader />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate('/admin/reports')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Reports
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Assessment Performance Report</h1>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!attempts.length}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            disabled={!attempts.length}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export JSON
          </button>
          <button
            type="button"
            onClick={handleRefreshReport}
            disabled={loadingAttempts}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-[#1b365d] bg-[#2afeae] hover:bg-[#25e89e] disabled:opacity-50"
          >
            {loadingAttempts ? 'Refreshing...' : 'Refresh Report'}
          </button>
        </div>

        {showFilters && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Filters</h3>
              <button type="button" onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                <select name="courseId" value={filters.courseId} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">All courses</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assessment</label>
                <select name="quizId" value={filters.quizId} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">All assessments</option>
                  {filteredQuizzes.map((q) => (
                    <option key={q.id} value={q.id}>{q.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pass status</label>
                <select name="passStatus" value={filters.passStatus} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500">
                  <option value="">All</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  {quizFeatureFlags.enableCriticalSafetyQuestions && (
                  <option value="critical">Critical safety fail</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search user</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                  placeholder="Name or email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${dateFiltersEnabled ? 'text-gray-700' : 'text-gray-400'}`}>
                  Start date
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                  disabled={!dateFiltersEnabled}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm text-sm ${
                    dateFiltersEnabled
                      ? 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                      : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                />
                {!dateFiltersEnabled && (
                  <p className="text-xs text-gray-400 mt-1">Available when All Records is selected</p>
                )}
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${dateFiltersEnabled ? 'text-gray-700' : 'text-gray-400'}`}>
                  End date
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                  disabled={!dateFiltersEnabled}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm text-sm ${
                    dateFiltersEnabled
                      ? 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                      : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                />
                {!dateFiltersEnabled && (
                  <p className="text-xs text-gray-400 mt-1">Available when All Records is selected</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={handleApplyFilters}
                disabled={loadingAttempts}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-[#1b365d] bg-[#2afeae] hover:bg-[#25e89e] disabled:opacity-50"
              >
                Apply Filters
              </button>
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {RECORD_SCOPE_CARDS.map((card) => {
            const Icon = card.Icon;
            const isSelected = recordScope === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handleRecordScopeChange(card.id)}
                className={`bg-white rounded-lg shadow p-6 text-left transition border-2 ${
                  isSelected
                    ? 'border-[#2afeae] ring-1 ring-[#2afeae]'
                    : 'border-transparent hover:border-gray-200'
                }`}
              >
                <div className="flex items-center">
                  <Icon className={`h-10 w-10 shrink-0 ${card.iconClass}`} />
                  <div className="ml-4 min-w-0">
                    <p className="text-sm font-medium text-gray-500">{card.label}</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {loadingScopeCounts ? '—' : scopeCounts[card.countKey]}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardDocumentListIcon className="h-5 w-5 text-[#1b365d]" />
              <h2 className="text-lg font-semibold text-gray-900">Latest attempts by learner</h2>
            </div>
            <p className="text-xs text-gray-500">One row per learner per assessment (most recent attempt).</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-8 px-2" />
                  {[
                    { key: 'user', label: 'User' },
                    { key: 'course', label: 'Course' },
                    { key: 'quiz', label: 'Assessment' },
                    { key: null, label: 'Latest #' },
                    { key: null, label: 'Attempts' },
                    { key: 'score', label: 'Score' },
                    { key: null, label: 'Status' },
                    { key: 'completedAt', label: 'Completed' },
                    { key: null, label: '' }
                  ].map((col) => (
                    <th key={col.label} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {col.key ? (
                        <button type="button" onClick={() => handleSort(col.key)} className="inline-flex items-center gap-1 hover:text-gray-800">
                          {col.label}
                          {renderSortIcon(col.key)}
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {!loadingAttempts && attempts.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                      No attempts match the table filters.
                    </td>
                  </tr>
                )}
                {attempts.map((row) => {
                  const key = rowKey(row);
                  const isExpanded = expandedKeys.has(key);
                  const history = historyCache[key] || [];
                  const olderAttempts = history.filter((h) => !h.isLatest);

                  return (
                    <Fragment key={row.attemptId}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-2 py-3">
                          {row.totalAttempts > 1 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(row)}
                              className="p-1 rounded hover:bg-gray-200"
                              aria-label={isExpanded ? 'Collapse' : 'Expand attempts'}
                            >
                              <ChevronRightIcon className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium text-gray-900">{row.userName}</div>
                          <div className="text-gray-500 text-xs">{row.userEmail}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{row.courseName}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{row.quizTitle}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">#{row.attemptNumber}</td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            type="button"
                            onClick={() => row.totalAttempts > 1 && toggleExpand(row)}
                            className={`font-semibold ${row.totalAttempts > 1 ? 'text-[#1b365d] underline hover:no-underline cursor-pointer' : 'text-gray-600 cursor-default'}`}
                          >
                            {row.totalAttempts}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#1b365d]">{row.scorePercent}%</td>
                        <td className="px-4 py-3"><PassBadge passed={row.passed} failedCriticalSafety={row.failedCriticalSafety} /></td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatAppDateTime(row.completedAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedAttemptId(row.attemptId)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#1b365d] bg-[#2afeae] rounded-md hover:bg-[#25e89e]"
                          >
                            <EyeIcon className="h-4 w-4" />
                            Details
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${key}-history`} className="bg-slate-50">
                          <td colSpan={11} className="px-6 py-3">
                            {loadingHistory[key] ? (
                              <p className="text-sm text-gray-500">Loading previous attempts…</p>
                            ) : olderAttempts.length === 0 ? (
                              <p className="text-sm text-gray-500">No other attempts.</p>
                            ) : (
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="text-left text-xs text-gray-500 uppercase">
                                    <th className="py-2 pr-4">Attempt</th>
                                    <th className="py-2 pr-4">Score</th>
                                    <th className="py-2 pr-4">Status</th>
                                    <th className="py-2 pr-4">Completed</th>
                                    <th className="py-2" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {olderAttempts.map((h) => (
                                    <tr key={h.attemptId} className="border-t border-gray-200">
                                      <td className="py-2 pr-4">#{h.attemptNumber}</td>
                                      <td className="py-2 pr-4 font-medium">{h.scorePercent}%</td>
                                      <td className="py-2 pr-4">
                                        <PassBadge passed={h.passed} failedCriticalSafety={h.failedCriticalSafety} />
                                      </td>
                                      <td className="py-2 pr-4">{formatAppDateTime(h.completedAt)}</td>
                                      <td className="py-2 text-right">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedAttemptId(h.attemptId)}
                                          className="text-[#1b365d] underline hover:no-underline text-xs font-medium"
                                        >
                                          View detail
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-gray-200">
            <Pagination
              currentPage={pagination.pageNumber}
              totalPages={pagination.totalPages}
              pageSize={pagination.pageSize}
              totalCount={pagination.totalAttempts}
              onPageChange={(page) => loadAttempts(page, pageSize, sortBy, sortDirection)}
              onPageSizeChange={(size) => {
                setPageSize(size);
                loadAttempts(1, size, sortBy, sortDirection);
              }}
            />
          </div>
        </div>
      </div>
      </div>

      {selectedAttemptId != null && (
        <QuizAttemptDetailPanel attemptId={selectedAttemptId} onClose={() => setSelectedAttemptId(null)} />
      )}
    </div>
  );
}

