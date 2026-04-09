import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import {
  getCourseEnrollmentReportCourses,
  getCourseEnrollmentReportSummary,
  exportToCSV,
  exportToJSON
} from '../services/reports';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  AcademicCapIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
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

export default function CourseEnrollmentReport() {
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
  const [sortBy, setSortBy] = useState('totalEnrollments');
  const [sortDirection, setSortDirection] = useState('desc');
  const [pageSize, setPageSize] = useState(50);

  const getBaseFilters = () => ({
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined
  });

  const loadSummary = async () => {
    try {
      setLoadingSummary(true);
      const data = await getCourseEnrollmentReportSummary(getBaseFilters());
      setSummaryData(data);
    } catch (error) {
      console.error('Failed to load course enrollment summary:', error);
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
    requestedSortBy = sortBy,
    requestedSortDirection = sortDirection
  ) => {
    try {
      setLoadingCourses(true);
      const data = await getCourseEnrollmentReportCourses({
        ...getBaseFilters(),
        pageNumber: requestedPageNumber,
        pageSize: requestedPageSize,
        search: requestedSearch || undefined,
        category: requestedCategory !== 'all' ? requestedCategory : undefined,
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
      console.error('Failed to load course enrollment table:', error);
      alert('Failed to load course details table');
    } finally {
      setLoadingCourses(false);
    }
  };

  useEffect(() => {
    Promise.all([loadSummary(), loadCourses(1, pageSize, '', 'all', sortBy, sortDirection)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleApplyFilters = async () => {
    await Promise.all([
      loadSummary(),
      loadCourses(1, pageSize, appliedSearch, categoryFilter, sortBy, sortDirection)
    ]);
  };

  const handleExportCSV = () => {
    if (!courses?.length) return;

    const csvData = courses.map(course => ({
      'Course Title': course.courseTitle,
      Category: course.category || 'N/A',
      Status: course.status,
      'Total Enrollments': course.totalEnrollments,
      Active: course.activeEnrollments,
      Completed: course.completedEnrollments,
      'Completion Rate': `${course.completionRate}%`,
      'Dropoff Rate': `${course.dropoffRate}%`,
      Popularity: course.popularity
    }));

    exportToCSV(csvData, 'course-enrollment-report-page');
  };

  const handleExportJSON = () => {
    exportToJSON(
      {
        summary: summaryData?.summary,
        categoryBreakdown: summaryData?.categoryBreakdown,
        pagination,
        courses
      },
      'course-enrollment-report-page'
    );
  };

  const handleSort = (column) => {
    const nextDirection = sortBy === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortBy(column);
    setSortDirection(nextDirection);
    loadCourses(1, pageSize, appliedSearch, categoryFilter, column, nextDirection);
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
    loadCourses(1, pageSize, term, categoryFilter, sortBy, sortDirection);
  };

  const handleCategoryChange = (e) => {
    const nextCategory = e.target.value;
    setCategoryFilter(nextCategory);
    loadCourses(1, pageSize, appliedSearch, nextCategory, sortBy, sortDirection);
  };

  const handlePageChange = (nextPage) => {
    loadCourses(nextPage, pageSize, appliedSearch, categoryFilter, sortBy, sortDirection);
  };

  const handlePageSizeChange = (e) => {
    const nextSize = parseInt(e.target.value, 10) || 50;
    setPageSize(nextSize);
    loadCourses(1, nextSize, appliedSearch, categoryFilter, sortBy, sortDirection);
  };

  const categories = useMemo(() => {
    const source = summaryData?.categoryBreakdown || [];
    return ['all', ...source.map(c => c.category)];
  }, [summaryData]);

  const top10Courses = summaryData?.topCoursesByEnrollment || [];
  const topCoursesChartData = {
    labels: top10Courses.map(c => c.courseTitle.length > 20 ? `${c.courseTitle.substring(0, 20)}...` : c.courseTitle),
    datasets: [
      {
        label: 'Total Enrollments',
        data: top10Courses.map(c => c.totalEnrollments),
        backgroundColor: 'rgba(59, 130, 246, 0.8)'
      },
      {
        label: 'Completed',
        data: top10Courses.map(c => c.completedEnrollments),
        backgroundColor: 'rgba(34, 197, 94, 0.8)'
      }
    ]
  };

  const categoryChartData = {
    labels: (summaryData?.categoryBreakdown || []).map(c => c.category),
    datasets: [{
      data: (summaryData?.categoryBreakdown || []).map(c => c.totalEnrollments),
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(34, 197, 94, 0.8)',
        'rgba(249, 115, 22, 0.8)',
        'rgba(168, 85, 247, 0.8)',
        'rgba(236, 72, 153, 0.8)'
      ]
    }]
  };

  const popularityData = {
    labels: ['High', 'Medium', 'Low'],
    datasets: [{
      data: [
        summaryData?.popularityDistribution?.high || 0,
        summaryData?.popularityDistribution?.medium || 0,
        summaryData?.popularityDistribution?.low || 0
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(249, 115, 22, 0.8)',
        'rgba(239, 68, 68, 0.8)'
      ]
    }]
  };

  if (loadingSummary && !summaryData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Course Enrollment Report</h1>
          <p className="text-gray-600">Track course enrollments, completion rates, and popularity metrics</p>
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
                <p className="text-sm text-gray-600 mb-1">Total Courses</p>
                <p className="text-3xl font-bold text-gray-900">{summaryData.summary.totalCourses}</p>
              </div>
              <AcademicCapIcon className="h-12 w-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Enrollments</p>
                <p className="text-3xl font-bold text-gray-900">{summaryData.summary.totalEnrollments}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Avg: {summaryData.summary.averageEnrollmentPerCourse} per course
                </p>
              </div>
              <UserGroupIcon className="h-12 w-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Enrollments</p>
                <p className="text-3xl font-bold text-gray-900">{summaryData.summary.activeEnrollments}</p>
                <p className="text-xs text-gray-500 mt-1">In Progress</p>
              </div>
              <ArrowTrendingUpIcon className="h-12 w-12 text-orange-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completion Rate</p>
                <p className="text-3xl font-bold text-gray-900">{summaryData.summary.averageCompletionRate}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  Dropoff: {summaryData.summary.averageDropoffRate}%
                </p>
              </div>
              <CheckCircleIcon className="h-12 w-12 text-purple-500" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-linear-to-r from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
            <div className="flex items-start">
              <ArrowTrendingUpIcon className="h-8 w-8 text-green-600 mr-3 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-800 mb-1">Most Popular Course</p>
                <p className="text-lg font-bold text-green-900">{summaryData.summary.mostPopularCourse}</p>
              </div>
            </div>
          </div>
          <div className="bg-linear-to-r from-red-50 to-red-100 rounded-lg shadow p-6 border border-red-200">
            <div className="flex items-start">
              <ArrowTrendingDownIcon className="h-8 w-8 text-red-600 mr-3 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800 mb-1">Least Popular Course</p>
                <p className="text-lg font-bold text-red-900">{summaryData.summary.leastPopularCourse}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Courses by Enrollment</h3>
            <div className="h-80">
              <Bar
                data={topCoursesChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: { beginAtZero: true }
                  },
                  plugins: {
                    legend: { position: 'top' }
                  }
                }}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Enrollments by Category</h3>
            <div className="h-80">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Popularity Distribution</h3>
            <div className="h-64">
              <Doughnut
                data={popularityData}
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

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Statistics</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {(summaryData.categoryBreakdown || []).map((cat, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{cat.category}</p>
                    <p className="text-sm text-gray-600">{cat.courses} courses</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">{cat.totalEnrollments}</p>
                    <p className="text-xs text-gray-500">enrollments</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    { key: 'status', label: 'Status' },
                    { key: 'totalEnrollments', label: 'Enrollments' },
                    { key: 'activeEnrollments', label: 'Active' },
                    { key: 'completedEnrollments', label: 'Completed' },
                    { key: 'completionRate', label: 'Completion Rate' },
                    { key: 'dropoffRate', label: 'Dropoff Rate' },
                    { key: 'popularity', label: 'Popularity' }
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        course.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {course.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                      {course.totalEnrollments}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {course.activeEnrollments}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {course.completedEnrollments}
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        course.dropoffRate > 50 ? 'text-red-600' :
                        course.dropoffRate > 25 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {course.dropoffRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        course.popularity === 'High' ? 'bg-green-100 text-green-800' :
                        course.popularity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {course.popularity}
                      </span>
                    </td>
                  </tr>
                ))}
                {loadingCourses && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-sm text-gray-500">
                      Loading course details...
                    </td>
                  </tr>
                )}
                {!loadingCourses && courses.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-sm text-gray-500">
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
