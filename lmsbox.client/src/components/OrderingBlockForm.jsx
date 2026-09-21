import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import InteractiveBlockPreview from './InteractiveBlockPreview';
import interactiveLessonsService from '../services/interactiveLessons';

const MIN_ITEMS = 2;
const MAX_ITEMS = 10;
const MAX_ITEM = 300;
const MAX_INSTRUCTION = 1000;
const MAX_HINT = 160;
const MAX_FEEDBACK = 1000;
const PREVIEW_DEBOUNCE_MS = 450;

const EMPTY_ITEM = { text: '' };

function itemsReady(items) {
  return Array.isArray(items)
    && items.length >= MIN_ITEMS
    && items.every((item) => item.text?.trim());
}

export default function OrderingBlockForm({ value, onChange, blockId }) {
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const items = Array.isArray(value.items) ? value.items : [];
  const update = (patch) => onChange({ ...value, ...patch });

  const previewPayloadKey = useMemo(() => {
    if (!itemsReady(items)) return '';
    return JSON.stringify({
      instruction: value.instruction || '',
      hint: value.hint || '',
      correctFeedback: value.correctFeedback || '',
      incorrectFeedback: value.incorrectFeedback || '',
      items: items.map((item) => ({ text: item.text || '' })),
    });
  }, [items, value.instruction, value.hint, value.correctFeedback, value.incorrectFeedback]);

  useEffect(() => {
    if (!previewPayloadKey) {
      setPreviewHtml('');
      setPreviewError('');
      setIsPreviewLoading(false);
      return undefined;
    }

    let cancelled = false;
    setIsPreviewLoading(true);
    setPreviewError('');

    const timer = setTimeout(async () => {
      try {
        const result = await interactiveLessonsService.renderBlockTemplate(
          'ordering',
          JSON.parse(previewPayloadKey),
          blockId || 0
        );
        if (cancelled) return;
        setPreviewHtml(result.html || '');
        setPreviewError('');
      } catch (err) {
        if (cancelled) return;
        setPreviewHtml('');
        setPreviewError(err.response?.data?.message || 'Unable to render live preview');
      } finally {
        if (!cancelled) setIsPreviewLoading(false);
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [previewPayloadKey, blockId]);

  const updateItem = (index, patch) => {
    update({
      items: items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  };

  const addItem = () => {
    if (items.length >= MAX_ITEMS) {
      toast.error(`An ordering block can have at most ${MAX_ITEMS} items`);
      return;
    }
    update({ items: [...items, { ...EMPTY_ITEM }] });
  };

  const removeItem = (index) => {
    update({ items: items.filter((_, i) => i !== index) });
  };

  const moveItem = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    update({ items: reordered });
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-xs text-gray-500">
        Add items in the correct order. Learners see them shuffled and rearrange them. Completes after they check their answer.
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">Instruction</label>
        <textarea
          value={value.instruction || ''}
          onChange={(e) => update({ instruction: e.target.value })}
          className="w-full border rounded px-3 py-2"
          rows={3}
          placeholder="Put these steps in the correct order."
          maxLength={MAX_INSTRUCTION}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Hint</label>
        <input
          value={value.hint || ''}
          onChange={(e) => update({ hint: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Use the arrows to rearrange, then check your answer."
          maxLength={MAX_HINT}
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Correct order ({items.length}/{MAX_ITEMS})</h4>

        {items.length === 0 && (
          <p className="text-sm text-gray-500">No items yet. Add at least {MIN_ITEMS} items in the correct sequence.</p>
        )}

        {items.map((item, index) => (
          <div key={index} className="border rounded p-4 space-y-3 bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">Item {index + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveItem(index, 'up')}
                  disabled={index === 0}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 'down')}
                  disabled={index === items.length - 1}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-sm text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Text *</label>
              <textarea
                value={item.text || ''}
                onChange={(e) => updateItem(index, { text: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={2}
                placeholder="Item in its correct position"
                maxLength={MAX_ITEM}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addItem}
          disabled={items.length >= MAX_ITEMS}
          className="w-full px-4 py-2.5 text-sm border border-dashed border-[#1b365d] text-[#1b365d] rounded hover:bg-[#f8fbff] disabled:opacity-50 disabled:hover:bg-transparent"
        >
          + Add item
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Correct feedback</label>
        <textarea
          value={value.correctFeedback || ''}
          onChange={(e) => update({ correctFeedback: e.target.value })}
          className="w-full border rounded px-3 py-2"
          rows={2}
          placeholder="You put every item in the right order."
          maxLength={MAX_FEEDBACK}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Incorrect feedback</label>
        <textarea
          value={value.incorrectFeedback || ''}
          onChange={(e) => update({ incorrectFeedback: e.target.value })}
          className="w-full border rounded px-3 py-2"
          rows={2}
          placeholder="That order is not quite right. Rearrange the items and check again."
          maxLength={MAX_FEEDBACK}
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-[#1b365d]">Live preview</h4>
          {isPreviewLoading && <span className="text-xs text-gray-500">Updating…</span>}
        </div>
        {previewError && <p className="text-xs text-red-600">{previewError}</p>}
        <div className="border rounded bg-[#f8fafc] overflow-hidden">
          <InteractiveBlockPreview
            title="Ordering"
            html={previewHtml}
            minHeight={280}
            emptyMessage={`Add at least ${MIN_ITEMS} items to see the live preview.`}
          />
        </div>
      </div>
    </div>
  );
}
