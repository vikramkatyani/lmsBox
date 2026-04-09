import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import AdminHeader from '../components/AdminHeader';
import Pagination from '../components/Pagination';
import usePageTitle from '../hooks/usePageTitle';
import { engagementAnalyticsService } from '../services/engagementAnalytics';
import toast from 'react-hot-toast';
import { 
  UserGroupIcon, 
  ArrowTrendingUpIcon, 
  AcademicCapIcon, 
  ClockIcon,
  FireIcon,
  PlusCircleIcon,
  CloudArrowUpIcon,
  UsersIcon,
  ArrowLeftIcon,
  ChevronUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function EngagementAnalytics() {
  usePageTitle('Engagement Analytics');
  const [dateRange, setDateRange] = useState('30days');
  const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });
  const [appliedRange, setAppliedRange] = useState(() => getRangeFromSelection('30days', { startDate: '', endDate: '' }));
  const [overview, setOverview] = useState(null);
  const [dailyScores, setDailyScores] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [eventBreakdown, setEventBreakdown] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);

  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(20);
  const [tableSort, setTableSort] = useState({ column: 'engagementScore', direction: 'desc' });
  const [tablePagination, setTablePagination] = useState({
    pageNumber: 1,
    pageSize: 20,
    totalUsers: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false
  });

  useEffect(() => {
    if (dateRange !== 'custom') {
      setAppliedRange(getRangeFromSelection(dateRange, customDates));
      setTablePage(1);
    }
  }, [dateRange]);

  useEffect(() => {
    loadSummary(appliedRange);
  }, [appliedRange]);

  useEffect(() => {
    loadTopUsersTable(appliedRange, tablePage, tablePageSize, tableSort.column, tableSort.direction);
  }, [appliedRange, tablePage, tablePageSize, tableSort]);

  const loadSummary = async (range) => {
    setSummaryLoading(true);
    try {
      const [overviewData, scoresData, breakdownData] = await Promise.all([
        engagementAnalyticsService.getOverview(range.fromDate, range.toDate),
        engagementAnalyticsService.getDailyScores(range.fromDate, range.toDate),
        engagementAnalyticsService.getEventBreakdown(range.fromDate, range.toDate)
      ]);

      // Fill in missing days with zero data
      const allDaysData = [];
      const dataMap = new Map(scoresData.map(s => [new Date(s.date).toDateString(), s]));

      const currentDate = new Date(range.fromDate);
      while (currentDate <= range.toDate) {
        const dateStr = currentDate.toDateString();
        if (dataMap.has(dateStr)) {
          allDaysData.push(dataMap.get(dateStr));
        } else {
          allDaysData.push({
            date: new Date(currentDate).toISOString(),
            engagementScore: 0,
            learnerScore: 0,
            adminScore: 0,
            totalEvents: 0,
            activeUsers: 0
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      setOverview(overviewData);
      setDailyScores(allDaysData);
      setEventBreakdown(breakdownData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error('Failed to load engagement analytics');
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadTopUsersTable = async (range, pageNumber, pageSize, sortBy, sortDirection) => {
    setTableLoading(true);
    try {
      const response = await engagementAnalyticsService.getTopUsersTable({
        fromDate: range.fromDate,
        toDate: range.toDate,
        pageNumber,
        pageSize,
        sortBy,
        sortDirection
      });

      setTopUsers(response.users || []);
      setTablePagination(response.pagination || {
        pageNumber,
        pageSize,
        totalUsers: 0,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false
      });
    } catch (error) {
      console.error('Failed to load top users table:', error);
      toast.error('Failed to load top users table');
    } finally {
      setTableLoading(false);
    }
  };

  const applyCustomRange = () => {
    if (!customDates.startDate || !customDates.endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    const nextRange = getRangeFromSelection('custom', customDates);
    if (nextRange.toDate < nextRange.fromDate) {
      toast.error('End date must be after start date');
      return;
    }

    setAppliedRange(nextRange);
    setTablePage(1);
  };

  const handleSort = (column) => {
    setTablePage(1);
    setTableSort(prev => {
      if (prev.column === column) {
        return {
          column,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        };
      }

      return {
        column,
        direction: 'desc'
      };
    });
  };

  const SortIcon = ({ column }) => {
    if (tableSort.column !== column) {
      return <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />;
    }

    return tableSort.direction === 'asc'
      ? <ArrowUpIcon className="h-4 w-4 text-[#1b365d]" />
      : <ArrowDownIcon className="h-4 w-4 text-[#1b365d]" />;
  };

  const renderSortableHeader = (label, column, alignRight = false) => (
    <button
      type="button"
      onClick={() => handleSort(column)}
      className={`inline-flex items-center gap-1 font-semibold text-gray-700 hover:text-[#1b365d] ${alignRight ? 'ml-auto' : ''}`}
    >
      {label}
      <SortIcon column={column} />
    </button>
  );

  const engagementScoreChartData = {
    labels: dailyScores.map(s => new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Total Engagement',
        data: dailyScores.map(s => s.engagementScore),
        borderColor: '#2afeae',
        backgroundColor: 'rgba(42, 254, 174, 0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'Learner Activity',
        data: dailyScores.map(s => s.learnerScore),
        borderColor: '#1b365d',
        backgroundColor: 'rgba(27, 54, 93, 0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5
      },
      {
        label: 'Admin Activity',
        data: dailyScores.map(s => s.adminScore),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5
      }
    ]
  };

  const eventBreakdownChartData = eventBreakdown ? {
    labels: Object.keys(eventBreakdown).map(key => 
      key.replace(/([A-Z])/g, ' $1').trim()
    ),
    datasets: [{
      data: Object.values(eventBreakdown),
      backgroundColor: [
        '#2afeae',
        '#1b365d',
        '#f59e0b',
        '#ef4444',
        '#8b5cf6',
        '#ec4899',
        '#14b8a6',
        '#f97316',
        '#10b981',
        '#6366f1'
      ],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };

  if (summaryLoading && !overview) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2afeae]"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Back Button */}
          <Link
            to="/admin/reports"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Reports
          </Link>

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FireIcon className="w-8 h-8 text-[#2afeae]" />
                Engagement Analytics
              </h1>
              <p className="text-sm text-gray-600 mt-1">Track learner and admin activity across your organization</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2afeae] focus:border-[#2afeae]"
              >
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>

          {/* Custom Date Range Inputs */}
          {dateRange === 'custom' && (
            <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customDates.startDate}
                    onChange={(e) => setCustomDates({ ...customDates, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2afeae] focus:border-[#2afeae]"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customDates.endDate}
                    onChange={(e) => setCustomDates({ ...customDates, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2afeae] focus:border-[#2afeae]"
                  />
                </div>
                <div className="pt-6">
                  <button
                    onClick={applyCustomRange}
                    disabled={summaryLoading || !customDates.startDate || !customDates.endDate}
                    className="px-6 py-2 bg-[#2afeae] text-[#1b365d] rounded-lg hover:bg-superadmin-btn-hover disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    {summaryLoading ? 'Loading...' : 'Apply'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Overview Cards */}
          {overview && (
            <>
              {/* Primary Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-[#1b365d]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <UserGroupIcon className="w-4 h-4" />
                    Active Users
                  </div>
                  <div className="text-3xl font-bold text-[#1b365d] mt-1">{overview.activeUsers}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-[#2afeae]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <ArrowTrendingUpIcon className="w-4 h-4" />
                    Avg. Engagement Score
                  </div>
                  <div className="text-3xl font-bold text-[#2afeae] mt-1">
                    {overview.averageEngagementScore.toFixed(0)}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <AcademicCapIcon className="w-4 h-4" />
                    Lessons Completed
                  </div>
                  <div className="text-3xl font-bold text-green-500 mt-1">{overview.totalLessonsCompleted}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-600">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <ClockIcon className="w-4 h-4" />
                    Avg. Session (min)
                  </div>
                  <div className="text-3xl font-bold text-purple-600 mt-1">
                    {overview.averageSessionDuration.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Activity Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-linear-to-br from-purple-50 to-purple-100 p-6 rounded-lg shadow border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-purple-700 flex items-center gap-2">
                    <PlusCircleIcon className="w-4 h-4" />
                    Courses Created
                  </div>
                  <div className="text-3xl font-bold text-purple-800 mt-1">{overview.totalCoursesCreated}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-linear-to-br from-blue-50 to-blue-100 p-6 rounded-lg shadow border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-blue-700 flex items-center gap-2">
                    <PlusCircleIcon className="w-4 h-4" />
                    Lessons Created
                  </div>
                  <div className="text-3xl font-bold text-blue-800 mt-1">{overview.totalLessonsCreated}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-linear-to-br from-amber-50 to-amber-100 p-6 rounded-lg shadow border border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-amber-700 flex items-center gap-2">
                    <CloudArrowUpIcon className="w-4 h-4" />
                    Content Uploads
                  </div>
                  <div className="text-3xl font-bold text-amber-800 mt-1">{overview.totalContentUploads}</div>
                </div>
              </div>
            </div>
            
            <div className="bg-linear-to-br from-pink-50 to-pink-100 p-6 rounded-lg shadow border border-pink-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-pink-700 flex items-center gap-2">
                    <UsersIcon className="w-4 h-4" />
                    Users Added
                  </div>
                  <div className="text-3xl font-bold text-pink-800 mt-1">{overview.totalUsersAdded}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

          {/* Engagement Score Trend with Breakdown */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <FireIcon className="w-5 h-5 text-[#2afeae]" />
              Daily Engagement Score Breakdown
            </h2>
            <Line data={engagementScoreChartData} options={chartOptions} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Event Breakdown */}
            {eventBreakdownChartData && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-semibold mb-4">Event Distribution</h2>
                <div className="max-w-md mx-auto">
                  <Doughnut data={eventBreakdownChartData} />
                </div>
              </div>
            )}

            {/* Top Engaged Users Table */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Most Engaged Users</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-gray-500">{renderSortableHeader('Name', 'name')}</th>
                      <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-gray-500">{renderSortableHeader('Email', 'email')}</th>
                      <th className="px-3 py-2 text-left text-xs uppercase tracking-wider text-gray-500">{renderSortableHeader('Role', 'role')}</th>
                      <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-gray-500">{renderSortableHeader('Score', 'engagementScore', true)}</th>
                      <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-gray-500">{renderSortableHeader('Events', 'totalEvents', true)}</th>
                      <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-gray-500">{renderSortableHeader('Login Days', 'loginDays', true)}</th>
                      <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-gray-500">{renderSortableHeader('Completions', 'lessonsCompleted', true)}</th>
                      <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-gray-500">{renderSortableHeader('Courses Created', 'coursesCreated', true)}</th>
                      <th className="px-3 py-2 text-right text-xs uppercase tracking-wider text-gray-500">{renderSortableHeader('Last Activity', 'lastActivity', true)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {tableLoading && (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">Loading table data...</td>
                      </tr>
                    )}
                    {!tableLoading && topUsers.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">No user activity found for this range.</td>
                      </tr>
                    )}
                    {!tableLoading && topUsers.map((user) => (
                      <tr key={user.userId}>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">{user.userName || 'Unknown User'}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">{user.email || '-'}</td>
                        <td className="px-3 py-2 text-sm">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            user.userRole === 'Admin' ? 'bg-purple-100 text-purple-700' :
                            user.userRole === 'Both' ? 'bg-blue-100 text-blue-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {user.userRole}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-right font-semibold text-[#1b365d]">{Number(user.engagementScore || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-700">{user.totalEvents}</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-700">{user.loginDays}</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-700">{user.lessonsCompleted}</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-700">{user.coursesCreated}</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-700">{formatDateDisplay(user.lastActivity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={tablePagination.pageNumber || tablePage}
                totalPages={tablePagination.totalPages || 1}
                pageSize={tablePagination.pageSize || tablePageSize}
                totalCount={tablePagination.totalUsers || 0}
                onPageChange={(page) => setTablePage(page)}
                onPageSizeChange={(size) => {
                  setTablePageSize(size);
                  setTablePage(1);
                }}
              />
            </div>
          </div>

          {/* Detailed Stats */}
          {overview && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Detailed Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-600">Total Events</div>
              <div className="text-2xl font-bold text-blue-700">{overview.totalEvents}</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-green-600">Total Logins</div>
              <div className="text-2xl font-bold text-green-700">{overview.totalLogins}</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-purple-600">Course Views</div>
              <div className="text-2xl font-bold text-purple-700">{overview.totalCourseViews}</div>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <div className="text-sm text-amber-600">Quiz Attempts</div>
                <div className="text-2xl font-bold text-amber-700">{overview.totalQuizAttempts}</div>
              </div>
              <div className="p-4 bg-pink-50 rounded-lg">
                <div className="text-sm text-pink-600">AI Queries</div>
                <div className="text-2xl font-bold text-pink-700">{overview.totalAIQueries}</div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function getRangeFromSelection(rangeSelection, customDates) {
  if (rangeSelection === 'custom') {
    const fromDate = new Date(customDates.startDate);
    const toDate = new Date(customDates.endDate);
    toDate.setHours(23, 59, 59, 999);
    return { fromDate, toDate };
  }

  const days = rangeSelection === '7days' ? 7 : rangeSelection === '30days' ? 30 : 90;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const toDate = new Date();
  return { fromDate, toDate };
}

function formatDateDisplay(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date).replace(/\s+/g, '-');
}