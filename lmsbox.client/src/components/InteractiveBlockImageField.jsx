import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  attachPendingImage,
  getPendingImageFile,
  isPendingImageUrl,
  releasePendingImage,
} from '../utils/pendingBlockImages';

export default function InteractiveBlockImageField({
  label = 'Image (optional)',
  url = '',
  onChange,
  altPreview = '',
  showPreview = true,
  helperText = 'The image uploads when you save the block.',
}) {
  const [fileKey, setFileKey] = useState(0);
  const pendingFile = getPendingImageFile(url);

  const replaceUrl = (nextUrl) => {
    if (isPendingImageUrl(url) && url !== nextUrl) {
      releasePendingImage(url);
    }
    onChange(nextUrl);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    setFileKey((key) => key + 1);
    if (!file) return;

    if (file.type && !file.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return;
    }

    replaceUrl(attachPendingImage(file));
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        value={pendingFile ? '' : (url || '')}
        onChange={(e) => replaceUrl(e.target.value)}
        className="mb-2 w-full rounded border px-3 py-2"
        placeholder={pendingFile ? pendingFile.name : 'https://...'}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200">
          {pendingFile ? 'Change image' : 'Upload image'}
          <input
            key={fileKey}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </label>
        {pendingFile && (
          <span className="text-xs text-gray-600" title={pendingFile.name}>
            Ready to upload: {pendingFile.name}
          </span>
        )}
      </div>
      {helperText && !pendingFile && (
        <p className="mt-1 text-xs text-gray-500">{helperText}</p>
      )}
      {url && showPreview ? (
        <div className="mt-2 space-y-1">
          <img
            src={url}
            alt={altPreview || ''}
            className="max-h-32 rounded border object-contain bg-white"
          />
          <button type="button" className="text-xs text-red-600" onClick={() => replaceUrl('')}>
            Remove image
          </button>
        </div>
      ) : null}
      {url && !showPreview ? (
        <button type="button" className="mt-2 text-xs text-red-600" onClick={() => replaceUrl('')}>
          Remove image
        </button>
      ) : null}
    </div>
  );
}
