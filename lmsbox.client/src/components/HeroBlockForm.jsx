import React from 'react';
import interactiveLessonsService from '../services/interactiveLessons';
import toast from 'react-hot-toast';

const MAX_KICKER = 120;
const MAX_TITLE = 200;
const MAX_INTRO = 500;
const MAX_PILLS = 6;
const MAX_PILL_LENGTH = 40;

export default function HeroBlockForm({ value, onChange, lessonId, blockId }) {
  const update = (patch) => onChange({ ...value, ...patch });
  const metaPills = Array.isArray(value.metaPills) ? value.metaPills : [];

  const updatePill = (index, text) => {
    const next = metaPills.map((pill, i) => (i === index ? text : pill));
    update({ metaPills: next });
  };

  const addPill = () => {
    if (metaPills.length >= MAX_PILLS) return;
    update({ metaPills: [...metaPills, ''] });
  };

  const removePill = (index) => {
    update({ metaPills: metaPills.filter((_, i) => i !== index) });
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !lessonId || !blockId) {
      if (!blockId) toast.error('Save the block first before uploading images');
      return;
    }

    try {
      const result = await interactiveLessonsService.uploadBlockMedia(lessonId, blockId, file);
      update({ backgroundImageUrl: result.url });
      toast.success('Background image uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      event.target.value = '';
    }
  };

  const clearImage = () => update({ backgroundImageUrl: '' });

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-xs text-gray-500">
        Completes automatically when shown to the learner.
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">Kicker</label>
        <input
          value={value.kicker || ''}
          onChange={(e) => update({ kicker: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="e.g. Module introduction"
          maxLength={MAX_KICKER}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Title *</label>
        <input
          value={value.title || ''}
          onChange={(e) => update({ title: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Main hero heading"
          maxLength={MAX_TITLE}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Intro</label>
        <textarea
          value={value.intro || ''}
          onChange={(e) => update({ intro: e.target.value })}
          className="w-full border rounded px-3 py-2"
          rows={3}
          placeholder="Optional supporting sentence"
          maxLength={MAX_INTRO}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label className="block text-sm font-medium">Meta pills ({metaPills.length}/{MAX_PILLS})</label>
          <button
            type="button"
            onClick={addPill}
            disabled={metaPills.length >= MAX_PILLS}
            className="px-3 py-1.5 text-sm border border-dashed border-[#1b365d] text-[#1b365d] rounded hover:bg-[#f8fbff] disabled:opacity-50"
          >
            + Add pill
          </button>
        </div>
        {metaPills.length === 0 && (
          <p className="text-xs text-gray-500">Optional short labels such as duration or format.</p>
        )}
        {metaPills.map((pill, index) => (
          <div key={index} className="flex gap-2 items-center">
            <input
              value={pill}
              onChange={(e) => updatePill(index, e.target.value)}
              className="flex-1 border rounded px-3 py-2"
              placeholder={`Pill ${index + 1}`}
              maxLength={MAX_PILL_LENGTH}
            />
            <button
              type="button"
              onClick={() => removePill(index)}
              className="text-sm text-red-600 shrink-0"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Background image (optional)</label>
        <input
          value={value.backgroundImageUrl || ''}
          onChange={(e) => update({ backgroundImageUrl: e.target.value })}
          className="w-full border rounded px-3 py-2 mb-2"
          placeholder="Image URL"
        />
        <div className="flex flex-wrap items-center gap-3">
          {blockId ? (
            <label className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded cursor-pointer hover:bg-gray-200">
              Upload image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>
          ) : (
            <p className="text-xs text-gray-500">Save the block first to upload images.</p>
          )}
          {value.backgroundImageUrl && (
            <button
              type="button"
              onClick={clearImage}
              className="text-xs text-gray-500 hover:text-gray-800 underline"
            >
              Clear image
            </button>
          )}
        </div>
        {value.backgroundImageUrl && (
          <p className="text-xs text-gray-500 mt-2 truncate" title={value.backgroundImageUrl}>
            {value.backgroundImageUrl}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Without an image, the hero uses the solid primary style with decorative orbs.
        </p>
      </div>
    </div>
  );
}
