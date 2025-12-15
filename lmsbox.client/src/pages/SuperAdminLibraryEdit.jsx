import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SuperAdminLayout from '../components/SuperAdminLayout';
import ImageCropModal from '../components/ImageCropModal';
import usePageTitle from '../hooks/usePageTitle';
import { getGlobalLibraryContent, updateGlobalLibraryContent } from '../services/superAdminApi';
import { ArrowLeftIcon, PhotoIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function SuperAdminLibraryEdit() {
  usePageTitle('Edit Content - Global Library');
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState('');
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    code: '',
    category: '',
    tags: ''
  });

  useEffect(() => {
    fetchContent();
  }, [id]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const data = await getGlobalLibraryContent(id);
      setContent(data);
      setFormData({
        title: data.title || '',
        description: data.description || '',
        code: data.code || '',
        category: data.category || '',
        tags: data.tags || ''
      });
      if (data.thumbnailUrl) {
        setThumbnailPreview(data.thumbnailUrl);
      }
    } catch (error) {
      console.error('Error fetching content:', error);
      toast.error('Failed to load content');
      navigate('/superadmin/library');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleThumbnailCrop = async (croppedFile) => {
    setThumbnail(croppedFile);
    setThumbnailPreview(URL.createObjectURL(croppedFile));
    toast.success('Thumbnail ready to upload');
  };

  const removeThumbnail = () => {
    setThumbnail(null);
    setThumbnailPreview('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!formData.code.trim()) {
      toast.error('Please enter a code');
      return;
    }

    try {
      setSaving(true);
      await updateGlobalLibraryContent(id, {
        title: formData.title,
        description: formData.description,
        code: formData.code,
        category: formData.category,
        tags: formData.tags
      }, thumbnail);
      
      toast.success('Content updated successfully');
      navigate('/superadmin/library');
    } catch (error) {
      console.error('Update error:', error);
      toast.error(error.message || 'Failed to update content');
    } finally {
      setSaving(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  if (!content) {
    return (
      <SuperAdminLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <p className="text-gray-500">Content not found</p>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/superadmin/library')}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Library
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Edit Content</h1>
          <p className="mt-2 text-sm text-gray-600">
            Update content metadata (file cannot be changed)
          </p>
        </div>

        {/* Content Info */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Content Information</h3>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Type</dt>
              <dd className="mt-1">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  content.contentType === 'pdf' 
                    ? 'bg-red-100 text-red-800' 
                    : content.contentType === 'video'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {content.contentType.toUpperCase()}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">File Size</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatFileSize(content.fileSizeBytes)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">File Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{content.fileName || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Uploaded On</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(content.uploadedOn).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Uploaded By</dt>
              <dd className="mt-1 text-sm text-gray-900">{content.uploadedBy}</dd>
            </div>
            {content.durationSeconds && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Duration</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {Math.floor(content.durationSeconds / 60)}:{(content.durationSeconds % 60).toString().padStart(2, '0')}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Thumbnail Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Thumbnail</h3>
          
          {thumbnailPreview ? (
            <div className="space-y-4">
              <div className="relative inline-block">
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="w-64 h-36 object-cover rounded-lg border border-gray-300"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setCropModalOpen(true)}
                  disabled={saving}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <PhotoIcon className="h-4 w-4 mr-2" />
                  Change Thumbnail
                </button>
                <button
                  type="button"
                  onClick={removeThumbnail}
                  disabled={saving}
                  className="inline-flex items-center px-3 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setCropModalOpen(true)}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <PhotoIcon className="h-5 w-5 mr-2" />
                Add Thumbnail
              </button>
              <p className="mt-2 text-sm text-gray-500">
                Optional thumbnail image for this content
              </p>
            </div>
          )}
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Editable Fields</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  disabled={saving}
                  placeholder="Enter content title"
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#2afeae] focus:border-indigo-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  disabled={saving}
                  rows={3}
                  placeholder="Optional description of the content"
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#2afeae] focus:border-indigo-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  required
                  disabled={saving}
                  placeholder="e.g., ladder-safety-2024 (lowercase with hyphens)"
                  pattern="[a-z0-9-]+"
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#2afeae] focus:border-indigo-500 disabled:bg-gray-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Unique identifier used for folder naming (lowercase letters, numbers, and hyphens only)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  disabled={saving}
                  placeholder="e.g., Security, HR, Technical, Management"
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#2afeae] focus:border-indigo-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags
                </label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  disabled={saving}
                  placeholder="e.g., compliance, safety, training (comma-separated)"
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#2afeae] focus:border-indigo-500 disabled:bg-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/superadmin/library')}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-boxlms-primary-btn text-boxlms-primary-btn-txt hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Image Crop Modal */}
        <ImageCropModal
          isOpen={cropModalOpen}
          onClose={() => setCropModalOpen(false)}
          onCropComplete={handleThumbnailCrop}
          aspectRatio={16 / 9}
        />
      </div>
    </SuperAdminLayout>
  );
}
