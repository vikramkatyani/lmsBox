import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import Pagination from '../components/Pagination';
import {
  getPathwayProgressReportSummary,
  getPathwayProgressReportPathways,
  exportToCSV,
  exportToJSON
} from '../services/reports';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  ArrowLeftIcon,
  MapIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  UserGroupIcon,
  AcademicCapIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

export default function PathwayProgressReport() {
  const navigate = useNavigate();

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);

  const [summaryData, setSummaryData] = useState(null);
  const [pathways, setPathways] = useState([]);
  const [pagination, setPagination] = useState({
    pageNumber: 1,
    pageSize: 25,
    totalPathways: 0,
    totalPages: 1
  });

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    activeOnly: true
  });
  const [appliedFilters, setAppliedFilters] = useState({
    startDate: '',
    endDate: '',
    activeOnly: true
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [sortBy, setSortBy] = useState('totalEnrollments');
  const [sortDirection, setSortDirection] = useState('desc');

  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    const initialize = async () => {
      await fetchSummary(appliedFilters);
    };

    initialize();
  }, []);

  useEffect(() => {
    fetchPathways(appliedFilters, pageNumber, pageSize, sortBy, sortDirection, appliedSearch);
  }, [appliedFilters, pageNumber, pageSize, sortBy, sortDirection, appliedSearch]);

  const fetchSummary = async (requestFilters) => {
    try {
      setLoadingSummary(true);
      const data = await getPathwayProgressReportSummary({
        startDate: requestFilters.startDate || undefined,
        endDate: requestFilters.endDate || undefined,
        activeOnly: requestFilters.activeOnly
      });
      setSummaryData(data);
    } catch (error) {
      console.error('Error fetching pathway progress summary:', error);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchPathways = async (
    requestFilters,
    requestedPageNumber,
    requestedPageSize,
    requestedSortBy,
    requestedSortDirection,
    requestedSearch
  ) => {
    try {
      setLoadingTable(true);
      const data = await getPathwayProgressReportPathways({
        startDate: requestFilters.startDate || undefined,
        endDate: requestFilters.endDate || undefined,
        activeOnly: requestFilters.activeOnly,
        pageNumber: requestedPageNumber,
        pageSize: requestedPageSize,
        sortBy: requestedSortBy,
        sortDirection: requestedSortDirection,
        search: requestedSearch || undefined
      });

      setPathways(data.pathways || []);
      setPagination(
        data.pagination || {
          pageNumber: requestedPageNumber,
          pageSize: requestedPageSize,
          totalPathways: 0,
          totalPages: 1
        }
      );
    } catch (error) {
      console.error('Error fetching pathway progress pathways:', error);
    } finally {
      setLoadingTable(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleApplyFilters = () => {
    const nextFilters = { ...filters };
    setAppliedFilters(nextFilters);
    setPageNumber(1);
    fetchSummary(nextFilters);
  };

  const handleApplySearch = () => {
    setAppliedSearch(searchTerm.trim());
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
    if (!pathways?.length) return;

    const csvData = pathways.map((pathway) => ({
      'Pathway Title': pathway.pathwayTitle,
      Status: pathway.isActive ? 'Active' : 'Inactive',
      Courses: pathway.courseCount,
      'Total Enrollments': pathway.totalEnrollments,
      Completed: pathway.completions,
      'In Progress': pathway.inProgress,
      'Not Started': pathway.notStarted,
      'Completion Rate': `${pathway.completionRate}%`,
      'Avg Progress': `${pathway.averageProgress}%`,
      'Avg Completion Time (days)': pathway.averageCompletionTime,
      'Engagement Level': pathway.engagementLevel,
      'Recent Enrollments (30d)': pathway.recentEnrollments
    }));

    exportToCSV(csvData, 'pathway-progress-report');
  };

  const handleExportJSON = () => {
    if (!summaryData) return;

    exportToJSON(
      {
        summary: summaryData.summary,
        completionTrends: summaryData.completionTrends,
        engagementBreakdown: summaryData.engagementBreakdown,
        topPathways: summaryData.topPathways,
        popularPathways: summaryData.popularPathways,
        strugglingPathways: summaryData.strugglingPathways,
        pathways,
        pagination
      },
      'pathway-progress-report'
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

  const summary = summaryData.summary;
  const completionTrends = summaryData.completionTrends || [];
  const engagementBreakdown = summaryData.engagementBreakdown || [];
  const topPathways = summaryData.topPathways || [];
  const popularPathways = summaryData.popularPathways || [];
  const strugglingPathways = summaryData.strugglingPathways || [];

  const completionTrendsChart = {
    labels: completionTrends.map((t) => t.month),
    datasets: [
      {
        label: 'Completions',
        data: completionTrends.map((t) => t.completions),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.3,
        fill: true
      }
    ]
  };

  const engagementBreakdownChart = {
    labels: engagementBreakdown.map((e) => e.level),
    datasets: [
      {
        data: engagementBreakdown.map((e) => e.count),
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(156, 163, 175, 0.8)'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }
    ]
  };

  const topPathwaysChart = {
    labels: topPathways.map((p) => p.pathwayTitle.substring(0, 30)),
    datasets: [
      {
        label: 'Completion Rate %',
        data: topPathways.map((p) => p.completionRate),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1
      }
    ]
  };

  const getEngagementBadgeColor = (level) => {
    switch (level) {
      case 'Excellent':
        return 'bg-green-100 text-green-800';
      case 'Good':
        return 'bg-blue-100 text-blue-800';
      case 'Fair':
        return 'bg-yellow-100 text-yellow-800';
      case 'Poor':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const sortableColumns = [
    { key: 'pathwayTitle', label: 'Pathway' },
    { key: 'isActive', label: 'Status' },
    { key: 'courseCount', label: 'Courses' },
    { key: 'totalEnrollments', label: 'Enrollments' },
    { key: 'completions', label: 'Completed' },
    { key: 'inProgress', label: 'In Progress' },
    { key: 'notStarted', label: 'Not Started' },
    { key: 'completionRate', label: 'Completion Rate' },
    { key: 'averageProgress', label: 'Avg Progress' },
    { key: 'averageCompletionTime', label: 'Avg Time' },
    { key: 'engagementLevel', label: 'Engagement' },
    { key: 'recentEnrollments', label: 'Recent (30d)' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                disabled={loadingSummary || loadingTable}
                className="w-full px-4 py-2 bg-[#2afeae] text-[#1b365d] rounded-md hover:bg-superadmin-btn-hover disabled:opacity-50 transition"
              >
                {loadingSummary ? 'Loading...' : 'Apply Filters'}
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

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Pathways</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by title, description, engagement"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleApplySearch}
                  className="px-4 py-2 bg-[#1b365d] text-white rounded-md hover:bg-[#234a7a]"
                >
                  Search
                </button>
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setAppliedSearch('');
                  setPageNumber(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Clear Search
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Pathways</p>
                <p className="text-3xl font-bold text-gray-900">{summary.totalPathways}</p>
                <p className="text-xs text-gray-500 mt-1">{summary.activePathways} active</p>
              </div>
              <MapIcon className="h-12 w-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Enrollments</p>
                <p className="text-3xl font-bold text-gray-900">{summary.totalEnrollments}</p>
                <p className="text-xs text-gray-500 mt-1">{summary.totalInProgress} in progress</p>
              </div>
              <UserGroupIcon className="h-12 w-12 text-indigo-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg Completion Rate</p>
                <p className="text-3xl font-bold text-gray-900">{summary.averageCompletionRate}%</p>
                <p className="text-xs text-gray-500 mt-1">{summary.totalCompletions} completions</p>
              </div>
              <CheckCircleIcon className="h-12 w-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg Completion Time</p>
                <p className="text-3xl font-bold text-gray-900">{summary.averageCompletionTime}</p>
                <p className="text-xs text-gray-500 mt-1">days</p>
              </div>
              <ClockIcon className="h-12 w-12 text-orange-500" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-2">
              <AcademicCapIcon className="h-5 w-5 text-green-600 mr-2" />
              <p className="text-sm font-medium text-gray-600">Most Successful</p>
            </div>
            <p className="text-lg font-semibold text-gray-900">{summary.mostSuccessfulPathway}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-2">
              <ChartBarIcon className="h-5 w-5 text-blue-600 mr-2" />
              <p className="text-sm font-medium text-gray-600">Most Popular</p>
            </div>
            <p className="text-lg font-semibold text-gray-900">{summary.mostPopularPathway}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-2">
              <MapIcon className="h-5 w-5 text-gray-600 mr-2" />
              <p className="text-sm font-medium text-gray-600">No Enrollments</p>
            </div>
            <p className="text-lg font-semibold text-gray-900">{summary.pathwaysWithNoEnrollments} pathways</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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

        {topPathways.length > 0 && (
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

        {(popularPathways.length > 0 || strugglingPathways.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {popularPathways.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Pathways</h3>
                <div className="space-y-3">
                  {popularPathways.map((pathway, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                      <div className="font-medium text-gray-900 mb-2">{pathway.pathwayTitle}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>{pathway.courseCount} courses</div>
                        <div>{pathway.totalEnrollments} enrolled</div>
                        <div>{pathway.completionRate}% completion</div>
                        <div>{pathway.averageCompletionTime} days avg</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {strugglingPathways.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Struggling Pathways (Needs Attention)</h3>
                <div className="space-y-3">
                  {strugglingPathways.map((pathway, index) => (
                    <div key={index} className="border border-red-200 bg-red-50 rounded-lg p-4">
                      <div className="font-medium text-gray-900 mb-2">{pathway.pathwayTitle}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>{pathway.totalEnrollments} enrolled</div>
                        <div>{pathway.completionRate}% completion</div>
                        <div className="col-span-2 text-red-600 font-medium">{pathway.dropoutRate}% dropout rate</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">All Pathways</h3>
            {loadingTable && <p className="text-sm text-gray-500">Refreshing table data...</p>}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {sortableColumns.map((column) => (
                    <th key={column.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => handleSort(column.key)}
                        className="inline-flex items-center gap-1 hover:text-gray-800"
                      >
                        {column.label}
                        {renderSortIcon(column.key)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {!loadingTable &&
                  pathways.map((pathway, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{pathway.pathwayTitle}</div>
                        {pathway.description && (
                          <div className="text-xs text-gray-500 mt-1">{pathway.description.substring(0, 60)}...</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            pathway.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {pathway.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{pathway.courseCount}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{pathway.totalEnrollments}</td>
                      <td className="px-6 py-4 text-sm text-green-700">{pathway.completions}</td>
                      <td className="px-6 py-4 text-sm text-blue-700">{pathway.inProgress}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{pathway.notStarted}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{pathway.completionRate}%</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{pathway.averageProgress}%</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {pathway.averageCompletionTime > 0 ? `${pathway.averageCompletionTime} days` : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEngagementBadgeColor(
                            pathway.engagementLevel
                          )}`}
                        >
                          {pathway.engagementLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{pathway.recentEnrollments}</td>
                    </tr>
                  ))}
                {loadingTable && (
                  <tr>
                    <td colSpan={12} className="px-6 py-8 text-center text-sm text-gray-500">
                      Loading pathways table...
                    </td>
                  </tr>
                )}
                {!loadingTable && pathways.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-6 py-8 text-center text-sm text-gray-500">
                      No pathways found for current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={pagination.pageNumber || pageNumber}
            totalPages={pagination.totalPages || 1}
            pageSize={pagination.pageSize || pageSize}
            totalCount={pagination.totalPathways || 0}
            onPageChange={(page) => setPageNumber(page)}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPageNumber(1);
            }}
          />
        </div>
      </div>
    </div>
  );
}
