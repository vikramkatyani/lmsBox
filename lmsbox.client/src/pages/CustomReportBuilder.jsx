import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateCustomReport, exportToCSV, exportToJSON } from '../services/reports';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  ArrowLeftIcon,
  PlayIcon,
  AdjustmentsHorizontalIcon,
  ChartBarIcon,
  TableCellsIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

export default function CustomReportBuilder() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  
  // Report configuration
  const [config, setConfig] = useState({
    entityType: 'users',
    metrics: [],
    groupBy: '',
    sortBy: '',
    sortDescending: true,
    filterBy: '',
    filterValue: '',
    startDate: '',
    endDate: '',
    limit: 100
  });

  // Available options for each entity type
  const entityTypes = [
    { value: 'users', label: 'Users', icon: '👥' },
    { value: 'courses', label: 'Courses', icon: '📚' },
    { value: 'pathways', label: 'Learning Pathways', icon: '🛤️' },
    { value: 'progress', label: 'Learning Progress', icon: '📈' }
  ];

  const metricsByEntity = {
    users: [
      { value: 'enrollments', label: 'Total Enrollments' },
      { value: 'completions', label: 'Completed Courses' },
      { value: 'averageProgress', label: 'Average Progress' },
      { value: 'engagementScore', label: 'Engagement Score' },
      { value: 'lastActivity', label: 'Last Activity Date' }
    ],
    courses: [
      { value: 'enrollments', label: 'Total Enrollments' },
      { value: 'completions', label: 'Total Completions' },
      { value: 'completionRate', label: 'Completion Rate' },
      { value: 'averageProgress', label: 'Average Progress' },
      { value: 'averageCompletionTime', label: 'Avg Completion Time' }
    ],
    pathways: [
      { value: 'enrollments', label: 'Total Enrollments' },
      { value: 'completions', label: 'Total Completions' },
      { value: 'completionRate', label: 'Completion Rate' },
      { value: 'averageProgress', label: 'Average Progress' }
    ],
    progress: [
      { value: 'timeToComplete', label: 'Time to Complete' }
    ]
  };

  const groupByOptions = {
    users: ['status', 'createdAt'],
    courses: ['category', 'createdAt'],
    pathways: ['isActive'],
    progress: ['completed', 'courseTitle']
  };

  const handleConfigChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleMetricToggle = (metric) => {
    setConfig(prev => ({
      ...prev,
      metrics: prev.metrics.includes(metric)
        ? prev.metrics.filter(m => m !== metric)
        : [...prev.metrics, metric]
    }));
  };

  const generateReport = async () => {
    if (config.metrics.length === 0) {
      alert('Please select at least one metric');
      return;
    }

    try {
      setLoading(true);
      const data = await generateCustomReport(config);
      setReportData(data);
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData?.dataPoints) return;
    exportToCSV(reportData.dataPoints, 'custom-report');
  };

  const handleExportJSON = () => {
    if (!reportData) return;
    exportToJSON(reportData, 'custom-report');
  };

  const renderVisualization = () => {
    if (!reportData?.dataPoints || reportData.dataPoints.length === 0) return null;

    // Get the first numeric metric for visualization
    const numericMetric = config.metrics.find(m => {
      const firstItem = reportData.dataPoints[0];
      return firstItem && typeof firstItem[m] === 'number';
    });

    if (!numericMetric) return null;

    // Create bar chart for top 10 items
    const top10 = reportData.dataPoints.slice(0, 10);
    const labels = top10.map(item => {
      if (item.name) return item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name;
      if (item.title) return item.title.length > 20 ? item.title.substring(0, 20) + '...' : item.title;
      if (item.email) return item.email.length > 20 ? item.email.substring(0, 20) + '...' : item.email;
      return 'Item ' + (top10.indexOf(item) + 1);
    });

    const chartData = {
      labels,
      datasets: [{
        label: numericMetric,
        data: top10.map(item => item[numericMetric] || 0),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      }]
    };

    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 by {numericMetric}</h3>
        <div className="h-80">
          <Bar
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false }
              }
            }}
          />
        </div>
      </div>
    );
  };

  const renderGroupedData = () => {
    if (!reportData?.groupedData) return null;

    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Grouped by {config.groupBy}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(reportData.groupedData).map(([key, value]) => (
            <div key={key} className="p-4 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-900 mb-2">{key}</div>
              <div className="text-2xl font-bold text-blue-600">{value.count}</div>
              <div className="text-xs text-gray-500 mt-1">items</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSummary = () => {
    if (!reportData?.summary) return null;

    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(reportData.summary).map(([key, value]) => (
            <div key={key} className="text-center">
              <div className="text-sm text-gray-600 capitalize mb-1">
                {key.replace(/_/g, ' ')}
              </div>
              <div className="text-xl font-bold text-gray-900">
                {typeof value === 'number' ? value.toFixed(2) : value}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDataTable = () => {
    if (!reportData?.dataPoints || reportData.dataPoints.length === 0) return null;

    const columns = Object.keys(reportData.dataPoints[0]);

    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Data Records</h3>
          <p className="text-sm text-gray-600">
            Showing {reportData.dataPoints.length} of {reportData.totalRecords} records
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map(col => (
                  <th
                    key={col}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.dataPoints.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {columns.map(col => (
                    <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {typeof row[col] === 'object' && row[col] !== null
                        ? JSON.stringify(row[col])
                        : String(row[col] ?? 'N/A')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/reports')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Back to Reports
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Custom Report Builder</h1>
        <p className="text-gray-600">Create custom reports by selecting entity type, metrics, and filters</p>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center mb-4">
          <AdjustmentsHorizontalIcon className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Report Configuration</h2>
        </div>

        {/* Entity Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Entity Type</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {entityTypes.map(type => (
              <button
                key={type.value}
                onClick={() => {
                  handleConfigChange('entityType', type.value);
                  handleConfigChange('metrics', []);
                  handleConfigChange('groupBy', '');
                }}
                className={`p-4 rounded-lg border-2 transition ${
                  config.entityType === type.value
                    ? 'border-[#2afeae] bg-info text-[#1b365d]'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-2xl mb-2">{type.icon}</div>
                <div className="font-medium">{type.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Metrics Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Metrics (Choose at least one)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {metricsByEntity[config.entityType]?.map(metric => (
              <label
                key={metric.value}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                  config.metrics.includes(metric.value)
                    ? 'border-[#2afeae] bg-info'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={config.metrics.includes(metric.value)}
                  onChange={() => handleMetricToggle(metric.value)}
                  className="mr-2"
                />
                <span className="text-sm">{metric.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Filters and Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={config.startDate}
              onChange={(e) => handleConfigChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={config.endDate}
              onChange={(e) => handleConfigChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Limit Results</label>
            <input
              type="number"
              value={config.limit}
              onChange={(e) => handleConfigChange('limit', parseInt(e.target.value))}
              min="10"
              max="1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Advanced Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group By</label>
            <select
              value={config.groupBy}
              onChange={(e) => handleConfigChange('groupBy', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No Grouping</option>
              {groupByOptions[config.entityType]?.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={config.sortBy}
              onChange={(e) => handleConfigChange('sortBy', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Default</option>
              {config.metrics.map(metric => (
                <option key={metric} value={metric}>{metric}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
            <select
              value={config.sortDescending ? 'desc' : 'asc'}
              onChange={(e) => handleConfigChange('sortDescending', e.target.value === 'desc')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={generateReport}
            disabled={loading || config.metrics.length === 0}
            className="inline-flex items-center px-6 py-3 bg-[#2afeae] text-[#1b365d] rounded-md hover:bg-[#25e89e] disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            <PlayIcon className="h-5 w-5 mr-2" />
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          {reportData && (
            <>
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center px-6 py-3 bg-[#2afeae] text-[#1b365d] rounded-md hover:bg-[#25e89e] transition font-medium"
              >
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Export CSV
              </button>
              <button
                onClick={handleExportJSON}
                className="inline-flex items-center px-6 py-3 bg-[#1b365d] text-white rounded-md hover:bg-[#234a7a] transition font-medium"
              >
                <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                Export JSON
              </button>
            </>
          )}
        </div>
      </div>

      {/* Report Results */}
      {reportData && (
        <>
          {/* Metadata */}
          <div className="bg-info border border-[#2afeae] rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <ChartBarIcon className="h-6 w-6 text-blue-600 mr-3 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-[#1b365d] mb-2">Report Generated</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-blue-800">
                  <div>
                    <span className="font-medium">Entity:</span> {reportData.entityType}
                  </div>
                  <div>
                    <span className="font-medium">Metrics:</span> {reportData.metrics.join(', ')}
                  </div>
                  <div>
                    <span className="font-medium">Total Records:</span> {reportData.totalRecords}
                  </div>
                  <div>
                    <span className="font-medium">Generated:</span>{' '}
                    {new Date(reportData.generatedAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Statistics */}
          {renderSummary()}

          {/* Grouped Data */}
          {renderGroupedData()}

          {/* Visualization */}
          {renderVisualization()}

          {/* Data Table */}
          {renderDataTable()}
        </>
      )}

      {/* Empty State */}
      {!reportData && !loading && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <TableCellsIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Report Generated Yet</h3>
          <p className="text-gray-600 mb-4">
            Configure your report settings above and click "Generate Report" to see results
          </p>
        </div>
      )}
    </div>
  );
}
