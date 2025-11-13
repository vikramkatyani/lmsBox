import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import { getPathwayProgressReport, exportToCSV, exportToJSON } from '../services/reports';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { 
  ArrowLeftIcon,
  MapIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  UserGroupIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';

export default function PathwayProgressReport() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    activeOnly: true
  });

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await getPathwayProgressReport(
        filters.startDate || undefined,
        filters.endDate || undefined,
        filters.activeOnly
      );
      setReportData(data);
    } catch (error) {
      console.error('Error fetching pathway progress report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleApplyFilters = () => {
    fetchReport();
  };

  const handleExportCSV = () => {
    if (!reportData?.pathways) return;
    
    const csvData = reportData.pathways.map(pathway => ({
      'Pathway Title': pathway.pathwayTitle,
      'Status': pathway.isActive ? 'Active' : 'Inactive',
      'Courses': pathway.courseCount,
      'Total Enrollments': pathway.totalEnrollments,
      'Completed': pathway.completions,
      'In Progress': pathway.inProgress,
      'Not Started': pathway.notStarted,
      'Completion Rate': `${pathway.completionRate}%`,
      'Avg Progress': `${pathway.averageProgress}%`,
      'Avg Completion Time (days)': pathway.averageCompletionTime,
      'Engagement Level': pathway.engagementLevel
    }));
    
    exportToCSV(csvData, 'pathway-progress-report');
  };

  const handleExportJSON = () => {
    if (!reportData) return;
    exportToJSON(reportData, 'pathway-progress-report');
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

  // Chart configurations
  const completionTrendsChart = {
    labels: reportData.completionTrends.map(t => t.month),
    datasets: [{
      label: 'Completions',
      data: reportData.completionTrends.map(t => t.completions),
      borderColor: 'rgb(99, 102, 241)',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      tension: 0.3,
      fill: true
    }]
  };

  const engagementBreakdownChart = {
    labels: reportData.engagementBreakdown.map(e => e.level),
    datasets: [{
      data: reportData.engagementBreakdown.map(e => e.count),
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',   // Excellent - green
        'rgba(59, 130, 246, 0.8)',  // Good - blue
        'rgba(251, 191, 36, 0.8)',  // Fair - yellow
        'rgba(239, 68, 68, 0.8)',   // Poor - red
        'rgba(156, 163, 175, 0.8)'  // No Data - gray
      ],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  const topPathwaysChart = {
    labels: reportData.topPathways.map(p => p.pathwayTitle.substring(0, 30)),
    datasets: [{
      label: 'Completion Rate %',
      data: reportData.topPathways.map(p => p.completionRate),
      backgroundColor: 'rgba(34, 197, 94, 0.8)',
      borderColor: 'rgba(34, 197, 94, 1)',
      borderWidth: 1
    }]
  };

  const getEngagementBadgeColor = (level) => {
    switch (level) {
      case 'Excellent': return 'bg-green-100 text-green-800';
      case 'Good': return 'bg-blue-100 text-blue-800';
      case 'Fair': return 'bg-yellow-100 text-yellow-800';
      case 'Poor': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Pathway Progress Report</h1>
        <p className="text-gray-600">Track learning pathway enrollments, completions, and engagement metrics</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filters</label>
            <label className="flex items-center space-x-2 cursor-pointer px-3 py-2">
              <input
                type="checkbox"
                name="activeOnly"
                checked={filters.activeOnly}
                onChange={handleFilterChange}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Active Only</span>
            </label>
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
              <p className="text-sm text-gray-600 mb-1">Total Pathways</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.totalPathways}</p>
              <p className="text-xs text-gray-500 mt-1">{reportData.summary.activePathways} active</p>
            </div>
            <MapIcon className="h-12 w-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Enrollments</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.totalEnrollments}</p>
              <p className="text-xs text-gray-500 mt-1">{reportData.summary.totalInProgress} in progress</p>
            </div>
            <UserGroupIcon className="h-12 w-12 text-indigo-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Completion Rate</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.averageCompletionRate}%</p>
              <p className="text-xs text-gray-500 mt-1">{reportData.summary.totalCompletions} completions</p>
            </div>
            <CheckCircleIcon className="h-12 w-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Completion Time</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.averageCompletionTime}</p>
              <p className="text-xs text-gray-500 mt-1">days</p>
            </div>
            <ClockIcon className="h-12 w-12 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-2">
            <AcademicCapIcon className="h-5 w-5 text-green-600 mr-2" />
            <p className="text-sm font-medium text-gray-600">Most Successful</p>
          </div>
          <p className="text-lg font-semibold text-gray-900">{reportData.summary.mostSuccessfulPathway}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-2">
            <ChartBarIcon className="h-5 w-5 text-blue-600 mr-2" />
            <p className="text-sm font-medium text-gray-600">Most Popular</p>
          </div>
          <p className="text-lg font-semibold text-gray-900">{reportData.summary.mostPopularPathway}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-2">
            <MapIcon className="h-5 w-5 text-gray-600 mr-2" />
            <p className="text-sm font-medium text-gray-600">No Enrollments</p>
          </div>
          <p className="text-lg font-semibold text-gray-900">{reportData.summary.pathwaysWithNoEnrollments} pathways</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Completion Trends */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Completion Trends (6 Months)</h3>
          <div className="h-64">
            <Line 
              data={completionTrendsChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  y: { 
                    beginAtZero: true,
                    ticks: { precision: 0 }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Engagement Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Distribution</h3>
          <div className="h-64 flex items-center justify-center">
            <Doughnut 
              data={engagementBreakdownChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { padding: 15, boxWidth: 12 }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Top Performing Pathways */}
      {reportData.topPathways.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Pathways (by Completion Rate)</h3>
          <div className="h-64">
            <Bar 
              data={topPathwaysChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  x: { 
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                      callback: (value) => value + '%'
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Popular and Struggling Pathways */}
      {(reportData.popularPathways.length > 0 || reportData.strugglingPathways.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Popular Pathways */}
          {reportData.popularPathways.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Pathways</h3>
              <div className="space-y-3">
                {reportData.popularPathways.map((pathway, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                    <div className="font-medium text-gray-900 mb-2">{pathway.pathwayTitle}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                      <div>📚 {pathway.courseCount} courses</div>
                      <div>👥 {pathway.totalEnrollments} enrolled</div>
                      <div>✅ {pathway.completionRate}% completion</div>
                      <div>⏱️ {pathway.averageCompletionTime} days avg</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Struggling Pathways */}
          {reportData.strugglingPathways.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Struggling Pathways (Needs Attention)</h3>
              <div className="space-y-3">
                {reportData.strugglingPathways.map((pathway, index) => (
                  <div key={index} className="border border-red-200 bg-red-50 rounded-lg p-4">
                    <div className="font-medium text-gray-900 mb-2">{pathway.pathwayTitle}</div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                      <div>👥 {pathway.totalEnrollments} enrolled</div>
                      <div>❌ {pathway.completionRate}% completion</div>
                      <div className="col-span-2 text-red-600 font-medium">
                        🚨 {pathway.dropoutRate}% dropout rate
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detailed Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Pathways</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pathway
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Courses
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Enrollments
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completion Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Engagement
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.pathways.map((pathway, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{pathway.pathwayTitle}</div>
                    {pathway.description && (
                      <div className="text-xs text-gray-500 mt-1">{pathway.description.substring(0, 60)}...</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      pathway.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {pathway.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {pathway.courseCount}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{pathway.totalEnrollments}</div>
                    <div className="text-xs text-gray-500">
                      {pathway.recentEnrollments} recent (30d)
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs space-y-1">
                      <div className="text-green-600">✓ {pathway.completions} completed</div>
                      <div className="text-blue-600">⟳ {pathway.inProgress} in progress</div>
                      <div className="text-gray-600">○ {pathway.notStarted} not started</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{pathway.completionRate}%</div>
                    <div className="text-xs text-gray-500">
                      {pathway.averageProgress}% avg progress
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {pathway.averageCompletionTime > 0 ? `${pathway.averageCompletionTime} days` : 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      getEngagementBadgeColor(pathway.engagementLevel)
                    }`}>
                      {pathway.engagementLevel}
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
