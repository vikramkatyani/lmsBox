import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import usePageTitle from '../hooks/usePageTitle';
import { getUserProgressReport, exportToCSV, exportToJSON } from '../services/reports';
import { Bar, Line } from 'react-chartjs-2';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  XMarkIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  ClockIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline';

export default function UserProgressReport() {
  usePageTitle('User Progress Report');
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getUserProgressReport({
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined
      });
      setData(result);
    } catch (err) {
      console.error('Error fetching user progress report:', err);
      setError(err.response?.data?.error || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleApplyFilters = () => {
    fetchReport();
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: ''
    });
  };

  const handleExportCSV = () => {
    if (data?.users) {
      const exportData = data.users.map(u => ({
        Name: u.name,
        Email: u.email,
        'Courses Enrolled': u.coursesEnrolled,
        'Courses Completed': u.coursesCompleted,
        'Courses In Progress': u.coursesInProgress,
        'Overall Progress': u.overallProgress + '%',
        'Avg Completion Time (Days)': u.averageCompletionTime,
        'Learning Velocity (Courses/Month)': u.learningVelocity
      }));
      exportToCSV(exportData, 'user_progress_report');
    }
  };

  const handleExportJSON = () => {
    if (data) {
      exportToJSON(data, 'user_progress_report');
    }
  };

  // Prepare chart data
  const topLearnersData = data?.users ? {
    labels: data.users
      .sort((a, b) => b.coursesCompleted - a.coursesCompleted)
      .slice(0, 10)
      .map(u => u.name.split(' ')[0]),
    datasets: [{
      label: 'Courses Completed',
      data: data.users
        .sort((a, b) => b.coursesCompleted - a.coursesCompleted)
        .slice(0, 10)
        .map(u => u.coursesCompleted),
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
      borderColor: 'rgb(59, 130, 246)',
      borderWidth: 1
    }]
  } : null;

  const progressDistributionData = data?.users ? {
    labels: ['0-25%', '26-50%', '51-75%', '76-100%'],
    datasets: [{
      label: 'Number of Users',
      data: [
        data.users.filter(u => u.overallProgress <= 25).length,
        data.users.filter(u => u.overallProgress > 25 && u.overallProgress <= 50).length,
        data.users.filter(u => u.overallProgress > 50 && u.overallProgress <= 75).length,
        data.users.filter(u => u.overallProgress > 75).length
      ],
      backgroundColor: [
        'rgba(239, 68, 68, 0.8)',
        'rgba(251, 191, 36, 0.8)',
        'rgba(34, 197, 94, 0.8)',
        'rgba(59, 130, 246, 0.8)'
      ],
      borderColor: [
        'rgb(239, 68, 68)',
        'rgb(251, 191, 36)',
        'rgb(34, 197, 94)',
        'rgb(59, 130, 246)'
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

  const getProgressColor = (progress) => {
    if (progress >= 75) return 'text-blue-600 bg-blue-100';
    if (progress >= 50) return 'text-green-600 bg-green-100';
    if (progress >= 25) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getProgressBarColor = (progress) => {
    if (progress >= 75) return 'bg-[#2afeae]';
    if (progress >= 50) return 'bg-[#2afeae]';
    if (progress >= 25) return 'bg-yellow-600';
    return 'bg-red-600';
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Progress Report</h1>
          <p className="text-gray-600">View individual user progress across all courses and learning pathways</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!data?.users}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export CSV
          </button>
          <button
            onClick={handleExportJSON}
            disabled={!data}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export JSON
          </button>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#2afeae] hover:bg-[#25e89e] disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh Report'}
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleApplyFilters}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#2afeae] hover:bg-[#25e89e]"
              >
                Apply Filters
              </button>
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading report data...</p>
            </div>
          </div>
        )}

        {/* Report Content */}
        {!loading && data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <AcademicCapIcon className="h-10 w-10 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Learners</p>
                    <p className="text-2xl font-semibold text-gray-900">{data.summary.totalLearners}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <CheckCircleIcon className="h-10 w-10 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Completions</p>
                    <p className="text-2xl font-semibold text-gray-900">{data.summary.totalCompletions}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <ClockIcon className="h-10 w-10 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Avg Progress</p>
                    <p className="text-2xl font-semibold text-gray-900">{data.summary.averageProgress}%</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <ClockIcon className="h-10 w-10 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Avg Completion</p>
                    <p className="text-2xl font-semibold text-gray-900">{data.summary.averageCompletionTime}d</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <RocketLaunchIcon className="h-10 w-10 text-indigo-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Avg Velocity</p>
                    <p className="text-2xl font-semibold text-gray-900">{data.summary.averageLearningVelocity}</p>
                    <p className="text-xs text-gray-500">courses/month</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Learners by Completions</h3>
                <div style={{ height: '300px' }}>
                  {topLearnersData && <Bar data={topLearnersData} options={chartOptions} />}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress Distribution</h3>
                <div style={{ height: '300px' }}>
                  {progressDistributionData && <Bar data={progressDistributionData} options={chartOptions} />}
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">User Details ({data.users.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enrolled</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">In Progress</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall Progress</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Time (Days)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Velocity</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.users.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                          No users found matching the criteria
                        </td>
                      </tr>
                    ) : (
                      data.users.map((user) => (
                        <tr key={user.userId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {user.coursesEnrolled}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {user.coursesCompleted}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              {user.coursesInProgress}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                                <div
                                  className={`h-2 rounded-full ${getProgressBarColor(user.overallProgress)}`}
                                  style={{ width: `${user.overallProgress}%` }}
                                ></div>
                              </div>
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${getProgressColor(user.overallProgress)}`}>
                                {user.overallProgress}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {user.averageCompletionTime}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="font-medium">{user.learningVelocity}</span>
                            <span className="text-xs text-gray-500 ml-1">c/m</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
