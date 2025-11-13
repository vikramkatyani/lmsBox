import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import { getCourseCompletionReport, exportToCSV, exportToJSON } from '../services/reports';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { 
  CheckCircleIcon,
  ClockIcon,
  AcademicCapIcon,
  ChartBarIcon,
  ArrowLeftIcon,
  TrophyIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

export default function CourseCompletionReport() {
  const navigate = useNavigate();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [performanceFilter, setPerformanceFilter] = useState('all');

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const data = await getCourseCompletionReport(filters);
      setReportData(data);
    } catch (error) {
      console.error('Failed to load course completion report:', error);
      alert('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleApplyFilters = () => {
    loadReport();
  };

  const handleExportCSV = () => {
    if (!reportData?.courses) return;
    
    const csvData = reportData.courses.map(course => ({
      'Course Title': course.courseTitle,
      'Category': course.category || 'N/A',
      'Total Enrollments': course.totalEnrollments,
      'Completed': course.completedCount,
      'In Progress': course.inProgressCount,
      'Not Started': course.notStartedCount,
      'Completion Rate': `${course.completionRate}%`,
      'Avg Completion Time (days)': course.averageCompletionTime,
      'Performance': course.performance
    }));
    
    exportToCSV(csvData, 'course-completion-report.csv');
  };

  const handleExportJSON = () => {
    if (!reportData) return;
    exportToJSON(reportData, 'course-completion-report.json');
  };

  if (loading) {
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

  if (!reportData) return null;

  // Filter courses
  const filteredCourses = reportData.courses.filter(course => {
    const matchesSearch = course.courseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (course.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;
    const matchesPerformance = performanceFilter === 'all' || course.performance === performanceFilter;
    return matchesSearch && matchesCategory && matchesPerformance;
  });

  // Get unique categories
  const categories = ['all', ...new Set(reportData.courses.map(c => c.category || 'Uncategorized'))];
  const performances = ['all', 'Excellent', 'Good', 'Fair', 'Poor'];

  // Top 10 courses by completion rate
  const top10Courses = [...reportData.courses].slice(0, 10);
  const topCoursesChartData = {
    labels: top10Courses.map(c => c.courseTitle.length > 20 ? c.courseTitle.substring(0, 20) + '...' : c.courseTitle),
    datasets: [
      {
        label: 'Completion Rate (%)',
        data: top10Courses.map(c => c.completionRate),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
      }
    ]
  };

  // Completion trends chart
  const trendsChartData = {
    labels: reportData.completionTrends.map(t => t.date),
    datasets: [{
      label: 'Completions',
      data: reportData.completionTrends.map(t => t.count),
      borderColor: 'rgba(59, 130, 246, 1)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.4,
      fill: true
    }]
  };

  // Category breakdown chart
  const categoryChartData = {
    labels: reportData.categoryBreakdown.map(c => c.category),
    datasets: [{
      data: reportData.categoryBreakdown.map(c => c.totalCompletions),
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(34, 197, 94, 0.8)',
        'rgba(249, 115, 22, 0.8)',
        'rgba(168, 85, 247, 0.8)',
        'rgba(236, 72, 153, 0.8)',
      ],
    }]
  };

  // Performance distribution
  const performanceData = {
    labels: ['Excellent', 'Good', 'Fair', 'Poor'],
    datasets: [{
      data: [
        reportData.courses.filter(c => c.performance === 'Excellent').length,
        reportData.courses.filter(c => c.performance === 'Good').length,
        reportData.courses.filter(c => c.performance === 'Fair').length,
        reportData.courses.filter(c => c.performance === 'Poor').length
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(249, 115, 22, 0.8)',
        'rgba(239, 68, 68, 0.8)',
      ],
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Course Completion Report</h1>
        <p className="text-gray-600">Track course completion rates, performance metrics, and trends</p>
      </div>

      {/* Filters */}
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
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
            >
              Apply Filters
            </button>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={handleExportCSV}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-sm"
            >
              Export CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition text-sm"
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
              <p className="text-sm text-gray-600 mb-1">Avg Completion Rate</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.averageCompletionRate}%</p>
            </div>
            <ChartBarIcon className="h-12 w-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Completions</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.totalCompletions}</p>
            </div>
            <CheckCircleIcon className="h-12 w-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">In Progress</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.totalInProgress}</p>
              <p className="text-xs text-gray-500 mt-1">
                Incomplete: {reportData.summary.totalIncomplete}
              </p>
            </div>
            <ClockIcon className="h-12 w-12 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Completion Time</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.averageCompletionTime}</p>
              <p className="text-xs text-gray-500 mt-1">days</p>
            </div>
            <AcademicCapIcon className="h-12 w-12 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Best/Worst Performing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-linear-to-r from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
          <div className="flex items-start">
            <TrophyIcon className="h-8 w-8 text-green-600 mr-3 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800 mb-1">Best Performing Course</p>
              <p className="text-lg font-bold text-green-900">{reportData.summary.bestPerforming}</p>
            </div>
          </div>
        </div>
        <div className="bg-linear-to-r from-red-50 to-red-100 rounded-lg shadow p-6 border border-red-200">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-600 mr-3 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 mb-1">Needs Improvement</p>
              <p className="text-lg font-bold text-red-900">{reportData.summary.worstPerforming}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
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

      {/* Category Statistics */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {reportData.categoryBreakdown.map((cat, index) => (
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

      {/* Filters for Course List */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Courses</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or category..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Performance</label>
            <select
              value={performanceFilter}
              onChange={(e) => setPerformanceFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {performances.map(perf => (
                <option key={perf} value={perf}>{perf === 'all' ? 'All Performance' : perf}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Course List Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Course Details</h3>
          <p className="text-sm text-gray-600">Showing {filteredCourses.length} of {reportData.courses.length} courses</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enrolled</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">In Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Time (days)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCourses.map((course) => (
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
                          className="bg-green-600 h-2 rounded-full" 
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
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
