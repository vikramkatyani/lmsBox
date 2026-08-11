import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SuperAdminLayout from '../components/SuperAdminLayout';
import usePageTitle from '../hooks/usePageTitle';
import { getTenant, createTenant, updateTenant } from '../services/superAdminApi';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function SuperAdminTenantForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  usePageTitle(isEdit ? 'Edit Tenant' : 'Create Tenant');

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    allowsMultipleOrganisations: false,
    maxUsers: 100,
    allocatedStorageGB: 10,
    domain: '',
    supportEmail: '',
    managerName: '',
    managerEmail: '',
    managerPhone: '',
    renewalDate: '',
    isActive: true,
    brandName: '',
    bannerUrl: '',
    faviconUrl: '',
    primaryOrganisationName: '',
    tenantAdminEmail: '',
    tenantAdminFirstName: '',
    tenantAdminLastName: '',
    tenantAdminPassword: ''
  });

  useEffect(() => {
    if (isEdit) {
      fetchTenant();
    }
  }, [id]);

  const fetchTenant = async () => {
    try {
      const data = await getTenant(id);
      setFormData((prev) => ({
        ...prev,
        name: data.name || '',
        code: data.code || '',
        description: data.description || '',
        allowsMultipleOrganisations: !!data.allowsMultipleOrganisations,
        maxUsers: data.maxUsers ?? 100,
        allocatedStorageGB: data.allocatedStorageGB ?? 10,
        domain: data.domain || '',
        supportEmail: data.supportEmail || '',
        managerName: data.managerName || '',
        managerEmail: data.managerEmail || '',
        managerPhone: data.managerPhone || '',
        renewalDate: data.renewalDate ? new Date(data.renewalDate).toISOString().split('T')[0] : '',
        isActive: data.isActive,
        brandName: data.brandName || '',
        bannerUrl: data.bannerUrl || '',
        faviconUrl: data.faviconUrl || ''
      }));
    } catch (error) {
      console.error(error);
      toast.error('Failed to load tenant');
      navigate('/superadmin/tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await updateTenant(id, {
          ...formData,
          maxUsers: Number(formData.maxUsers),
          allocatedStorageGB: Number(formData.allocatedStorageGB),
          renewalDate: formData.renewalDate || null
        });
        toast.success('Tenant updated');
        navigate(`/superadmin/tenants/${id}`);
      } else {
        if (!formData.tenantAdminPassword || formData.tenantAdminPassword.length < 6) {
          toast.error('Tenant admin password must be at least 6 characters');
          setSaving(false);
          return;
        }
        const created = await createTenant({
          name: formData.name,
          code: formData.code || undefined,
          description: formData.description || undefined,
          allowsMultipleOrganisations: formData.allowsMultipleOrganisations,
          maxUsers: Number(formData.maxUsers),
          allocatedStorageGB: Number(formData.allocatedStorageGB),
          domain: formData.domain || undefined,
          supportEmail: formData.supportEmail || undefined,
          managerName: formData.managerName || undefined,
          managerEmail: formData.managerEmail || undefined,
          managerPhone: formData.managerPhone || undefined,
          renewalDate: formData.renewalDate || null,
          primaryOrganisationName: formData.primaryOrganisationName || undefined,
          tenantAdminEmail: formData.tenantAdminEmail,
          tenantAdminFirstName: formData.tenantAdminFirstName,
          tenantAdminLastName: formData.tenantAdminLastName || undefined,
          tenantAdminPassword: formData.tenantAdminPassword
        });
        toast.success('Tenant created');
        navigate(`/superadmin/tenants/${created.id}`);
      }
    } catch (error) {
      toast.error(error.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="max-w-3xl mx-auto px-4 py-12 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/superadmin/tenants')}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to tenants
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          {isEdit ? 'Edit Tenant' : 'Create Tenant'}
        </h1>

        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tenant name *</label>
            <input
              required
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code {isEdit ? '*' : '(optional)'}</label>
            <input
              required={isEdit}
              name="code"
              value={formData.code}
              onChange={handleChange}
              placeholder="auto-generated from name if empty"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="allowsMultipleOrganisations"
              checked={formData.allowsMultipleOrganisations}
              onChange={handleChange}
            />
            Allow multiple organisations under this tenant
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max users</label>
              <input
                type="number"
                min={1}
                name="maxUsers"
                value={formData.maxUsers}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Storage (GB)</label>
              <input
                type="number"
                min={1}
                name="allocatedStorageGB"
                value={formData.allocatedStorageGB}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          {isEdit && (
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
              />
              Active
            </label>
          )}

          {isEdit && (
            <div className="border-t pt-5 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Tenant branding</h2>
              <p className="text-sm text-gray-600">
                Applied to all organisations under this tenant unless an organisation opts into custom branding.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand name</label>
                <input
                  name="brandName"
                  value={formData.brandName}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banner / logo URL</label>
                <input
                  name="bannerUrl"
                  value={formData.bannerUrl}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Favicon URL</label>
                <input
                  name="faviconUrl"
                  value={formData.faviconUrl}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="https://..."
                />
              </div>
              {formData.bannerUrl && (
                <img
                  src={formData.bannerUrl}
                  alt="Tenant banner preview"
                  className="w-full max-w-xl h-auto object-contain border rounded"
                  style={{ aspectRatio: '37/9' }}
                />
              )}
            </div>
          )}

          {!isEdit && (
            <div className="border-t pt-5 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Primary organisation & Tenant Admin</h2>
              <p className="text-sm text-gray-600">
                A primary organisation is created automatically. The Tenant Admin is also granted OrgAdmin on that organisation.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary organisation name</label>
                <input
                  name="primaryOrganisationName"
                  value={formData.primaryOrganisationName}
                  onChange={handleChange}
                  placeholder="Defaults to tenant name"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin first name *</label>
                  <input
                    required
                    name="tenantAdminFirstName"
                    value={formData.tenantAdminFirstName}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin last name</label>
                  <input
                    name="tenantAdminLastName"
                    value={formData.tenantAdminLastName}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin email *</label>
                <input
                  required
                  type="email"
                  name="tenantAdminEmail"
                  value={formData.tenantAdminEmail}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin password *</label>
                <input
                  required
                  type="password"
                  name="tenantAdminPassword"
                  value={formData.tenantAdminPassword}
                  onChange={handleChange}
                  minLength={6}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/superadmin/tenants')}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: '#1b365d' }}
            >
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create tenant'}
            </button>
          </div>
        </form>
      </div>
    </SuperAdminLayout>
  );
}
