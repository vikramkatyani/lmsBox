import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminHeader from '../components/AdminHeader';
import Pagination from '../components/Pagination';
import usePageTitle from '../hooks/usePageTitle';
import {
  ACTIVITY_LOG_ACTION_PREFIXES,
  ACTIVITY_LOG_ACTOR_TYPES,
  getActivityLogById,
  getActivityLogSummary,
  listActivityLogs,
} from '../services/activityLogs';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const actionBadgeClass = (action) => {
  const a = (action || '').toLowerCase();
  if (a.includes('question bank') || a.includes('question')) return 'bg-teal-100 text-teal-800';
  if (a.includes('quiz')) return 'bg-amber-100 text-amber-800';
  if (a.includes('survey')) return 'bg-indigo-100 text-indigo-800';
  if (a.includes('course')) return 'bg-blue-100 text-blue-800';
  if (a.includes('lesson')) return 'bg-cyan-100 text-cyan-800';
  if (a.includes('user')) return 'bg-green-100 text-green-800';
  if (a.includes('deleted')) return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
};

const actorTypeBadgeClass = (actorType) => {
  if (actorType === 'admin') return 'bg-purple-100 text-purple-800';
  if (actorType === 'learner') return 'bg-sky-100 text-sky-800';
  return 'bg-gray-100 text-gray-800';
};

export default function SuperAdminActivityLogs() {
  usePageTitle('Activity Log');

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    actionContains: '',
    performedBy: '',
    actorType: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({ ...filters });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const buildQueryParams = useCallback(
    () => ({
      search: debouncedSearch || undefined,
      dateFrom: appliedFilters.dateFrom || undefined,
      dateTo: appliedFilters.dateTo || undefined,
      actionContains: appliedFilters.actionContains || undefined,
      performedBy: appliedFilters.performedBy || undefined,
      actorType: appliedFilters.actorType || undefined,
      page,
      pageSize,
    }),
    [appliedFilters, debouncedSearch, page, pageSize]
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = buildQueryParams();
      const [listResult, summaryResult] = await Promise.all([
        listActivityLogs(params),
        getActivityLogSummary({
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          actorType: params.actorType,
        }),
      ]);

      setItems(Array.isArray(listResult?.items) ? listResult.items : []);
      setTotalCount(listResult?.total ?? 0);
      setSummary(summaryResult);
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Failed to load activity logs');
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    setPage(1);
  };

  const handleClearFilters = () => {
    const cleared = {
      dateFrom: '',
      dateTo: '',
      actionContains: '',
      performedBy: '',
      actorType: '',
    };
    setFilters(cleared);
    setAppliedFilters(cleared);
    setSearchInput('');
    setPage(1);
  };

  const openDetail = async (id) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setSelectedLog(null);
    try {
      const data = await getActivityLogById(id);
      setSelectedLog(data);
    } catch (e) {
      toast.error(e.message || 'Failed to load log detail');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedLog(null);
  };

  const topActions = summary?.topActions ? Object.entries(summary.topActions) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/admin/reports"
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back to Reports
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
            <p className="mt-1 text-sm text-gray-600">
              All logged platform activity from learners and admins — logins, course progress, assessments, uploads, and administrative changes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Total (filtered period)</p>
              <p className="text-2xl font-bold text-gray-900">{summary.total ?? 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Last 24 hours</p>
              <p className="text-2xl font-bold text-teal-700">{summary.last24Hours ?? 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Admin actions</p>
              <p className="text-2xl font-bold text-purple-700">{summary.adminCount ?? 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Learner actions</p>
              <p className="text-2xl font-bold text-sky-700">{summary.learnerCount ?? 0}</p>
            </div>
          </div>
        )}

        {summary && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
              <p className="text-sm text-gray-500 mb-2">Top actions</p>
              {topActions.length === 0 ? (
                <p className="text-sm text-gray-400">No data</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {topActions.slice(0, 5).map(([action, count]) => (
                    <span
                      key={action}
                      className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-800"
                      title={action}
                    >
                      <span className="max-w-[180px] truncate">{action}</span>
                      <span className="ml-1 font-semibold text-gray-600">({count})</span>
                    </span>
                  ))}
                </div>
              )}
          </div>
        )}

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="search"
                placeholder="Search action, performer, details…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
          </div>

          {showFilters && (
            <div className="px-4 py-4 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Activity type</label>
                  <select
                    value={filters.actionContains}
                    onChange={(e) => setFilters((f) => ({ ...f, actionContains: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 text-sm"
                  >
                    {ACTIVITY_LOG_ACTION_PREFIXES.map((a) => (
                      <option key={a.value || 'all'} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">User type</label>
                  <select
                    value={filters.actorType}
                    onChange={(e) => setFilters((f) => ({ ...f, actorType: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 text-sm"
                  >
                    {ACTIVITY_LOG_ACTOR_TYPES.map((a) => (
                      <option key={a.value || 'all'} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Performed by</label>
                  <input
                    type="text"
                    placeholder="Name or email"
                    value={filters.performedBy}
                    onChange={(e) => setFilters((f) => ({ ...f, performedBy: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">From date</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">To date</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 text-sm"
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#1b365d] rounded-md hover:bg-[#152a4a]"
                >
                  Apply filters
                </button>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performed by</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Detail</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      Loading…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      No activity logs match your filters.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatDateTime(row.performedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm max-w-xs">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${actionBadgeClass(row.action)}`}
                          title={row.action}
                        >
                          <span className="truncate max-w-[220px]">{row.action}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${actorTypeBadgeClass(row.actorType)}`}
                        >
                          {row.actorType || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[160px] truncate" title={row.performedBy}>
                        {row.performedBy || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-md truncate" title={row.detailsPreview}>
                        {row.detailsPreview || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openDetail(row.id)}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && totalCount > 0 && (
            <div className="px-4 py-3 border-t border-gray-200">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/50" onClick={closeDetail} aria-hidden="true" />
          <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Activity log detail</h2>
              <button
                type="button"
                onClick={closeDetail}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-4 flex-1">
              {detailLoading ? (
                <p className="text-gray-500 py-8 text-center">Loading…</p>
              ) : selectedLog ? (
                <div className="space-y-4">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="sm:col-span-2">
                      <dt className="text-gray-500">Action</dt>
                      <dd className="font-medium text-gray-900 break-words">{selectedLog.action}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">When</dt>
                      <dd className="text-gray-900">{formatDateTime(selectedLog.performedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Performed by</dt>
                      <dd className="text-gray-900 break-all">{selectedLog.performedBy || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">User type</dt>
                      <dd className="text-gray-900 capitalize">{selectedLog.actorType || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Source</dt>
                      <dd className="text-gray-900 capitalize">{selectedLog.source || '—'}</dd>
                    </div>
                  </dl>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Details</h3>
                    <pre className="text-xs bg-gray-50 border border-gray-200 rounded-md p-3 overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
                      {selectedLog.details || '(empty)'}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
