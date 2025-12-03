import { useState, useEffect } from 'react';
import { XMarkIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import lessonsService from '../services/lessons';
import HtmlLessonEditor from './HtmlLessonEditor';

export default function HtmlLessonModal({ isOpen, onClose, courseId, lesson, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    ordinal: 1,
    type: 'html',
    htmlContent: '',
    htmlUrl: '',
    isOptional: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isLoadingLesson, setIsLoadingLesson] = useState(false);

  // Fetch fresh lesson data with HTML content when editing
  useEffect(() => {
    const fetchLessonData = async () => {
      if (lesson && lesson.id && courseId) {
        setIsLoadingLesson(true);
        try {
          const freshLesson = await lessonsService.getLesson(courseId, lesson.id);
          setFormData({
            title: freshLesson.title || '',
            content: freshLesson.content || '',
            ordinal: freshLesson.ordinal || 1,
            type: 'html',
            htmlContent: freshLesson.htmlContent || '',
            htmlUrl: freshLesson.htmlUrl || '',
            isOptional: freshLesson.isOptional || false,
          });
        } catch (error) {
          console.error('Error fetching lesson data:', error);
          // Fallback to lesson prop data
          setFormData({
            title: lesson.title || '',
            content: lesson.content || '',
            ordinal: lesson.ordinal || 1,
            type: 'html',
            htmlContent: lesson.htmlContent || '',
            htmlUrl: lesson.htmlUrl || '',
            isOptional: lesson.isOptional || false,
          });
        } finally {
          setIsLoadingLesson(false);
        }
      } else if (!lesson) {
        // Reset for new lesson
        setFormData({
          title: '',
          content: '',
          ordinal: 1,
          type: 'html',
          htmlContent: '',
          htmlUrl: '',
          isOptional: false,
        });
      }
    };

    fetchLessonData();
  }, [lesson, courseId]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleHtmlContentChange = (content) => {
    setFormData(prev => ({
      ...prev,
      htmlContent: content
    }));
  };

  const handleUploadToBlob = async (htmlContent) => {
    if (!htmlContent || !htmlContent.trim()) {
      setUploadError('Please add HTML content before saving');
      return null;
    }

    try {
      const response = await lessonsService.uploadHtmlContent(
        courseId,
        formData.title || 'Untitled HTML Lesson',
        htmlContent
      );

      setFormData(prev => ({
        ...prev,
        htmlUrl: response.htmlUrl
      }));

      return response.htmlUrl;
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.response?.data?.message || 'Failed to upload HTML content');
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setUploadError('Please enter a lesson title');
      return;
    }

    if (!formData.htmlContent.trim()) {
      setUploadError('Please add HTML content');
      return;
    }

    setIsSaving(true);
    setUploadError(null);

    try {
      // Upload HTML content to blob storage
      const htmlUrl = await handleUploadToBlob(formData.htmlContent);
      
      if (!htmlUrl) {
        setIsSaving(false);
        return;
      }

      // Prepare lesson data
      const lessonData = {
        title: formData.title,
        content: formData.content,
        ordinal: formData.ordinal,
        type: 'html',
        htmlContent: formData.htmlContent,
        htmlUrl: htmlUrl,
        isOptional: formData.isOptional
      };

      if (lesson) {
        // Update existing lesson
        await lessonsService.updateLesson(courseId, lesson.id, lessonData);
      } else {
        // Create new lesson
        await lessonsService.createLesson(courseId, lessonData);
      }

      onSave?.();
      onClose();
    } catch (error) {
      console.error('Error saving lesson:', error);
      setUploadError(error.response?.data?.message || 'Failed to save HTML lesson');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-5xl bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 rounded-lg">
                <CodeBracketIcon className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {lesson ? 'Edit HTML Lesson' : 'Add HTML Lesson'}
                </h2>
                <p className="text-sm text-gray-500">
                  Create interactive HTML content for your course
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-6 w-6 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Loading State */}
            {isLoadingLesson && (
              <div className="bg-info border border-[#2afeae] rounded-lg p-4 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-blue-800">Loading lesson content...</p>
              </div>
            )}

            {/* Error Display */}
            {uploadError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{uploadError}</p>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Lesson Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter lesson title"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                placeholder="Brief description of this lesson"
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* HTML Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                HTML Content *
              </label>
              <HtmlLessonEditor
                initialContent={formData.htmlContent}
                onContentChange={handleHtmlContentChange}
                onUrlChange={handleUploadToBlob}
              />
            </div>

            {/* Optional Checkbox */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isOptional"
                name="isOptional"
                checked={formData.isOptional}
                onChange={handleInputChange}
                className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
              />
              <label htmlFor="isOptional" className="ml-2 block text-sm text-gray-700">
                Mark as optional (learners can skip this lesson)
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !formData.title.trim() || !formData.htmlContent.trim()}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </span>
                ) : (
                  `${lesson ? 'Update' : 'Create'} Lesson`
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
