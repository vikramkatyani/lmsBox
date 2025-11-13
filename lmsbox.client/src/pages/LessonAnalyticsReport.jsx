import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import { getLessonAnalyticsReport, exportToCSV, exportToJSON } from '../services/reports';
import { Bar, Doughnut, Pie } from 'react-chartjs-2';
import {
  ArrowLeftIcon,
  AcademicCapIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  FireIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

export default function LessonAnalyticsReport() {
  const navigate = useNavigate();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    courseId: '',
    lessonType: '',
    startDate: '',
    endDate: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [engagementFilter, setEngagementFilter] = useState('all');

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const data = await getLessonAnalyticsReport(filters);
      setReportData(data);
    } catch (error) {
      console.error('Failed to load lesson analytics report:', error);
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
    if (!reportData?.lessons) return;
    
    const csvData = reportData.lessons.map(lesson => ({
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
    
    exportToCSV(csvData, 'lesson-analytics-report.csv');
  };

  const handleExportJSON = () => {
    if (!reportData) return;
    exportToJSON(reportData, 'lesson-analytics-report.json');
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

  // Filter lessons
  const filteredLessons = reportData.lessons.filter(lesson => {
    const matchesSearch = lesson.lessonTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lesson.courseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lesson.lessonType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEngagement = engagementFilter === 'all' || lesson.engagementLevel === engagementFilter;
    return matchesSearch && matchesEngagement;
  });

  // Engagement breakdown chart
  const engagementChartData = {
    labels: reportData.engagementBreakdown.map(e => e.level),
    datasets: [{
      data: reportData.engagementBreakdown.map(e => e.count),
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',   // High - Green
        'rgba(59, 130, 246, 0.8)',  // Medium - Blue
        'rgba(251, 191, 36, 0.8)',  // Low - Yellow
        'rgba(239, 68, 68, 0.8)'    // Very Low - Red
      ],
    }]
  };

  // Type breakdown chart
  const typeChartData = {
    labels: reportData.typeBreakdown.map(t => t.type),
    datasets: [{
      label: 'Lesson Count',
      data: reportData.typeBreakdown.map(t => t.count),
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
    }]
  };

  // Difficulty breakdown chart
  const difficultyChartData = {
    labels: reportData.difficultyBreakdown.map(d => d.level),
    datasets: [{
      data: reportData.difficultyBreakdown.map(d => d.count),
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',   // Easy - Green
        'rgba(59, 130, 246, 0.8)',  // Moderate - Blue
        'rgba(251, 191, 36, 0.8)',  // Challenging - Yellow
        'rgba(239, 68, 68, 0.8)'    // Very Challenging - Red
      ],
    }]
  };

  // Top lessons by completion rate
  const top10Lessons = [...reportData.lessons]
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 10);
  
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
        <p className="text-gray-600">Analyze lesson performance, engagement levels, and difficulty</p>
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
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Engagement</label>
            <select
              value={engagementFilter}
              onChange={(e) => setEngagementFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Very Low">Very Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lesson List Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Lesson Details</h3>
          <p className="text-sm text-gray-600">Showing {filteredLessons.length} of {reportData.lessons.length} lessons</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lesson</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enrollments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engagement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Difficulty</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLessons.map((lesson) => (
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
                          className="bg-green-600 h-2 rounded-full"
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
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
