import { useState, useEffect } from 'react';
import { HardDrive, AlertTriangle } from 'lucide-react';
import { storageService } from '../services/storage';

const StorageUsageWidget = () => {
  const [storageInfo, setStorageInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      <div className="bg-white rounded-lg shadow p-4">
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

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Storage Usage</h3>
        </div>
        {isNearLimit && (
          <AlertTriangle className={`w-5 h-5 ${isOverLimit ? 'text-red-500' : 'text-yellow-500'}`} />
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{storageInfo.usedFormatted} used</span>
          <span>{storageInfo.allocatedFormatted} total</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
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
      <div className="space-y-2 pt-3 border-t">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Course Content:</span>
          <span className="font-medium text-gray-900">
            {formatBytes(storageInfo.contentUsedBytes)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Branding & Media:</span>
          <span className="font-medium text-gray-900">
            {formatBytes(storageInfo.brandingUsedBytes)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Available:</span>
          <span className="font-medium text-green-600">
            {storageInfo.availableFormatted}
          </span>
        </div>
      </div>

      {/* Warning Messages */}
      {isOverLimit && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <strong>Storage almost full!</strong> Please delete unused content or contact support to upgrade.
        </div>
      )}
      {isNearLimit && !isOverLimit && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
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
