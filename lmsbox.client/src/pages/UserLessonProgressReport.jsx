import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import Pagination from '../components/Pagination';
import usePageTitle from '../hooks/usePageTitle';
import { formatLessonTypeLabel } from '../utils/lessonTypes';
import {
  getUserLessonProgressReportSummary,
  getUserLessonProgressReportRecords,
  exportToCSV,
  exportToJSON
} from '../services/reports';
import { isAdmin } from '../utils/auth';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  UserGroupIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';
import LessonProgressEditSlideOver from '../components/LessonProgressEditSlideOver';

function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function UserLessonProgressReport() {
  usePageTitle('User Lesson Progress Report');
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
    lessonType: '',
    status: '',
    startDate: '',
    endDate: ''
  });

  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    courseId: '',
    lessonType: '',
    status: '',
    startDate: '',
    endDate: ''
  });

  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('lastAccessedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editingRecord, setEditingRecord] = useState(null);
  const canEditProgress = isAdmin();

  useEffect(() => {
    fetchSummary(appliedFilters);
  }, []);

  useEffect(() => {
    fetchRecords(appliedFilters, pageNumber, pageSize, sortBy, sortDirection);
  }, [appliedFilters, pageNumber, pageSize, sortBy, sortDirection]);

  const fetchSummary = async (requestFilters) => {
    try {
      setLoadingSummary(true);
      const data = await getUserLessonProgressReportSummary({
        search: requestFilters.search || undefined,
        courseId: requestFilters.courseId || undefined,
        lessonType: requestFilters.lessonType || undefined,
        status: requestFilters.status || undefined,
        startDate: requestFilters.startDate || undefined,
        endDate: requestFilters.endDate || undefined
      });
      setSummaryData(data);
    } catch (error) {
      console.error('Failed to load user-lesson progress summary:', error);
      alert('Failed to load report summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchRecords = async (requestFilters, requestedPage, requestedPageSize, requestedSortBy, requestedSortDirection) => {
    try {
      setLoadingTable(true);
      const data = await getUserLessonProgressReportRecords({
        search: requestFilters.search || undefined,
        courseId: requestFilters.courseId || undefined,
        lessonType: requestFilters.lessonType || undefined,
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
      console.error('Failed to load user-lesson progress records:', error);
      alert('Failed to load table data');
    } finally {
      setLoadingTable(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
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
      lessonType: '',
      status: '',
      startDate: '',
      endDate: ''
    };
    setFilters(cleared);
    setAppliedFilters(cleared);
    setSortBy('lastAccessedAt');
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
    if (sortBy !== column) return <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />;
    if (sortDirection === 'asc') return <ChevronUpIcon className="h-4 w-4 text-gray-700" />;
    return <ChevronDownIcon className="h-4 w-4 text-gray-700" />;
  };

  const handleExportCSV = () => {
    if (!records?.length) return;

    const csvData = records.map((row) => ({
      'User Name': row.userName,
      Email: row.email,
      Course: row.courseTitle,
      Lesson: row.lessonTitle,
      Type: formatLessonTypeLabel(row.lessonType),
      Order: row.lessonOrdinal,
      Progress: `${row.progressPercent}%`,
      Status: row.status,
      'Time Spent': formatDuration(row.totalTimeSpentSeconds),
      'Last Accessed': row.lastAccessedAt ? new Date(row.lastAccessedAt).toLocaleDateString() : 'N/A',
      'Completed Date': row.completedAt ? new Date(row.completedAt).toLocaleDateString() : 'N/A'
    }));

    exportToCSV(csvData, 'user-lesson-progress-report');
  };

  const handleExportJSON = () => {
    if (!summaryData) return;

    exportToJSON(
      {
        summary: summaryData.summary,
        statusBreakdown: summaryData.statusBreakdown,
        lessonTypeBreakdown: summaryData.lessonTypeBreakdown,
        courseStats: summaryData.courseStats,
        records,
        pagination
      },
      'user-lesson-progress-report'
    );
  };

  const handleProgressSaved = () => {
    fetchRecords(appliedFilters, pageNumber, pageSize, sortBy, sortDirection);
    fetchSummary(appliedFilters);
  };

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

  const availableCourses = summaryData.courseOptions || [];
  const lessonTypeOptions = summaryData.lessonTypeOptions || [];

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

  const lessonTypeChart = {
    labels: summaryData.lessonTypeBreakdown?.map((item) => formatLessonTypeLabel(item.lessonType)) || [],
    datasets: [
      {
        label: 'Records',
        data: summaryData.lessonTypeBreakdown?.map((item) => item.count) || [],
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 1
      }
    ]
  };

  const topCoursesChart = {
    labels: summaryData.courseStats?.slice(0, 5).map((cs) => cs.courseTitle.substring(0, 30)) || [],
    datasets: [
      {
        label: 'Lesson Records',
        data: summaryData.courseStats?.slice(0, 5).map((cs) => cs.totalRecords) || [],
        backgroundColor: 'rgba(42, 254, 174, 0.8)',
        borderColor: 'rgba(27, 54, 93, 1)',
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User-Lesson Progress Report</h1>
          <p className="text-gray-600">Detailed view of each user&apos;s progress on individual lessons</p>
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
                      placeholder="Search user, course, or lesson..."
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lesson Type</label>
                  <select
                    name="lessonType"
                    value={filters.lessonType}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Types</option>
                    {lessonTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {formatLessonTypeLabel(type)}
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
                    <option value="">All Statuses</option>
                    <option value="Completed">Completed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Not Started">Not Started</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Completion From</label>
                  <input
                    type="date"
                    name="startDate"
                    value={filters.startDate}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Completion To</label>
                  <input
                    type="date"
                    name="endDate"
                    value={filters.endDate}
                    onChange={handleFilterChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleApplyFilters}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm"
                >
                  Apply Filters
                </button>
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition text-sm"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Records</p>
                <p className="text-3xl font-bold text-gray-900">{summaryData.summary?.totalRecords || 0}</p>
                <p className="text-xs text-gray-500 mt-1">{summaryData.summary?.activeUsers || 0} active users</p>
              </div>
              <BookOpenIcon className="h-12 w-12 text-indigo-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completed</p>
                <p className="text-3xl font-bold text-gray-900">{summaryData.summary?.totalCompleted || 0}</p>
                <p className="text-xs text-gray-500 mt-1">{summaryData.summary?.overallCompletionRate || 0}% completion rate</p>
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
                <p className="text-sm text-gray-600 mb-1">Total Time Spent</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatDuration(summaryData.summary?.totalTimeSpentSeconds)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{summaryData.summary?.totalNotStarted || 0} not started</p>
              </div>
              <UserGroupIcon className="h-12 w-12 text-blue-500" />
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
                  plugins: { legend: { position: 'bottom', labels: { padding: 10, boxWidth: 12 } } }
                }}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">By Lesson Type</h3>
            <div className="h-64">
              <Bar
                data={lessonTypeChart}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
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
                  plugins: { legend: { display: false } },
                  scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
                }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">User-Lesson Progress Details</h3>
            <p className="text-sm text-gray-600 mt-1">
              Showing {(pagination.totalRows || 0) === 0 ? 0 : (pagination.pageNumber - 1) * pagination.pageSize + 1}-
              {Math.min(pagination.pageNumber * pagination.pageSize, pagination.totalRows || 0)} of {pagination.totalRows || 0} records
            </p>
            {canEditProgress && (
              <p className="text-xs text-gray-500 mt-1">Click a status badge to update progress.</p>
            )}
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
                    <button type="button" onClick={() => handleSort('lessonTitle')} className="inline-flex items-center gap-1 hover:text-gray-800">
                      Lesson
                      {renderSortIcon('lessonTitle')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => handleSort('lessonType')} className="inline-flex items-center gap-1 hover:text-gray-800">
                      Type
                      {renderSortIcon('lessonType')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => handleSort('progressPercent')} className="inline-flex items-center gap-1 hover:text-gray-800">
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
                    <button type="button" onClick={() => handleSort('totalTimeSpentSeconds')} className="inline-flex items-center gap-1 hover:text-gray-800">
                      Time Spent
                      {renderSortIcon('totalTimeSpentSeconds')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => handleSort('lastAccessedAt')} className="inline-flex items-center gap-1 hover:text-gray-800">
                      Last Accessed
                      {renderSortIcon('lastAccessedAt')}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" onClick={() => handleSort('completedAt')} className="inline-flex items-center gap-1 hover:text-gray-800">
                      Completed
                      {renderSortIcon('completedAt')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((row) => (
                  <tr key={row.progressId || `${row.userId}-${row.lessonId}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{row.userName}</div>
                      <div className="text-sm text-gray-500">{row.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{row.courseTitle}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{row.lessonTitle}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatLessonTypeLabel(row.lessonType)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-900 mr-2">{row.progressPercent}%</span>
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${row.progressPercent}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {canEditProgress ? (
                        <button
                          type="button"
                          onClick={() => setEditingRecord(row)}
                          title="Update lesson progress"
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-400 transition ${getStatusBadgeColor(row.status)}`}
                        >
                          {row.status}
                          <PencilSquareIcon className="h-3.5 w-3.5 opacity-60" />
                        </button>
                      ) : (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(row.status)}`}>
                          {row.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDuration(row.totalTimeSpentSeconds)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {row.lastAccessedAt ? new Date(row.lastAccessedAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {row.completedAt ? new Date(row.completedAt).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loadingTable && records.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-gray-500">No lesson progress records found for the selected filters.</div>
          )}

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

      {canEditProgress && (
        <LessonProgressEditSlideOver
          isOpen={Boolean(editingRecord)}
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSaved={handleProgressSaved}
        />
      )}
    </div>
  );
}
