import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SuperAdminLayout from '../components/SuperAdminLayout';
import usePageTitle from '../hooks/usePageTitle';
import { 
  uploadVideo,
  uploadPdf
} from '../services/superAdminApi';
import { ArrowLeftIcon, CloudArrowUpIcon, DocumentIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function SuperAdminLibraryCreate() {
  usePageTitle('Add Content - Global Library');
  const navigate = useNavigate();
  
  const [contentType, setContentType] = useState('pdf'); // pdf or video
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: ''
  });

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = contentType === 'pdf' 
      ? ['application/pdf']
      : ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    
    if (!validTypes.includes(selectedFile.type)) {
      toast.error(`Invalid file type. Please select a valid ${contentType === 'pdf' ? 'PDF' : 'video'} file.`);
      return;
    }

    // Check file size (max 500MB for video, 50MB for PDF)
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

    try {
      setUploading(true);
      setUploadProgress(0);

      // Upload file directly to server (server handles Azure upload)
      let response;
      if (contentType === 'video') {
        response = await uploadVideo(
          file,
          formData.title,
          formData.description,
          formData.tags,
          (progress) => setUploadProgress(Math.round(progress))
        );
      } else {
        response = await uploadPdf(
          file,
          formData.title,
          formData.description,
          formData.tags,
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
            Upload PDF documents or video files accessible to all organisations
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Content Type Selection */}
          <div className="bg-white shadow rounded-lg p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Content Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setContentType('pdf');
                  setFile(null);
                }}
                className={`p-6 border-2 rounded-lg transition-colors ${
                  contentType === 'pdf'
                    ? 'border-indigo-500 bg-indigo-50'
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
                    ? 'border-indigo-500 bg-indigo-50'
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
                  accept={contentType === 'pdf' ? '.pdf' : 'video/*'}
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
                    {contentType === 'pdf' ? 'PDF up to 50MB' : 'Video (MP4, WebM, OGG) up to 500MB'}
                  </p>
                </label>
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {contentType === 'pdf' ? (
                      <DocumentIcon className="h-8 w-8 text-red-500 shrink-0" />
                    ) : (
                      <VideoCameraIcon className="h-8 w-8 text-blue-500 shrink-0" />
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
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
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
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
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
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
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
                  disabled={uploading}
                  placeholder="e.g., compliance, safety, training (comma-separated)"
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Add tags to help categorize and search for this content
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
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
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
    </SuperAdminLayout>
  );
}
