import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SuperAdminLayout from '../components/SuperAdminLayout';
import ImageCropModal from '../components/ImageCropModal';
import usePageTitle from '../hooks/usePageTitle';
import { 
  uploadVideo,
  uploadPdf,
  uploadScorm
} from '../services/superAdminApi';
import { ArrowLeftIcon, CloudArrowUpIcon, DocumentIcon, VideoCameraIcon, CubeIcon, PhotoIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function SuperAdminLibraryCreate() {
  usePageTitle('Add Content - Global Library');
  const navigate = useNavigate();
  
  const [contentType, setContentType] = useState('pdf'); // pdf, video, or scorm
  const [file, setFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState('');
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    code: '',
    category: '',
    tags: '',
    durationHours: '',
    durationMinutes: '',
    durationSeconds: ''
  });

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = contentType === 'pdf' 
      ? ['application/pdf']
      : contentType === 'video'
      ? ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
      : ['application/zip', 'application/x-zip-compressed']; // SCORM
    
    if (!validTypes.includes(selectedFile.type)) {
      toast.error(`Invalid file type. Please select a valid ${contentType === 'pdf' ? 'PDF' : contentType === 'video' ? 'video' : 'ZIP'} file.`);
      return;
    }

    // Check file size (max 500MB for video/scorm, 50MB for PDF)
    const maxSize = contentType === 'pdf' ? 50 * 1024 * 1024 : 500 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error(`File size exceeds maximum allowed (${contentType === 'pdf' ? '50MB' : '500MB'})`);
      return;
    }

    setFile(selectedFile);
    
    // Auto-fill title if empty
    if (!formData.title) {
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, ''); // Remove extension
      setFormData(prev => ({ ...prev, title: fileName }));
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
    
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!formData.code.trim()) {
      toast.error('Please enter a unique code');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Calculate duration in seconds from hours:minutes:seconds (optional for all content types)
      const hours = parseInt(formData.durationHours || 0);
      const minutes = parseInt(formData.durationMinutes || 0);
      const seconds = parseInt(formData.durationSeconds || 0);
      const durationSeconds = (hours > 0 || minutes > 0 || seconds > 0)
        ? (hours * 3600) + (minutes * 60) + seconds
        : null;

      // Upload file directly to server (server handles Azure upload)
      let response;
      if (contentType === 'video') {
        response = await uploadVideo(
          file,
          formData.title,
          formData.description,
          formData.code,
          formData.category,
          formData.tags,
          durationSeconds,
          thumbnail,
          (progress) => setUploadProgress(Math.round(progress))
        );
      } else if (contentType === 'scorm') {
        response = await uploadScorm(
          file,
          formData.title,
          formData.description,
          formData.code,
          formData.category,
          formData.tags,
          thumbnail,
          (progress) => setUploadProgress(Math.round(progress))
        );
      } else {
        response = await uploadPdf(
          file,
          formData.title,
          formData.description,
          formData.code,
          formData.category,
          formData.tags,
          thumbnail,
          (progress) => setUploadProgress(Math.round(progress))
        );
      }

      toast.success(response.message || 'Content uploaded successfully');
      navigate('/superadmin/library');
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload content');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Add Content to Global Library</h1>
          <p className="mt-2 text-sm text-gray-600">
            Upload PDF documents, videos, or SCORM packages accessible to all organisations
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Content Type Selection */}
          <div className="bg-white shadow rounded-lg p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Content Type
            </label>
            <div className="grid grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => {
                  setContentType('pdf');
                  setFile(null);
                }}
                className={`p-6 border-2 rounded-lg transition-colors ${
                  contentType === 'pdf'
                    ? 'border-[#2afeae] bg-[#e8fdf6]'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <DocumentIcon className={`h-12 w-12 mx-auto mb-3 ${
                  contentType === 'pdf' ? 'text-indigo-600' : 'text-gray-400'
                }`} />
                <div className="text-center">
                  <div className="font-medium text-gray-900">PDF Document</div>
                  <div className="text-xs text-gray-500 mt-1">Max 50MB</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setContentType('video');
                  setFile(null);
                }}
                className={`p-6 border-2 rounded-lg transition-colors ${
                  contentType === 'video'
                    ? 'border-[#2afeae] bg-[#e8fdf6]'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <VideoCameraIcon className={`h-12 w-12 mx-auto mb-3 ${
                  contentType === 'video' ? 'text-indigo-600' : 'text-gray-400'
                }`} />
                <div className="text-center">
                  <div className="font-medium text-gray-900">Video</div>
                  <div className="text-xs text-gray-500 mt-1">Max 500MB</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setContentType('scorm');
                  setFile(null);
                }}
                className={`p-6 border-2 rounded-lg transition-colors ${
                  contentType === 'scorm'
                    ? 'border-[#2afeae] bg-[#e8fdf6]'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <CubeIcon className={`h-12 w-12 mx-auto mb-3 ${
                  contentType === 'scorm' ? 'text-indigo-600' : 'text-gray-400'
                }`} />
                <div className="text-center">
                  <div className="font-medium text-gray-900">SCORM Package</div>
                  <div className="text-xs text-gray-500 mt-1">Max 500MB</div>
                </div>
              </button>
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-white shadow rounded-lg p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select File *
            </label>
            
            {!file ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  id="fileInput"
                  accept={contentType === 'pdf' ? '.pdf' : contentType === 'video' ? 'video/*' : '.zip'}
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="hidden"
                />
                <label htmlFor="fileInput" className="cursor-pointer">
                  <CloudArrowUpIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <div className="text-sm text-gray-600">
                    <span className="font-medium text-indigo-600 hover:text-indigo-500">Click to upload</span>
                    {' '}or drag and drop
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {contentType === 'pdf' ? 'PDF up to 50MB' : contentType === 'video' ? 'Video (MP4, WebM, OGG) up to 500MB' : 'ZIP file (SCORM package) up to 500MB'}
                  </p>
                </label>
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {contentType === 'pdf' ? (
                      <DocumentIcon className="h-8 w-8 text-red-500 shrink-0" />
                    ) : contentType === 'video' ? (
                      <VideoCameraIcon className="h-8 w-8 text-blue-500 shrink-0" />
                    ) : (
                      <CubeIcon className="h-8 w-8 text-purple-500 shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{file.name}</div>
                      <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                    </div>
                  </div>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {uploading && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600">Uploading...</span>
                      <span className="text-xs text-gray-600">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#2afeae] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content Details */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Content Details</h3>
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
                  disabled={uploading}
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
                  disabled={uploading}
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
                  disabled={uploading}
                  placeholder="e.g., ladder-safety-2024 (lowercase with hyphens)"
                  pattern="[a-z0-9-]+"
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#2afeae] focus:border-indigo-500 disabled:bg-gray-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Unique identifier used for Azure folder naming (lowercase letters, numbers, and hyphens only)
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
                  disabled={uploading}
                  placeholder="e.g., Security, HR, Technical, Management"
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#2afeae] focus:border-indigo-500 disabled:bg-gray-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter a category name. If it doesn't exist, it will be created automatically.
                </p>
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
                  disabled={uploading}
                  placeholder="e.g., compliance, safety, training (comma-separated)"
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#2afeae] focus:border-indigo-500 disabled:bg-gray-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Add tags to help categorize and search for this content
                </p>
              </div>

              {/* Duration (optional for all content types) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (Optional)
                </label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <input
                      type="number"
                      name="durationHours"
                      value={formData.durationHours}
                      onChange={handleChange}
                      disabled={uploading}
                      min="0"
                      placeholder="Hours"
                      className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#2afeae] focus:border-indigo-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      name="durationMinutes"
                      value={formData.durationMinutes}
                      onChange={handleChange}
                      disabled={uploading}
                      min="0"
                      max="59"
                      placeholder="Minutes"
                      className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#2afeae] focus:border-indigo-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      name="durationSeconds"
                      value={formData.durationSeconds}
                      onChange={handleChange}
                      disabled={uploading}
                      min="0"
                      max="59"
                      placeholder="Seconds"
                      className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#2afeae] focus:border-indigo-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Enter content duration in HH:MM:SS format for display purposes
                </p>
              </div>

              {/* Thumbnail Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Thumbnail
                </label>
                {!thumbnailPreview ? (
                  <button
                    type="button"
                    onClick={() => setCropModalOpen(true)}
                    disabled={uploading}
                    className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors disabled:opacity-50"
                  >
                    <PhotoIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-indigo-600 hover:text-indigo-500">Click to upload thumbnail</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Recommended: 800x600px (4:3 ratio) or similar
                    </p>
                  </button>
                ) : (
                  <div className="relative">
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    {!uploading && (
                      <button
                        type="button"
                        onClick={removeThumbnail}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 hover:bg-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Upload a thumbnail image to make your content more appealing
                </p>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/superadmin/library')}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2afeae] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-boxlms-primary-btn text-boxlms-primary-btn-txt hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading {uploadProgress}%
                </>
              ) : (
                <>
                  <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                  Upload Content
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Image Crop Modal for Thumbnail */}
      <ImageCropModal
        isOpen={cropModalOpen}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleThumbnailCrop}
        aspectRatio={4 / 3}  // 800x600 recommended ratio
      />
    </SuperAdminLayout>
  );
}
