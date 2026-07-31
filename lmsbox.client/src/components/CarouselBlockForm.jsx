import React, { useEffect, useMemo, useState } from 'react';
import interactiveLessonsService from '../services/interactiveLessons';
import InteractiveBlockPreview from './InteractiveBlockPreview';
import toast from 'react-hot-toast';

const MAX_SLIDES = 10;
const MAX_AI_SLIDES = 10;
const PREVIEW_DEBOUNCE_MS = 450;

const EMPTY_SLIDE = { title: '', body: '', imageUrl: '' };

function slidesReadyForPreview(slides) {
  if (!Array.isArray(slides) || slides.length === 0) return false;
  return slides.every((slide) => slide.title?.trim() && slide.body?.trim());
}

export default function CarouselBlockForm({
  value,
  onChange,
  lessonId,
  blockId,
}) {
  const [aiSlideCount, setAiSlideCount] = useState(4);
  const [isGeneratingSlides, setIsGeneratingSlides] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const slides = value.slides || [];
  const update = (patch) => onChange({ ...value, ...patch });

  const previewPayloadKey = useMemo(() => {
    if (!slidesReadyForPreview(slides)) return '';
    return JSON.stringify({
      contentDescription: value.contentDescription || 'Carousel preview',
      slides: slides.map((slide) => ({
        title: slide.title || '',
        body: slide.body || '',
        imageUrl: slide.imageUrl || '',
      })),
    });
  }, [slides, value.contentDescription]);

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
        // Validation requires contentDescription; use a placeholder when empty for live preview only.
        if (!payload.contentDescription?.trim()) {
          payload.contentDescription = 'Carousel preview';
        }
        const result = await interactiveLessonsService.renderCarouselTemplate(payload, blockId || 0);
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

  const updateSlide = (index, patch) => {
    update({
      slides: slides.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)),
    });
  };

  const addSlide = () => {
    if (slides.length >= MAX_SLIDES) {
      toast.error(`A carousel can have at most ${MAX_SLIDES} slides`);
      return;
    }
    update({ slides: [...slides, { ...EMPTY_SLIDE }] });
  };

  const removeSlide = (index) => {
    update({ slides: slides.filter((_, i) => i !== index) });
  };

  const moveSlide = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slides.length) return;
    const reordered = [...slides];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    update({ slides: reordered });
  };

  const hasExistingSlideContent = () =>
    slides.some((slide) => slide.title?.trim() || slide.body?.trim() || slide.imageUrl?.trim());

  const handleGenerateSlides = async () => {
    const description = value.contentDescription?.trim();
    if (!description) {
      toast.error('Enter a content description before generating slides');
      return;
    }

    const count = Number(aiSlideCount);
    if (!Number.isFinite(count) || count < 1 || count > MAX_AI_SLIDES) {
      toast.error(`Enter a number between 1 and ${MAX_AI_SLIDES}`);
      return;
    }

    if (hasExistingSlideContent()) {
      const confirmed = window.confirm(
        'This will replace your current slides with AI-generated content. Continue?'
      );
      if (!confirmed) return;
    }

    setIsGeneratingSlides(true);
    try {
      const result = await interactiveLessonsService.generateCarouselSlides(description, count);
      const generated = (result.slides || []).map((slide) => ({
        title: slide.title || '',
        body: slide.body || '',
        imageUrl: slide.imageUrl || '',
      }));

      if (!generated.length) {
        toast.error('No slides were generated. Please try again.');
        return;
      }

      update({ slides: generated });
      toast.success(`Generated ${generated.length} slide${generated.length === 1 ? '' : 's'}`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to generate slides');
    } finally {
      setIsGeneratingSlides(false);
    }
  };

  const handleImageUpload = async (index, event) => {
    const file = event.target.files?.[0];
    if (!file || !lessonId || !blockId) {
      if (!blockId) toast.error('Save the block first before uploading images');
      return;
    }

    try {
      const result = await interactiveLessonsService.uploadBlockMedia(lessonId, blockId, file);
      updateSlide(index, { imageUrl: result.url });
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      event.target.value = '';
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
          placeholder="Describe what learners should learn from this carousel..."
        />
        <p className="text-xs text-gray-500 mt-1">
          Learners must view every slide to complete this block.
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Slides ({slides.length}/{MAX_SLIDES})</h4>

        {slides.length === 0 && (
          <p className="text-sm text-gray-500">No slides yet. Add slides manually below, or use AI as an optional starting point.</p>
        )}

        {slides.map((slide, index) => (
          <div key={index} className="border rounded p-4 space-y-3 bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">Slide {index + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveSlide(index, 'up')}
                  disabled={index === 0}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveSlide(index, 'down')}
                  disabled={index === slides.length - 1}
                  className="px-2 py-1 text-sm border rounded bg-white disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeSlide(index)}
                  className="text-sm text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Slide title *</label>
              <input
                value={slide.title || ''}
                onChange={(e) => updateSlide(index, { title: e.target.value })}
                className="w-full border rounded px-3 py-2"
                placeholder="Slide heading"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Slide body *</label>
              <textarea
                value={slide.body || ''}
                onChange={(e) => updateSlide(index, { body: e.target.value })}
                className="w-full border rounded px-3 py-2"
                rows={4}
                placeholder="Main content for this slide"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Image (optional)</label>
              <input
                value={slide.imageUrl || ''}
                onChange={(e) => updateSlide(index, { imageUrl: e.target.value })}
                className="w-full border rounded px-3 py-2 mb-2"
                placeholder="Image URL"
              />
              {blockId ? (
                <label className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded cursor-pointer hover:bg-gray-200">
                  Upload image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(index, e)}
                  />
                </label>
              ) : (
                <p className="text-xs text-gray-500">Save the block first to upload images.</p>
              )}
              {slide.imageUrl && (
                <p className="text-xs text-gray-500 mt-2 truncate" title={slide.imageUrl}>
                  {slide.imageUrl}
                </p>
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addSlide}
          disabled={slides.length >= MAX_SLIDES}
          className="w-full px-4 py-2.5 text-sm border border-dashed border-[#1b365d] text-[#1b365d] rounded hover:bg-[#f8fbff] disabled:opacity-50 disabled:hover:bg-transparent"
        >
          + Add new slide
        </button>
      </div>

      <div className="rounded-lg border border-[#d9e5f2] bg-[#f8fbff] p-4 space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-[#1b365d]">Optional: generate slides with AI</h4>
          <p className="text-xs text-gray-600 mt-1">
            Creates up to {MAX_AI_SLIDES} slides from the content description. You can edit titles, body text, and add images afterwards.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Number of slides</label>
            <input
              type="number"
              min={1}
              max={MAX_AI_SLIDES}
              value={aiSlideCount}
              onChange={(e) => setAiSlideCount(e.target.value)}
              className="w-28 border rounded px-3 py-2"
            />
          </div>
          <button
            type="button"
            onClick={handleGenerateSlides}
            disabled={isGeneratingSlides || !value.contentDescription?.trim()}
            className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 disabled:opacity-50"
          >
            {isGeneratingSlides ? 'Generating...' : 'Generate slides'}
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
          Shows how learners will see this carousel. Fill in title and body for every slide to enable preview.
        </p>
        {previewError && (
          <p className="text-xs text-red-600">{previewError}</p>
        )}
        <div className="border rounded bg-[#f8fafc] overflow-hidden">
          <InteractiveBlockPreview
            title="Carousel"
            html={previewHtml}
            minHeight={280}
            emptyMessage="Add at least one slide with a title and body to see the live preview."
          />
        </div>
      </div>
    </div>
  );
}
