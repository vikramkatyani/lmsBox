import React, { useState } from 'react';
import interactiveLessonsService from '../services/interactiveLessons';
import toast from 'react-hot-toast';

const ACCEPTED_AUDIO =
  'audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/flac,.mp3,.wav,.ogg,.m4a,.aac,.flac';

export default function AudioBlockForm({
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

  const handleAudioUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!blockId) {
      onPendingFileChange?.(file);
      event.target.value = '';
      return;
    }

    if (!lessonId) {
      toast.error('Save the lesson first before uploading audio');
      event.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const result = await interactiveLessonsService.uploadBlockMedia(lessonId, blockId, file);
      update({ audioUrl: result.url });
      toast.success('Audio uploaded — save the block to keep it');
    } catch (err) {
      console.error(err);
      const status = err.response?.status;
      const message =
        err.response?.data?.message
        || (status === 413 ? 'Audio is too large. Maximum size is 500 MB.' : null)
        || (err.code === 'ECONNABORTED' ? 'Upload timed out. Try a smaller file.' : null)
        || 'Failed to upload audio';
      toast.error(message);
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
          placeholder="Optional title above the audio"
          disabled={uploading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={value.description || ''}
          onChange={(e) => update({ description: e.target.value })}
          className="w-full border rounded px-3 py-2"
          rows={3}
          placeholder="Optional description text under the audio"
          disabled={uploading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Upload audio</label>
        <div className="flex flex-wrap items-center gap-3">
          <label
            className={`inline-flex items-center px-3 py-2 text-sm rounded ${
              uploading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 cursor-pointer hover:bg-gray-200'
            }`}
          >
            {isUploading ? 'Uploading...' : 'Choose audio file'}
            <input
              type="file"
              accept={ACCEPTED_AUDIO}
              className="hidden"
              disabled={uploading}
              onChange={handleAudioUpload}
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
            Choose an audio file now — it will upload when you save the block.
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
          Or paste audio URL{pendingFile ? '' : ' *'}
        </label>
        <input
          value={value.audioUrl || ''}
          onChange={(e) => update({ audioUrl: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="https://.../audio.mp3"
          disabled={uploading || !!pendingFile}
        />
        <p className="text-xs text-gray-500 mt-1">
          {pendingFile
            ? 'URL is set automatically after the file uploads.'
            : 'Supports Azure uploads and direct MP3/WAV/OGG/M4A URLs. Title and description are optional.'}
        </p>
        {value.audioUrl && !pendingFile && (
          <p className="text-xs text-gray-500 mt-2 truncate" title={value.audioUrl}>
            {value.audioUrl}
          </p>
        )}
      </div>
    </div>
  );
}
