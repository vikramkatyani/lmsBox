import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import InteractiveBlockImageField from './InteractiveBlockImageField';
import InteractiveBlockIconPicker from './InteractiveBlockIconPicker';
import InteractiveBlockPreview from './InteractiveBlockPreview';
import interactiveLessonsService from '../services/interactiveLessons';
import { withoutPendingImageUrls } from '../utils/pendingBlockImages';

const MAX_PANELS = 10;
const MAX_TITLE = 200;
const MAX_BODY = 2000;
const MAX_HEADING = 200;
const PREVIEW_DEBOUNCE_MS = 450;

const EMPTY_PANEL = { title: '', body: '', imageUrl: '', icon: '' };

function panelsReady(panels) {
  return Array.isArray(panels) && panels.length > 0 && panels.every((panel) => panel.title?.trim() && panel.body?.trim());
}

export default function TabsBlockForm({ value, onChange, blockId }) {
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const panels = Array.isArray(value.panels) ? value.panels : [];
  const update = (patch) => onChange({ ...value, ...patch });

  const previewPayloadKey = useMemo(() => {
    if (!panelsReady(panels)) return '';
    return JSON.stringify({
      heading: value.heading || '',
      panels: withoutPendingImageUrls(panels).map((panel) => ({
        title: panel.title || '',
        body: panel.body || '',
        imageUrl: panel.imageUrl || '',
        icon: panel.icon || '',
      })),
    });
  }, [panels, value.heading]);

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
          'tabs',
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

  const updatePanel = (index, patch) => {
    update({
      panels: panels.map((panel, i) => (i === index ? { ...panel, ...patch } : panel)),
    });
  };

  const addPanel = () => {
    if (panels.length >= MAX_PANELS) {
      toast.error(`Tabs can have at most ${MAX_PANELS} panels`);
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

  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-xs text-gray-500">
        Completes after every tab has been opened. The first tab is shown automatically.
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">Heading</label>
        <input
          value={value.heading || ''}
          onChange={(e) => update({ heading: e.target.value })}
          className="w-full border rounded px-3 py-2"
          placeholder="Optional heading above the tabs"
          maxLength={MAX_HEADING}
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Tabs ({panels.length}/{MAX_PANELS})</h4>

        {panels.length === 0 && (
          <p className="text-sm text-gray-500">No tabs yet. Add at least one tab below.</p>
        )}

        {panels.map((panel, index) => (
          <div key={index} className="border rounded p-4 space-y-3 bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">Tab {index + 1}</span>
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
              <label className="block text-sm font-medium mb-1">Tab title *</label>
              <input
                value={panel.title || ''}
                onChange={(e) => updatePanel(index, { title: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Tab label"
                maxLength={MAX_TITLE}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tab body *</label>
              <textarea
                value={panel.body || ''}
                onChange={(e) => updatePanel(index, { body: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={4}
                placeholder="Content shown when this tab is selected"
                maxLength={MAX_BODY}
              />
            </div>

            <InteractiveBlockIconPicker
              label="Tab icon"
              value={panel.icon || ''}
              onChange={(icon) => updatePanel(index, { icon })}
            />

            <InteractiveBlockImageField
              label="Tab image (optional)"
              url={panel.imageUrl || ''}
              onChange={(imageUrl) => updatePanel(index, { imageUrl })}
              altPreview={panel.title}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={addPanel}
          disabled={panels.length >= MAX_PANELS}
          className="w-full px-4 py-2.5 text-sm border border-dashed border-[#1b365d] text-[#1b365d] rounded hover:bg-[#f8fbff] disabled:opacity-50 disabled:hover:bg-transparent"
        >
          + Add tab
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
            title="Tabs"
            html={previewHtml}
            minHeight={280}
            emptyMessage="Add at least one tab with a title and body to see the live preview."
          />
        </div>
      </div>
    </div>
  );
}
