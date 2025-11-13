import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import { getContentUsageReport, exportToCSV, exportToJSON } from '../services/reports';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ChartBarIcon,
  FireIcon,
  ExclamationCircleIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';

export default function ContentUsageReport() {
  const navigate = useNavigate();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
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
      const data = await getContentUsageReport(filters);
      setReportData(data);
    } catch (error) {
      console.error('Failed to load content usage report:', error);
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
    if (!reportData?.content) return;
    
    const csvData = reportData.content.map(item => ({
      'Content Title': item.contentTitle,
      'Category': item.category,
      'Type': item.contentType,
      'Access Count': item.accessCount,
      'Unique Users': item.uniqueUsers,
      'Completions': item.completions,
      'Completion Rate': `${item.completionRate}%`,
      'Avg Progress': `${item.averageProgress}%`,
      'Engagement': item.engagementLevel,
      'Lessons': item.lessonCount,
      'Last Access': item.lastAccessDate || 'N/A',
      'Days Since Access': item.daysSinceLastAccess || 'N/A',
      'Status': item.isUnused ? 'Unused' : 'Active'
    }));
    
    exportToCSV(csvData, 'content-usage-report.csv');
  };

  const handleExportJSON = () => {
    if (!reportData) return;
    exportToJSON(reportData, 'content-usage-report.json');
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

  // Filter content
  const filteredContent = reportData.content.filter(item => {
    const matchesSearch = item.contentTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEngagement = engagementFilter === 'all' || item.engagementLevel === engagementFilter;
    return matchesSearch && matchesEngagement;
  });

  // Get unique categories
  const categories = ['all', ...new Set(reportData.content.map(c => c.category))];

  // Engagement chart
  const engagementChartData = {
    labels: reportData.engagementBreakdown.map(e => e.level),
    datasets: [{
      data: reportData.engagementBreakdown.map(e => e.count),
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',   // High
        'rgba(59, 130, 246, 0.8)',  // Medium
        'rgba(251, 191, 36, 0.8)',  // Low
        'rgba(156, 163, 175, 0.8)'  // None
      ],
    }]
  };

  // Category usage trends chart
  const categoryChartData = {
    labels: reportData.usageTrends.map(t => t.category),
    datasets: [{
      label: 'Total Accesses',
      data: reportData.usageTrends.map(t => t.accessCount),
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
    }]
  };

  // Top content chart
  const topContentChartData = {
    labels: reportData.topContent.map(c => c.contentTitle.length > 20 ? c.contentTitle.substring(0, 20) + '...' : c.contentTitle),
    datasets: [{
      label: 'Access Count',
      data: reportData.topContent.map(c => c.accessCount),
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Usage Report</h1>
        <p className="text-gray-600">Track content access patterns, identify unused content, and measure engagement</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.filter(c => c !== 'all').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
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
              <p className="text-sm text-gray-600 mb-1">Total Content</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.totalContent}</p>
            </div>
            <DocumentTextIcon className="h-12 w-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Accesses</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.totalAccesses}</p>
            </div>
            <ChartBarIcon className="h-12 w-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Unique Users</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.totalUniqueUsers}</p>
            </div>
            <UserGroupIcon className="h-12 w-12 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Access/Content</p>
              <p className="text-3xl font-bold text-gray-900">{reportData.summary.averageAccessPerContent}</p>
            </div>
            <FireIcon className="h-12 w-12 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Usage Issues Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-linear-to-r from-red-50 to-red-100 rounded-lg shadow p-6 border border-red-200">
          <div className="flex items-center mb-2">
            <EyeSlashIcon className="h-6 w-6 text-red-600 mr-2" />
            <h3 className="text-lg font-semibold text-red-900">Unused Content</h3>
          </div>
          <p className="text-3xl font-bold text-red-900">{reportData.summary.unusedContent}</p>
          <p className="text-sm text-red-700 mt-1">
            {reportData.summary.totalContent > 0 ? 
              Math.round((reportData.summary.unusedContent / reportData.summary.totalContent) * 100) : 0}% of total
          </p>
        </div>

        <div className="bg-linear-to-r from-yellow-50 to-yellow-100 rounded-lg shadow p-6 border border-yellow-200">
          <div className="flex items-center mb-2">
            <ExclamationCircleIcon className="h-6 w-6 text-yellow-600 mr-2" />
            <h3 className="text-lg font-semibold text-yellow-900">Underutilized</h3>
          </div>
          <p className="text-3xl font-bold text-yellow-900">{reportData.summary.underutilizedContent}</p>
          <p className="text-sm text-yellow-700 mt-1">Less than 10 accesses</p>
        </div>

        <div className="bg-linear-to-r from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
          <div className="flex items-center mb-2">
            <FireIcon className="h-6 w-6 text-green-600 mr-2" />
            <h3 className="text-lg font-semibold text-green-900">High Engagement</h3>
          </div>
          <p className="text-3xl font-bold text-green-900">{reportData.summary.highEngagement}</p>
          <p className="text-sm text-green-700 mt-1">Over 100 accesses</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Most Accessed Content</h3>
          <div className="h-80">
            <Bar
              data={topContentChartData}
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage by Category</h3>
          <div className="h-80">
            <Bar
              data={categoryChartData}
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h3>
          <div className="space-y-3 overflow-y-auto max-h-80">
            {reportData.categoryBreakdown.map((cat, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-gray-900">{cat.category}</span>
                  <span className="text-sm font-semibold text-blue-600">{cat.totalAccesses} accesses</span>
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>{cat.contentCount} items</span>
                    <span>{cat.totalUsers} users</span>
                  </div>
                  {cat.unusedContent > 0 && (
                    <div className="text-red-600">⚠️ {cat.unusedContent} unused</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unused Content List */}
      {reportData.unusedContent.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg shadow p-6 mb-6">
          <div className="flex items-center mb-4">
            <EyeSlashIcon className="h-6 w-6 text-red-600 mr-2" />
            <h3 className="text-lg font-semibold text-red-900">Unused Content ({reportData.unusedContent.length})</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reportData.unusedContent.map((item, idx) => (
              <div key={idx} className="bg-white p-3 rounded border border-red-200">
                <div className="font-medium text-gray-900">{item.contentTitle}</div>
                <div className="text-sm text-gray-600">{item.category} • {item.lessonCount} lessons</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters for Content List */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Content</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or category..."
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
              <option value="None">None (Unused)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content List Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Content Details</h3>
          <p className="text-sm text-gray-600">Showing {filteredContent.length} of {reportData.content.length} items</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accesses</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engagement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Access</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredContent.map((item) => (
                <tr key={item.contentId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{item.contentTitle}</div>
                    <div className="text-xs text-gray-500">{item.lessonCount} lessons</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    {item.accessCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.uniqueUsers}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.completions}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      item.engagementLevel === 'High' ? 'bg-green-100 text-green-800' :
                      item.engagementLevel === 'Medium' ? 'bg-blue-100 text-blue-800' :
                      item.engagementLevel === 'Low' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.engagementLevel}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.lastAccessDate ? (
                      <div>
                        <div>{new Date(item.lastAccessDate).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">{item.daysSinceLastAccess} days ago</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">Never</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.isUnused ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        Unused
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    )}
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
