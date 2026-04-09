import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import Pagination from '../components/Pagination';
import {
  getContentUsageReportSummary,
  getContentUsageReportContent,
  exportToCSV,
  exportToJSON
} from '../services/reports';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ChartBarIcon,
  FireIcon,
  ExclamationCircleIcon,
  EyeSlashIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

export default function ContentUsageReport() {
  const navigate = useNavigate();

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);

  const [summaryData, setSummaryData] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [pagination, setPagination] = useState({
    pageNumber: 1,
    pageSize: 25,
    totalRows: 0,
    totalPages: 1
  });

  const [filters, setFilters] = useState({
    category: '',
    startDate: '',
    endDate: ''
  });

  const [tableFilters, setTableFilters] = useState({
    search: '',
    engagement: 'all'
  });

  const [appliedFilters, setAppliedFilters] = useState({
    category: '',
    startDate: '',
    endDate: ''
  });

  const [appliedTableFilters, setAppliedTableFilters] = useState({
    search: '',
    engagement: 'all'
  });

  const [sortBy, setSortBy] = useState('usageScore');
  const [sortDirection, setSortDirection] = useState('desc');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    loadSummary(appliedFilters);
  }, []);

  useEffect(() => {
    loadTable(appliedFilters, appliedTableFilters, pageNumber, pageSize, sortBy, sortDirection);
  }, [appliedFilters, appliedTableFilters, pageNumber, pageSize, sortBy, sortDirection]);

  const loadSummary = async (requestFilters) => {
    try {
      setLoadingSummary(true);
      const data = await getContentUsageReportSummary({
        category: requestFilters.category || undefined,
        startDate: requestFilters.startDate || undefined,
        endDate: requestFilters.endDate || undefined
      });
      setSummaryData(data);
    } catch (error) {
      console.error('Failed to load content usage summary:', error);
      alert('Failed to load report summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadTable = async (requestFilters, requestTableFilters, requestedPage, requestedPageSize, requestedSortBy, requestedSortDirection) => {
    try {
      setLoadingTable(true);
      const data = await getContentUsageReportContent({
        category: requestFilters.category || undefined,
        startDate: requestFilters.startDate || undefined,
        endDate: requestFilters.endDate || undefined,
        search: requestTableFilters.search || undefined,
        engagement: requestTableFilters.engagement === 'all' ? undefined : requestTableFilters.engagement,
        pageNumber: requestedPage,
        pageSize: requestedPageSize,
        sortBy: requestedSortBy,
        sortDirection: requestedSortDirection
      });

      setTableRows(data.content || []);
      setPagination(
        data.pagination || {
          pageNumber: requestedPage,
          pageSize: requestedPageSize,
          totalRows: 0,
          totalPages: 1
        }
      );
    } catch (error) {
      console.error('Failed to load content usage table data:', error);
      alert('Failed to load content table data');
    } finally {
      setLoadingTable(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleApplyFilters = () => {
    const next = { ...filters };
    setAppliedFilters(next);
    setPageNumber(1);
    loadSummary(next);
  };

  const handleTableFilterChange = (e) => {
    setTableFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleApplyTableFilters = () => {
    setAppliedTableFilters({ ...tableFilters });
    setPageNumber(1);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
    setPageNumber(1);
  };

  const renderSortIcon = (column) => {
    if (sortBy !== column) {
      return <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUpIcon className="h-4 w-4 text-gray-700" />;
    }
    return <ChevronDownIcon className="h-4 w-4 text-gray-700" />;
  };

  const handleExportCSV = () => {
    if (!tableRows?.length) return;

    const csvData = tableRows.map(item => ({
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
    if (!summaryData) return;
    exportToJSON(
      {
        summary: summaryData.summary,
        categoryBreakdown: summaryData.categoryBreakdown,
        engagementBreakdown: summaryData.engagementBreakdown,
        topContent: summaryData.topContent,
        unusedContent: summaryData.unusedContent,
        underutilizedContent: summaryData.underutilizedContent,
        usageTrends: summaryData.usageTrends,
        content: tableRows,
        pagination
      },
      'content-usage-report'
    );
  };

  if (loadingSummary && !summaryData) {
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

  if (!summaryData) return null;

  const categories = summaryData.categoryOptions || [];

  const engagementChartData = {
    labels: summaryData.engagementBreakdown.map(e => e.level),
    datasets: [{
      data: summaryData.engagementBreakdown.map(e => e.count),
      backgroundColor: [
        'rgba(34, 197, 94, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(251, 191, 36, 0.8)',
        'rgba(156, 163, 175, 0.8)'
      ],
    }]
  };

  const categoryChartData = {
    labels: summaryData.usageTrends.map(t => t.category),
    datasets: [{
      label: 'Total Accesses',
      data: summaryData.usageTrends.map(t => t.accessCount),
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
    }]
  };

  const topContentChartData = {
    labels: summaryData.topContent.map(c => c.contentTitle.length > 20 ? c.contentTitle.substring(0, 20) + '...' : c.contentTitle),
    datasets: [{
      label: 'Access Count',
      data: summaryData.topContent.map(c => c.accessCount),
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
              {categories.map(cat => (
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
              className="w-full px-4 py-2 bg-[#2afeae] text-[#1b365d] rounded-md hover:bg-superadmin-btn-hover transition"
            >
              Apply Filters
            </button>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={handleExportCSV}
              className="flex-1 px-4 py-2 bg-[#2afeae] text-[#1b365d] rounded-md hover:bg-superadmin-btn-hover transition text-sm"
            >
              Export CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="flex-1 px-4 py-2 bg-[#1b365d] text-white rounded-md hover:bg-[#234a7a] transition text-sm"
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
              <p className="text-3xl font-bold text-gray-900">{summaryData.summary.totalContent}</p>
            </div>
            <DocumentTextIcon className="h-12 w-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Accesses</p>
              <p className="text-3xl font-bold text-gray-900">{summaryData.summary.totalAccesses}</p>
            </div>
            <ChartBarIcon className="h-12 w-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Unique Users</p>
              <p className="text-3xl font-bold text-gray-900">{summaryData.summary.totalUniqueUsers}</p>
            </div>
            <UserGroupIcon className="h-12 w-12 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Access/Content</p>
              <p className="text-3xl font-bold text-gray-900">{summaryData.summary.averageAccessPerContent}</p>
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
          <p className="text-3xl font-bold text-red-900">{summaryData.summary.unusedContent}</p>
          <p className="text-sm text-red-700 mt-1">
            {summaryData.summary.totalContent > 0 ?
              Math.round((summaryData.summary.unusedContent / summaryData.summary.totalContent) * 100) : 0}% of total
          </p>
        </div>

        <div className="bg-linear-to-r from-yellow-50 to-yellow-100 rounded-lg shadow p-6 border border-yellow-200">
          <div className="flex items-center mb-2">
            <ExclamationCircleIcon className="h-6 w-6 text-yellow-600 mr-2" />
            <h3 className="text-lg font-semibold text-yellow-900">Underutilized</h3>
          </div>
          <p className="text-3xl font-bold text-yellow-900">{summaryData.summary.underutilizedContent}</p>
          <p className="text-sm text-yellow-700 mt-1">Less than 10 accesses</p>
        </div>

        <div className="bg-linear-to-r from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
          <div className="flex items-center mb-2">
            <FireIcon className="h-6 w-6 text-green-600 mr-2" />
            <h3 className="text-lg font-semibold text-green-900">High Engagement</h3>
          </div>
          <p className="text-3xl font-bold text-green-900">{summaryData.summary.highEngagement}</p>
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
            {summaryData.categoryBreakdown.map((cat, idx) => (
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
                    <div className="text-red-600">{cat.unusedContent} unused</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unused Content List */}
      {summaryData.unusedContent.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg shadow p-6 mb-6">
          <div className="flex items-center mb-4">
            <EyeSlashIcon className="h-6 w-6 text-red-600 mr-2" />
            <h3 className="text-lg font-semibold text-red-900">Unused Content ({summaryData.unusedContent.length})</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {summaryData.unusedContent.map((item, idx) => (
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
              name="search"
              value={tableFilters.search}
              onChange={handleTableFilterChange}
              placeholder="Search by title or category..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Engagement</label>
            <select
              name="engagement"
              value={tableFilters.engagement}
              onChange={handleTableFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="None">None (Unused)</option>
            </select>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              onClick={handleApplyTableFilters}
              className="px-4 py-2 bg-[#1b365d] text-white rounded-md hover:bg-[#234a7a] transition"
            >
              Apply Table Filters
            </button>
          </div>
        </div>
      </div>

      {/* Content List Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Content Details</h3>
          <p className="text-sm text-gray-600">Showing {tableRows.length} of {pagination.totalRows || 0} items</p>
        </div>
        {loadingTable ? (
          <div className="py-12 text-center text-gray-600">Loading table data...</div>
        ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button type="button" onClick={() => handleSort('contentTitle')} className="inline-flex items-center gap-1 hover:text-gray-800">
                    Content
                    {renderSortIcon('contentTitle')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button type="button" onClick={() => handleSort('category')} className="inline-flex items-center gap-1 hover:text-gray-800">
                    Category
                    {renderSortIcon('category')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button type="button" onClick={() => handleSort('accessCount')} className="inline-flex items-center gap-1 hover:text-gray-800">
                    Accesses
                    {renderSortIcon('accessCount')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button type="button" onClick={() => handleSort('uniqueUsers')} className="inline-flex items-center gap-1 hover:text-gray-800">
                    Users
                    {renderSortIcon('uniqueUsers')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button type="button" onClick={() => handleSort('completions')} className="inline-flex items-center gap-1 hover:text-gray-800">
                    Completions
                    {renderSortIcon('completions')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button type="button" onClick={() => handleSort('engagementLevel')} className="inline-flex items-center gap-1 hover:text-gray-800">
                    Engagement
                    {renderSortIcon('engagementLevel')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button type="button" onClick={() => handleSort('lastAccessDate')} className="inline-flex items-center gap-1 hover:text-gray-800">
                    Last Access
                    {renderSortIcon('lastAccessDate')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center gap-1 hover:text-gray-800">
                    Status
                    {renderSortIcon('status')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableRows.map((item) => (
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
        )}

        <Pagination
          currentPage={pagination.pageNumber || 1}
          totalPages={pagination.totalPages || 1}
          pageSize={pagination.pageSize || pageSize}
          totalCount={pagination.totalRows || 0}
          onPageChange={(nextPage) => setPageNumber(nextPage)}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPageNumber(1);
          }}
        />
      </div>
      </div>
    </div>
  );
}
