import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import { getCourseEnrollmentReport, exportToCSV, exportToJSON } from '../services/reports';
import { Bar, Doughnut } from 'react-chartjs-2';
import { 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon,
  AcademicCapIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ChartBarIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

export default function CourseEnrollmentReport() {
  const navigate = useNavigate();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const data = await getCourseEnrollmentReport(filters);
      setReportData(data);
    } catch (error) {
      console.error('Failed to load course enrollment report:', error);
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
      'Status': course.status,
      'Total Enrollments': course.totalEnrollments,
      'Active': course.activeEnrollments,
      'Completed': course.completedEnrollments,
      'Completion Rate': `${course.completionRate}%`,
      'Dropoff Rate': `${course.dropoffRate}%`,
      'Popularity': course.popularity
    }));
    
    exportToCSV(csvData, 'course-enrollment-report.csv');
  };

  const handleExportJSON = () => {
    if (!reportData) return;
    exportToJSON(reportData, 'course-enrollment-report.json');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (!reportData) return null;

  // Filter courses based on search and category
  const filteredCourses = reportData.courses.filter(course => {
    const matchesSearch = course.courseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (course.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = ['all', ...new Set(reportData.courses.map(c => c.category || 'Uncategorized'))];

  // Top 10 courses by enrollment
  const top10Courses = [...reportData.courses].slice(0, 10);
  const topCoursesChartData = {
    labels: top10Courses.map(c => c.courseTitle.length > 20 ? c.courseTitle.substring(0, 20) + '...' : c.courseTitle),
    datasets: [
      {
        label: 'Total Enrollments',
        data: top10Courses.map(c => c.totalEnrollments),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
      {
        label: 'Completed',
        data: top10Courses.map(c => c.completedEnrollments),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
      }
    ]
  };

  // Category breakdown chart
  const categoryChartData = {
    labels: reportData.categoryBreakdown.map(c => c.category),
    datasets: [{
      data: reportData.categoryBreakdown.map(c => c.totalEnrollments),
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(34, 197, 94, 0.8)',
        'rgba(249, 115, 22, 0.8)',
        'rgba(168, 85, 247, 0.8)',
        'rgba(236, 72, 153, 0.8)',
      ],
    }]
  };

  // Popularity distribution
  const popularityData = {
    labels: ['High', 'Medium', 'Low'],
    datasets: [{
      data: [
        reportData.courses.filter(c => c.popularity === 'High').length,
        reportData.courses.filter(c => c.popularity === 'Medium').length,
        reportData.courses.filter(c => c.popularity === 'Low').length
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Course Enrollment Report</h1>
        <p className="text-gray-600">Track course enrollments, completion rates, and popularity metrics</p>
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
              <p className="text-sm text-gray-600 mb-1">Total Courses</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.totalCourses}</p>
            </div>
            <AcademicCapIcon className="h-12 w-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Enrollments</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.totalEnrollments}</p>
              <p className="text-xs text-gray-500 mt-1">
                Avg: {reportData.summary.averageEnrollmentPerCourse} per course
              </p>
            </div>
            <UserGroupIcon className="h-12 w-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Enrollments</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.activeEnrollments}</p>
              <p className="text-xs text-gray-500 mt-1">
                In Progress
              </p>
            </div>
            <ArrowTrendingUpIcon className="h-12 w-12 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completion Rate</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.averageCompletionRate}%</p>
              <p className="text-xs text-gray-500 mt-1">
                Dropoff: {reportData.summary.averageDropoffRate}%
              </p>
            </div>
            <CheckCircleIcon className="h-12 w-12 text-purple-500" />
          </div>
        </div>
      </div>

  {/* Most/Least Popular */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-linear-to-r from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
          <div className="flex items-start">
            <ArrowTrendingUpIcon className="h-8 w-8 text-green-600 mr-3 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800 mb-1">Most Popular Course</p>
              <p className="text-lg font-bold text-green-900">{reportData.summary.mostPopularCourse}</p>
            </div>
          </div>
        </div>
        <div className="bg-linear-to-r from-red-50 to-red-100 rounded-lg shadow p-6 border border-red-200">
          <div className="flex items-start">
            <ArrowTrendingDownIcon className="h-8 w-8 text-red-600 mr-3 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 mb-1">Least Popular Course</p>
              <p className="text-lg font-bold text-red-900">{reportData.summary.leastPopularCourse}</p>
            </div>
          </div>
        </div>
      </div>

  {/* Charts */}
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
            {reportData.categoryBreakdown.map((cat, index) => (
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

  {/* Filters for Course List */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enrollments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dropoff Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Popularity</th>
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
                          className="bg-green-600 h-2 rounded-full" 
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
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
