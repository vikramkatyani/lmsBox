import React, { useState } from 'react';
import interactiveLessonsService from '../services/interactiveLessons';
import toast from 'react-hot-toast';

const ACCEPTED_VIDEO =
  'video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,.mp4,.webm,.mov,.avi,.mkv,.wmv';

export default function VideoBlockForm({
  value,
  onChange,
  lessonId,
  blockId,
  pendingFile = null,
  onPendingFileChange,
  isBusy = false,
  uploadProgress = 0,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const update = (patch) => onChange({ ...value, ...patch });
  const uploading = isUploading || isBusy;

  const handleVideoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // New block: hold the file and upload when the block is saved.
    if (!blockId) {
      onPendingFileChange?.(file);
      event.target.value = '';
      return;
    }

    if (!lessonId) {
      toast.error('Save the lesson first before uploading a video');
      event.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const result = await interactiveLessonsService.uploadBlockMedia(lessonId, blockId, file);
      update({ videoUrl: result.url });
      toast.success('Video uploaded — save the block to keep it');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to upload video');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const clearPendingFile = () => {
    onPendingFileChange?.(null);
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          value={value.title || ''}
          onChange={(e) => update({ title: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Optional title above the video"
          disabled={uploading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={value.description || value.caption || ''}
          onChange={(e) => update({ description: e.target.value, caption: undefined })}
          className="w-full border rounded px-3 py-2"
          rows={3}
          placeholder="Optional description text under the video"
          disabled={uploading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Upload video</label>
        <div className="flex flex-wrap items-center gap-3">
          <label
            className={`inline-flex items-center px-3 py-2 text-sm rounded ${
              uploading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 cursor-pointer hover:bg-gray-200'
            }`}
          >
            {isUploading ? 'Uploading...' : blockId ? 'Choose video file' : 'Choose video file'}
            <input
              type="file"
              accept={ACCEPTED_VIDEO}
              className="hidden"
              disabled={uploading}
              onChange={handleVideoUpload}
            />
          </label>
          {pendingFile && (
            <div className="flex items-center gap-2 text-sm text-gray-700 min-w-0">
              <span className="truncate" title={pendingFile.name}>
                {pendingFile.name}
              </span>
              <button
                type="button"
                onClick={clearPendingFile}
                disabled={uploading}
                className="text-xs text-gray-500 hover:text-gray-800 underline shrink-0"
              >
                Remove
              </button>
            </div>
          )}
        </div>
        {uploading && uploadProgress > 0 && (
          <div className="mt-2">
            <div className="h-1.5 w-full bg-gray-200 rounded overflow-hidden">
              <div
                className="h-full bg-[#1b365d] transition-all"
                style={{ width: `${Math.min(100, uploadProgress)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{uploadProgress}% uploaded</p>
          </div>
        )}
        {!blockId && !pendingFile && (
          <p className="text-xs text-gray-500 mt-1">
            Choose a video file now — it will upload when you save the block.
          </p>
        )}
        {pendingFile && !uploading && (
          <p className="text-xs text-gray-500 mt-1">
            File ready. It will upload when you save the block.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Or paste video URL{pendingFile ? '' : ' *'}
        </label>
        <input
          value={value.videoUrl || ''}
          onChange={(e) => update({ videoUrl: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="https://.../video.mp4"
          disabled={uploading || !!pendingFile}
        />
        <p className="text-xs text-gray-500 mt-1">
          {pendingFile
            ? 'URL is set automatically after the file uploads.'
            : 'Direct video file URL (MP4, WebM, etc.). Title and description are optional. Learners must watch to the end to complete this block.'}
        </p>
        {value.videoUrl && !pendingFile && (
          <p className="text-xs text-gray-500 mt-2 truncate" title={value.videoUrl}>
            {value.videoUrl}
          </p>
        )}
      </div>
    </div>
  );
}
