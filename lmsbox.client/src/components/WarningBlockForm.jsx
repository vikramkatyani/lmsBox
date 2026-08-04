import React from 'react';

const MAX_LABEL = 60;
const MAX_BODY = 2000;

export default function WarningBlockForm({ value, onChange }) {
  const update = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-xs text-gray-500">
        Completes automatically when shown to the learner.
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">Label</label>
        <input
          value={value.label ?? ''}
          onChange={(e) => update({ label: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Warning"
          maxLength={MAX_LABEL}
        />
        <p className="text-xs text-gray-500 mt-1">Shown above the message. Defaults to Warning.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Message *</label>
        <textarea
          value={value.body || ''}
          onChange={(e) => update({ body: e.target.value })}
          className="w-full border rounded px-3 py-2"
          rows={4}
          placeholder="The limit, exclusion, or common mistake learners must watch for"
          maxLength={MAX_BODY}
        />
      </div>
    </div>
  );
}
