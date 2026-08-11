import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import usePageTitle from '../hooks/usePageTitle';
import {
  getMyTenant,
  getTenantOrganisations,
  createTenantOrganisation,
  createOrgAdminForTenant
} from '../services/tenantAdminApi';
import { PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function TenantAdminOrganisations() {
  usePageTitle('Tenant Organisations');
  const [tenant, setTenant] = useState(null);
  const [organisations, setOrganisations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [adminForm, setAdminForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: ''
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [tenantData, orgs] = await Promise.all([getMyTenant(), getTenantOrganisations()]);
      setTenant(tenantData);
      setOrganisations(orgs);
    } catch (error) {
      toast.error(error.message || 'Failed to load tenant organisations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const canAddOrg =
    tenant?.allowsMultipleOrganisations || (organisations?.length || 0) === 0;

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createTenantOrganisation({ name: orgName });
      toast.success('Organisation created');
      setOrgName('');
      setShowOrgForm(false);
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to create organisation');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createOrgAdminForTenant(showAdminForm, adminForm);
      toast.success('Organisation admin created');
      setShowAdminForm(null);
      setAdminForm({ email: '', firstName: '', lastName: '', password: '' });
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to create admin');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="max-w-5xl mx-auto px-4 py-12 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Organisations</h1>
          <p className="text-sm text-gray-600 mt-1">
            Tenant: <span className="font-medium">{tenant?.name}</span>
            {tenant?.allowsMultipleOrganisations ? ' (multi-organisation)' : ' (single organisation)'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Day-to-day learning admin stays under{' '}
            <Link to="/admin/dashboard" className="text-indigo-600 hover:underline">
              Admin
            </Link>
            .
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Your organisations</h2>
            {canAddOrg && (
              <button
                onClick={() => setShowOrgForm((v) => !v)}
                className="inline-flex items-center text-sm text-indigo-600"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add organisation
              </button>
            )}
          </div>

          {showOrgForm && (
            <form onSubmit={handleCreateOrg} className="mb-4 flex gap-2">
              <input
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Organisation name"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-md text-white text-sm"
                style={{ backgroundColor: '#1b365d' }}
              >
                Create
              </button>
            </form>
          )}

          <div className="divide-y divide-gray-200">
            {organisations.map((org) => (
              <div key={org.id} className="py-3 flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-900">{org.name}</div>
                  <div className="text-sm text-gray-500">
                    {org.totalUsers} users · max {org.maxUsers}
                    {!org.isActive && ' · Inactive'}
                  </div>
                </div>
                <button
                  onClick={() => setShowAdminForm(org.id)}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  Add OrgAdmin
                </button>
              </div>
            ))}
            {organisations.length === 0 && (
              <p className="text-sm text-gray-500 py-4">No organisations yet.</p>
            )}
          </div>
        </div>

        {showAdminForm && (
          <div className="bg-white shadow rounded-lg p-6 mt-6">
            <h3 className="text-lg font-semibold mb-4">Create OrgAdmin</h3>
            <form onSubmit={handleCreateAdmin} className="space-y-3">
              <input
                required
                type="email"
                placeholder="Email"
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  placeholder="First name"
                  value={adminForm.firstName}
                  onChange={(e) => setAdminForm({ ...adminForm, firstName: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
                <input
                  placeholder="Last name"
                  value={adminForm.lastName}
                  onChange={(e) => setAdminForm({ ...adminForm, lastName: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <input
                required
                type="password"
                minLength={6}
                placeholder="Password"
                value={adminForm.password}
                onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowAdminForm(null)} className="px-4 py-2 border rounded-md text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-md text-white text-sm"
                  style={{ backgroundColor: '#1b365d' }}
                >
                  Create admin
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
