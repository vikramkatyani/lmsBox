import React from 'react';

const MAX_LABEL = 60;
const MAX_TITLE = 200;
const MAX_PROMPT = 500;
const MAX_PLACEHOLDER = 160;

export default function ReflectionBlockForm({ value, onChange }) {
  const update = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-xs text-gray-500">
        Completes once the learner saves a non-empty reflection.
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">Label</label>
        <input
          value={value.label ?? ''}
          onChange={(e) => update({ label: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Your reflection"
          maxLength={MAX_LABEL}
        />
        <p className="text-xs text-gray-500 mt-1">Shown above the question. Defaults to Your reflection.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Question *</label>
        <input
          value={value.title || ''}
          onChange={(e) => update({ title: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="The question learners answer in their own words"
          maxLength={MAX_TITLE}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Prompt</label>
        <textarea
          value={value.prompt || ''}
          onChange={(e) => update({ prompt: e.target.value })}
          className="w-full border rounded px-3 py-2"
          rows={3}
          placeholder="e.g. There is no right answer here — write what comes to mind."
          maxLength={MAX_PROMPT}
        />
        <p className="text-xs text-gray-500 mt-1">Optional supporting sentence under the question.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Placeholder</label>
        <input
          value={value.placeholder || ''}
          onChange={(e) => update({ placeholder: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Write a few sentences…"
          maxLength={MAX_PLACEHOLDER}
        />
        <p className="text-xs text-gray-500 mt-1">Optional hint text shown inside the empty answer box.</p>
      </div>
    </div>
  );
}
