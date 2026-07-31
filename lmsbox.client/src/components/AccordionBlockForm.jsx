import React, { useEffect, useMemo, useState } from 'react';
import interactiveLessonsService from '../services/interactiveLessons';
import InteractiveBlockPreview from './InteractiveBlockPreview';
import toast from 'react-hot-toast';

const MAX_PANELS = 10;
const MAX_AI_PANELS = 10;
const PREVIEW_DEBOUNCE_MS = 450;

const EMPTY_PANEL = { title: '', body: '' };

function panelsReadyForPreview(panels) {
  if (!Array.isArray(panels) || panels.length === 0) return false;
  return panels.every((panel) => panel.title?.trim() && panel.body?.trim());
}

export default function AccordionBlockForm({ value, onChange, blockId }) {
  const [aiPanelCount, setAiPanelCount] = useState(4);
  const [isGeneratingPanels, setIsGeneratingPanels] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const panels = value.panels || [];
  const update = (patch) => onChange({ ...value, ...patch });

  const previewPayloadKey = useMemo(() => {
    if (!panelsReadyForPreview(panels)) return '';
    return JSON.stringify({
      contentDescription: value.contentDescription || 'Accordion preview',
      panels: panels.map((panel) => ({
        title: panel.title || '',
        body: panel.body || '',
      })),
    });
  }, [panels, value.contentDescription]);

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
        const payload = JSON.parse(previewPayloadKey);
        if (!payload.contentDescription?.trim()) {
          payload.contentDescription = 'Accordion preview';
        }
        const result = await interactiveLessonsService.renderBlockTemplate('accordion', payload, blockId || 0);
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

  const updatePanel = (index, patch) => {
    update({
      panels: panels.map((panel, i) => (i === index ? { ...panel, ...patch } : panel)),
    });
  };

  const addPanel = () => {
    if (panels.length >= MAX_PANELS) {
      toast.error(`An accordion can have at most ${MAX_PANELS} panels`);
      return;
    }
    update({ panels: [...panels, { ...EMPTY_PANEL }] });
  };

  const removePanel = (index) => {
    update({ panels: panels.filter((_, i) => i !== index) });
  };

  const movePanel = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= panels.length) return;
    const reordered = [...panels];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    update({ panels: reordered });
  };

  const hasExistingPanelContent = () =>
    panels.some((panel) => panel.title?.trim() || panel.body?.trim());

  const handleGeneratePanels = async () => {
    const description = value.contentDescription?.trim();
    if (!description) {
      toast.error('Enter a content description before generating panels');
      return;
    }

    const count = Number(aiPanelCount);
    if (!Number.isFinite(count) || count < 1 || count > MAX_AI_PANELS) {
      toast.error(`Enter a number between 1 and ${MAX_AI_PANELS}`);
      return;
    }

    if (hasExistingPanelContent()) {
      const confirmed = window.confirm(
        'This will replace your current panels with AI-generated content. Continue?'
      );
      if (!confirmed) return;
    }

    setIsGeneratingPanels(true);
    try {
      const result = await interactiveLessonsService.generateAccordionPanels(description, count);
      const generated = (result.panels || []).map((panel) => ({
        title: panel.title || '',
        body: panel.body || '',
      }));

      if (!generated.length) {
        toast.error('No panels were generated. Please try again.');
        return;
      }

      update({ panels: generated });
      toast.success(`Generated ${generated.length} panel${generated.length === 1 ? '' : 's'}`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to generate panels');
    } finally {
      setIsGeneratingPanels(false);
    }
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <label className="block text-sm font-medium mb-1">Content description *</label>
        <textarea
          value={value.contentDescription || ''}
          onChange={(e) => update({ contentDescription: e.target.value })}
          className="w-full border rounded px-3 py-2"
          rows={4}
          placeholder="Describe what learners should learn from this accordion..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Learners must expand every panel to complete this block.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Panels ({panels.length}/{MAX_PANELS})</h4>

        {panels.length === 0 && (
          <p className="text-sm text-gray-500">
            No panels yet. Add panels manually below, or use AI as an optional starting point.
          </p>
        )}

        {panels.map((panel, index) => (
          <div key={index} className="border rounded p-4 space-y-3 bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">Panel {index + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => movePanel(index, 'up')}
                  disabled={index === 0}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => movePanel(index, 'down')}
                  disabled={index === panels.length - 1}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removePanel(index)}
                  className="text-sm text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Panel title *</label>
              <input
                value={panel.title || ''}
                onChange={(e) => updatePanel(index, { title: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Section heading"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Panel body *</label>
              <textarea
                value={panel.body || ''}
                onChange={(e) => updatePanel(index, { body: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={4}
                placeholder="Content revealed when the panel is expanded"
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addPanel}
          disabled={panels.length >= MAX_PANELS}
          className="w-full px-4 py-2.5 text-sm border border-dashed border-[#1b365d] text-[#1b365d] rounded hover:bg-[#f8fbff] disabled:opacity-50 disabled:hover:bg-transparent"
        >
          + Add new panel
        </button>
      </div>

      <div className="rounded-lg border border-[#d9e5f2] bg-[#f8fbff] p-4 space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-[#1b365d]">Optional: generate panels with AI</h4>
          <p className="text-xs text-gray-600 mt-1">
            Creates up to {MAX_AI_PANELS} panels from the content description. You can edit titles and body text afterwards.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Number of panels</label>
            <input
              type="number"
              min={1}
              max={MAX_AI_PANELS}
              value={aiPanelCount}
              onChange={(e) => setAiPanelCount(e.target.value)}
              className="w-28 border rounded px-3 py-2"
            />
          </div>
          <button
            type="button"
            onClick={handleGeneratePanels}
            disabled={isGeneratingPanels || !value.contentDescription?.trim()}
            className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 disabled:opacity-50"
          >
            {isGeneratingPanels ? 'Generating...' : 'Generate panels'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-[#1b365d]">Live preview</h4>
          {isPreviewLoading && (
            <span className="text-xs text-gray-500">Updating…</span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Shows how learners will see this accordion. Fill in title and body for every panel to enable preview.
        </p>
        {previewError && (
          <p className="text-xs text-red-600">{previewError}</p>
        )}
        <div className="border rounded bg-[#f8fafc] overflow-hidden">
          <InteractiveBlockPreview
            title="Accordion"
            html={previewHtml}
            minHeight={280}
            emptyMessage="Add at least one panel with a title and body to see the live preview."
          />
        </div>
      </div>
    </div>
  );
}
