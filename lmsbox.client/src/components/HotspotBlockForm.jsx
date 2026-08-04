import React from 'react';
import interactiveLessonsService from '../services/interactiveLessons';
import toast from 'react-hot-toast';

const MAX_PINS = 12;
const MAX_IMAGE_URL = 2000;
const MAX_IMAGE_ALT = 300;
const MAX_PIN_TITLE = 120;
const MAX_PIN_BODY = 600;

const EMPTY_PIN = { topPercent: 50, leftPercent: 50, title: '', body: '' };

function clampPercent(raw) {
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(100, Math.max(0, parsed));
}

export default function HotspotBlockForm({ value, onChange, lessonId, blockId }) {
  const pins = Array.isArray(value.pins) ? value.pins : [];
  const update = (patch) => onChange({ ...value, ...patch });

  const updatePin = (index, patch) => {
    update({
      pins: pins.map((pin, i) => (i === index ? { ...pin, ...patch } : pin)),
    });
  };

  const addPin = () => {
    if (pins.length >= MAX_PINS) {
      toast.error(`A hotspot diagram can have at most ${MAX_PINS} pins`);
      return;
    }
    update({ pins: [...pins, { ...EMPTY_PIN }] });
  };

  const removePin = (index) => {
    update({ pins: pins.filter((_, i) => i !== index) });
  };

  const movePin = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= pins.length) return;
    const reordered = [...pins];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    update({ pins: reordered });
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !lessonId || !blockId) {
      if (!blockId) toast.error('Save the block first before uploading images');
      return;
    }

    try {
      const result = await interactiveLessonsService.uploadBlockMedia(lessonId, blockId, file);
      update({ imageUrl: result.url });
      toast.success('Diagram image uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      event.target.value = '';
    }
  };

  const clearImage = () => update({ imageUrl: '' });

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-xs text-gray-500">
        Completes after every pin has been opened.
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">Diagram image *</label>
        <input
          value={value.imageUrl || ''}
          onChange={(e) => update({ imageUrl: e.target.value })}
          className="w-full border rounded px-3 py-2 mb-2"
          placeholder="Image URL"
          maxLength={MAX_IMAGE_URL}
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
          {value.imageUrl && (
            <button
              type="button"
              onClick={clearImage}
              className="text-xs text-gray-500 hover:text-gray-800 underline"
            >
              Clear image
            </button>
          )}
        </div>
        {value.imageUrl && (
          <p className="text-xs text-gray-500 mt-2 truncate" title={value.imageUrl}>
            {value.imageUrl}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Image description</label>
        <input
          value={value.imageAlt || ''}
          onChange={(e) => update({ imageAlt: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Alternative text describing the diagram"
          maxLength={MAX_IMAGE_ALT}
        />
        <p className="text-xs text-gray-500 mt-1">Read aloud by screen readers instead of the image.</p>
      </div>

      {value.imageUrl && (
        <div>
          <label className="block text-sm font-medium mb-1">Pin positions</label>
          <div className="relative border rounded overflow-hidden bg-gray-50">
            <img src={value.imageUrl} alt="" className="w-full block" />
            {pins.map((pin, index) => (
              <span
                key={index}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#1b365d] text-white text-xs flex items-center justify-center shadow"
                style={{
                  top: `${clampPercent(pin.topPercent)}%`,
                  left: `${clampPercent(pin.leftPercent)}%`,
                }}
              >
                {index + 1}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Preview of where each pin sits. Adjust the percentages below to move them.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <h4 className="font-medium">Pins ({pins.length}/{MAX_PINS})</h4>

        {pins.length === 0 && (
          <p className="text-sm text-gray-500">No pins yet. Add at least one pin below.</p>
        )}

        {pins.map((pin, index) => (
          <div key={index} className="border rounded p-4 space-y-3 bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">Pin {index + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => movePin(index, 'up')}
                  disabled={index === 0}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => movePin(index, 'down')}
                  disabled={index === pins.length - 1}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removePin(index)}
                  className="text-sm text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Top position (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={pin.topPercent ?? ''}
                  onChange={(e) => updatePin(index, { topPercent: e.target.value })}
                  onBlur={() => updatePin(index, { topPercent: clampPercent(pin.topPercent) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Left position (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={pin.leftPercent ?? ''}
                  onChange={(e) => updatePin(index, { leftPercent: e.target.value })}
                  onBlur={() => updatePin(index, { leftPercent: clampPercent(pin.leftPercent) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                value={pin.title || ''}
                onChange={(e) => updatePin(index, { title: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="What this part of the diagram is"
                maxLength={MAX_PIN_TITLE}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Body *</label>
              <textarea
                value={pin.body || ''}
                onChange={(e) => updatePin(index, { body: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="Detail shown when the learner opens this pin"
                maxLength={MAX_PIN_BODY}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addPin}
          disabled={pins.length >= MAX_PINS}
          className="w-full px-4 py-2.5 text-sm border border-dashed border-[#1b365d] text-[#1b365d] rounded hover:bg-[#f8fbff] disabled:opacity-50 disabled:hover:bg-transparent"
        >
          + Add pin
        </button>
      </div>
    </div>
  );
}
