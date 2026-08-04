import React from 'react';
import toast from 'react-hot-toast';

const MAX_STAGES = 10;
const MAX_TITLE = 200;
const MAX_BODY = 2000;
const MAX_HINT = 160;

const EMPTY_STAGE = { title: '', body: '' };

export default function TimelineBlockForm({ value, onChange }) {
  const stages = Array.isArray(value.stages) ? value.stages : [];
  const update = (patch) => onChange({ ...value, ...patch });

  const updateStage = (index, patch) => {
    update({
      stages: stages.map((stage, i) => (i === index ? { ...stage, ...patch } : stage)),
    });
  };

  const addStage = () => {
    if (stages.length >= MAX_STAGES) {
      toast.error(`A timeline can have at most ${MAX_STAGES} stages`);
      return;
    }
    update({ stages: [...stages, { ...EMPTY_STAGE }] });
  };

  const removeStage = (index) => {
    update({ stages: stages.filter((_, i) => i !== index) });
  };

  const moveStage = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= stages.length) return;
    const reordered = [...stages];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    update({ stages: reordered });
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-xs text-gray-500">
        Completes after every stage has been opened. Stages are numbered automatically.
      </p>

      <div className="space-y-4">
        <h4 className="font-medium">Stages ({stages.length}/{MAX_STAGES})</h4>

        {stages.length === 0 && (
          <p className="text-sm text-gray-500">No stages yet. Add at least one stage below.</p>
        )}

        {stages.map((stage, index) => (
          <div key={index} className="border rounded p-4 space-y-3 bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">Stage {index + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveStage(index, 'up')}
                  disabled={index === 0}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveStage(index, 'down')}
                  disabled={index === stages.length - 1}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeStage(index)}
                  className="text-sm text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                value={stage.title || ''}
                onChange={(e) => updateStage(index, { title: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Stage heading"
                maxLength={MAX_TITLE}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Body *</label>
              <textarea
                value={stage.body || ''}
                onChange={(e) => updateStage(index, { body: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="What happens at this stage"
                maxLength={MAX_BODY}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addStage}
          disabled={stages.length >= MAX_STAGES}
          className="w-full px-4 py-2.5 text-sm border border-dashed border-[#1b365d] text-[#1b365d] rounded hover:bg-[#f8fbff] disabled:opacity-50 disabled:hover:bg-transparent"
        >
          + Add stage
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Hint</label>
        <input
          value={value.hint ?? ''}
          onChange={(e) => update({ hint: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Select a stage to expand it"
          maxLength={MAX_HINT}
        />
        <p className="text-xs text-gray-500 mt-1">
          Optional nudge shown above the timeline. Defaults to Select a stage to expand it.
        </p>
      </div>
    </div>
  );
}
