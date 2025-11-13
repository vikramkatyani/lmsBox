import React, { useEffect, useState } from 'react';
import AdminHeader from '../components/AdminHeader';
import usePageTitle from '../hooks/usePageTitle';
import { getDashboardStats } from '../services/dashboard';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
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

export default function AdminDashboard() {
  usePageTitle('Admin Dashboard');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getDashboardStats()
      .then(data => {
        setStats(data);
        setError(null);
      })
      .catch(err => {
        console.error('Dashboard stats error:', err);
        setError('Failed to load dashboard stats');
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Prepare chart data
  const completionChartData = stats?.completionHistory ? {
    labels: stats.completionHistory.map(d => d.date),
    datasets: [{
      label: 'Course Completions',
      data: stats.completionHistory.map(d => d.count),
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4
    }]
  } : null;

  const registrationChartData = stats?.registrationHistory ? {
    labels: stats.registrationHistory.map(d => d.date),
    datasets: [{
      label: 'New Users',
      data: stats.registrationHistory.map(d => d.count),
      backgroundColor: 'rgba(34, 197, 94, 0.8)',
      borderColor: 'rgb(34, 197, 94)',
      borderWidth: 1
    }]
  } : null;

  const userStatusData = stats ? {
    labels: ['Active', 'Inactive', 'Suspended'],
    datasets: [{
      data: [stats.activeUsers || 0, stats.inactiveUsers || 0, stats.suspendedUsers || 0],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(156, 163, 175, 0.8)',
        'rgba(239, 68, 68, 0.8)'
      ],
      borderColor: [
        'rgb(34, 197, 94)',
        'rgb(156, 163, 175)',
        'rgb(239, 68, 68)'
      ],
      borderWidth: 1
    }]
  } : null;

  const courseStatusData = stats ? {
    labels: ['Active', 'Archived'],
    datasets: [{
      data: [stats.activeCourses || 0, stats.archivedCourses || 0],
      backgroundColor: [
        'rgba(59, 130, 246, 0.8)',
        'rgba(156, 163, 175, 0.8)'
      ],
      borderColor: [
        'rgb(59, 130, 246)',
        'rgb(156, 163, 175)'
      ],
      borderWidth: 1
    }]
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top'
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Primary Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="shrink-0">
                <svg className="h-12 w-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Users</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? <span className="animate-pulse text-gray-300">...</span> : (stats?.totalUsers ?? '--')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="shrink-0">
                <svg className="h-12 w-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Courses</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? <span className="animate-pulse text-gray-300">...</span> : (stats?.totalCourses ?? '--')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="shrink-0">
                <svg className="h-12 w-12 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Learning Pathways</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? <span className="animate-pulse text-gray-300">...</span> : (stats?.totalPathways ?? '--')}
                </p>
                {/* <p className="text-xs text-gray-500 mt-1">
                  {stats?.activePathways ?? '--'} active
                </p> */}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="shrink-0">
                <svg className="h-12 w-12 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Lessons</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? <span className="animate-pulse text-gray-300">...</span> : (stats?.totalEnrollments ?? '--')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats?.completedEnrollments ?? '--'} completed, {stats?.inProgressEnrollments ?? '--'} in progress
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         {/* <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Assignments</p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">
                  {loading ? <span className="animate-pulse text-gray-300">...</span> : (stats?.assignmentsTotal ?? '--')}
                </p>
                <div className="mt-2 text-xs text-gray-600">
                  <span className="text-green-600 font-semibold">{stats?.assignmentsCompleted ?? 0}</span> completed,{' '}
                  <span className="text-orange-600 font-semibold">{stats?.assignmentsPending ?? 0}</span> pending
                </div>
              </div>
              <svg className="h-10 w-10 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Quizzes</p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">
                  {loading ? <span className="animate-pulse text-gray-300">...</span> : (stats?.totalQuizzes ?? '--')}
                </p>
              </div>
              <svg className="h-10 w-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div> */}

          {/* <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">User Groups</p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">
                  {loading ? <span className="animate-pulse text-gray-300">...</span> : (stats?.totalGroups ?? '--')}
                </p>
              </div>
              <svg className="h-10 w-10 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div> */}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Completion Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Course Completions (Last 12 Months)</h2>
            <div style={{ height: '250px' }}>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-gray-400 animate-pulse">Loading chart...</span>
                </div>
              ) : completionChartData ? (
                <Line data={completionChartData} options={chartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No data available
                </div>
              )}
            </div>
          </div>

          {/* Registration Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">User Registrations (Last 12 Months)</h2>
            <div style={{ height: '250px' }}>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-gray-400 animate-pulse">Loading chart...</span>
                </div>
              ) : registrationChartData ? (
                <Bar data={registrationChartData} options={chartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No data available
                </div>
              )}
            </div>
          </div>

          {/* User Status Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">User Status Distribution</h2>
            <div style={{ height: '250px' }}>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-gray-400 animate-pulse">Loading chart...</span>
                </div>
              ) : userStatusData ? (
                <Doughnut data={userStatusData} options={chartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No data available
                </div>
              )}
            </div>
          </div>

          {/* Course Status Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Course Status Distribution</h2>
            <div style={{ height: '250px' }}>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <span className="text-gray-400 animate-pulse">Loading chart...</span>
                </div>
              ) : courseStatusData ? (
                <Doughnut data={courseStatusData} options={chartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No data available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="p-6">
            <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {loading ? (
                <li className="py-2 text-gray-300 text-center animate-pulse">Loading...</li>
              ) : (!stats || !stats.recentActivities || stats.recentActivities.length === 0) ? (
                <li className="py-2 text-gray-400 text-center">No recent activities.</li>
              ) : (
                stats.recentActivities.map((act, idx) => (
                  <li key={idx} className="py-2 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2"></span>
                    <span className="text-sm text-gray-700">{act.text}</span>
                    <span className="ml-auto text-xs text-gray-400">{act.date}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
