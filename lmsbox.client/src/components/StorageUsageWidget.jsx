import { useState, useEffect } from 'react';
import { HardDrive, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { storageService } from '../services/storage';

const StorageUsageWidget = ({ compact = false }) => {
  const [storageInfo, setStorageInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadStorageUsage();
  }, []);

  const loadStorageUsage = async () => {
    try {
      setLoading(true);
      const data = await storageService.getStorageUsage();
      setStorageInfo(data);
    } catch (err) {
      console.error('Error loading storage usage:', err);
      setError('Failed to load storage usage');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !storageInfo) {
    return null;
  }

  const isNearLimit = storageInfo.usagePercentage >= 80;
  const isOverLimit = storageInfo.usagePercentage >= 95;

  // Compact version for dashboard
  if (compact) {
    return (
      <div 
        onClick={() => navigate('/admin/reports/storage')}
        className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200"
      >
        <div className="flex items-center">
          <div className="shrink-0">
            <HardDrive className="h-12 w-12 text-indigo-600" />
          </div>
          <div className="ml-4 flex-1">
            <p className="text-sm font-medium text-gray-500">Storage Usage</p>
            <p className="text-2xl font-semibold text-gray-900">
              {storageInfo.usagePercentage.toFixed(1)}%
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isOverLimit
                    ? 'bg-red-500'
                    : isNearLimit
                    ? 'bg-yellow-500'
                    : 'bg-[#2afeae]'
                }`}
                style={{ width: `${Math.min(storageInfo.usagePercentage, 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {storageInfo.usedGB} GB of {storageInfo.allocatedGB} GB
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Full version for detailed page
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HardDrive className="w-6 h-6 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Storage Usage</h3>
        </div>
        {isNearLimit && (
          <AlertTriangle className={`w-6 h-6 ${isOverLimit ? 'text-red-500' : 'text-yellow-500'}`} />
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{storageInfo.usedGB} GB used</span>
          <span>{storageInfo.allocatedGB} GB total</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isOverLimit
                ? 'bg-red-500'
                : isNearLimit
                ? 'bg-yellow-500'
                : 'bg-[#2afeae]'
            }`}
            style={{ width: `${Math.min(storageInfo.usagePercentage, 100)}%` }}
          ></div>
        </div>
        <div className="text-xs text-gray-500 mt-1 text-right">
          {storageInfo.usagePercentage.toFixed(1)}% used
        </div>
      </div>

      {/* Storage Breakdown */}
      <div className="space-y-3 pt-4 border-t">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Course Content:</span>
          <span className="font-medium text-gray-900">
            {storageInfo.contentUsedGB} GB
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Branding & Media:</span>
          <span className="font-medium text-gray-900">
            {storageInfo.brandingUsedGB} GB
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Available:</span>
          <span className="font-medium text-green-600">
            {storageInfo.availableGB} GB
          </span>
        </div>
      </div>

      {/* Warning Messages */}
      {isOverLimit && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <strong>Storage almost full!</strong> Please delete unused content or contact support to upgrade.
        </div>
      )}
      {isNearLimit && !isOverLimit && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
          <strong>Storage running low.</strong> Consider removing old files or upgrading your plan.
        </div>
      )}
    </div>
  );
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

export default StorageUsageWidget;
