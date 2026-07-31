import React from 'react';

export default function TextBlockForm({ value, onChange }) {
  const update = (patch) => onChange({ ...value, ...patch });
  const showContinueButton = value.showContinueButton !== false;

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <label className="block text-sm font-medium mb-1">Heading</label>
        <input
          value={value.heading || ''}
          onChange={(e) => update({ heading: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Optional main heading"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Subheading</label>
        <input
          value={value.subheading || ''}
          onChange={(e) => update({ subheading: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Optional supporting line"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Text content *</label>
        <textarea
          value={value.body || ''}
          onChange={(e) => update({ body: e.target.value })}
          className="w-full border rounded px-3 py-2"
          rows={8}
          placeholder="Main body text for learners..."
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={showContinueButton}
          onChange={(e) => update({ showContinueButton: e.target.checked })}
        />
        <span>
          <span className="font-medium">Show Continue button</span>
          <span className="block text-xs text-gray-500 mt-0.5">
            {showContinueButton
              ? 'Learners must tap Continue to complete this block.'
              : 'No Continue button — the block completes automatically when shown.'}
          </span>
        </span>
      </label>
    </div>
  );
}
