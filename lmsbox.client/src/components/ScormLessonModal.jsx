import { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  ArchiveBoxIcon, 
  CloudArrowUpIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import lessonsService from '../services/lessons';

export default function ScormLessonModal({ isOpen, onClose, courseId, lesson, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    ordinal: 1,
    type: 'scorm',
    scormUrl: '',
    scormVersion: '1.2',
    isOptional: false,
  });

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (lesson) {
      setFormData({
        title: lesson.title || '',
        content: lesson.content || '',
        ordinal: lesson.ordinal || 1,
        type: 'scorm',
        scormUrl: lesson.scormUrl || '',
        scormVersion: lesson.scormVersion || '1.2',
        isOptional: lesson.isOptional || false,
      });
      
      if (lesson.scormUrl) {
        setUploadSuccess({ packageName: 'Existing Package', launchUrl: lesson.scormUrl });
      }
    }
  }, [lesson]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setUploadError('Invalid file format. Please upload a ZIP file containing a SCORM package.');
      return;
    }

    // Validate file size (500MB max)
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      setUploadError('File size exceeds 500MB limit.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    setUploadSuccess(null);

    try {
      const response = await lessonsService.uploadScorm(
        courseId,
        file,
        (progress) => setUploadProgress(progress)
      );

      setFormData(prev => ({
        ...prev,
        scormUrl: response.launchUrl,
        scormVersion: response.scormVersion || '1.2'
      }));

      setUploadSuccess({
        packageName: response.packageName,
        launchUrl: response.launchUrl,
        scormVersion: response.scormVersion || '1.2',
        fileCount: response.fileCount,
        totalSize: response.totalSize
      });

    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to upload SCORM package. Please ensure the ZIP file contains a valid imsmanifest.xml file.';
      setUploadError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Please enter a lesson title');
      return;
    }

    if (!formData.scormUrl) {
      alert('Please upload a SCORM package');
      return;
    }

    setIsSaving(true);

    try {
      if (lesson) {
        await lessonsService.updateLesson(courseId, lesson.id, formData);
      } else {
        await lessonsService.createLesson(courseId, formData);
      }

      onSave?.();
      handleClose();
    } catch (error) {
      console.error('Error saving lesson:', error);
      alert(error.response?.data?.message || 'Failed to save lesson');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      content: '',
      ordinal: 1,
      type: 'scorm',
      scormUrl: '',
      scormVersion: '1.2',
      isOptional: false,
    });
    setUploadProgress(0);
    setIsUploading(false);
    setUploadError(null);
    setUploadSuccess(null);
    onClose();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatScormVersion = (version) => {
    const map = {
      '1.2':      'SCORM 1.2',
      '2004-2nd': 'SCORM 2004 2nd Edition',
      '2004-3rd': 'SCORM 2004 3rd Edition',
      '2004-4th': 'SCORM 2004 4th Edition',
    };
    return map[version] || version;
  };

  const getScormBadgeClassName = (version) => {
    switch (version) {
      case '1.2':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case '2004-2nd':
        return 'bg-sky-100 text-sky-800 border border-sky-200';
      case '2004-3rd':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case '2004-4th':
        return 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" 
          onClick={handleClose}
          aria-hidden="true"
        ></div>

        {/* Center alignment trick */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        {/* Modal panel */}
        <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-[#1b365d] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center">
              <ArchiveBoxIcon className="h-6 w-6 text-white mr-2" />
              <h3 className="text-lg font-semibold text-white">
                {lesson ? 'Edit SCORM Lesson' : 'Create SCORM Lesson'}
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:text-gray-200 transition"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-6 py-4 max-h-[70vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lesson Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter lesson title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    name="content"
                    value={formData.content}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Add a description or instructions for this SCORM lesson"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isOptional"
                    checked={formData.isOptional}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    This lesson is optional
                  </label>
                </div>
              </div>

              {/* SCORM Upload */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  SCORM Package *
                </label>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <ArchiveBoxIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                  
                  {!formData.scormUrl && !isUploading && (
                    <>
                      <label className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-gray-900">
                          Click to upload SCORM package
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          ZIP file only (Max 500MB)
                        </span>
                        <span className="mt-1 block text-xs text-gray-400">
                          Must contain imsmanifest.xml
                        </span>
                        <input
                          type="file"
                          accept=".zip"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </>
                  )}

                  {isUploading && (
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-[#2afeae] h-2 rounded-full transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">
                        Uploading and extracting SCORM package... {uploadProgress}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        This may take a few moments
                      </p>
                    </div>
                  )}

                  {uploadSuccess && !isUploading && (
                    <div className="mt-4">
                      <div className="flex items-center justify-center text-green-600 mb-3">
                        <CheckCircleIcon className="h-6 w-6 mr-2" />
                        <span className="text-sm font-medium">SCORM package uploaded successfully</span>
                      </div>
                      <div className="bg-success border border-success rounded-lg p-4 text-left">
                        <p className="text-sm font-medium text-gray-900 mb-2">Package Details:</p>
                        <div className="space-y-1 text-xs text-gray-600">
                          <p><span className="font-medium">Package:</span> {uploadSuccess.packageName}</p>
                          {uploadSuccess.scormVersion && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Learning Standard:</span>
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getScormBadgeClassName(uploadSuccess.scormVersion)}`}
                              >
                                {formatScormVersion(uploadSuccess.scormVersion)}
                              </span>
                            </div>
                          )}
                          {uploadSuccess.fileCount && (
                            <p><span className="font-medium">Files:</span> {uploadSuccess.fileCount}</p>
                          )}
                          {uploadSuccess.totalSize && (
                            <p><span className="font-medium">Size:</span> {formatFileSize(uploadSuccess.totalSize)}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, scormUrl: '' }));
                          setUploadSuccess(null);
                        }}
                        className="mt-3 text-sm text-gray-600 hover:text-gray-800"
                      >
                        Upload different package
                      </button>
                    </div>
                  )}

                  {uploadError && (
                    <div className="flex items-start justify-center text-error mt-4 bg-error border border-error rounded p-3">
                      <ExclamationCircleIcon className="h-6 w-6 mr-2 shrink-0" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Upload Failed</p>
                        <p className="text-xs mt-1">{uploadError}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info box */}
                <div className="mt-4 bg-info border border-info rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <strong>About SCORM:</strong> SCORM (Sharable Content Object Reference Model) is a standard for e-learning content. 
                    Your ZIP file must contain an imsmanifest.xml file at the root or in a subfolder. The system will automatically 
                    extract the package, validate it, and determine the launch URL.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                disabled={isSaving || isUploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-[#1b365d] bg-[#2afeae] hover:bg-[#25e89e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2afeae] disabled:opacity-50"
                disabled={isSaving || isUploading || !formData.scormUrl}
              >
                {isSaving ? 'Saving...' : lesson ? 'Update Lesson' : 'Create Lesson'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
