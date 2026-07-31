import { useEffect, useState } from 'react';
import { XMarkIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import lessonsService from '../services/lessons';

const DEFAULT_PENDING_MESSAGE =
  'Congratulations on completing the online part of your course. After your practical, you will be able to complete your evaluation and, if successful, download your certificate. Please allow up to one week for your Assessor to upload your results.';
const LEGACY_PENDING_MESSAGE =
  'This activity is completed outside the learning platform. Your progress will be updated automatically once completion is recorded.';

export default function ExternalLessonModal({ isOpen, onClose, courseId, lesson, lessonsCount = 0, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    externalPendingMessage: DEFAULT_PENDING_MESSAGE,
    ordinal: 1,
    type: 'external',
    isOptional: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (lesson) {
      const storedMessage = lesson.externalPendingMessage || '';
      setFormData({
        title: lesson.title || '',
        externalPendingMessage:
          !storedMessage || storedMessage === LEGACY_PENDING_MESSAGE
            ? DEFAULT_PENDING_MESSAGE
            : storedMessage,
        ordinal: lesson.ordinal || 1,
        type: 'external',
        isOptional: lesson.isOptional || false,
      });
    } else {
      setFormData({
        title: '',
        externalPendingMessage: DEFAULT_PENDING_MESSAGE,
        ordinal: lessonsCount + 1,
        type: 'external',
        isOptional: false,
      });
    }
  }, [lesson, lessonsCount, isOpen]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      return;
    }

    if (!formData.externalPendingMessage.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        type: 'external',
        externalPendingMessage: formData.externalPendingMessage.trim(),
        ordinal: formData.ordinal,
        isOptional: formData.isOptional,
      };

      if (lesson?.id) {
        await lessonsService.updateLesson(courseId, lesson.id, payload);
      } else {
        await lessonsService.createLesson(courseId, payload);
      }

      onSave?.();
      onClose?.();
    } catch (error) {
      console.error('Error saving practical lesson:', error);
      const message = error.response?.data?.message || 'Failed to save practical lesson';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <ArrowTopRightOnSquareIcon className="h-5 w-5 text-[#1b365d]" />
            <h2 className="text-lg font-semibold text-gray-900">
              {lesson ? 'Edit Practical' : 'Add Practical'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          <p className="text-sm text-gray-600">
            Practical lessons are completed outside the LMS. When the learner finishes the activity in your
            third-party system, that system should record completion for this lesson.
          </p>

          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
              Lesson Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1b365d] focus:outline-none focus:ring-1 focus:ring-[#1b365d]"
              placeholder="e.g. Practical Pre-requisite"
            />
          </div>

          <div>
            <label htmlFor="externalPendingMessage" className="mb-1 block text-sm font-medium text-gray-700">
              Pre-Completion Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="externalPendingMessage"
              name="externalPendingMessage"
              value={formData.externalPendingMessage}
              onChange={handleInputChange}
              required
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#1b365d] focus:outline-none focus:ring-1 focus:ring-[#1b365d]"
              placeholder="Message shown to learners while this lesson is pending completion"
            />
            <p className="mt-1 text-xs text-gray-500">
              This message is shown to learners until the practical result is recorded.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="isOptional"
              checked={formData.isOptional}
              onChange={handleInputChange}
              className="rounded border-gray-300 text-[#1b365d] focus:ring-[#1b365d]"
            />
            Optional lesson
          </label>

          <div className="flex justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-boxlms-primary-btn px-4 py-2 text-sm text-boxlms-primary-btn-txt hover:brightness-90 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : lesson ? 'Save Changes' : 'Add Practical'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
