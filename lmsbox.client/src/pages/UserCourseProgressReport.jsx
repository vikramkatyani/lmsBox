import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import Pagination from '../components/Pagination';
import {
  getUserCourseProgressReportSummary,
  getUserCourseProgressReportRecords,
  exportToCSV,
  exportToJSON
} from '../services/reports';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  ArrowLeftIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ExclamationTriangleIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

export default function UserCourseProgressReport() {
  const navigate = useNavigate();

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);

  const [summaryData, setSummaryData] = useState(null);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({
    pageNumber: 1,
    pageSize: 25,
    totalRows: 0,
    totalPages: 1
  });

  const [filters, setFilters] = useState({
    search: '',
    courseId: '',
    status: '',
    startDate: '',
    endDate: ''
  });

  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    courseId: '',
    status: '',
    startDate: '',
    endDate: ''
  });

  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('progressPercent');
  const [sortDirection, setSortDirection] = useState('desc');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    fetchSummary(appliedFilters);
  }, []);

  useEffect(() => {
    fetchRecords(appliedFilters, pageNumber, pageSize, sortBy, sortDirection);
  }, [appliedFilters, pageNumber, pageSize, sortBy, sortDirection]);

  const fetchSummary = async (requestFilters) => {
    try {
      setLoadingSummary(true);
      const data = await getUserCourseProgressReportSummary({
        search: requestFilters.search || undefined,
        courseId: requestFilters.courseId || undefined,
        status: requestFilters.status || undefined,
        startDate: requestFilters.startDate || undefined,
        endDate: requestFilters.endDate || undefined
      });
      setSummaryData(data);
    } catch (error) {
      console.error('Failed to load user-course progress summary:', error);
      alert('Failed to load report summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchRecords = async (requestFilters, requestedPage, requestedPageSize, requestedSortBy, requestedSortDirection) => {
    try {
      setLoadingTable(true);
      const data = await getUserCourseProgressReportRecords({
        search: requestFilters.search || undefined,
        courseId: requestFilters.courseId || undefined,
        status: requestFilters.status || undefined,
        startDate: requestFilters.startDate || undefined,
        endDate: requestFilters.endDate || undefined,
        pageNumber: requestedPage,
        pageSize: requestedPageSize,
        sortBy: requestedSortBy,
        sortDirection: requestedSortDirection
      });

      setRecords(data.records || []);
      setPagination(
        data.pagination || {
          pageNumber: requestedPage,
          pageSize: requestedPageSize,
          totalRows: 0,
          totalPages: 1
        }
      );
    } catch (error) {
      console.error('Failed to load user-course progress records:', error);
      alert('Failed to load table data');
    } finally {
      setLoadingTable(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleApplyFilters = () => {
    const nextFilters = { ...filters };
    setAppliedFilters(nextFilters);
    setPageNumber(1);
    fetchSummary(nextFilters);
  };

  const handleClearFilters = () => {
    const cleared = {
      search: '',
      courseId: '',
      status: '',
      startDate: '',
      endDate: ''
    };

    setFilters(cleared);
    setAppliedFilters(cleared);
    setSortBy('progressPercent');
    setSortDirection('desc');
    setPageNumber(1);
    fetchSummary(cleared);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
    setPageNumber(1);
  };

  const renderSortIcon = (column) => {
    if (sortBy !== column) {
      return <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />;
    }

    if (sortDirection === 'asc') {
      return <ChevronUpIcon className="h-4 w-4 text-gray-700" />;
    }

    return <ChevronDownIcon className="h-4 w-4 text-gray-700" />;
  };

  const handleExportCSV = () => {
    if (!records?.length) return;

    const csvData = records.map((ucp) => ({
      'User Name': ucp.userName,
      Email: ucp.email,
      Course: ucp.courseTitle,
      Category: ucp.courseCategory,
      Progress: `${ucp.progressPercent}%`,
      Status: ucp.status,
      'Days Since Last Activity': ucp.daysSinceLastActivity,
      Performance: ucp.performance,
      'Completed Date': ucp.completedAt ? new Date(ucp.completedAt).toLocaleDateString() : 'N/A'
    }));

    exportToCSV(csvData, 'user-course-progress-report');
  };

  const handleExportJSON = () => {
    if (!summaryData) return;

    exportToJSON(
      {
        summary: summaryData.summary,
        statusBreakdown: summaryData.statusBreakdown,
        performanceBreakdown: summaryData.performanceBreakdown,
        courseStats: summaryData.courseStats,
        topPerformers: summaryData.topPerformers,
        staleEnrollments: summaryData.staleEnrollments,
        records,
        pagination
      },
      'user-course-progress-report'
    );
  };

  if (loadingSummary && !summaryData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading report...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!summaryData) return null;

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'Not Started':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPerformanceBadgeColor = (performance) => {
    switch (performance) {
      case 'Excellent':
        return 'bg-green-100 text-green-800';
      case 'Good':
        return 'bg-blue-100 text-blue-800';
      case 'Average':
        return 'bg-yellow-100 text-yellow-800';
      case 'Slow':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const availableCourses = summaryData.courseOptions || [];

  const statusBreakdownChart = {
    labels: summaryData.statusBreakdown?.map((sb) => sb.status) || [],
    datasets: [
      {
        data: summaryData.statusBreakdown?.map((sb) => sb.count) || [],
        backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(156, 163, 175, 0.8)'],
        borderWidth: 2,
        borderColor: '#fff'
      }
    ]
  };

  const performanceBreakdownChart = {
    labels: summaryData.performanceBreakdown?.map((pb) => pb.performance) || [],
    datasets: [
      {
        label: 'Users',
        data: summaryData.performanceBreakdown?.map((pb) => pb.count) || [],
        backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(251, 191, 36, 0.8)', 'rgba(239, 68, 68, 0.8)'],
        borderWidth: 1
      }
    ]
  };

  const topCoursesChart = {
    labels: summaryData.courseStats?.slice(0, 5).map((cs) => cs.courseTitle.substring(0, 30)) || [],
    datasets: [
      {
        label: 'Total Enrolled',
        data: summaryData.courseStats?.slice(0, 5).map((cs) => cs.totalEnrolled) || [],
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 1
      }
    ]
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/reports')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Reports
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User-Course Progress Report</h1>
          <p className="text-gray-600">Comprehensive view of all users and their course progress</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center text-gray-700 hover:text-gray-900"
            >
              <FunnelIcon className="h-5 w-5 mr-2" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-[#2afeae] text-[#1b365d] rounded-md hover:bg-superadmin-btn-hover transition text-sm"
              >
                Export CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="px-4 py-2 bg-[#1b365d] text-white rounded-md hover:bg-[#234a7a] transition text-sm"
              >
                Export JSON
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="search"
                      value={filters.search}
                      onChange={handleFilterChange}
                      placeholder="Search by user, email, or course..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                  <select
                    name="courseId"
                    value={filters.courseId}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Courses</option>
                    {availableCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    value={filters.status}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Status</option>
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Not Started">Not Started</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    value={filters.startDate}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    name="endDate"
                    value={filters.endDate}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleApplyFilters}
                    className="flex-1 px-4 py-2 bg-[#2afeae] text-[#1b365d] rounded-md hover:bg-superadmin-btn-hover transition"
                  >
                    Apply Filters
                  </button>
                  <button
                    onClick={handleClearFilters}
                    className="flex-1 px-4 py-2 bg-[#1b365d] text-white rounded-md hover:bg-[#234a7a] transition"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Enrollments</p>
                <p className="text-3xl font-bold text-gray-900">{summaryData.summary?.totalEnrollments || 0}</p>
                <p className="text-xs text-gray-500 mt-1">{summaryData.summary?.activeUsers || 0} active users</p>
              </div>
              <AcademicCapIcon className="h-12 w-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completion Rate</p>
                <p className="text-3xl font-bold text-gray-900">{summaryData.summary?.overallCompletionRate || 0}%</p>
                <p className="text-xs text-gray-500 mt-1">{summaryData.summary?.totalCompleted || 0} completed</p>
              </div>
              <CheckCircleIcon className="h-12 w-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg Progress</p>
                <p className="text-3xl font-bold text-gray-900">{summaryData.summary?.averageProgressPercent || 0}%</p>
                <p className="text-xs text-gray-500 mt-1">{summaryData.summary?.totalInProgress || 0} in progress</p>
              </div>
              <ClockIcon className="h-12 w-12 text-orange-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Stale Enrollments</p>
                <p className="text-3xl font-bold text-gray-900">{summaryData.summary?.staleEnrollmentsCount || 0}</p>
                <p className="text-xs text-gray-500 mt-1">In progress, &lt;50% completion</p>
              </div>
              <ExclamationTriangleIcon className="h-12 w-12 text-yellow-500" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution</h3>
            <div className="h-64 flex items-center justify-center">
              <Doughnut
                data={statusBreakdownChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { padding: 10, boxWidth: 12 }
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance</h3>
            <div className="h-64">
              <Bar
                data={performanceBreakdownChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: { precision: 0 }
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Courses</h3>
            <div className="h-64">
              <Bar
                data={topCoursesChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: 'y',
                  plugins: {
                    legend: { display: false }
                  },
                  scales: {
                    x: {
                      beginAtZero: true,
                      ticks: { precision: 0 }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        {summaryData.topPerformers && summaryData.topPerformers.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers (3+ courses)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {summaryData.topPerformers.slice(0, 5).map((performer, index) => (
                <div key={index} className="border border-[#2afeae] bg-success rounded-lg p-4">
                  <div className="font-medium text-gray-900 mb-2">{performer.userName}</div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>{performer.totalCourses} courses</div>
                    <div>{performer.completed} completed</div>
                    <div className="font-semibold text-green-700">{performer.completionRate}% rate</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {summaryData.staleEnrollments && summaryData.staleEnrollments.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stale Enrollments (Needs Attention)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Since Last Activity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {summaryData.staleEnrollments.map((enrollment, index) => (
                    <tr key={index} className="hover:bg-yellow-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{enrollment.userName}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{enrollment.courseTitle}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <span className="text-sm text-gray-900 mr-2">{enrollment.progressPercent}%</span>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div className="bg-yellow-600 h-2 rounded-full" style={{ width: `${enrollment.progressPercent}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{enrollment.daysSinceLastActivity} days</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {enrollment.lastActivityAt ? new Date(enrollment.lastActivityAt).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">User-Course Progress Details</h3>
              <p className="text-sm text-gray-600 mt-1">
                Showing {(pagination.totalRows || 0) === 0 ? 0 : (pagination.pageNumber - 1) * pagination.pageSize + 1}-
                {Math.min(pagination.pageNumber * pagination.pageSize, pagination.totalRows || 0)} of {pagination.totalRows || 0} records
              </p>
            </div>
          </div>

          {loadingTable && <div className="px-6 py-4 border-b border-gray-200 text-sm text-gray-500">Loading table data...</div>}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => handleSort('userName')} className="inline-flex items-center gap-1 hover:text-gray-800">
                      User
                      {renderSortIcon('userName')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => handleSort('courseTitle')} className="inline-flex items-center gap-1 hover:text-gray-800">
                      Course
                      {renderSortIcon('courseTitle')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleSort('progressPercent')}
                      className="inline-flex items-center gap-1 hover:text-gray-800"
                    >
                      Progress
                      {renderSortIcon('progressPercent')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center gap-1 hover:text-gray-800">
                      Status
                      {renderSortIcon('status')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleSort('performance')}
                      className="inline-flex items-center gap-1 hover:text-gray-800"
                    >
                      Performance
                      {renderSortIcon('performance')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleSort('completedAt')}
                      className="inline-flex items-center gap-1 hover:text-gray-800"
                    >
                      Completed Date
                      {renderSortIcon('completedAt')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.userName}</div>
                      <div className="text-xs text-gray-500">{item.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{item.courseTitle}</div>
                      <div className="text-xs text-gray-500">{item.courseCategory}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-900 mr-2">{item.progressPercent}%</span>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${item.completed ? 'bg-[#2afeae]' : item.progressPercent > 0 ? 'bg-[#2afeae]' : 'bg-gray-400'}`}
                            style={{ width: `${item.progressPercent}%` }}
                          ></div>
                        </div>
                      </div>
                      {item.daysToComplete && <div className="text-xs text-gray-500 mt-1">Completed in {item.daysToComplete} days</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(item.status)}`}>
                        {item.status}
                      </span>
                      {item.isStale && <div className="text-xs text-yellow-600 mt-1">Stale</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPerformanceBadgeColor(item.performance)}`}>
                        {item.performance}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.completedAt ? new Date(item.completedAt).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={pagination.pageNumber || 1}
            totalPages={pagination.totalPages || 1}
            pageSize={pagination.pageSize || pageSize}
            totalCount={pagination.totalRows || 0}
            onPageChange={(nextPage) => setPageNumber(nextPage)}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPageNumber(1);
            }}
          />
        </div>
      </div>
    </div>
  );
}
