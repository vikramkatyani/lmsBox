import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SuperAdminLayout from '../components/SuperAdminLayout';
import usePageTitle from '../hooks/usePageTitle';
import { getTenants } from '../services/superAdminApi';
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  ServerStackIcon,
  ChartBarIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function SuperAdminDashboard() {
  usePageTitle('Super Admin Dashboard');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    totalOrgs: 0,
    totalUsers: 0,
    totalStorage: 0
  });

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const data = await getTenants();
      setStats({
        totalTenants: data.length,
        activeTenants: data.filter((t) => t.isActive).length,
        totalOrgs: data.reduce((sum, t) => sum + (t.organisationCount || 0), 0),
        totalUsers: data.reduce((sum, t) => sum + (t.totalUsers || 0), 0),
        totalStorage: data.reduce((sum, t) => sum + (t.allocatedStorageGB || 0), 0)
      });
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="ml-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Tenants</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalTenants}</p>
              </div>
              <BuildingOfficeIcon className="h-12 w-12 text-indigo-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Tenants</p>
                <p className="text-3xl font-bold text-gray-900">{stats.activeTenants}</p>
              </div>
              <CheckCircleIcon className="h-12 w-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Organisations</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalOrgs}</p>
              </div>
              <UserGroupIcon className="h-12 w-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Allocated Storage</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalStorage} GB</p>
              </div>
              <ServerStackIcon className="h-12 w-12 text-purple-500" />
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => navigate('/superadmin/tenants')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow text-left"
          >
            <BuildingOfficeIcon className="h-8 w-8 text-indigo-500 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Tenants</h3>
            <p className="text-sm text-gray-600">Create and manage tenants and their organisations</p>
          </button>

          <button
            onClick={() => navigate('/superadmin/library')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow text-left"
          >
            <ServerStackIcon className="h-8 w-8 text-purple-500 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Global Library</h3>
            <p className="text-sm text-gray-600">Manage global content library</p>
          </button>

          <button
            onClick={() => navigate('/admin/reports/activity-logs')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow text-left"
          >
            <ChartBarIcon className="h-8 w-8 text-blue-500 mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Analytics & Reports</h3>
            <p className="text-sm text-gray-600">View system-wide analytics</p>
          </button>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
