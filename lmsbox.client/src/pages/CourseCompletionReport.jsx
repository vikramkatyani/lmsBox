import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import {
  getCourseCompletionReportSummary,
  getCourseCompletionReportCourses,
  exportToCSV,
  exportToJSON
} from '../services/reports';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  CheckCircleIcon,
  ClockIcon,
  AcademicCapIcon,
  ChartBarIcon,
  ArrowLeftIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

const DEFAULT_PAGINATION = {
  pageNumber: 1,
  pageSize: 50,
  totalCourses: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false
};

export default function CourseCompletionReport() {
  const navigate = useNavigate();

  const [summaryData, setSummaryData] = useState(null);
  const [courses, setCourses] = useState([]);
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('completionRate');
  const [sortDirection, setSortDirection] = useState('desc');
  const [pageSize, setPageSize] = useState(50);

  const getBaseFilters = () => ({
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined
  });

  const loadSummary = async () => {
    try {
      setLoadingSummary(true);
      const data = await getCourseCompletionReportSummary(getBaseFilters());
      setSummaryData(data);
    } catch (error) {
      console.error('Failed to load course completion summary:', error);
      alert('Failed to load report summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadCourses = async (
    requestedPageNumber = 1,
    requestedPageSize = pageSize,
    requestedSearch = appliedSearch,
    requestedCategory = categoryFilter,
    requestedPerformance = performanceFilter,
    requestedSortBy = sortBy,
    requestedSortDirection = sortDirection
  ) => {
    try {
      setLoadingCourses(true);
      const data = await getCourseCompletionReportCourses({
        ...getBaseFilters(),
        pageNumber: requestedPageNumber,
        pageSize: requestedPageSize,
        search: requestedSearch || undefined,
        category: requestedCategory !== 'all' ? requestedCategory : undefined,
        performance: requestedPerformance !== 'all' ? requestedPerformance : undefined,
        sortBy: requestedSortBy,
        sortDirection: requestedSortDirection
      });

      setCourses(data.courses || []);
      setPagination(data.pagination || {
        pageNumber: requestedPageNumber,
        pageSize: requestedPageSize,
        totalCourses: data.courses?.length || 0,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false
      });
    } catch (error) {
      console.error('Failed to load course completion table:', error);
      alert('Failed to load course details table');
    } finally {
      setLoadingCourses(false);
    }
  };

  useEffect(() => {
    Promise.all([loadSummary(), loadCourses(1, pageSize, '', 'all', 'all', sortBy, sortDirection)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleApplyFilters = async () => {
    await Promise.all([
      loadSummary(),
      loadCourses(1, pageSize, appliedSearch, categoryFilter, performanceFilter, sortBy, sortDirection)
    ]);
  };

  const handleExportCSV = () => {
    if (!courses?.length) return;

    const csvData = courses.map(course => ({
      'Course Title': course.courseTitle,
      Category: course.category || 'N/A',
      'Total Enrollments': course.totalEnrollments,
      Completed: course.completedCount,
      'In Progress': course.inProgressCount,
      'Not Started': course.notStartedCount,
      'Completion Rate': `${course.completionRate}%`,
      'Avg Completion Time (days)': course.averageCompletionTime,
      Performance: course.performance
    }));

    exportToCSV(csvData, 'course-completion-report-page');
  };

  const handleExportJSON = () => {
    exportToJSON(
      {
        summary: summaryData?.summary,
        completionTrends: summaryData?.completionTrends,
        categoryBreakdown: summaryData?.categoryBreakdown,
        pagination,
        courses
      },
      'course-completion-report-page'
    );
  };

  const handleSort = (column) => {
    const nextDirection = sortBy === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortBy(column);
    setSortDirection(nextDirection);
    loadCourses(1, pageSize, appliedSearch, categoryFilter, performanceFilter, column, nextDirection);
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

  const handleApplySearch = () => {
    const term = searchTerm.trim();
    setAppliedSearch(term);
    loadCourses(1, pageSize, term, categoryFilter, performanceFilter, sortBy, sortDirection);
  };

  const handleCategoryChange = (e) => {
    const nextCategory = e.target.value;
    setCategoryFilter(nextCategory);
    loadCourses(1, pageSize, appliedSearch, nextCategory, performanceFilter, sortBy, sortDirection);
  };

  const handlePerformanceChange = (e) => {
    const nextPerformance = e.target.value;
    setPerformanceFilter(nextPerformance);
    loadCourses(1, pageSize, appliedSearch, categoryFilter, nextPerformance, sortBy, sortDirection);
  };

  const handlePageChange = (nextPage) => {
    loadCourses(nextPage, pageSize, appliedSearch, categoryFilter, performanceFilter, sortBy, sortDirection);
  };

  const handlePageSizeChange = (e) => {
    const nextSize = parseInt(e.target.value, 10) || 50;
    setPageSize(nextSize);
    loadCourses(1, nextSize, appliedSearch, categoryFilter, performanceFilter, sortBy, sortDirection);
  };

  const categories = useMemo(() => {
    const source = summaryData?.categoryBreakdown || [];
    return ['all', ...source.map(c => c.category)];
  }, [summaryData]);

  const performances = ['all', 'Excellent', 'Good', 'Fair', 'Poor'];

  const top10Courses = summaryData?.topCoursesByCompletionRate || [];
  const topCoursesChartData = {
    labels: top10Courses.map(c => c.courseTitle.length > 20 ? `${c.courseTitle.substring(0, 20)}...` : c.courseTitle),
    datasets: [
      {
        label: 'Completion Rate (%)',
        data: top10Courses.map(c => c.completionRate),
        backgroundColor: 'rgba(34, 197, 94, 0.8)'
      }
    ]
  };

  const trendsChartData = {
    labels: (summaryData?.completionTrends || []).map(t => t.date),
    datasets: [{
      label: 'Completions',
      data: (summaryData?.completionTrends || []).map(t => t.count),
      borderColor: 'rgba(59, 130, 246, 1)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4,
      fill: true
    }]
  };

  const categoryChartData = {
    labels: (summaryData?.categoryBreakdown || []).map(c => c.category),
    datasets: [{
      data: (summaryData?.categoryBreakdown || []).map(c => c.totalCompletions),
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(34, 197, 94, 0.8)',
        'rgba(249, 115, 22, 0.8)',
        'rgba(168, 85, 247, 0.8)',
        'rgba(236, 72, 153, 0.8)'
      ]
    }]
  };

  const performanceData = {
    labels: ['Excellent', 'Good', 'Fair', 'Poor'],
    datasets: [{
      data: [
        summaryData?.performanceDistribution?.excellent || 0,
        summaryData?.performanceDistribution?.good || 0,
        summaryData?.performanceDistribution?.fair || 0,
        summaryData?.performanceDistribution?.poor || 0
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(249, 115, 22, 0.8)',
        'rgba(239, 68, 68, 0.8)'
      ]
    }]
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Course Completion Report</h1>
          <p className="text-gray-600">Track course completion rates, performance metrics, and trends</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="flex items-end">
              <button
                onClick={handleApplyFilters}
                disabled={loadingSummary || loadingCourses}
                className="w-full px-4 py-2 bg-[#2afeae] text-[#1b365d] rounded-md hover:bg-superadmin-btn-hover disabled:opacity-50 transition"
              >
                {loadingSummary ? 'Loading...' : 'Apply Filters'}
              </button>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleExportCSV}
                className="flex-1 px-4 py-2 bg-[#2afeae] text-[#1b365d] rounded-md hover:bg-superadmin-btn-hover transition text-sm"
              >
                Export CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="flex-1 px-4 py-2 bg-[#1b365d] text-white rounded-md hover:bg-[#234a7a] transition text-sm"
              >
                Export JSON
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg Completion Rate</p>
                <p className="text-3xl font-bold text-gray-900">{summaryData.summary.averageCompletionRate}%</p>
              </div>
              <ChartBarIcon className="h-12 w-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Completions</p>
                <p className="text-3xl font-bold text-gray-900">{summaryData.summary.totalCompletions}</p>
              </div>
              <CheckCircleIcon className="h-12 w-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">In Progress</p>
                <p className="text-3xl font-bold text-gray-900">{summaryData.summary.totalInProgress}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Incomplete: {summaryData.summary.totalIncomplete}
                </p>
              </div>
              <ClockIcon className="h-12 w-12 text-orange-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg Completion Time</p>
                <p className="text-3xl font-bold text-gray-900">{summaryData.summary.averageCompletionTime}</p>
                <p className="text-xs text-gray-500 mt-1">days</p>
              </div>
              <AcademicCapIcon className="h-12 w-12 text-purple-500" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-linear-to-r from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
            <div className="flex items-start">
              <TrophyIcon className="h-8 w-8 text-green-600 mr-3 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800 mb-1">Best Performing Course</p>
                <p className="text-lg font-bold text-green-900">{summaryData.summary.bestPerforming}</p>
              </div>
            </div>
          </div>
          <div className="bg-linear-to-r from-red-50 to-red-100 rounded-lg shadow p-6 border border-red-200">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-600 mr-3 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800 mb-1">Needs Improvement</p>
                <p className="text-lg font-bold text-red-900">{summaryData.summary.worstPerforming}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Courses by Completion Rate</h3>
            <div className="h-80">
              <Bar
                data={topCoursesChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: { beginAtZero: true, max: 100 }
                  },
                  plugins: {
                    legend: { display: false }
                  }
                }}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Distribution</h3>
            <div className="h-80">
              <Doughnut
                data={performanceData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom' }
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Completion Trends (Last 30 Days)</h3>
            <div className="h-64">
              <Line
                data={trendsChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: { beginAtZero: true }
                  },
                  plugins: {
                    legend: { display: false }
                  }
                }}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Completions by Category</h3>
            <div className="h-64">
              <Doughnut
                data={categoryChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom' }
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(summaryData.categoryBreakdown || []).map((cat, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900">{cat.category}</p>
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  <p>{cat.courses} courses</p>
                  <p>{cat.totalCompletions} completions</p>
                  <p className="font-semibold text-blue-600">{cat.averageCompletionRate}% avg rate</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Courses</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by title or category..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleApplySearch}
                  className="px-4 py-2 bg-[#1b365d] text-white rounded-md hover:bg-[#234a7a] transition"
                >
                  Search
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Category</label>
              <select
                value={categoryFilter}
                onChange={handleCategoryChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Performance</label>
              <select
                value={performanceFilter}
                onChange={handlePerformanceChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {performances.map(perf => (
                  <option key={perf} value={perf}>{perf === 'all' ? 'All Performance' : perf}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rows Per Page</label>
              <select
                value={pageSize}
                onChange={handlePageSizeChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[25, 50, 100, 200].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Course Details</h3>
              <p className="text-sm text-gray-600">
                Showing {courses.length} of {pagination.totalCourses} courses
              </p>
            </div>
            {loadingCourses && <p className="text-sm text-gray-500">Refreshing table...</p>}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { key: 'courseTitle', label: 'Course' },
                    { key: 'category', label: 'Category' },
                    { key: 'totalEnrollments', label: 'Enrolled' },
                    { key: 'completedCount', label: 'Completed' },
                    { key: 'inProgressCount', label: 'In Progress' },
                    { key: 'completionRate', label: 'Completion Rate' },
                    { key: 'averageCompletionTime', label: 'Avg Time (days)' },
                    { key: 'performance', label: 'Performance' }
                  ].map((column) => (
                    <th
                      key={column.key}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(column.key)}
                        className="inline-flex items-center gap-1 hover:text-gray-800"
                      >
                        {column.label}
                        {renderSortIcon(column.key)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {!loadingCourses && courses.map((course) => (
                  <tr key={course.courseId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{course.courseTitle}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {course.category || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {course.totalEnrollments}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                      {course.completedCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {course.inProgressCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-[#2afeae] h-2 rounded-full"
                            style={{ width: `${Math.min(course.completionRate, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-900 font-medium">{course.completionRate}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {course.averageCompletionTime || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        course.performance === 'Excellent' ? 'bg-green-100 text-green-800' :
                        course.performance === 'Good' ? 'bg-blue-100 text-blue-800' :
                        course.performance === 'Fair' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {course.performance}
                      </span>
                    </td>
                  </tr>
                ))}
                {loadingCourses && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                      Loading course details...
                    </td>
                  </tr>
                )}
                {!loadingCourses && courses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                      No courses found for current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Page {pagination.pageNumber} of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(Math.max(1, pagination.pageNumber - 1))}
                disabled={!pagination.hasPreviousPage || loadingCourses}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(pagination.pageNumber + 1)}
                disabled={!pagination.hasNextPage || loadingCourses}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
