import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import InteractiveBlockImageField from './InteractiveBlockImageField';
import InteractiveBlockIconPicker from './InteractiveBlockIconPicker';
import InteractiveBlockPreview from './InteractiveBlockPreview';
import interactiveLessonsService from '../services/interactiveLessons';
import { withoutPendingImageUrls } from '../utils/pendingBlockImages';

const MAX_NODES = 10;
const MAX_TITLE = 200;
const MAX_BODY = 2000;
const MAX_HEADING = 200;
const MAX_HINT = 160;
const PREVIEW_DEBOUNCE_MS = 450;

const VARIANTS = [
  { value: 'start', label: 'Start' },
  { value: 'step', label: 'Step' },
  { value: 'decision', label: 'Decision' },
  { value: 'end', label: 'End' },
];

const EMPTY_NODE = { title: '', body: '', imageUrl: '', icon: '', variant: 'step' };

function nodesReady(nodes) {
  return Array.isArray(nodes) && nodes.length > 0 && nodes.every((node) => node.title?.trim() && node.body?.trim());
}

export default function FlowchartBlockForm({ value, onChange, blockId }) {
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const nodes = Array.isArray(value.nodes) ? value.nodes : [];
  const update = (patch) => onChange({ ...value, ...patch });

  const previewPayloadKey = useMemo(() => {
    if (!nodesReady(nodes)) return '';
    return JSON.stringify({
      heading: value.heading || '',
      hint: value.hint || '',
      nodes: withoutPendingImageUrls(nodes).map((node) => ({
        title: node.title || '',
        body: node.body || '',
        imageUrl: node.imageUrl || '',
        icon: node.icon || '',
        variant: node.variant || 'step',
      })),
    });
  }, [nodes, value.heading, value.hint]);

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
          'flowchart',
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

  const updateNode = (index, patch) => {
    update({
      nodes: nodes.map((node, i) => (i === index ? { ...node, ...patch } : node)),
    });
  };

  const addNode = () => {
    if (nodes.length >= MAX_NODES) {
      toast.error(`A flowchart can have at most ${MAX_NODES} stages`);
      return;
    }
    const variant = nodes.length === 0 ? 'start' : 'step';
    update({ nodes: [...nodes, { ...EMPTY_NODE, variant }] });
  };

  const removeNode = (index) => {
    update({ nodes: nodes.filter((_, i) => i !== index) });
  };

  const moveNode = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= nodes.length) return;
    const reordered = [...nodes];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    update({ nodes: reordered });
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-xs text-gray-500">
        Completes after every stage has been opened. Learners select a node to read its detail.
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">Heading</label>
        <input
          value={value.heading || ''}
          onChange={(e) => update({ heading: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Optional heading above the flowchart"
          maxLength={MAX_HEADING}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Hint</label>
        <input
          value={value.hint || ''}
          onChange={(e) => update({ hint: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Select a stage to read more"
          maxLength={MAX_HINT}
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Stages ({nodes.length}/{MAX_NODES})</h4>

        {nodes.length === 0 && (
          <p className="text-sm text-gray-500">No stages yet. Add at least one stage below.</p>
        )}

        {nodes.map((node, index) => (
          <div key={index} className="border rounded p-4 space-y-3 bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">Stage {index + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveNode(index, 'up')}
                  disabled={index === 0}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveNode(index, 'down')}
                  disabled={index === nodes.length - 1}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeNode(index)}
                  className="text-sm text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                value={node.title || ''}
                onChange={(e) => updateNode(index, { title: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Stage heading"
                maxLength={MAX_TITLE}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Body *</label>
              <textarea
                value={node.body || ''}
                onChange={(e) => updateNode(index, { body: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="Detail shown when this stage is selected"
                maxLength={MAX_BODY}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Shape</label>
              <select
                value={node.variant || 'step'}
                onChange={(e) => updateNode(index, { variant: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                {VARIANTS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <InteractiveBlockIconPicker
              label="Stage icon"
              value={node.icon || ''}
              onChange={(icon) => updateNode(index, { icon })}
            />

            <InteractiveBlockImageField
              label="Stage image (optional)"
              url={node.imageUrl || ''}
              onChange={(imageUrl) => updateNode(index, { imageUrl })}
              altPreview={node.title}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={addNode}
          disabled={nodes.length >= MAX_NODES}
          className="w-full px-4 py-2.5 text-sm border border-dashed border-[#1b365d] text-[#1b365d] rounded hover:bg-[#f8fbff] disabled:opacity-50 disabled:hover:bg-transparent"
        >
          + Add stage
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-[#1b365d]">Live preview</h4>
          {isPreviewLoading && <span className="text-xs text-gray-500">Updating…</span>}
        </div>
        {previewError && <p className="text-xs text-red-600">{previewError}</p>}
        <div className="border rounded bg-[#f8fafc] overflow-hidden">
          <InteractiveBlockPreview
            title="Flowchart"
            html={previewHtml}
            minHeight={320}
            emptyMessage="Add at least one stage with a title and body to see the live preview."
          />
        </div>
      </div>
    </div>
  );
}
