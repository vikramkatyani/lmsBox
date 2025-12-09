import { useState, useEffect } from 'react';
import { HardDrive, RefreshCw, ArrowLeft, FileText, Image, Video, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import StorageUsageWidget from '../components/StorageUsageWidget';
import usePageTitle from '../hooks/usePageTitle';
import { storageService } from '../services/storage';
import toast from 'react-hot-toast';

export default function StorageReport() {
  usePageTitle('Storage Report');
  const navigate = useNavigate();
  const [storageInfo, setStorageInfo] = useState(null);
  const [storageFiles, setStorageFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadStorageData();
  }, []);

  const loadStorageData = async () => {
    try {
      setLoading(true);
      const [usageData, filesData] = await Promise.all([
        storageService.getStorageUsage(),
        storageService.getStorageFiles()
      ]);
      setStorageInfo(usageData);
      setStorageFiles(filesData || []);
    } catch (err) {
      console.error('Error loading storage data:', err);
      toast.error('Failed to load storage data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStorageData();
    setRefreshing(false);
    toast.success('Storage data refreshed');
  };

  // Filter files based on category, type, and search term
  const filteredFiles = storageFiles.filter(file => {
    const matchesCategory = filterCategory === 'all' || file.category === filterCategory;
    const matchesType = filterType === 'all' || file.fileType === filterType;
    const matchesSearch = searchTerm === '' || 
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.path.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesType && matchesSearch;
  });

  // Get file type icon
  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'video':
        return <Video className="h-5 w-5 text-blue-500" />;
      case 'document':
        return <FileText className="h-5 w-5 text-red-500" />;
      case 'image':
        return <Image className="h-5 w-5 text-green-500" />;
      case 'scorm':
        return <Package className="h-5 w-5 text-purple-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
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
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Reports
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HardDrive className="w-8 h-8 text-indigo-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Storage Report</h1>
                <p className="text-gray-600 mt-1">Monitor your Azure storage consumption and quota usage</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-[#2afeae] text-[#1b365d] rounded-lg hover:bg-[#25e89e] disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'files'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Files ({storageFiles.length})
            </button>
          </nav>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        ) : activeTab === 'overview' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Storage Widget */}
            <div className="lg:col-span-2">
              <StorageUsageWidget compact={false} />
            </div>

            {/* Storage Stats */}
            <div className="space-y-6">
              {/* Quota Info */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quota Details</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Allocated Storage</p>
                    <p className="text-2xl font-bold text-gray-900">{storageInfo?.allocatedGB} GB</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Storage Used</p>
                    <p className="text-2xl font-bold text-indigo-600">{storageInfo?.usedGB} GB</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Available Storage</p>
                    <p className="text-2xl font-bold text-green-600">{storageInfo?.availableGB} GB</p>
                  </div>
                </div>
              </div>

              {/* Upgrade Info */}
              {storageInfo && storageInfo.usagePercentage >= 70 && (
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg shadow p-6 border border-indigo-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Need More Space?</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Contact support to upgrade your storage quota and get more space for your content.
                  </p>
                  <button className="w-full px-4 py-2 bg-[#1b365d] text-white rounded-lg hover:bg-[#234a7a] transition-colors">
                    Contact Support
                  </button>
                </div>
              )}
            </div>

            {/* Storage Breakdown */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Breakdown by Type</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Course Content */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Course Content</h4>
                      <span className="text-sm text-gray-500">
                        {storageInfo && storageInfo.usedGB > 0 ? ((storageInfo.contentUsedGB / storageInfo.usedGB) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-indigo-600 mb-2">
                      {storageInfo?.contentUsedGB || 0} GB
                    </p>
                    <p className="text-sm text-gray-600">
                      Includes lessons, SCORM packages, documents, videos, and HTML content
                    </p>
                  </div>

                  {/* Branding & Media */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Branding & Media</h4>
                      <span className="text-sm text-gray-500">
                        {storageInfo && storageInfo.usedGB > 0 ? ((storageInfo.brandingUsedGB / storageInfo.usedGB) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-purple-600 mb-2">
                      {storageInfo?.brandingUsedGB || 0} GB
                    </p>
                    <p className="text-sm text-gray-600">
                      Includes course banners, logos, favicons, and branding assets
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips & Best Practices */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tips to Manage Storage</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">📹 Optimize Videos</h4>
                    <p className="text-sm text-gray-600">
                      Compress videos before uploading. Use formats like MP4 with H.264 codec for best compatibility.
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">🗑️ Remove Old Content</h4>
                    <p className="text-sm text-gray-600">
                      Archive or delete outdated courses and unused materials to free up space.
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">🖼️ Optimize Images</h4>
                    <p className="text-sm text-gray-600">
                      Use compressed images (WebP, JPEG) and appropriate resolutions for course banners.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Files Tab */
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">All Categories</option>
                    <option value="branding">Branding</option>
                    <option value="content">Content</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">File Type</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">All Types</option>
                    <option value="video">Video</option>
                    <option value="document">Document</option>
                    <option value="image">Image</option>
                    <option value="scorm">SCORM</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Files Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        File Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Added On
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredFiles.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center">
                          <div className="text-gray-500">
                            <FileText className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                            <p className="text-sm font-medium">No files found</p>
                            <p className="text-xs mt-1">Try adjusting your filters or search term</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredFiles.map((file, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {getFileIcon(file.fileType)}
                              <div className="max-w-md">
                                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                                <p className="text-xs text-gray-500 truncate">{file.path}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                              {file.fileType}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                              file.category === 'branding' 
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {file.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatBytes(file.size)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {file.lastModified ? new Date(file.lastModified).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'N/A'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {filteredFiles.length > 0 && (
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Showing {filteredFiles.length} of {storageFiles.length} files
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}
