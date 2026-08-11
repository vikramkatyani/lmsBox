import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import ImageCropModal from '../components/ImageCropModal';
import toast from 'react-hot-toast';
import { getOrganisationSettings, updateOrganisationSettings, uploadBannerImage } from '../services/organisation';
import usePageTitle from '../hooks/usePageTitle';
import { BuildingOfficeIcon, EnvelopeIcon, PhoneIcon, PhotoIcon } from '@heroicons/react/24/outline';

export default function OrganisationSettings() {
  const navigate = useNavigate();
  usePageTitle('Organisation Settings');

  const [form, setForm] = useState({
    name: '',
    description: '',
    useTenantBranding: true,
    brandName: '',
    logoUrl: '',
    supportName: '',
    supportEmail: '',
    supportPhone: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [orgInfo, setOrgInfo] = useState(null);
  const [tenantBranding, setTenantBranding] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getOrganisationSettings();
      setOrgInfo(data);
      setTenantBranding(data.tenantBranding || null);
      setForm({
        name: data.name || '',
        description: data.description || '',
        useTenantBranding: data.useTenantBranding !== false,
        brandName: data.brandName || '',
        logoUrl: data.logoUrl || '',
        supportName: data.supportName || '',
        supportEmail: data.supportEmail || '',
        supportPhone: data.supportPhone || ''
      });
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Failed to load organisation settings');
      if (e.message && e.message.includes('Forbidden')) {
        navigate('/admin/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name || !form.name.trim()) {
      toast.error('Organisation name is required');
      return;
    }

    try {
      setSaving(true);
      await updateOrganisationSettings({
        name: form.name,
        description: form.description,
        useTenantBranding: form.useTenantBranding,
        brandName: form.useTenantBranding ? undefined : form.brandName,
        logoUrl: form.useTenantBranding ? undefined : form.logoUrl,
        supportName: form.supportName,
        supportEmail: form.supportEmail,
        supportPhone: form.supportPhone
      });
      toast.success('Organisation settings updated successfully');
      await loadSettings();
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Failed to update organisation settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin/dashboard');
  };

  const handleCropComplete = async (croppedImageFile) => {
    try {
      setUploading(true);
      const result = await uploadBannerImage(croppedImageFile);
      
      // Add timestamp to bust cache
      const urlWithTimestamp = `${result.url}?t=${Date.now()}`;
      
      // Update the form with the new logo URL
      setForm((prev) => ({ ...prev, logoUrl: urlWithTimestamp, useTenantBranding: false }));
      
      // Also update the orgInfo to reflect the change immediately
      setOrgInfo((prev) => ({ ...prev, logoUrl: urlWithTimestamp, useTenantBranding: false }));
      
      toast.success('Banner uploaded — switched to custom branding');
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Failed to upload banner image');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <>
        <AdminHeader title="Organisation Settings" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminHeader title="Organisation Settings" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Organisation Information */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">Organisation Information</h2>
              </div>
            </div>
            <div className="px-6 py-6 space-y-6">
              {/* Organisation Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Organisation Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  placeholder="Enter organisation name"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Brief description of your organisation"
                />
              </div>

              {/* Branding mode */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                <p className="text-sm font-medium text-gray-900">Branding</p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="brandingMode"
                    className="mt-1"
                    checked={form.useTenantBranding}
                    onChange={() => handleChange('useTenantBranding', true)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Apply tenant branding</span>
                    <span className="block text-sm text-gray-500">
                      Use the parent tenant brand (default). Organisations without custom branding inherit these settings.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="brandingMode"
                    className="mt-1"
                    checked={!form.useTenantBranding}
                    onChange={() => handleChange('useTenantBranding', false)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Custom organisation branding</span>
                    <span className="block text-sm text-gray-500">
                      Override with organisation-specific brand name and banner.
                    </span>
                  </span>
                </label>

                {form.useTenantBranding && (
                  <div className="mt-2 rounded-md border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-600">
                    <p className="font-medium text-gray-800 mb-1">Effective tenant branding</p>
                    <p>Brand: {tenantBranding?.brandName || orgInfo?.effectiveBrandName || 'Not set'}</p>
                    {(tenantBranding?.bannerUrl || orgInfo?.effectiveLogoUrl) && (
                      <img
                        src={tenantBranding?.bannerUrl || orgInfo?.effectiveLogoUrl}
                        alt="Tenant branding preview"
                        className="mt-2 w-full max-w-xl h-auto object-contain"
                        style={{ aspectRatio: '37/9' }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Brand Name */}
              <div className={form.useTenantBranding ? 'opacity-50 pointer-events-none' : ''}>
                <label htmlFor="brandName" className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Name
                </label>
                <input
                  id="brandName"
                  type="text"
                  value={form.useTenantBranding ? (tenantBranding?.brandName || '') : form.brandName}
                  onChange={(e) => handleChange('brandName', e.target.value)}
                  disabled={form.useTenantBranding}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  placeholder="Brand name for emails and communications"
                />
                <p className="mt-1 text-sm text-gray-500">
                  This name will appear in system emails and communications
                </p>
              </div>

              {/* Logo URL */}
              <div className={form.useTenantBranding ? 'opacity-50' : ''}>
                <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <PhotoIcon className="h-4 w-4 text-gray-400 mr-1" />
                      Company Banner / Logo
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCropModal(true)}
                      disabled={uploading || form.useTenantBranding}
                      className="px-3 py-1 text-sm bg-[#2afeae] text-[#1b365d] rounded-lg hover:bg-[#25e89e] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </label>
                <input
                  id="logoUrl"
                  type="url"
                  value={form.useTenantBranding ? (tenantBranding?.bannerUrl || tenantBranding?.logoUrl || '') : form.logoUrl}
                  onChange={(e) => handleChange('logoUrl', e.target.value)}
                  disabled={form.useTenantBranding}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  placeholder="https://example.com/logo.png"
                />
                <p className="mt-1 text-sm text-gray-500">
                  {form.useTenantBranding
                    ? 'Switch to custom branding to upload an organisation banner.'
                    : 'Upload an image (recommended) or paste a URL. Images will be cropped to 37:9 ratio.'}
                </p>
                {((form.useTenantBranding ? (tenantBranding?.bannerUrl || tenantBranding?.logoUrl) : form.logoUrl)) && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Banner Preview (37:9 ratio):</p>
                    <div className="border border-gray-200 rounded-lg p-2 bg-white">
                      <img 
                        key={form.useTenantBranding ? (tenantBranding?.bannerUrl || tenantBranding?.logoUrl) : form.logoUrl}
                        src={form.useTenantBranding ? (tenantBranding?.bannerUrl || tenantBranding?.logoUrl) : form.logoUrl} 
                        alt="Banner preview" 
                        className="w-full max-w-2xl h-auto object-contain"
                        style={{ aspectRatio: '37/9' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Support Contact Information */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">Support Contact Information</h2>
              </div>
            </div>
            <div className="px-6 py-6 space-y-6">
              {/* Support Contact Name */}
              <div>
                <label htmlFor="supportName" className="block text-sm font-medium text-gray-700 mb-2">
                  Support Contact Name
                </label>
                <input
                  id="supportName"
                  type="text"
                  value={form.supportName}
                  onChange={(e) => handleChange('supportName', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Help Desk or John Smith"
                />
              </div>

              {/* Support Email */}
              <div>
                <label htmlFor="supportEmail" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center">
                    <EnvelopeIcon className="h-4 w-4 text-gray-400 mr-1" />
                    Support Email
                  </div>
                </label>
                <input
                  id="supportEmail"
                  type="email"
                  value={form.supportEmail}
                  onChange={(e) => handleChange('supportEmail', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="support@example.com"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Users will use this email to contact support
                </p>
              </div>

              {/* Support Phone */}
              <div>
                <label htmlFor="supportPhone" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center">
                    <PhoneIcon className="h-4 w-4 text-gray-400 mr-1" />
                    Support Phone
                  </div>
                </label>
                <input
                  id="supportPhone"
                  type="tel"
                  value={form.supportPhone}
                  onChange={(e) => handleChange('supportPhone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* System Information (Read-only) */}
          {orgInfo && (
            <div className="bg-gray-50 shadow-sm rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">System Information</h2>
              </div>
              <div className="px-6 py-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Domain</p>
                    <p className="mt-1 text-sm text-gray-900">{orgInfo.domain || 'Not set'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Status</p>
                    <p className="mt-1 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        orgInfo.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {orgInfo.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Max Users</p>
                    <p className="mt-1 text-sm text-gray-900">{orgInfo.maxUsers}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Storage Allocation</p>
                    <p className="mt-1 text-sm text-gray-900">{orgInfo.allocatedStorageGB} GB</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-[#2afeae] text-[#1b365d] rounded-lg hover:bg-[#25e89e] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Image Crop Modal */}
      <ImageCropModal
        isOpen={showCropModal}
        onClose={() => setShowCropModal(false)}
        onCropComplete={handleCropComplete}
        aspectRatio={37 / 9}
      />
    </>
  );
}
