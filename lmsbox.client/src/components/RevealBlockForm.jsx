import React from 'react';
import toast from 'react-hot-toast';

const MAX_ITEMS = 8;
const MAX_LABEL = 60;
const MAX_TITLE = 200;
const MAX_BODY = 2000;
const MAX_HINT = 160;

const EMPTY_ITEM = { title: '', body: '', variant: 'default', label: '' };

const VARIANTS = [
  { value: 'default', label: 'Default' },
  { value: 'warn', label: 'Warn' },
];

export default function RevealBlockForm({ value, onChange }) {
  const items = Array.isArray(value.items) ? value.items : [];
  const update = (patch) => onChange({ ...value, ...patch });

  const updateItem = (index, patch) => {
    update({
      items: items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
  };

  const addItem = () => {
    if (items.length >= MAX_ITEMS) {
      toast.error(`A click reveal block can have at most ${MAX_ITEMS} panels`);
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
        Completes after every reveal is opened.
      </p>

      <div className="space-y-4">
        <h4 className="font-medium">Reveal panels ({items.length}/{MAX_ITEMS})</h4>

        {items.length === 0 && (
          <p className="text-sm text-gray-500">No panels yet. Add at least one panel below.</p>
        )}

        {items.map((item, index) => (
          <div key={index} className="border rounded p-4 space-y-3 bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">Panel {index + 1}</span>
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
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                value={item.title || ''}
                onChange={(e) => updateItem(index, { title: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Panel heading"
                maxLength={MAX_TITLE}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Hidden body *</label>
              <textarea
                value={item.body || ''}
                onChange={(e) => updateItem(index, { body: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="Content shown once the learner opens this panel"
                maxLength={MAX_BODY}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Style</label>
              <select
                value={item.variant || 'default'}
                onChange={(e) => updateItem(index, { variant: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                {VARIANTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Prompt label</label>
              <input
                value={item.label || ''}
                onChange={(e) => updateItem(index, { label: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Click to reveal"
                maxLength={MAX_LABEL}
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
          + Add panel
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Hint</label>
        <input
          value={value.hint || ''}
          onChange={(e) => update({ hint: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="e.g. Select a card to reveal the answer"
          maxLength={MAX_HINT}
        />
        <p className="text-xs text-gray-500 mt-1">Optional nudge shown under the panels.</p>
      </div>
    </div>
  );
}
