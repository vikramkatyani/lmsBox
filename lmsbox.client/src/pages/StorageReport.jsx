import { useState, useEffect } from 'react';
import { HardDrive, RefreshCw, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import StorageUsageWidget from '../components/StorageUsageWidget';
import usePageTitle from '../hooks/usePageTitle';
import { storageService } from '../services/storage';

export default function StorageReport() {
  usePageTitle('Storage Report');
  const navigate = useNavigate();
  const [storageInfo, setStorageInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStorageData();
  }, []);

  const loadStorageData = async () => {
    try {
      setLoading(true);
      const data = await storageService.getStorageUsage();
      setStorageInfo(data);
    } catch (err) {
      console.error('Error loading storage data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStorageData();
    setRefreshing(false);
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

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        ) : (
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
                    <p className="text-2xl font-bold text-gray-900">{storageInfo?.allocatedFormatted}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Storage Used</p>
                    <p className="text-2xl font-bold text-indigo-600">{storageInfo?.usedFormatted}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Available Storage</p>
                    <p className="text-2xl font-bold text-green-600">{storageInfo?.availableFormatted}</p>
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
                        {storageInfo && ((storageInfo.contentUsedBytes / storageInfo.usedBytes) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-indigo-600 mb-2">
                      {formatBytes(storageInfo?.contentUsedBytes || 0)}
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
                        {storageInfo && ((storageInfo.brandingUsedBytes / storageInfo.usedBytes) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-purple-600 mb-2">
                      {formatBytes(storageInfo?.brandingUsedBytes || 0)}
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
