import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import usePageTitle from '../hooks/usePageTitle';
import { getTimeTrackingReport, exportToCSV, exportToJSON } from '../services/reports';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  ArrowLeftIcon,
  ClockIcon,
  UserGroupIcon,
  AcademicCapIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  FireIcon
} from '@heroicons/react/24/outline';

export default function TimeTrackingReport() {
  usePageTitle('Time Tracking & Engagement Report');
  const navigate = useNavigate();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    userId: '',
    courseId: '',
    startDate: '',
    endDate: ''
  });
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTimeTrackingReport(filters);
      setReportData(data);
    } catch (error) {
      console.error('Failed to load time tracking report:', error);
      setError(error.response?.data?.error || 'Failed to load report');
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
    if (!reportData) return;
    
    let csvData = [];
    if (activeTab === 'users') {
      csvData = reportData.userTimeAnalytics.map(user => ({
        'User': user.userName,
        'Email': user.email,
        'Total Hours': user.totalTimeSpentHours,
        'Courses Accessed': user.coursesAccessed,
        'Lessons Accessed': user.lessonsAccessed,
        'Avg Session (min)': user.averageSessionMinutes,
        'Active Days': user.activeDays,
        'Last Activity': user.lastActivityDate
      }));
    } else if (activeTab === 'courses') {
      csvData = reportData.courseTimeAnalytics.map(course => ({
        'Course': course.courseTitle,
        'Total Hours': course.totalTimeSpentHours,
        'Unique Learners': course.uniqueLearners,
        'Avg Time Per Learner (min)': course.averageTimePerLearnerMinutes,
        'Total Lessons': course.totalLessons,
        'Completed Lessons': course.completedLessons
      }));
    } else if (activeTab === 'lessons') {
      csvData = reportData.lessonTimeAnalytics.map(lesson => ({
        'Lesson': lesson.lessonTitle,
        'Type': lesson.lessonType,
        'Course': lesson.courseTitle,
        'Total Hours': lesson.totalTimeSpentHours,
        'Unique Learners': lesson.uniqueLearners,
        'Avg Time Per Learner (min)': lesson.averageTimePerLearnerMinutes,
        'Completions': lesson.completions,
        'Completion Rate': `${lesson.completionRate}%`,
        'Video Bookmarks': lesson.videoBookmarkCount,
        'Last Accessed': lesson.lastAccessedAt
      }));
    }
    
    exportToCSV(csvData, `time-tracking-${activeTab}-report.csv`);
  };

  const handleExportJSON = () => {
    if (!reportData) return;
    exportToJSON(reportData, 'time-tracking-report.json');
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-error border border-error rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!reportData) return null;

  const { summary, userTimeAnalytics, courseTimeAnalytics, lessonTimeAnalytics, dailyTimeBreakdown, timeByLessonType } = reportData;

  // Chart: Daily Time Breakdown
  const dailyTimeChartData = {
    labels: dailyTimeBreakdown.map(d => new Date(d.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Time Spent (Hours)',
        data: dailyTimeBreakdown.map(d => d.totalTimeSpentHours),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
        fill: true
      }
    ]
  };

  // Chart: Time by Lesson Type
  const lessonTypeChartData = {
    labels: timeByLessonType.map(t => t.lessonType),
    datasets: [
      {
        label: 'Time Spent (Hours)',
        data: timeByLessonType.map(t => t.totalTimeSpentHours),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(251, 146, 60, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(244, 63, 94, 0.8)'
        ]
      }
    ]
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/reports')}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-1" />
            Back to Reports
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Time Tracking & Engagement Report</h1>
          <p className="text-gray-600">Comprehensive analytics on time spent by learners across courses and lessons</p>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleApplyFilters}
                className="w-full bg-[#2afeae] text-[#1b365d] px-4 py-2 rounded-md hover:bg-[#25e89e]"
              >
                Apply Filters
              </button>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleExportCSV}
                className="flex-1 bg-[#2afeae] text-[#1b365d] px-4 py-2 rounded-md hover:bg-[#25e89e] text-sm"
              >
                Export CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="flex-1 bg-[#1b365d] text-white px-4 py-2 rounded-md hover:bg-[#234a7a] text-sm"
              >
                Export JSON
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Time Spent</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalTimeSpentHours}h</p>
              </div>
              <ClockIcon className="h-12 w-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Unique Learners</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalUniqueLearners}</p>
              </div>
              <UserGroupIcon className="h-12 w-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Courses Accessed</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalCoursesAccessed}</p>
              </div>
              <AcademicCapIcon className="h-12 w-12 text-purple-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Lessons Accessed</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalLessonsAccessed}</p>
              </div>
              <BookOpenIcon className="h-12 w-12 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Additional Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm font-medium text-gray-600">Avg Time Per Learner</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{summary.averageTimePerLearnerHours}h</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm font-medium text-gray-600">Avg Time Per Course</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{summary.averageTimePerCourseHours}h</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm font-medium text-gray-600">Avg Time Per Lesson</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{summary.averageTimePerLessonMinutes} min</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Daily Time Spent</h3>
            <Line data={dailyTimeChartData} options={{ responsive: true, maintainAspectRatio: true }} />
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Time by Lesson Type</h3>
            <Doughnut data={lessonTypeChartData} options={{ responsive: true, maintainAspectRatio: true }} />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {['summary', 'users', 'courses', 'lessons', 'daily'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'summary' && (
              <div className="space-y-4">
                <div className="bg-info border border-[#2afeae] rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">📊 Key Insights</h4>
                  <ul className="list-disc list-inside text-blue-800 space-y-1">
                    <li>Most Active Day: <strong>{summary.mostActiveDay}</strong> ({summary.peakActivityHours}h)</li>
                    <li>Most Time-Consuming Course: <strong>{summary.mostTimeConsuming}</strong></li>
                    <li>Average time per learner: <strong>{summary.averageTimePerLearnerHours} hours</strong></li>
                  </ul>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Time by Lesson Type</h4>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Type</th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Hours</th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Avg/Lesson</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {timeByLessonType.map(type => (
                          <tr key={type.lessonType}>
                            <td className="px-4 py-2 text-sm">{type.lessonType}</td>
                            <td className="px-4 py-2 text-sm text-right">{type.totalTimeSpentHours}h</td>
                            <td className="px-4 py-2 text-sm text-right">{type.averageTimePerLessonMinutes} min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Courses</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lessons</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Session</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Active Days</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {userTimeAnalytics.map(user => (
                      <tr key={user.userId}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{user.userName}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {user.totalTimeSpentHours}h
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {user.coursesAccessed}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {user.lessonsAccessed}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {user.averageSessionMinutes} min
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {user.activeDays}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.lastActivityDate ? new Date(user.lastActivityDate).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'courses' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Learners</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Time/Learner</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lessons</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {courseTimeAnalytics.map(course => (
                      <tr key={course.courseId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {course.courseTitle}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {course.totalTimeSpentHours}h
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {course.uniqueLearners}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {course.averageTimePerLearnerMinutes} min
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {course.totalLessons}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {course.completedLessons}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'lessons' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lesson</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Learners</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Time</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Completion %</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bookmarks</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {lessonTimeAnalytics.map(lesson => (
                      <tr key={lesson.lessonId}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          <div>{lesson.lessonTitle}</div>
                          <div className="text-xs text-gray-500">{lesson.courseTitle}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {lesson.lessonType}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {lesson.totalTimeSpentHours}h
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {lesson.uniqueLearners}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {lesson.averageTimePerLearnerMinutes} min
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {lesson.completionRate}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {lesson.videoBookmarkCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'daily' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unique Learners</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lessons Accessed</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Courses Accessed</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dailyTimeBreakdown.map(day => (
                      <tr key={day.date}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {new Date(day.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {day.totalTimeSpentHours}h
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {day.uniqueLearners}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {day.lessonsAccessed}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                          {day.coursesAccessed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
