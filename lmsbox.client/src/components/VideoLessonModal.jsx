import { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  VideoCameraIcon, 
  CloudArrowUpIcon, 
  FolderIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlayIcon
} from '@heroicons/react/24/outline';
import lessonsService from '../services/lessons';

export default function VideoLessonModal({ isOpen, onClose, courseId, lesson, onSave, captionOnly = false }) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    ordinal: 1,
    type: 'video',
    videoUrl: '',
    captionUrl: '',
    videoDurationSeconds: null,
    isOptional: false,
  });

  const [videoSource, setVideoSource] = useState('upload'); // 'upload', 'library'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [captionFileName, setCaptionFileName] = useState('');
  const [captionUploadProgress, setCaptionUploadProgress] = useState(0);
  const [isCaptionUploading, setIsCaptionUploading] = useState(false);
  const [captionUploadError, setCaptionUploadError] = useState(null);
  const [libraryVideos, setLibraryVideos] = useState([]);
  const [selectedLibraryVideo, setSelectedLibraryVideo] = useState(null);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [showSourceSelector, setShowSourceSelector] = useState(false);

  // Fetch fresh lesson data with SAS token when editing
  useEffect(() => {
    const fetchLessonWithToken = async () => {
      if (lesson && lesson.id && courseId) {
        try {
          const freshLesson = await lessonsService.getLesson(courseId, lesson.id);
          setPreviewUrl(freshLesson.videoUrl || '');
        } catch (error) {
          console.error('Error fetching lesson with token:', error);
          setPreviewUrl(lesson.videoUrl || '');
        }
      }
    };

    fetchLessonWithToken();
  }, [lesson, courseId]);

  useEffect(() => {
    if (lesson) {
      setFormData({
        title: lesson.title || '',
        content: lesson.content || '',
        ordinal: lesson.ordinal || 1,
        type: 'video',
        videoUrl: lesson.videoUrl || '',
        captionUrl: lesson.captionUrl || '',
        videoDurationSeconds: lesson.durationSeconds || lesson.videoDurationSeconds || null,
        isOptional: lesson.isOptional || false,
      });
      setCaptionFileName(lesson.captionUrl ? lesson.captionUrl.split('?')[0].split('/').pop() : '');
      
      // Don't show source selector if editing existing video or caption-only mode
      setShowSourceSelector(captionOnly ? false : !lesson.videoUrl);
    } else {
      // New lesson - show source selector
      setShowSourceSelector(true);
    }
  }, [lesson, captionOnly]);

  useEffect(() => {
    if (isOpen && videoSource === 'library') {
      loadLibraryVideos();
    }
  }, [isOpen, videoSource, courseId]);

  const loadLibraryVideos = async () => {
    setIsLoadingLibrary(true);
    try {
      // Load videos from shared LMS library (accessible to all organizations)
      const videos = await lessonsService.listSharedLibraryVideos(courseId);
      setLibraryVideos(videos);
    } catch (error) {
      console.error('Error loading library videos:', error);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleVideoSourceChange = (source) => {
    setVideoSource(source);
    setUploadError(null);
    setUploadProgress(0);
    setSelectedLibraryVideo(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/x-flv', 'video/x-matroska', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid video format. Please upload MP4, AVI, MOV, WMV, FLV, MKV, or WebM files.');
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

    try {
      const response = await lessonsService.uploadVideo(
        courseId,
        file,
        (progress) => setUploadProgress(progress)
      );

      setFormData(prev => ({
        ...prev,
        videoUrl: response.videoUrl
      }));

      // Get video duration if possible
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        setFormData(prev => ({
          ...prev,
          videoDurationSeconds: Math.round(video.duration)
        }));
        URL.revokeObjectURL(video.src);
      };

    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.response?.data?.message || 'Failed to upload video. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCaptionUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.toLowerCase().split('.').pop();
    if (extension !== 'vtt') {
      setCaptionUploadError('Invalid caption format. Please upload a WebVTT (.vtt) file.');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setCaptionUploadError('Caption file exceeds 5MB limit.');
      return;
    }

    setIsCaptionUploading(true);
    setCaptionUploadError(null);
    setCaptionUploadProgress(0);

    try {
      const response = await lessonsService.uploadCaption(
        courseId,
        file,
        (progress) => setCaptionUploadProgress(progress)
      );

      setFormData(prev => ({
        ...prev,
        captionUrl: response.captionUrl
      }));
      setCaptionFileName(response.originalFileName || file.name);
    } catch (error) {
      console.error('Caption upload error:', error);
      setCaptionUploadError(error.response?.data?.message || 'Failed to upload caption. Please try again.');
    } finally {
      setIsCaptionUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveCaption = () => {
    setFormData(prev => ({
      ...prev,
      captionUrl: ''
    }));
    setCaptionFileName('');
    setCaptionUploadError(null);
    setCaptionUploadProgress(0);
  };

  const handleLibraryVideoSelect = (video) => {
    setSelectedLibraryVideo(video);
    setFormData(prev => ({
      ...prev,
      videoUrl: video.url
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (captionOnly) {
      if (!lesson?.id) {
        alert('Lesson not found');
        return;
      }

      setIsSaving(true);
      try {
        await lessonsService.updateCaption(courseId, lesson.id, formData.captionUrl || null);
        onSave?.();
        handleClose();
      } catch (error) {
        console.error('Error saving caption:', error);
        alert(error.response?.data?.message || 'Failed to save caption');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!formData.title.trim()) {
      alert('Please enter a lesson title');
      return;
    }

    if (!formData.videoUrl) {
      alert('Please provide a video source');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        title: formData.title,
        content: formData.content,
        ordinal: formData.ordinal,
        type: formData.type,
        videoUrl: formData.videoUrl,
        captionUrl: formData.captionUrl || null,
        durationSeconds: formData.videoDurationSeconds,
        isOptional: formData.isOptional,
      };

      if (lesson) {
        await lessonsService.updateLesson(courseId, lesson.id, payload);
      } else {
        await lessonsService.createLesson(courseId, payload);
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
      type: 'video',
      videoUrl: '',
      captionUrl: '',
      videoDurationSeconds: null,
      isOptional: false,
    });
    setVideoSource('url');
    setUploadProgress(0);
    setIsUploading(false);
    setUploadError(null);
    setCaptionFileName('');
    setCaptionUploadProgress(0);
    setIsCaptionUploading(false);
    setCaptionUploadError(null);
    setLibraryVideos([]);
    setSelectedLibraryVideo(null);
    onClose();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
              <VideoCameraIcon className="h-6 w-6 text-white mr-2" />
              <h3 className="text-lg font-semibold text-white">
                {captionOnly
                  ? 'Manage Video Captions'
                  : lesson
                    ? 'Edit Video Lesson'
                    : 'Create Video Lesson'}
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
              {captionOnly && (
                <div className="mb-4 bg-info border border-info rounded-lg p-3 text-sm text-[#1b365d]">
                  This course is published. You can add, replace, or remove the caption file for this video lesson.
                </div>
              )}

              {/* Basic Info */}
              {!captionOnly && (
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Add a description or instructions for this video lesson"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (seconds)
                    </label>
                    <input
                      type="number"
                      name="videoDurationSeconds"
                      value={formData.videoDurationSeconds || ''}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Auto-detected or manual"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isOptional"
                    checked={formData.isOptional}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    This lesson is optional
                  </label>
                </div>
              </div>
              )}

              {/* Video Source Selection */}
              {!captionOnly && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video Source *
                </label>

                {/* Show existing video with preview and change option */}
                {formData.videoUrl && !showSourceSelector && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <div className="flex items-center justify-center text-green-600 mb-3">
                      <CheckCircleIcon className="h-6 w-6 mr-2" />
                      <span className="text-sm font-medium">Video added to lesson</span>
                    </div>
                    <div className="bg-info border border-info rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Current Video:</p>
                          <p className="text-xs text-gray-600 mt-1 break-all">
                            {formData.videoUrl.split('?')[0].split('/').pop()}
                          </p>
                        </div>
                        <a 
                          href={previewUrl || formData.videoUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="ml-3 inline-flex items-center px-3 py-1.5 text-sm font-medium text-[#1b365d] bg-white border-[#1b365d] rounded-md hover:bg-info transition shrink-0"
                        >
                          <PlayIcon className="h-4 w-4 mr-1" />
                          Preview
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSourceSelector(true)}
                      className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Change video
                    </button>
                  </div>
                )}

                {/* Show upload interface for new lessons or when changing */}
                {showSourceSelector && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <VideoCameraIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                    
                    {!formData.videoUrl && !isUploading && (
                      <>
                        <label className="cursor-pointer">
                          <span className="mt-2 block text-sm font-medium text-gray-900">
                            Click to upload video
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">
                            MP4, AVI, MOV, WMV, FLV, MKV, WebM (Max 500MB)
                          </span>
                          <input
                            type="file"
                            accept="video/*"
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
                          Uploading... {uploadProgress}%
                        </p>
                      </div>
                    )}

                    {formData.videoUrl && !isUploading && (
                      <div className="flex items-center justify-center text-green-600 mt-4">
                        <CheckCircleIcon className="h-6 w-6 mr-2" />
                        <span className="text-sm font-medium">Video uploaded successfully</span>
                      </div>
                    )}

                    {uploadError && (
                      <div className="flex items-center justify-center text-red-600 mt-4">
                        <ExclamationCircleIcon className="h-6 w-6 mr-2" />
                        <span className="text-sm">{uploadError}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}

              {captionOnly && formData.title && (
                <div className="mb-2">
                  <p className="text-sm text-gray-500">Lesson</p>
                  <p className="text-base font-medium text-gray-900">{formData.title}</p>
                </div>
              )}

              {/* Captions */}
              <div className={captionOnly ? 'mt-2' : 'mt-6'}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Captions (English VTT{captionOnly ? '' : ', Optional'})
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  {formData.captionUrl ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-green-600">
                        <CheckCircleIcon className="h-5 w-5 mr-2" />
                        <span className="text-sm font-medium">{captionFileName || 'Caption file added'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCaption}
                        className="text-sm text-red-600 hover:text-red-800 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      {!isCaptionUploading ? (
                        <label className="cursor-pointer">
                          <span className="block text-sm font-medium text-gray-900">
                            Click to upload caption file
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">
                            WebVTT (.vtt) only (Max 5MB)
                          </span>
                          <input
                            type="file"
                            accept=".vtt,text/vtt"
                            onChange={handleCaptionUpload}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-[#2afeae] h-2 rounded-full transition-all"
                              style={{ width: `${captionUploadProgress}%` }}
                            ></div>
                          </div>
                          <p className="text-sm text-gray-600 mt-2">
                            Uploading caption... {captionUploadProgress}%
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {captionUploadError && (
                    <div className="flex items-center justify-center text-red-600 mt-4">
                      <ExclamationCircleIcon className="h-5 w-5 mr-2" />
                      <span className="text-sm">{captionUploadError}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={isSaving || isUploading || isCaptionUploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-[#1b365d] bg-[#2afeae] hover:bg-[#25e89e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2afeae] disabled:opacity-50"
                disabled={isSaving || isUploading || isCaptionUploading || (!captionOnly && !formData.videoUrl)}
              >
                {isSaving
                  ? 'Saving...'
                  : captionOnly
                    ? 'Save Captions'
                    : lesson
                      ? 'Update Lesson'
                      : 'Create Lesson'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
