import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import {
  getLessonAnalyticsReportSummary,
  getLessonAnalyticsReportLessons,
  exportToCSV,
  exportToJSON
} from '../services/reports';
import { Bar, Doughnut, Pie } from 'react-chartjs-2';
import {
  ArrowLeftIcon,
  AcademicCapIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  FireIcon,
  ExclamationTriangleIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

const DEFAULT_PAGINATION = {
  pageNumber: 1,
  pageSize: 50,
  totalLessons: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false
};

export default function LessonAnalyticsReport() {
  const navigate = useNavigate();
  const [summaryData, setSummaryData] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [filters, setFilters] = useState({
    courseId: '',
    lessonType: '',
    startDate: '',
    endDate: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [engagementFilter, setEngagementFilter] = useState('all');
  const [sortBy, setSortBy] = useState('order');
  const [sortDirection, setSortDirection] = useState('desc');
  const [pageSize, setPageSize] = useState(50);

  const getBaseFilters = () => ({
    courseId: filters.courseId || undefined,
    lessonType: filters.lessonType || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined
  });

  const loadSummary = async () => {
    try {
      setLoadingSummary(true);
      const data = await getLessonAnalyticsReportSummary(getBaseFilters());
      setSummaryData(data);
    } catch (error) {
      console.error('Failed to load lesson analytics summary:', error);
      alert('Failed to load report summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadLessons = async (
    requestedPageNumber = 1,
    requestedPageSize = pageSize,
    requestedSearch = appliedSearch,
    requestedEngagement = engagementFilter,
    requestedSortBy = sortBy,
    requestedSortDirection = sortDirection
  ) => {
    try {
      setLoadingLessons(true);
      const data = await getLessonAnalyticsReportLessons({
        ...getBaseFilters(),
        pageNumber: requestedPageNumber,
        pageSize: requestedPageSize,
        search: requestedSearch || undefined,
        engagement: requestedEngagement !== 'all' ? requestedEngagement : undefined,
        sortBy: requestedSortBy,
        sortDirection: requestedSortDirection
      });

      setLessons(data.lessons || []);
      setPagination(data.pagination || {
        pageNumber: requestedPageNumber,
        pageSize: requestedPageSize,
        totalLessons: data.lessons?.length || 0,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false
      });
    } catch (error) {
      console.error('Failed to load lesson analytics table:', error);
      alert('Failed to load lesson details table');
    } finally {
      setLoadingLessons(false);
    }
  };

  useEffect(() => {
    Promise.all([loadSummary(), loadLessons(1, pageSize, '', 'all', sortBy, sortDirection)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleApplyFilters = async () => {
    await Promise.all([
      loadSummary(),
      loadLessons(1, pageSize, appliedSearch, engagementFilter, sortBy, sortDirection)
    ]);
  };

  const handleExportCSV = () => {
    if (!lessons?.length) return;
    
    const csvData = lessons.map(lesson => ({
      'Lesson Title': lesson.lessonTitle,
      'Course': lesson.courseTitle,
      'Type': lesson.lessonType,
      'Order': lesson.order,
      'Duration (min)': lesson.duration,
      'Total Enrollments': lesson.totalEnrollments,
      'Completions': lesson.completions,
      'In Progress': lesson.inProgress,
      'Not Started': lesson.notStarted,
      'Completion Rate': `${lesson.completionRate}%`,
      'Avg Progress': `${lesson.averageProgress}%`,
      'Engagement': lesson.engagementLevel,
      'Difficulty': lesson.difficulty,
      'Popular': lesson.isPopular ? 'Yes' : 'No'
    }));
    
    exportToCSV(csvData, 'lesson-analytics-report-page');
  };

  const handleExportJSON = () => {
    exportToJSON(
      {
        summary: summaryData?.summary,
        typeBreakdown: summaryData?.typeBreakdown,
        engagementBreakdown: summaryData?.engagementBreakdown,
        difficultyBreakdown: summaryData?.difficultyBreakdown,
        topLessonsByCompletionRate: summaryData?.topLessonsByCompletionRate,
        popularLessons: summaryData?.popularLessons,
        problematicLessons: summaryData?.problematicLessons,
        pagination,
        lessons
      },
      'lesson-analytics-report-page'
    );
  };

  const handleSort = (column) => {
    const nextDirection = sortBy === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortBy(column);
    setSortDirection(nextDirection);
    loadLessons(1, pageSize, appliedSearch, engagementFilter, column, nextDirection);
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
    loadLessons(1, pageSize, term, engagementFilter, sortBy, sortDirection);
  };

  const handleEngagementChange = (e) => {
    const nextEngagement = e.target.value;
    setEngagementFilter(nextEngagement);
    loadLessons(1, pageSize, appliedSearch, nextEngagement, sortBy, sortDirection);
  };

  const handlePageChange = (nextPage) => {
    loadLessons(nextPage, pageSize, appliedSearch, engagementFilter, sortBy, sortDirection);
  };

  const handlePageSizeChange = (e) => {
    const nextSize = parseInt(e.target.value, 10) || 50;
    setPageSize(nextSize);
    loadLessons(1, nextSize, appliedSearch, engagementFilter, sortBy, sortDirection);
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

  const tableLessons = useMemo(() => lessons, [lessons]);

  const engagementChartData = {
    labels: (summaryData.engagementBreakdown || []).map(e => e.level),
    datasets: [{
      data: (summaryData.engagementBreakdown || []).map(e => e.count),
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',   // High - Green
        'rgba(59, 130, 246, 0.8)',  // Medium - Blue
        'rgba(251, 191, 36, 0.8)',  // Low - Yellow
        'rgba(239, 68, 68, 0.8)'    // Very Low - Red
      ],
    }]
  };

  const typeChartData = {
    labels: (summaryData.typeBreakdown || []).map(t => t.type),
    datasets: [{
      label: 'Lesson Count',
      data: (summaryData.typeBreakdown || []).map(t => t.count),
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
    }]
  };

  const difficultyChartData = {
    labels: (summaryData.difficultyBreakdown || []).map(d => d.level),
    datasets: [{
      data: (summaryData.difficultyBreakdown || []).map(d => d.count),
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',   // Easy - Green
        'rgba(59, 130, 246, 0.8)',  // Moderate - Blue
        'rgba(251, 191, 36, 0.8)',  // Challenging - Yellow
        'rgba(239, 68, 68, 0.8)'    // Very Challenging - Red
      ],
    }]
  };

  const top10Lessons = summaryData.topLessonsByCompletionRate || [];
  
  const topLessonsChartData = {
    labels: top10Lessons.map(l => l.lessonTitle.length > 20 ? l.lessonTitle.substring(0, 20) + '...' : l.lessonTitle),
    datasets: [{
      label: 'Completion Rate (%)',
      data: top10Lessons.map(l => l.completionRate),
      backgroundColor: 'rgba(34, 197, 94, 0.8)',
    }]
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Lesson Analytics Report</h1>
        <p className="text-gray-600">Analyse lesson performance, engagement levels, and difficulty</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lesson Type</label>
            <select
              name="lessonType"
              value={filters.lessonType}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="Video">Video</option>
              <option value="Text">Text</option>
              <option value="Quiz">Quiz</option>
              <option value="Assignment">Assignment</option>
              <option value="SCORM">SCORM</option>
            </select>
          </div>
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
                disabled={loadingSummary || loadingLessons}
                className="w-full px-4 py-2 bg-[#2afeae] text-[#1b365d] rounded-md hover:bg-superadmin-btn-hover disabled:opacity-50 transition"
            >
                {loadingSummary ? 'Loading...' : 'Apply Filters'}
            </button>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={handleExportCSV}
              className="flex-1 px-4 py-2 bg-[#2afeae] text-[#1b365d] rounded-md hover:bg-[#25e89e] transition text-sm"
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Lessons</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.totalLessons}</p>
            </div>
            <AcademicCapIcon className="h-12 w-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Completion Rate</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.averageCompletionRate}%</p>
            </div>
            <CheckCircleIcon className="h-12 w-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Enrollments</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.totalEnrollments}</p>
            </div>
            <ChartBarIcon className="h-12 w-12 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Progress</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.averageProgress}%</p>
            </div>
            <ClockIcon className="h-12 w-12 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Popular and Problematic Lessons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Popular Lessons */}
        <div className="bg-linear-to-r from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
          <div className="flex items-center mb-4">
            <FireIcon className="h-6 w-6 text-green-600 mr-2" />
            <h3 className="text-lg font-semibold text-green-900">Popular Lessons ({reportData.popularLessons.length})</h3>
          </div>
          {reportData.popularLessons.length > 0 ? (
            <div className="space-y-2">
              {reportData.popularLessons.map((lesson, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white p-3 rounded">
                  <span className="text-sm font-medium text-gray-900">{lesson.lessonTitle}</span>
                  <span className="text-sm text-green-600 font-semibold">{lesson.completionRate}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-green-700 text-sm">No popular lessons identified</p>
          )}
        </div>

        {/* Problematic Lessons */}
        <div className="bg-linear-to-r from-red-50 to-red-100 rounded-lg shadow p-6 border border-red-200">
          <div className="flex items-center mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mr-2" />
            <h3 className="text-lg font-semibold text-red-900">Needs Improvement ({reportData.problematicLessons.length})</h3>
          </div>
          {reportData.problematicLessons.length > 0 ? (
            <div className="space-y-2">
              {reportData.problematicLessons.map((lesson, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white p-3 rounded">
                  <span className="text-sm font-medium text-gray-900">{lesson.lessonTitle}</span>
                  <span className="text-sm text-red-600 font-semibold">{lesson.completionRate}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-red-700 text-sm">No problematic lessons identified</p>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Lessons by Completion Rate</h3>
          <div className="h-80">
            <Bar
              data={topLessonsChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100
                  }
                },
                plugins: {
                  legend: { display: false }
                }
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Lessons by Type</h3>
          <div className="h-80">
            <Bar
              data={typeChartData}
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Level Distribution</h3>
          <div className="h-80">
            <Doughnut
              data={engagementChartData}
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Difficulty Distribution</h3>
          <div className="h-80">
            <Pie
              data={difficultyChartData}
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

      {/* Type Breakdown Stats */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Breakdown by Lesson Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {reportData.typeBreakdown.map((type, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900 mb-2">{type.type}</p>
              <div className="space-y-1 text-sm text-gray-600">
                <p>{type.count} lessons</p>
                <p>{type.totalEnrollments} enrollments</p>
                <p className="font-semibold text-blue-600">{type.averageCompletionRate}% avg rate</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters for Lesson List */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Lessons</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, course, or type..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleApplySearch}
              className="mt-2 px-4 py-2 bg-[#1b365d] text-white rounded-md hover:bg-[#234a7a] transition text-sm"
            >
              Search
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Engagement</label>
            <select
              value={engagementFilter}
              onChange={handleEngagementChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Very Low">Very Low</option>
            </select>
            <div className="mt-2">
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
      </div>

      {/* Lesson List Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Lesson Details</h3>
            <p className="text-sm text-gray-600">Showing {tableLessons.length} of {pagination.totalLessons} lessons</p>
          </div>
          {loadingLessons && <p className="text-sm text-gray-500">Refreshing table...</p>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  { key: 'lessonTitle', label: 'Lesson' },
                  { key: 'courseTitle', label: 'Course' },
                  { key: 'lessonType', label: 'Type' },
                  { key: 'totalEnrollments', label: 'Enrollments' },
                  { key: 'completions', label: 'Completions' },
                  { key: 'completionRate', label: 'Completion Rate' },
                  { key: 'engagementLevel', label: 'Engagement' },
                  { key: 'difficulty', label: 'Difficulty' }
                ].map((column) => (
                  <th key={column.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
              {!loadingLessons && tableLessons.map((lesson) => (
                <tr key={lesson.lessonId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{lesson.lessonTitle}</div>
                    <div className="text-xs text-gray-500">Order: {lesson.order} {lesson.duration ? `• ${lesson.duration} min` : ''}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {lesson.courseTitle}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {lesson.lessonType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {lesson.totalEnrollments}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                    {lesson.completions}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className="bg-[#2afeae] h-2 rounded-full"
                          style={{ width: `${Math.min(lesson.completionRate, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-900 font-medium">{lesson.completionRate}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      lesson.engagementLevel === 'High' ? 'bg-green-100 text-green-800' :
                      lesson.engagementLevel === 'Medium' ? 'bg-blue-100 text-blue-800' :
                      lesson.engagementLevel === 'Low' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {lesson.engagementLevel}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      lesson.difficulty === 'Easy' ? 'bg-green-100 text-green-800' :
                      lesson.difficulty === 'Moderate' ? 'bg-blue-100 text-blue-800' :
                      lesson.difficulty === 'Challenging' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {lesson.difficulty}
                    </span>
                  </td>
                </tr>
              ))}
              {loadingLessons && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                    Loading lesson details...
                  </td>
                </tr>
              )}
              {!loadingLessons && tableLessons.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                    No lessons found for current filters.
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
              disabled={!pagination.hasPreviousPage || loadingLessons}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.pageNumber + 1)}
              disabled={!pagination.hasNextPage || loadingLessons}
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
