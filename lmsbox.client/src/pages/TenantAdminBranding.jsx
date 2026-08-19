import { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import TenantThemeEditor from '../components/TenantThemeEditor';
import usePageTitle from '../hooks/usePageTitle';
import { getMyTenant, getTenantBranding, updateTenantBranding, uploadTenantBrandingAsset } from '../services/tenantAdminApi';
import { brandingToForm, formToBrandingPayload } from '../theme/tenantTheme';
import toast from 'react-hot-toast';

export default function TenantAdminBranding() {
  usePageTitle('Tenant Branding');
  const [tenant, setTenant] = useState(null);
  const [form, setForm] = useState(brandingToForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({});

  const load = async () => {
    try {
      setLoading(true);
      const [branding, me] = await Promise.all([getTenantBranding(), getMyTenant().catch(() => null)]);
      setTenant(me);
      setForm(brandingToForm(branding));
    } catch (error) {
      toast.error(error.message || 'Failed to load branding');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (assetType, file) => {
    setUploading((prev) => ({ ...prev, [assetType]: true }));
    try {
      const result = await uploadTenantBrandingAsset(file, assetType);
      const next = result.branding ? brandingToForm(result.branding) : {
        ...form,
        bannerUrl: result.bannerUrl ?? form.bannerUrl,
        faviconUrl: result.faviconUrl ?? form.faviconUrl,
        loginHeroUrl: result.loginHeroUrl ?? form.loginHeroUrl
      };
      setForm((prev) => ({ ...prev, ...next, customCss: prev.customCss, brandName: prev.brandName || next.brandName }));
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
      const saved = await updateTenantBranding(formToBrandingPayload(form));
      setForm(brandingToForm({ ...form, ...saved }));
      toast.success('Tenant branding updated. Organisations using tenant branding will inherit these settings.');
    } catch (error) {
      toast.error(error.message || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="max-w-6xl mx-auto px-4 py-12 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tenant branding</h1>
        <p className="text-sm text-gray-600 mb-6">
          These settings appear on your organisation login page
          {tenant?.loginPath ? (
            <>
              {' '}
              (<code>{tenant.loginPath}</code>)
            </>
          ) : null}{' '}
          and in the app. Leave colours empty to use the default LMS Box theme.
        </p>
        <TenantThemeEditor
          form={form}
          onChange={setForm}
          onUpload={handleUpload}
          uploading={uploading}
          loginPath={tenant?.loginPath}
          tenantName={tenant?.name || tenant?.brandName}
          saving={saving}
          onSave={handleSave}
        />
      </div>
    </AdminLayout>
  );
}
