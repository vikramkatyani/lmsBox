import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import { getPathwayAssignmentsReport, exportToCSV, exportToJSON } from '../services/reports';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { 
  ArrowLeftIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ClockIcon,
  MapIcon,
  ChartBarIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

export default function PathwayAssignmentsReport() {
  const navigate = useNavigate();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    pathwayId: '',
    activeOnly: true
  });
  const [selectedPathway, setSelectedPathway] = useState(null);
  const [showUserDetails, setShowUserDetails] = useState(false);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      const data = await getPathwayAssignmentsReport(
        filters.pathwayId || undefined,
        filters.activeOnly
      );
      setReportData(data);
      setSelectedPathway(null);
      setShowUserDetails(false);
    } catch (error) {
      console.error('Failed to load pathway assignments report:', error);
      alert('Failed to load report data');
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
    loadReport();
  };

  const handleExportCSV = () => {
    if (!reportData?.pathways) return;
    
    const csvData = reportData.pathways.flatMap(pathway =>
      pathway.userAssignments.map(user => ({
        'Pathway': pathway.pathwayTitle,
        'User Name': user.userName,
        'Email': user.email,
        'Enrolled Date': new Date(user.enrolledAt).toLocaleDateString(),
        'Status': user.status,
        'Progress': `${user.progressPercent}%`,
        'Completed Date': user.completedAt ? new Date(user.completedAt).toLocaleDateString() : 'N/A'
      }))
    );
    
    exportToCSV(csvData, 'pathway-assignments-report');
  };

  const handleExportJSON = () => {
    if (!reportData) return;
    exportToJSON(reportData, 'pathway-assignments-report');
  };

  const handleViewUsers = (pathway) => {
    setSelectedPathway(pathway);
    setShowUserDetails(true);
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

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Not Started': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Chart configurations
  const assignmentTrendsChart = {
    labels: reportData.assignmentTrends?.map(t => t.month) || [],
    datasets: [{
      label: 'Assignments',
      data: reportData.assignmentTrends?.map(t => t.assignments) || [],
      borderColor: 'rgb(99, 102, 241)',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      tension: 0.3,
      fill: true
    }]
  };

  const statusDistributionChart = {
    labels: ['Completed', 'In Progress', 'Not Started'],
    datasets: [{
      data: [
        reportData.summary?.totalCompleted || 0,
        reportData.summary?.totalInProgress || 0,
        reportData.summary?.totalNotStarted || 0
      ],
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(156, 163, 175, 0.8)'
      ],
      borderWidth: 2,
      borderColor: '#fff'
    }]
  };

  const topAssignedChart = {
    labels: reportData.topAssigned?.map(p => p.pathwayTitle.substring(0, 30)) || [],
    datasets: [{
      label: 'Assigned Users',
      data: reportData.topAssigned?.map(p => p.assignedUsers) || [],
      backgroundColor: 'rgba(99, 102, 241, 0.8)',
      borderColor: 'rgba(99, 102, 241, 1)',
      borderWidth: 1
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Pathway Assignments Report</h1>
        <p className="text-gray-600">Track which pathways are assigned to users and monitor their progress</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Pathway</label>
            <select
              name="pathwayId"
              value={filters.pathwayId}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Pathways</option>
              {reportData?.pathways?.map(p => (
                <option key={p.pathwayId} value={p.pathwayId}>{p.pathwayTitle}</option>
              ))}
            </select>
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
              <p className="text-sm text-gray-600 mb-1">Total Assignments</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary?.totalAssignments || 0}</p>
              <p className="text-xs text-gray-500 mt-1">{reportData.summary?.recentAssignments || 0} recent (30d)</p>
            </div>
            <UserGroupIcon className="h-12 w-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Pathways</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary?.totalPathways || 0}</p>
              <p className="text-xs text-gray-500 mt-1">{reportData.summary?.activePathways || 0} active</p>
            </div>
            <MapIcon className="h-12 w-12 text-indigo-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completed</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary?.totalCompleted || 0}</p>
              <p className="text-xs text-gray-500 mt-1">{reportData.summary?.averageCompletionRate || 0}% avg rate</p>
            </div>
            <CheckCircleIcon className="h-12 w-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">In Progress</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary?.totalInProgress || 0}</p>
              <p className="text-xs text-gray-500 mt-1">{reportData.summary?.totalNotStarted || 0} not started</p>
            </div>
            <ClockIcon className="h-12 w-12 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-2">
            <ChartBarIcon className="h-5 w-5 text-blue-600 mr-2" />
            <p className="text-sm font-medium text-gray-600">Most Assigned Pathway</p>
          </div>
          <p className="text-lg font-semibold text-gray-900">{reportData.summary?.mostAssignedPathway || 'N/A'}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-2">
            <ExclamationCircleIcon className="h-5 w-5 text-yellow-600 mr-2" />
            <p className="text-sm font-medium text-gray-600">Unassigned Pathways</p>
          </div>
          <p className="text-lg font-semibold text-gray-900">{reportData.summary?.unassignedPathwaysCount || 0} pathways</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Assignment Trends */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment Trends (6 Months)</h3>
          <div className="h-64">
            <Line 
              data={assignmentTrendsChart}
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

        {/* Status Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution</h3>
          <div className="h-64 flex items-center justify-center">
            <Doughnut 
              data={statusDistributionChart}
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

      {/* Top Assigned Pathways */}
      {reportData.topAssigned && reportData.topAssigned.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Assigned Pathways</h3>
          <div className="h-64">
            <Bar 
              data={topAssignedChart}
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
                    ticks: { precision: 0 }
                  }
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Unassigned Pathways */}
      {reportData.unassignedPathways && reportData.unassignedPathways.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Unassigned Pathways</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reportData.unassignedPathways.map((pathway, index) => (
              <div key={index} className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                <div className="font-medium text-gray-900">{pathway.pathwayTitle}</div>
                <div className="text-sm text-gray-600 mt-2">
                  Status: <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    pathway.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {pathway.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pathways Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Pathway Assignments</h3>
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
                  Assigned Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completion Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recent (30d)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.pathways && reportData.pathways.map((pathway, index) => (
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
                    {pathway.assignedUsers}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs space-y-1">
                      <div className="text-green-600">✓ {pathway.completed} completed</div>
                      <div className="text-blue-600">⟳ {pathway.inProgress} in progress</div>
                      <div className="text-gray-600">○ {pathway.notStarted} not started</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{pathway.completionRate}%</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${pathway.completionRate}%` }}
                      ></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {pathway.recentAssignments}
                  </td>
                  <td className="px-6 py-4">
                    {pathway.assignedUsers > 0 && (
                      <button
                        onClick={() => handleViewUsers(pathway)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Users
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Modal */}
      {showUserDetails && selectedPathway && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Users Assigned to: {selectedPathway.pathwayTitle}
              </h3>
              <button
                onClick={() => setShowUserDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enrolled</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedPathway.userAssignments && selectedPathway.userAssignments.map((user, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{user.userName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(user.enrolledAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <span className="text-sm text-gray-900 mr-2">{user.progressPercent}%</span>
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${user.progressPercent}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            getStatusBadgeColor(user.status)
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {user.completedAt ? new Date(user.completedAt).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
