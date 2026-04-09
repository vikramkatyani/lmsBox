import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import usePageTitle from '../hooks/usePageTitle';
import {
  getUserActivityReportSummary,
  getUserActivityReportUsers,
  exportToCSV,
  exportToJSON
} from '../services/reports';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  XMarkIcon,
  UserCircleIcon,
  ClockIcon,
  ChartBarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

export default function UserActivityReport() {
  usePageTitle('User Activity Report');
  const navigate = useNavigate();
  const [data, setData] = useState({ summary: null, users: [] });
  const [pagination, setPagination] = useState({
    pageNumber: 1,
    pageSize: 50,
    totalUsers: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    minDaysDormant: 30
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('engagement');
  const [sortDirection, setSortDirection] = useState('desc');
  const [pageSize, setPageSize] = useState(50);
  const [showFilters, setShowFilters] = useState(false);
  const hasLoadedInitialRef = useRef(false);

  const fetchSummary = async () => {
    const result = await getUserActivityReportSummary({
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      minDaysDormant: filters.minDaysDormant
    });

    setData(prev => ({
      ...prev,
      summary: result.summary,
      header: result.header
    }));
  };

  const fetchUsers = async (
    requestedPageNumber = 1,
    requestedPageSize = pageSize,
    requestedSearch = debouncedSearchTerm,
    requestedSortBy = sortBy,
    requestedSortDirection = sortDirection
  ) => {
    const result = await getUserActivityReportUsers({
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      minDaysDormant: filters.minDaysDormant,
      pageNumber: requestedPageNumber,
      pageSize: requestedPageSize,
      search: requestedSearch || undefined,
      sortBy: requestedSortBy,
      sortDirection: requestedSortDirection
    });

    setData(prev => ({
      ...prev,
      users: result.users || [],
      header: result.header || prev.header
    }));

    setPagination(result.pagination || {
      pageNumber: requestedPageNumber,
      pageSize: requestedPageSize,
      totalUsers: result?.users?.length || 0,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false
    });
  };

  const fetchReport = async (requestedPageNumber = 1, requestedPageSize = pageSize) => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchSummary(),
        fetchUsers(requestedPageNumber, requestedPageSize)
      ]);
    } catch (err) {
      console.error('Error fetching user activity report:', err);
      setError(err.response?.data?.error || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(1, pageSize);
    hasLoadedInitialRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (!hasLoadedInitialRef.current) return;
    setLoading(true);
    setError(null);
    fetchUsers(1, pageSize, debouncedSearchTerm, sortBy, sortDirection)
      .catch((err) => {
        console.error('Error fetching filtered users:', err);
        setError(err.response?.data?.error || 'Failed to load report users');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, sortBy, sortDirection]);

  const handleApplyFilters = () => {
    fetchReport(1, pageSize);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      minDaysDormant: 30
    });
  };

  const handlePageChange = (nextPage) => {
    setLoading(true);
    setError(null);
    fetchUsers(nextPage, pageSize)
      .catch((err) => {
        console.error('Error fetching paged users:', err);
        setError(err.response?.data?.error || 'Failed to load report users');
      })
      .finally(() => setLoading(false));
  };

  const handlePageSizeChange = (e) => {
    const nextSize = parseInt(e.target.value, 10) || 50;
    setPageSize(nextSize);
    setLoading(true);
    setError(null);
    fetchUsers(1, nextSize)
      .catch((err) => {
        console.error('Error fetching paged users:', err);
        setError(err.response?.data?.error || 'Failed to load report users');
      })
      .finally(() => setLoading(false));
  };

  const handleApplySearchSort = () => {
    setDebouncedSearchTerm(searchTerm);
    setLoading(true);
    setError(null);
    fetchUsers(1, pageSize, searchTerm, sortBy, sortDirection)
      .catch((err) => {
        console.error('Error fetching filtered users:', err);
        setError(err.response?.data?.error || 'Failed to load report users');
      })
      .finally(() => setLoading(false));
  };

  const handleExportCSV = () => {
    if (data?.users) {
      const exportData = data.users.map(u => ({
        Name: u.name,
        Email: u.email,
        Status: u.status,
        'Created On': new Date(u.createdOn).toLocaleDateString(),
        'Last Activity': new Date(u.lastActivityDate).toLocaleDateString(),
        'Days Since Last Activity': u.daysSinceLastActivity,
        'Engagement Score': u.engagementScore,
        'Is Dormant': u.isDormant ? 'Yes' : 'No',
        'Enrollments': u.enrollments,
        'Completions': u.completions,
        'In Progress': u.inProgress,
        'Average Progress': u.averageProgress + '%'
      }));
      exportToCSV(exportData, 'user_activity_report');
    }
  };

  const handleExportJSON = () => {
    if (data) {
      exportToJSON(data, 'user_activity_report');
    }
  };

  const summary = data?.summary || {
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    suspendedUsers: 0,
    dormantUsers: 0,
    averageEngagementScore: 0,
    highlyEngagedUsers: 0,
    moderatelyEngagedUsers: 0,
    lowEngagementUsers: 0
  };

  // Prepare chart data
  const engagementDistributionData = {
    labels: ['High (≥70)', 'Moderate (40-69)', 'Low (<40)'],
    datasets: [{
      data: [
        summary.highlyEngagedUsers,
        summary.moderatelyEngagedUsers,
        summary.lowEngagementUsers
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(251, 191, 36, 0.8)',
        'rgba(239, 68, 68, 0.8)'
      ],
      borderColor: [
        'rgb(34, 197, 94)',
        'rgb(251, 191, 36)',
        'rgb(239, 68, 68)'
      ],
      borderWidth: 1
    }]
  };

  const statusDistributionData = {
    labels: ['Active', 'Inactive', 'Suspended', 'Idle'],
    datasets: [{
      data: [
        summary.activeUsers,
        summary.inactiveUsers,
        summary.suspendedUsers,
        summary.dormantUsers
      ],
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(156, 163, 175, 0.8)',
        'rgba(239, 68, 68, 0.8)',
        'rgba(251, 146, 60, 0.8)'
      ],
      borderColor: [
        'rgb(59, 130, 246)',
        'rgb(156, 163, 175)',
        'rgb(239, 68, 68)',
        'rgb(251, 146, 60)'
      ],
      borderWidth: 1
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    }
  };

  const getEngagementBadge = (score) => {
    if (score >= 70) return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-success text-success">High</span>;
    if (score >= 40) return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-warning text-warning">Moderate</span>;
    return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-error text-error">Low</span>;
  };

  const getStatusBadge = (status) => {
    const colors = {
      Active: 'bg-success text-success',
      Inactive: 'bg-gray-100 text-gray-800',
      Suspended: 'bg-error text-error'
    };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/reports')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Reports
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Activity Report</h1>
          <p className="text-gray-600">Track user engagement, identify idle users, and analyse activity patterns</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!data?.users}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={handleExportJSON}
            disabled={!data}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export JSON
          </button>
          <button
            onClick={() => fetchReport(pagination.pageNumber || 1, pageSize)}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-[#1b365d] bg-[#2afeae] hover:bg-superadmin-btn-hover disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh Report'}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Days Idle</label>
                <input
                  type="number"
                  min="1"
                  value={filters.minDaysDormant}
                  onChange={(e) => setFilters({ ...filters, minDaysDormant: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleApplyFilters}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#2afeae] hover:bg-superadmin-btn-hover"
              >
                Apply Filters
              </button>
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-error border border-error text-error px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading report data...</p>
            </div>
          </div>
        )}

        {/* Report Content */}
        {!loading && data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <UserCircleIcon className="h-10 w-10 text-[#1b365d]" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Users</p>
                    <p className="text-2xl font-semibold text-gray-900">{summary.totalUsers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <ClockIcon className="h-10 w-10 text-[#2afeae]" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Active Users</p>
                    <p className="text-2xl font-semibold text-gray-900">{summary.activeUsers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="h-10 w-10 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Idle Users</p>
                    <p className="text-2xl font-semibold text-gray-900">{summary.dormantUsers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <ChartBarIcon className="h-10 w-10 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Avg Engagement</p>
                    <p className="text-2xl font-semibold text-gray-900">{summary.averageEngagementScore}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Distribution</h3>
                <div style={{ height: '250px' }}>
                  {engagementDistributionData && <Doughnut data={engagementDistributionData} options={chartOptions} />}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Status Distribution</h3>
                <div style={{ height: '250px' }}>
                  {statusDistributionData && <Doughnut data={statusDistributionData} options={chartOptions} />}
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex flex-col gap-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    User Details ({pagination.totalUsers || data.users.length})
                  </h3>
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search name, email, status"
                        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm min-w-60"
                      />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      >
                        <option value="engagement">Sort: Engagement</option>
                        <option value="name">Sort: Name</option>
                        <option value="lastActivity">Sort: Last Activity</option>
                        <option value="avgProgress">Sort: Avg Progress</option>
                        <option value="completions">Sort: Completions</option>
                        <option value="enrollments">Sort: Enrollments</option>
                        <option value="status">Sort: Status</option>
                        <option value="idle">Sort: Idle</option>
                        <option value="createdOn">Sort: Created On</option>
                      </select>
                      <select
                        value={sortDirection}
                        onChange={(e) => setSortDirection(e.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                      >
                        <option value="desc">Desc</option>
                        <option value="asc">Asc</option>
                      </select>
                      <button
                        onClick={handleApplySearchSort}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Apply
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Rows per page</label>
                      <select
                        value={pageSize}
                        onChange={handlePageSizeChange}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engagement</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enrollments</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Progress</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Idle</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.users.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                          No users found matching the criteria
                        </td>
                      </tr>
                    ) : (
                      data.users.map((user) => (
                        <tr key={user.userId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(user.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>{new Date(user.lastActivityDate).toLocaleDateString()}</div>
                            <div className="text-xs text-gray-500">{user.daysSinceLastActivity} days ago</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{user.engagementScore}</span>
                              {getEngagementBadge(user.engagementScore)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {user.enrollments}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {user.completions}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {user.averageProgress}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {user.isDormant ? (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                                Yes
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-success text-success">
                                No
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-gray-600">
                  Page {pagination.pageNumber || 1} of {pagination.totalPages || 1}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange((pagination.pageNumber || 1) - 1)}
                    disabled={!pagination.hasPreviousPage || loading}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange((pagination.pageNumber || 1) + 1)}
                    disabled={!pagination.hasNextPage || loading}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
