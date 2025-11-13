import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SuperAdminLayout from '../components/SuperAdminLayout';
import usePageTitle from '../hooks/usePageTitle';
import { 
  getOrganisation, 
  createOrganisation, 
  updateOrganisation,
  getOrgUploadToken,
  uploadFileToAzure
} from '../services/superAdminApi';
import { ArrowLeftIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function SuperAdminOrganisationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  usePageTitle(isEdit ? 'Edit Organisation' : 'Create Organisation');

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({ banner: false, favicon: false });
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    maxUsers: 100,
    allocatedStorageGB: 10,
    domain: '',
    bannerUrl: '',
    faviconUrl: '',
    themeSettings: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    smtpUseSsl: true,
    sendGridApiKey: '',
    fromEmail: '',
    fromName: '',
    supportEmail: '',
    managerName: '',
    managerEmail: '',
    managerPhone: '',
    renewalDate: '',
    isActive: true
  });

  useEffect(() => {
    if (isEdit) {
      fetchOrganisation();
    }
  }, [id]);

  const fetchOrganisation = async () => {
    try {
      const data = await getOrganisation(id);
      setFormData({
        ...data,
        renewalDate: data.renewalDate ? new Date(data.renewalDate).toISOString().split('T')[0] : '',
        smtpPort: data.smtpPort || 587,
        themeSettings: data.themeSettings || ''
      });
    } catch (error) {
      console.error('Error fetching organisation:', error);
      toast.error('Failed to load organisation');
      navigate('/superadmin/organisations');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const handleFileUpload = async (e, fileType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = fileType === 'banner' 
      ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      : ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png'];
    
    if (!validTypes.includes(file.type)) {
      toast.error(`Invalid file type for ${fileType}. Please select a valid image.`);
      return;
    }

    try {
      setUploading(prev => ({ ...prev, [fileType]: true }));
      
      // Get SAS token
      const extension = `.${file.name.split('.').pop()}`;
      const { uploadUrl, blobPath } = await getOrgUploadToken(id || 0, extension);
      
      // Upload file
      await uploadFileToAzure(uploadUrl, file);
      
      // Update form with blob path
      const urlField = fileType === 'banner' ? 'bannerUrl' : 'faviconUrl';
      setFormData(prev => ({ ...prev, [urlField]: blobPath }));
      
      toast.success(`${fileType === 'banner' ? 'Banner' : 'Favicon'} uploaded successfully`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload ${fileType}`);
    } finally {
      setUploading(prev => ({ ...prev, [fileType]: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Organisation name is required');
      return;
    }

    try {
      setSaving(true);
      
      const dataToSend = {
        ...formData,
        renewalDate: formData.renewalDate || null
      };

      if (isEdit) {
        await updateOrganisation(id, dataToSend);
        toast.success('Organisation updated successfully');
      } else {
        await createOrganisation(dataToSend);
        toast.success('Organisation created successfully');
      }
      
      navigate('/superadmin/organisations');
    } catch (error) {
      console.error('Error saving organisation:', error);
      toast.error(error.message || 'Failed to save organisation');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/superadmin/organisations')}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Organisations
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isEdit ? 'Edit Organisation' : 'Create New Organisation'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {isEdit ? 'Update organisation details and settings' : 'Set up a new organisation for your LMS'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Organisation Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Max Users *
                  </label>
                  <input
                    type="number"
                    name="maxUsers"
                    value={formData.maxUsers}
                    onChange={handleChange}
                    min="1"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Allocated Storage (GB) *
                  </label>
                  <input
                    type="number"
                    name="allocatedStorageGB"
                    value={formData.allocatedStorageGB}
                    onChange={handleChange}
                    min="1"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Domain
                </label>
                <input
                  type="text"
                  name="domain"
                  value={formData.domain}
                  onChange={handleChange}
                  placeholder="example.com"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Renewal Date
                </label>
                <input
                  type="date"
                  name="renewalDate"
                  value={formData.renewalDate}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Active
                </label>
              </div>
            </div>
          </div>

          {/* Branding (only show in edit mode since we need org ID for upload) */}
          {isEdit && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Branding</h2>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Banner Image
                  </label>
                  {formData.bannerUrl && (
                    <p className="text-xs text-gray-500 mb-2">Current: {formData.bannerUrl}</p>
                  )}
                  <div className="flex items-center">
                    <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                      <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                      {uploading.banner ? 'Uploading...' : 'Upload Banner'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'banner')}
                        disabled={uploading.banner}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Favicon
                  </label>
                  {formData.faviconUrl && (
                    <p className="text-xs text-gray-500 mb-2">Current: {formData.faviconUrl}</p>
                  )}
                  <div className="flex items-center">
                    <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                      <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                      {uploading.favicon ? 'Uploading...' : 'Upload Favicon'}
                      <input
                        type="file"
                        accept=".ico,image/x-icon,image/png"
                        onChange={(e) => handleFileUpload(e, 'favicon')}
                        disabled={uploading.favicon}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Theme Settings (JSON)
                  </label>
                  <textarea
                    name="themeSettings"
                    value={formData.themeSettings}
                    onChange={handleChange}
                    rows={4}
                    placeholder='{"primaryColor": "#4F46E5", "secondaryColor": "#7C3AED"}'
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Contact Information */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Support Email
                </label>
                <input
                  type="email"
                  name="supportEmail"
                  value={formData.supportEmail}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Manager Name
                  </label>
                  <input
                    type="text"
                    name="managerName"
                    value={formData.managerName}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Manager Email
                  </label>
                  <input
                    type="email"
                    name="managerEmail"
                    value={formData.managerEmail}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Manager Phone
                  </label>
                  <input
                    type="tel"
                    name="managerPhone"
                    value={formData.managerPhone}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Email Configuration */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Email Configuration</h2>
            <div className="grid grid-cols-1 gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    From Email
                  </label>
                  <input
                    type="email"
                    name="fromEmail"
                    value={formData.fromEmail}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    From Name
                  </label>
                  <input
                    type="text"
                    name="fromName"
                    value={formData.fromName}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  SendGrid API Key
                </label>
                <input
                  type="password"
                  name="sendGridApiKey"
                  value={formData.sendGridApiKey}
                  onChange={handleChange}
                  placeholder="SG.xxxxxxxxxxxxx"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-4">SMTP Settings (Alternative to SendGrid)</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        name="smtpHost"
                        value={formData.smtpHost}
                        onChange={handleChange}
                        placeholder="smtp.example.com"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Port
                      </label>
                      <input
                        type="number"
                        name="smtpPort"
                        value={formData.smtpPort}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        SMTP Username
                      </label>
                      <input
                        type="text"
                        name="smtpUsername"
                        value={formData.smtpUsername}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        SMTP Password
                      </label>
                      <input
                        type="password"
                        name="smtpPassword"
                        value={formData.smtpPassword}
                        onChange={handleChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="smtpUseSsl"
                      checked={formData.smtpUseSsl}
                      onChange={handleChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Use SSL/TLS
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/superadmin/organisations')}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                isEdit ? 'Update Organisation' : 'Create Organisation'
              )}
            </button>
          </div>
        </form>
      </div>
    </SuperAdminLayout>
  );
}
