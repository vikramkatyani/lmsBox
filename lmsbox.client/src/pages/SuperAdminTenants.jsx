import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SuperAdminLayout from '../components/SuperAdminLayout';
import usePageTitle from '../hooks/usePageTitle';
import { getTenants } from '../services/superAdminApi';
import {
  PlusIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function SuperAdminTenants() {
  usePageTitle('Tenants - Super Admin');
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const data = await getTenants();
      setTenants(data);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const filtered = tenants.filter((tenant) => {
    if (statusFilter === 'active' && !tenant.isActive) return false;
    if (statusFilter === 'inactive' && tenant.isActive) return false;
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      tenant.name?.toLowerCase().includes(search) ||
      tenant.code?.toLowerCase().includes(search) ||
      tenant.tenantAdminEmail?.toLowerCase().includes(search) ||
      tenant.domain?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-600">Loading tenants...</span>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Tenants</h1>
            <p className="mt-1 text-sm text-gray-600">
              Create and manage tenants. Each tenant owns one or more organisations.
            </p>
          </div>
          <button
            onClick={() => navigate('/superadmin/tenants/create')}
            className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white"
            style={{ backgroundColor: '#1b365d' }}
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Tenant
          </button>
        </div>

        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tenants..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orgs</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{tenant.name}</div>
                    <div className="text-sm text-gray-500">{tenant.code}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {tenant.allowsMultipleOrganisations ? 'Multi-organisation' : 'Single organisation'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{tenant.organisationCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{tenant.totalUsers}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{tenant.tenantAdminEmail || '—'}</td>
                  <td className="px-6 py-4">
                    {tenant.isActive ? (
                      <span className="inline-flex items-center text-green-700 text-sm">
                        <CheckCircleIcon className="h-4 w-4 mr-1" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-red-600 text-sm">
                        <XCircleIcon className="h-4 w-4 mr-1" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => navigate(`/superadmin/tenants/${tenant.id}`)}
                      className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      <BuildingOfficeIcon className="h-4 w-4 mr-1" />
                      View
                    </button>
                    <button
                      onClick={() => navigate(`/superadmin/tenants/${tenant.id}/edit`)}
                      className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
                    >
                      <PencilIcon className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                    No tenants found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
