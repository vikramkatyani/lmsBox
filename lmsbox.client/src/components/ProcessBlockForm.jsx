import React from 'react';
import toast from 'react-hot-toast';

const MAX_STEPS = 8;
const MAX_STEP_TITLE = 200;
const MAX_STEP_BODY = 1000;
const MAX_NODE_LABEL = 60;
const MAX_BUTTON_LABEL = 60;
const MAX_FINISH_MESSAGE = 500;

const EMPTY_STEP = { title: '', body: '' };

/** Stage labels are stored as objects, but older payloads may hold plain strings. */
function readNodeLabel(node) {
  if (typeof node === 'string') return node;
  return node?.label || '';
}

export default function ProcessBlockForm({ value, onChange }) {
  const steps = Array.isArray(value.steps) ? value.steps : [];
  const nodes = Array.isArray(value.nodes) ? value.nodes : [];
  const nodeLabels = steps.map((_, index) => readNodeLabel(nodes[index]));
  const filledLabelCount = nodeLabels.filter((label) => label.trim()).length;

  const update = (patch) => onChange({ ...value, ...patch });

  const commit = (nextSteps, nextLabels) => {
    update({ steps: nextSteps, nodes: nextLabels.map((label) => ({ label })) });
  };

  const updateStep = (index, patch) => {
    update({
      steps: steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    });
  };

  const updateNodeLabel = (index, label) => {
    commit(steps, nodeLabels.map((current, i) => (i === index ? label : current)));
  };

  const addStep = () => {
    if (steps.length >= MAX_STEPS) {
      toast.error(`A process flow can have at most ${MAX_STEPS} steps`);
      return;
    }
    commit([...steps, { ...EMPTY_STEP }], [...nodeLabels, '']);
  };

  const removeStep = (index) => {
    commit(
      steps.filter((_, i) => i !== index),
      nodeLabels.filter((_, i) => i !== index)
    );
  };

  const moveStep = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;
    const reorderedSteps = [...steps];
    const reorderedLabels = [...nodeLabels];
    [reorderedSteps[index], reorderedSteps[newIndex]] = [reorderedSteps[newIndex], reorderedSteps[index]];
    [reorderedLabels[index], reorderedLabels[newIndex]] = [reorderedLabels[newIndex], reorderedLabels[index]];
    commit(reorderedSteps, reorderedLabels);
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-xs text-gray-500">
        Completes after every step has been revealed. Learners reveal one step at a time.
      </p>

      <div className="space-y-4">
        <h4 className="font-medium">Steps ({steps.length}/{MAX_STEPS})</h4>

        {steps.length === 0 && (
          <p className="text-sm text-gray-500">No steps yet. Add at least one step below.</p>
        )}

        {steps.map((step, index) => (
          <div key={index} className="border rounded p-4 space-y-3 bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">Step {index + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveStep(index, 'up')}
                  disabled={index === 0}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(index, 'down')}
                  disabled={index === steps.length - 1}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  className="text-sm text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                value={step.title || ''}
                onChange={(e) => updateStep(index, { title: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Step heading"
                maxLength={MAX_STEP_TITLE}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Body *</label>
              <textarea
                value={step.body || ''}
                onChange={(e) => updateStep(index, { body: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="What happens during this step"
                maxLength={MAX_STEP_BODY}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Stage label</label>
              <input
                value={nodeLabels[index] || ''}
                onChange={(e) => updateNodeLabel(index, e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="Short label for the diagram above the steps"
                maxLength={MAX_NODE_LABEL}
              />
            </div>
          </div>
        ))}

        {filledLabelCount > 0 && filledLabelCount < steps.length && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Fill in a stage label for every step, or clear them all. Partly filled labels are ignored and the
            diagram falls back to the step titles.
          </p>
        )}

        {filledLabelCount === 0 && steps.length > 0 && (
          <p className="text-xs text-gray-500">
            Stage labels are optional — leave them blank to derive the diagram from the step titles.
          </p>
        )}

        <button
          type="button"
          onClick={addStep}
          disabled={steps.length >= MAX_STEPS}
          className="w-full px-4 py-2.5 text-sm border border-dashed border-[#1b365d] text-[#1b365d] rounded hover:bg-[#f8fbff] disabled:opacity-50 disabled:hover:bg-transparent"
        >
          + Add step
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Start button label</label>
        <input
          value={value.startButtonLabel ?? ''}
          onChange={(e) => update({ startButtonLabel: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Start the sequence"
          maxLength={MAX_BUTTON_LABEL}
        />
        <p className="text-xs text-gray-500 mt-1">
          Label for the button that reveals the first step. Defaults to Start the sequence.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Finish message</label>
        <textarea
          value={value.finishMessage || ''}
          onChange={(e) => update({ finishMessage: e.target.value })}
          className="w-full border rounded px-3 py-2"
          rows={3}
          placeholder="Optional takeaway shown once every step has been revealed"
          maxLength={MAX_FINISH_MESSAGE}
        />
      </div>
    </div>
  );
}
