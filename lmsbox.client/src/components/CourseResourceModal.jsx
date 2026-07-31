import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  DocumentTextIcon,
  VideoCameraIcon,
  CodeBracketIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import resourcesService from '../services/resources';
import HtmlLessonEditor from './HtmlLessonEditor';
import ImageCropModal from './ImageCropModal';
import { formatResourceTypeLabel } from '../utils/resourceTypes';

const TYPE_CONFIG = {
  pdf: {
    icon: DocumentTextIcon,
    createLabel: 'Create PDF Resource',
    editLabel: 'Edit PDF Resource',
    fileLabel: 'PDF file',
    accept: 'application/pdf',
    maxSize: 100 * 1024 * 1024,
    maxSizeLabel: '100MB',
  },
  video: {
    icon: VideoCameraIcon,
    createLabel: 'Create Video Resource',
    editLabel: 'Edit Video Resource',
    fileLabel: 'video file',
    accept: 'video/mp4,video/avi,video/mov,video/wmv,video/x-flv,video/x-matroska,video/webm',
    maxSize: 500 * 1024 * 1024,
    maxSizeLabel: '500MB',
  },
  html: {
    icon: CodeBracketIcon,
    createLabel: 'Create HTML Resource',
    editLabel: 'Edit HTML Resource',
  },
};

const emptyForm = (resourceType, ordinal = 1) => ({
  title: '',
  description: '',
  ordinal,
  type: resourceType,
  videoUrl: '',
  documentUrl: '',
  htmlContent: '',
  htmlUrl: '',
  thumbnailUrl: '',
});

export default function CourseResourceModal({ isOpen, onClose, courseId, resource, resourceType, onSave, resourcesCount = 0 }) {
  const config = TYPE_CONFIG[resourceType] || TYPE_CONFIG.pdf;
  const HeaderIcon = config.icon;

  const [formData, setFormData] = useState(() => emptyForm(resourceType, resourcesCount + 1));
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingResource, setIsLoadingResource] = useState(false);
  const [showFileSelector, setShowFileSelector] = useState(true);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadResource = async () => {
      if (resource?.id && courseId) {
        setIsLoadingResource(true);
        try {
          const fresh = await resourcesService.getResource(courseId, resource.id);
          setFormData({
            title: fresh.title || '',
            description: fresh.description || '',
            ordinal: fresh.ordinal || 1,
            type: fresh.type || resourceType,
            videoUrl: fresh.videoUrl || '',
            documentUrl: fresh.documentUrl || '',
            htmlContent: fresh.htmlContent || '',
            htmlUrl: fresh.htmlUrl || '',
            thumbnailUrl: fresh.thumbnailUrl || '',
          });
          setShowFileSelector(!(fresh.videoUrl || fresh.documentUrl || fresh.htmlUrl));
        } catch (error) {
          console.error('Error loading resource:', error);
          setFormData({
            title: resource.title || '',
            description: resource.description || '',
            ordinal: resource.ordinal || 1,
            type: resource.type || resourceType,
            videoUrl: resource.videoUrl || '',
            documentUrl: resource.documentUrl || '',
            htmlContent: resource.htmlContent || '',
            htmlUrl: resource.htmlUrl || '',
            thumbnailUrl: resource.thumbnailUrl || '',
          });
        } finally {
          setIsLoadingResource(false);
        }
      } else {
        setFormData(emptyForm(resourceType, resourcesCount + 1));
        setShowFileSelector(true);
      }
      setUploadError(null);
      setUploadProgress(0);
      setCropModalOpen(false);
    };

    loadResource();
  }, [isOpen, resource, courseId, resourceType, resourcesCount]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const hasFile = resourceType === 'pdf'
    ? !!formData.documentUrl
    : resourceType === 'video'
      ? !!formData.videoUrl
      : !!(formData.htmlUrl || formData.htmlContent?.trim());

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (resourceType === 'pdf' && file.type !== 'application/pdf') {
      setUploadError('Invalid file format. Please upload PDF files only.');
      return;
    }

    if (resourceType === 'video') {
      const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/x-flv', 'video/x-matroska', 'video/webm'];
      if (!allowedTypes.includes(file.type)) {
        setUploadError('Invalid video format. Please upload MP4, AVI, MOV, WMV, FLV, MKV, or WebM files.');
        return;
      }
    }

    if (file.size > config.maxSize) {
      setUploadError(`File size exceeds ${config.maxSizeLabel} limit.`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      if (resourceType === 'pdf') {
        const response = await resourcesService.uploadPdf(courseId, file, setUploadProgress);
        setFormData((prev) => ({ ...prev, documentUrl: response.documentUrl }));
      } else if (resourceType === 'video') {
        const response = await resourcesService.uploadVideo(courseId, file, setUploadProgress);
        setFormData((prev) => ({ ...prev, videoUrl: response.videoUrl }));
      }
      setShowFileSelector(false);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.response?.data?.message || 'Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleThumbnailCrop = async (croppedFile) => {
    if (!croppedFile || !courseId) return;

    setIsUploadingThumbnail(true);
    setUploadError(null);

    try {
      const response = await resourcesService.uploadThumbnail(courseId, croppedFile);
      setFormData((prev) => ({ ...prev, thumbnailUrl: response.thumbnailUrl }));
    } catch (error) {
      console.error('Thumbnail upload error:', error);
      setUploadError(error.response?.data?.message || 'Failed to upload thumbnail. Please try again.');
      throw error;
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const removeThumbnail = () => {
    setFormData((prev) => ({ ...prev, thumbnailUrl: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setUploadError('Please enter a resource title');
      return;
    }

    if (resourceType === 'html' && !formData.htmlContent?.trim()) {
      setUploadError('Please add HTML content');
      return;
    }

    if ((resourceType === 'pdf' || resourceType === 'video') && !hasFile) {
      setUploadError(`Please upload a ${config.fileLabel}`);
      return;
    }

    setIsSaving(true);
    setUploadError(null);

    try {
      let payload = {
        ...formData,
        type: resourceType,
        thumbnailUrl: formData.thumbnailUrl
          ? formData.thumbnailUrl.split('?')[0]
          : null,
      };

      if (resourceType === 'html') {
        const uploadResult = await resourcesService.uploadHtmlContent(
          courseId,
          formData.title,
          formData.htmlContent
        );
        payload = { ...payload, htmlUrl: uploadResult.htmlUrl };
      }

      if (resource?.id) {
        await resourcesService.updateResource(courseId, resource.id, payload);
      } else {
        await resourcesService.createResource(courseId, payload);
      }

      onSave?.();
      handleClose();
    } catch (error) {
      console.error('Error saving resource:', error);
      setUploadError(error.response?.data?.message || 'Failed to save resource');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setUploadError(null);
    setUploadProgress(0);
    setIsUploading(false);
    setIsUploadingThumbnail(false);
    setCropModalOpen(false);
    onClose();
  };

  if (!isOpen) return null;

  const fileUrl = resourceType === 'pdf' ? formData.documentUrl : formData.videoUrl;
  const busy = isSaving || isUploading || isUploadingThumbnail;

  return (
    <>
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={handleClose} aria-hidden="true" />

        <div className="relative w-full max-w-4xl rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between bg-[#1b365d] px-6 py-4">
            <div className="flex items-center">
              <HeaderIcon className="mr-2 h-6 w-6 text-white" />
              <h3 className="text-lg font-semibold text-white">
                {resource ? config.editLabel : config.createLabel}
              </h3>
            </div>
            <button onClick={handleClose} className="text-white transition hover:text-gray-200">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4">
              {isLoadingResource && (
                <div className="rounded-lg border border-[#2afeae] bg-info p-4 text-sm text-blue-800">
                  Loading resource...
                </div>
              )}

              {uploadError && (
                <div className="flex items-center rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <ExclamationCircleIcon className="mr-2 h-5 w-5 shrink-0" />
                  {uploadError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Resource Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1b365d]"
                  placeholder={`Enter ${formatResourceTypeLabel(resourceType)} resource title`}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description (Optional)</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1b365d]"
                  placeholder="Add a short description for this resource"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Thumbnail (Optional)</label>
                {!formData.thumbnailUrl ? (
                  <button
                    type="button"
                    onClick={() => setCropModalOpen(true)}
                    disabled={busy}
                    className="w-full rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-gray-400 disabled:opacity-50"
                  >
                    <PhotoIcon className="mx-auto mb-2 h-10 w-10 text-gray-400" />
                    <div className="text-sm text-gray-600">
                      <span className="font-medium text-[#1b365d]">Click to upload thumbnail</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Recommended: 800×600px (4:3 ratio)</p>
                  </button>
                ) : (
                  <div className="relative overflow-hidden rounded-lg border border-gray-200">
                    <img
                      src={formData.thumbnailUrl}
                      alt="Resource thumbnail preview"
                      className="h-40 w-full object-cover"
                    />
                    {!busy && (
                      <div className="absolute right-2 top-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCropModalOpen(true)}
                          className="rounded-md bg-white/95 px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow hover:bg-white"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={removeThumbnail}
                          className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white shadow hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    {isUploadingThumbnail && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-medium text-white">
                        Uploading thumbnail...
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Shown to learners in the course resources panel. A default icon is used if none is set.
                </p>
              </div>

              {resourceType === 'html' ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">HTML Content *</label>
                  <HtmlLessonEditor
                    content={formData.htmlContent}
                    onChange={(content) => setFormData((prev) => ({ ...prev, htmlContent: content }))}
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {formatResourceTypeLabel(resourceType)} File *
                  </label>

                  {hasFile && !showFileSelector ? (
                    <div className="rounded-lg border-2 border-dashed border-gray-300 p-6">
                      <div className="mb-3 flex items-center justify-center text-green-600">
                        <CheckCircleIcon className="mr-2 h-6 w-6" />
                        <span className="text-sm font-medium">{formatResourceTypeLabel(resourceType)} added</span>
                      </div>
                      <p className="break-all text-center text-xs text-gray-600">
                        {fileUrl?.split('?')[0].split('/').pop()}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowFileSelector(true)}
                        className="mt-3 block w-full text-sm font-medium text-purple-600 hover:text-purple-800"
                      >
                        Change file
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                      <HeaderIcon className="mx-auto mb-3 h-12 w-12 text-gray-400" />

                      {!isUploading && (
                        <label className="cursor-pointer">
                          <span className="mt-2 block text-sm font-medium text-gray-900">
                            Click to upload {config.fileLabel}
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">
                            Max size: {config.maxSizeLabel}
                          </span>
                          <input
                            type="file"
                            accept={config.accept}
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      )}

                      {isUploading && (
                        <div className="mt-4">
                          <div className="h-2 w-full rounded-full bg-gray-200">
                            <div
                              className="h-2 rounded-full bg-[#2afeae] transition-all"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <p className="mt-2 text-sm text-gray-600">Uploading... {uploadProgress}%</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 bg-gray-50 px-6 py-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={busy}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || (resourceType !== 'html' && !hasFile)}
                className="rounded-md bg-[#1b365d] px-4 py-2 text-sm font-medium text-white hover:bg-[#234a7a] disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : resource ? 'Update Resource' : 'Create Resource'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <ImageCropModal
      isOpen={cropModalOpen}
      onClose={() => setCropModalOpen(false)}
      onCropComplete={handleThumbnailCrop}
      aspectRatio={4 / 3}
      imageType="Thumbnail"
    />
    </>
  );
}
