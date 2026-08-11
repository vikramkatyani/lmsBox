import { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import usePageTitle from '../hooks/usePageTitle';
import { getTenantBranding, updateTenantBranding } from '../services/tenantAdminApi';
import toast from 'react-hot-toast';

export default function TenantAdminBranding() {
  usePageTitle('Tenant Branding');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    brandName: '',
    bannerUrl: '',
    faviconUrl: '',
    themeSettings: ''
  });

  const load = async () => {
    try {
      setLoading(true);
      const data = await getTenantBranding();
      setForm({
        brandName: data.brandName || '',
        bannerUrl: data.bannerUrl || data.logoUrl || '',
        faviconUrl: data.faviconUrl || '',
        themeSettings: data.themeSettings || ''
      });
    } catch (error) {
      toast.error(error.message || 'Failed to load branding');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateTenantBranding(form);
      toast.success('Tenant branding updated. Organisations using tenant branding will inherit these settings.');
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="max-w-3xl mx-auto px-4 py-12 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tenant branding</h1>
        <p className="text-sm text-gray-600 mb-6">
          These settings apply to every organisation under your tenant that has &quot;Apply tenant branding&quot; selected
          (the default).
        </p>

        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Brand name</label>
            <input
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Banner / logo URL</label>
            <input
              value={form.bannerUrl}
              onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Favicon URL</label>
            <input
              value={form.faviconUrl}
              onChange={(e) => setForm({ ...form, faviconUrl: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="https://..."
            />
          </div>
          {form.bannerUrl && (
            <img
              src={form.bannerUrl}
              alt="Banner preview"
              className="w-full max-w-xl h-auto object-contain border rounded"
              style={{ aspectRatio: '37/9' }}
            />
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md text-white text-sm disabled:opacity-60"
              style={{ backgroundColor: '#1b365d' }}
            >
              {saving ? 'Saving...' : 'Save branding'}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
