import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SuperAdminLayout from '../components/SuperAdminLayout';
import TenantThemeEditor from '../components/TenantThemeEditor';
import usePageTitle from '../hooks/usePageTitle';
import { getTenant, updateTenantBranding, uploadTenantAsset } from '../services/superAdminApi';
import { brandingToForm, formToBrandingPayload } from '../theme/tenantTheme';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function SuperAdminTenantTheme() {
  const { id } = useParams();
  const navigate = useNavigate();
  usePageTitle('Tenant theme');
  const [tenant, setTenant] = useState(null);
  const [form, setForm] = useState(brandingToForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({});

  const load = async () => {
    try {
      setLoading(true);
      const data = await getTenant(id);
      setTenant(data);
      setForm(brandingToForm(data));
    } catch (error) {
      toast.error(error.message || 'Failed to load tenant');
      navigate('/superadmin/tenants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleUpload = async (assetType, file) => {
    setUploading((prev) => ({ ...prev, [assetType]: true }));
    try {
      const result = await uploadTenantAsset(id, file, assetType);
      setForm((prev) => ({
        ...prev,
        bannerUrl: result.bannerUrl ?? prev.bannerUrl,
        faviconUrl: result.faviconUrl ?? prev.faviconUrl,
        loginHeroUrl: result.loginHeroUrl ?? prev.loginHeroUrl
      }));
      toast.success('Image uploaded');
    } catch (error) {
      toast.error(error.message || 'Upload failed');
    } finally {
      setUploading((prev) => ({ ...prev, [assetType]: false }));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await updateTenantBranding(id, formToBrandingPayload(form));
      setForm(brandingToForm({ ...form, ...saved }));
      toast.success('Theme saved. Organisations using tenant branding will inherit these settings.');
    } catch (error) {
      toast.error(error.message || 'Failed to save theme');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !tenant) {
    return (
      <SuperAdminLayout>
        <div className="max-w-6xl mx-auto px-4 py-12 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(`/superadmin/tenants/${id}`)}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to {tenant.name}
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Theme studio</h1>
        <p className="text-sm text-gray-600 mb-6">
          Customise the login page and brand for <strong>{tenant.name}</strong> ({tenant.code}).
          Leave fields as defaults to keep the LMS Box look.
        </p>
        <TenantThemeEditor
          form={form}
          onChange={setForm}
          onUpload={handleUpload}
          uploading={uploading}
          loginPath={tenant.loginPath || `/t/${tenant.code}/login`}
          tenantName={tenant.name}
          saving={saving}
          onSave={handleSave}
        />
      </div>
    </SuperAdminLayout>
  );
}
