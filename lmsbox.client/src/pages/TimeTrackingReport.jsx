import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import usePageTitle from '../hooks/usePageTitle';
import { getTimeTrackingReportSummary, getTimeTrackingReportTable, exportToCSV, exportToJSON } from '../services/reports';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  ArrowLeftIcon,
  ClockIcon,
  UserGroupIcon,
  AcademicCapIcon,
  BookOpenIcon,
  ArrowsUpDownIcon
} from '@heroicons/react/24/outline';

const DEFAULT_SORT = {
  users: { sortBy: 'totalTimeSpentHours', sortDirection: 'desc' },
  courses: { sortBy: 'totalTimeSpentHours', sortDirection: 'desc' },
  lessons: { sortBy: 'totalTimeSpentHours', sortDirection: 'desc' },
  daily: { sortBy: 'date', sortDirection: 'desc' }
};

const TABLE_TABS = ['summary', 'users', 'courses', 'lessons', 'daily'];

export default function TimeTrackingReport() {
  usePageTitle('Time Tracking & Engagement Report');
  const navigate = useNavigate();

  const [summaryData, setSummaryData] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({ userId: '', courseId: '', startDate: '', endDate: '' });
  const [appliedFilters, setAppliedFilters] = useState({ userId: '', courseId: '', startDate: '', endDate: '' });

  const [activeTab, setActiveTab] = useState('summary');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize] = useState(25);
  const [sortByTab, setSortByTab] = useState(DEFAULT_SORT);

  const currentSort = sortByTab[activeTab] ?? { sortBy: 'totalTimeSpentHours', sortDirection: 'desc' };

  const fetchSummary = async (requestFilters) => {
    const data = await getTimeTrackingReportSummary(requestFilters);
    setSummaryData(data);
  };

  const fetchTable = async (tab, requestFilters, page, sortState) => {
    if (tab === 'summary') return;
    setTableLoading(true);
    try {
      const tableData = await getTimeTrackingReportTable({
        table: tab,
        ...requestFilters,
        pageNumber: page,
        pageSize,
        sortBy: sortState.sortBy,
        sortDirection: sortState.sortDirection
      });
      setTableRows(tableData.rows || []);
      setPagination(tableData.pagination || null);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError(null);
        await fetchSummary(appliedFilters);
      } catch (err) {
        console.error('Failed to load time tracking summary:', err);
        setError(err.response?.data?.error || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (activeTab === 'summary') return;
      try {
        setError(null);
        await fetchTable(activeTab, appliedFilters, pageNumber, currentSort);
      } catch (err) {
        console.error('Failed to load table data:', err);
        setError(err.response?.data?.error || 'Failed to load table data');
      }
    };

    run();
  }, [activeTab, appliedFilters, pageNumber, pageSize, currentSort.sortBy, currentSort.sortDirection]);

  const handleFilterChange = (e) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleApplyFilters = async () => {
    try {
      setLoading(true);
      setError(null);
      const nextFilters = { ...filters };
      setAppliedFilters(nextFilters);
      setPageNumber(1);
      await fetchSummary(nextFilters);
      if (activeTab !== 'summary') {
        await fetchTable(activeTab, nextFilters, 1, sortByTab[activeTab]);
      }
    } catch (err) {
      console.error('Failed to apply filters:', err);
      setError(err.response?.data?.error || 'Failed to apply filters');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column) => {
    if (activeTab === 'summary') return;
    setPageNumber(1);
    setSortByTab((prev) => {
      const current = prev[activeTab] ?? DEFAULT_SORT[activeTab];
      const nextDirection = current.sortBy === column && current.sortDirection === 'asc' ? 'desc' : 'asc';
      return {
        ...prev,
        [activeTab]: { sortBy: column, sortDirection: nextDirection }
      };
    });
  };

  const renderSort = (column) => {
    if (activeTab === 'summary') return null;
    const isActive = currentSort.sortBy === column;
    if (!isActive) return <ArrowsUpDownIcon className="h-3.5 w-3.5 text-gray-400" />;
    return <span className="text-xs text-blue-600">{currentSort.sortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  const headerButtonClass = 'px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-blue-600';

  const formatDateDisplay = (value) => {
    if (!value) return 'N/A';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      .format(date)
      .replace(/\s+/g, '-');
  };

  const handleExportCSV = () => {
    if (!summaryData) return;

    let csvData = [];
    if (activeTab === 'users') {
      csvData = tableRows.map((user) => ({
        User: user.userName,
        Email: user.email,
        'Total Hours': user.totalTimeSpentHours,
        Courses: user.coursesAccessed,
        Lessons: user.lessonsAccessed,
        'Avg Session (min)': user.averageSessionMinutes,
        'Active Days': user.activeDays,
        'Last Activity': user.lastActivityDate
      }));
    } else if (activeTab === 'courses') {
      csvData = tableRows.map((course) => ({
        Course: course.courseTitle,
        'Total Hours': course.totalTimeSpentHours,
        Learners: course.uniqueLearners,
        'Avg/Learner (min)': course.averageTimePerLearnerMinutes,
        Lessons: course.totalLessons,
        Completed: course.completedLessons
      }));
    } else if (activeTab === 'lessons') {
      csvData = tableRows.map((lesson) => ({
        Lesson: lesson.lessonTitle,
        Type: lesson.lessonType,
        Course: lesson.courseTitle,
        'Total Hours': lesson.totalTimeSpentHours,
        Learners: lesson.uniqueLearners,
        'Avg/Learner (min)': lesson.averageTimePerLearnerMinutes,
        Completions: lesson.completions,
        'Completion Rate': `${lesson.completionRate}%`,
        Bookmarks: lesson.videoBookmarkCount,
        'Last Accessed': lesson.lastAccessedAt
      }));
    } else if (activeTab === 'daily') {
      csvData = tableRows.map((day) => ({
        Date: day.date,
        'Total Hours': day.totalTimeSpentHours,
        'Unique Learners': day.uniqueLearners,
        'Lessons Accessed': day.lessonsAccessed,
        'Courses Accessed': day.coursesAccessed
      }));
    }

    exportToCSV(csvData, `time-tracking-${activeTab}-report.csv`);
  };

  const handleExportJSON = () => {
    if (!summaryData) return;
    exportToJSON(
      {
        summary: summaryData.summary,
        dailyTimeBreakdown: summaryData.dailyTimeBreakdown,
        timeByLessonType: summaryData.timeByLessonType,
        activeTab,
        tableRows,
        pagination
      },
      'time-tracking-report.json'
    );
  };

  const dailyTimeBreakdown = summaryData?.dailyTimeBreakdown || [];
  const timeByLessonType = summaryData?.timeByLessonType || [];
  const summary = summaryData?.summary;

  const dailyTimeChartData = useMemo(
    () => ({
      labels: dailyTimeBreakdown.map((d) => formatDateDisplay(d.date)),
      datasets: [
        {
          label: 'Time Spent (Hours)',
          data: dailyTimeBreakdown.map((d) => d.totalTimeSpentHours),
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 2,
          fill: true
        }
      ]
    }),
    [dailyTimeBreakdown]
  );

  const lessonTypeChartData = useMemo(
    () => ({
      labels: timeByLessonType.map((t) => t.lessonType),
      datasets: [
        {
          label: 'Time Spent (Hours)',
          data: timeByLessonType.map((t) => t.totalTimeSpentHours),
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(251, 146, 60, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(244, 63, 94, 0.8)'
          ]
        }
      ]
    }),
    [timeByLessonType]
  );

  if (loading && !summaryData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading report...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !summaryData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-error bg-error p-4">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/reports')}
            className="mb-4 inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <ArrowLeftIcon className="mr-1 h-5 w-5" />
            Back to Reports
          </button>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Time Tracking & Engagement Report</h1>
          <p className="text-gray-600">Comprehensive analytics on time spent by learners across courses and lessons</p>
        </div>

        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Filters</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleApplyFilters}
                className="w-full rounded-md bg-[#2afeae] px-4 py-2 text-[#1b365d] hover:bg-superadmin-btn-hover"
              >
                Apply Filters
              </button>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleExportCSV}
                disabled={activeTab === 'summary'}
                className="flex-1 rounded-md bg-[#2afeae] px-4 py-2 text-sm text-[#1b365d] hover:bg-superadmin-btn-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="flex-1 rounded-md bg-[#1b365d] px-4 py-2 text-sm text-white hover:bg-[#234a7a]"
              >
                Export JSON
              </button>
            </div>
          </div>
        </div>

        {summary && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-4">
              <div className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Time Spent</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{summary.totalTimeSpentHours}h</p>
                  </div>
                  <ClockIcon className="h-12 w-12 text-blue-500" />
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Unique Learners</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{summary.totalUniqueLearners}</p>
                  </div>
                  <UserGroupIcon className="h-12 w-12 text-green-500" />
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Courses Accessed</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{summary.totalCoursesAccessed}</p>
                  </div>
                  <AcademicCapIcon className="h-12 w-12 text-purple-500" />
                </div>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Lessons Accessed</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{summary.totalLessonsAccessed}</p>
                  </div>
                  <BookOpenIcon className="h-12 w-12 text-orange-500" />
                </div>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-lg bg-white p-6 shadow">
                <p className="text-sm font-medium text-gray-600">Avg Time Per Learner</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{summary.averageTimePerLearnerHours}h</p>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <p className="text-sm font-medium text-gray-600">Avg Time Per Course</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{summary.averageTimePerCourseHours}h</p>
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <p className="text-sm font-medium text-gray-600">Avg Time Per Lesson</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{summary.averageTimePerLessonMinutes} min</p>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-semibold">Daily Time Spent</h3>
                <Line data={dailyTimeChartData} options={{ responsive: true, maintainAspectRatio: true }} />
              </div>

              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-semibold">Time by Lesson Type</h3>
                <Doughnut data={lessonTypeChartData} options={{ responsive: true, maintainAspectRatio: true }} />
              </div>
            </div>
          </>
        )}

        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {TABLE_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setPageNumber(1);
                  }}
                  className={`px-1 py-4 text-sm font-medium capitalize ${
                    activeTab === tab
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

            {activeTab === 'summary' && summary && (
              <div className="space-y-4">
                <div className="rounded-lg border border-[#2afeae] bg-info p-4">
                  <h4 className="mb-2 font-semibold text-blue-900">Key Insights</h4>
                  <ul className="list-inside list-disc space-y-1 text-blue-800">
                    <li>Most Active Day: <strong>{formatDateDisplay(summary.mostActiveDay)}</strong> ({summary.peakActivityHours}h)</li>
                    <li>Most Time-Consuming Course: <strong>{summary.mostTimeConsuming}</strong></li>
                    <li>Average time per learner: <strong>{summary.averageTimePerLearnerHours} hours</strong></li>
                  </ul>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <h4 className="mb-2 font-semibold">Time by Lesson Type</h4>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Type</th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Hours</th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Avg/Lesson</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {timeByLessonType.map((type) => (
                          <tr key={type.lessonType}>
                            <td className="px-4 py-2 text-sm">{type.lessonType}</td>
                            <td className="px-4 py-2 text-right text-sm">{type.totalTimeSpentHours}h</td>
                            <td className="px-4 py-2 text-right text-sm">{type.averageTimePerLessonMinutes} min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab !== 'summary' && (
              <>
                {tableLoading && <p className="mb-3 text-sm text-gray-500">Loading table data...</p>}
                <div className="overflow-x-auto">
                  {activeTab === 'users' && (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className={`${headerButtonClass} text-left`}>
                            <button onClick={() => handleSort('userName')} className="inline-flex items-center gap-1">User {renderSort('userName')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-left`}>
                            <button onClick={() => handleSort('email')} className="inline-flex items-center gap-1">Email {renderSort('email')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('totalTimeSpentHours')} className="inline-flex items-center gap-1">Total Hours {renderSort('totalTimeSpentHours')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('coursesAccessed')} className="inline-flex items-center gap-1">Courses {renderSort('coursesAccessed')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('lessonsAccessed')} className="inline-flex items-center gap-1">Lessons {renderSort('lessonsAccessed')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('averageSessionMinutes')} className="inline-flex items-center gap-1">Avg Session {renderSort('averageSessionMinutes')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('activeDays')} className="inline-flex items-center gap-1">Active Days {renderSort('activeDays')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-left`}>
                            <button onClick={() => handleSort('lastActivityDate')} className="inline-flex items-center gap-1">Last Activity {renderSort('lastActivityDate')}</button>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {tableRows.map((user) => (
                          <tr key={user.userId}>
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{user.userName}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{user.email}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{user.totalTimeSpentHours}h</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{user.coursesAccessed}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{user.lessonsAccessed}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{user.averageSessionMinutes} min</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{user.activeDays}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{formatDateDisplay(user.lastActivityDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {activeTab === 'courses' && (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className={`${headerButtonClass} text-left`}>
                            <button onClick={() => handleSort('courseTitle')} className="inline-flex items-center gap-1">Course {renderSort('courseTitle')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('totalTimeSpentHours')} className="inline-flex items-center gap-1">Total Hours {renderSort('totalTimeSpentHours')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('uniqueLearners')} className="inline-flex items-center gap-1">Learners {renderSort('uniqueLearners')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('averageTimePerLearnerMinutes')} className="inline-flex items-center gap-1">Avg/Learner {renderSort('averageTimePerLearnerMinutes')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('totalLessons')} className="inline-flex items-center gap-1">Lessons {renderSort('totalLessons')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('completedLessons')} className="inline-flex items-center gap-1">Completed {renderSort('completedLessons')}</button>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {tableRows.map((course) => (
                          <tr key={course.courseId || course.courseTitle}>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{course.courseTitle}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{course.totalTimeSpentHours}h</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{course.uniqueLearners}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{course.averageTimePerLearnerMinutes} min</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{course.totalLessons}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{course.completedLessons}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {activeTab === 'lessons' && (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className={`${headerButtonClass} text-left`}>
                            <button onClick={() => handleSort('lessonTitle')} className="inline-flex items-center gap-1">Lesson {renderSort('lessonTitle')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-left`}>
                            <button onClick={() => handleSort('lessonType')} className="inline-flex items-center gap-1">Type {renderSort('lessonType')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-left`}>
                            <button onClick={() => handleSort('courseTitle')} className="inline-flex items-center gap-1">Course {renderSort('courseTitle')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('totalTimeSpentHours')} className="inline-flex items-center gap-1">Total Hours {renderSort('totalTimeSpentHours')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('uniqueLearners')} className="inline-flex items-center gap-1">Learners {renderSort('uniqueLearners')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('averageTimePerLearnerMinutes')} className="inline-flex items-center gap-1">Avg Time {renderSort('averageTimePerLearnerMinutes')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('completionRate')} className="inline-flex items-center gap-1">Completion % {renderSort('completionRate')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('videoBookmarkCount')} className="inline-flex items-center gap-1">Bookmarks {renderSort('videoBookmarkCount')}</button>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {tableRows.map((lesson) => (
                          <tr key={lesson.lessonId || `${lesson.lessonTitle}-${lesson.courseId}`}>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{lesson.lessonTitle}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{lesson.lessonType}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{lesson.courseTitle}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{lesson.totalTimeSpentHours}h</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{lesson.uniqueLearners}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{lesson.averageTimePerLearnerMinutes} min</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{lesson.completionRate}%</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{lesson.videoBookmarkCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {activeTab === 'daily' && (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className={`${headerButtonClass} text-left`}>
                            <button onClick={() => handleSort('date')} className="inline-flex items-center gap-1">Date {renderSort('date')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('totalTimeSpentHours')} className="inline-flex items-center gap-1">Total Hours {renderSort('totalTimeSpentHours')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('uniqueLearners')} className="inline-flex items-center gap-1">Unique Learners {renderSort('uniqueLearners')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('lessonsAccessed')} className="inline-flex items-center gap-1">Lessons Accessed {renderSort('lessonsAccessed')}</button>
                          </th>
                          <th className={`${headerButtonClass} text-right`}>
                            <button onClick={() => handleSort('coursesAccessed')} className="inline-flex items-center gap-1">Courses Accessed {renderSort('coursesAccessed')}</button>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {tableRows.map((day) => (
                          <tr key={day.date}>
                            <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{formatDateDisplay(day.date)}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{day.totalTimeSpentHours}h</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{day.uniqueLearners}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{day.lessonsAccessed}</td>
                            <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">{day.coursesAccessed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {pagination && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Page {pagination.pageNumber} of {pagination.totalPages} ({pagination.totalRows} rows)
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
                        disabled={!pagination.hasPreviousPage || tableLoading}
                        className="rounded border px-3 py-1 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPageNumber((prev) => prev + 1)}
                        disabled={!pagination.hasNextPage || tableLoading}
                        className="rounded border px-3 py-1 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
