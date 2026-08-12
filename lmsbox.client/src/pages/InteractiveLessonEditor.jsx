import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import Modal from '../components/Modal';
import QuestionnaireBlockForm from '../components/QuestionnaireBlockForm';
import CarouselBlockForm from '../components/CarouselBlockForm';
import AccordionBlockForm from '../components/AccordionBlockForm';
import TextBlockForm from '../components/TextBlockForm';
import VideoBlockForm from '../components/VideoBlockForm';
import HeroBlockForm from '../components/HeroBlockForm';
import CardsBlockForm from '../components/CardsBlockForm';
import RevealBlockForm from '../components/RevealBlockForm';
import FlipBlockForm from '../components/FlipBlockForm';
import RememberBlockForm from '../components/RememberBlockForm';
import WarningBlockForm from '../components/WarningBlockForm';
import TimelineBlockForm from '../components/TimelineBlockForm';
import ReflectionBlockForm from '../components/ReflectionBlockForm';
import HotspotBlockForm from '../components/HotspotBlockForm';
import ProcessBlockForm from '../components/ProcessBlockForm';
import InteractiveBlockPreview from '../components/InteractiveBlockPreview';
import interactiveLessonsService from '../services/interactiveLessons';
import usePageTitle from '../hooks/usePageTitle';
import toast from 'react-hot-toast';
import { INTERACTIVE_LESSON_MAX_BLOCKS } from '../config/lessonFeatureFlags';
import {
  createEmptyQuestionnaireFormData,
  normalizeQuestionnaireFormData,
} from '../components/questionnaireFormHelpers';

const TEMPLATE_BLOCK_TYPES = new Set([
  'hero',
  'cards',
  'reveal',
  'flip',
  'remember',
  'warning',
  'timeline',
  'reflection',
  'hotspot',
  'process',
  'carousel',
  'accordion',
  'questionnaire',
  'text',
  'video',
]);

function usesFixedTemplate(blockType) {
  return TEMPLATE_BLOCK_TYPES.has(blockType);
}

const EMPTY_QUESTIONNAIRE = createEmptyQuestionnaireFormData();

const EMPTY_CAROUSEL = {
  contentDescription: '',
  slides: [],
};

const EMPTY_ACCORDION = {
  contentDescription: '',
  panels: [],
};

const EMPTY_TEXT = {
  heading: '',
  subheading: '',
  bodyHtml: '',
  body: '',
  showContinueButton: true,
};

const EMPTY_VIDEO = {
  title: '',
  description: '',
  videoUrl: '',
};

const EMPTY_HERO = {
  kicker: '',
  title: '',
  intro: '',
  metaPills: [],
  backgroundImageUrl: '',
};

const EMPTY_CARDS = {
  cards: [],
};

const EMPTY_REVEAL = {
  items: [],
  hint: '',
};

const EMPTY_FLIP = {
  cards: [],
};

const EMPTY_REMEMBER = {
  label: 'Remember',
  body: '',
};

const EMPTY_WARNING = {
  label: 'Warning',
  body: '',
};

const EMPTY_TIMELINE = {
  stages: [],
  hint: 'Select a stage to expand it',
};

const EMPTY_REFLECTION = {
  label: 'Your reflection',
  title: '',
  prompt: '',
  placeholder: '',
};

const EMPTY_HOTSPOT = {
  imageUrl: '',
  imageAlt: '',
  pins: [],
};

const EMPTY_PROCESS = {
  nodes: [],
  steps: [],
  finishMessage: '',
  startButtonLabel: 'Start the sequence',
};

function getEmptyFormData(blockType) {
  if (blockType === 'hero') {
    return { ...EMPTY_HERO, metaPills: [] };
  }
  if (blockType === 'cards') {
    return { ...EMPTY_CARDS, cards: [] };
  }
  if (blockType === 'reveal') {
    return { ...EMPTY_REVEAL, items: [] };
  }
  if (blockType === 'flip') {
    return { ...EMPTY_FLIP, cards: [] };
  }
  if (blockType === 'remember') {
    return { ...EMPTY_REMEMBER };
  }
  if (blockType === 'warning') {
    return { ...EMPTY_WARNING };
  }
  if (blockType === 'timeline') {
    return { ...EMPTY_TIMELINE, stages: [] };
  }
  if (blockType === 'reflection') {
    return { ...EMPTY_REFLECTION };
  }
  if (blockType === 'hotspot') {
    return { ...EMPTY_HOTSPOT, pins: [] };
  }
  if (blockType === 'process') {
    return { ...EMPTY_PROCESS, nodes: [], steps: [] };
  }
  if (blockType === 'carousel') {
    return { ...EMPTY_CAROUSEL, slides: [] };
  }
  if (blockType === 'accordion') {
    return { ...EMPTY_ACCORDION, panels: [] };
  }
  if (blockType === 'text') {
    return { ...EMPTY_TEXT };
  }
  if (blockType === 'video') {
    return { ...EMPTY_VIDEO };
  }
  return { ...EMPTY_QUESTIONNAIRE, questions: [...EMPTY_QUESTIONNAIRE.questions] };
}

/**
 * The process template only accepts stage labels when there is exactly one per step,
 * so partly filled labels are dropped and the diagram falls back to the step titles.
 */
function normalizeProcessNodes(formData) {
  const steps = Array.isArray(formData.steps) ? formData.steps : [];
  const labels = (Array.isArray(formData.nodes) ? formData.nodes : []).map((node) =>
    (typeof node === 'string' ? node : node?.label || '').trim()
  );

  const isComplete = steps.length > 0 && labels.length === steps.length && labels.every(Boolean);
  return isComplete ? labels.map((label) => ({ label })) : [];
}

function parseFormPayload(json, blockType = 'questionnaire') {
  if (!json) return getEmptyFormData(blockType);
  try {
    const parsed = JSON.parse(json);
    if (blockType === 'questionnaire') {
      return normalizeQuestionnaireFormData(parsed);
    }
    return parsed;
  } catch {
    return getEmptyFormData(blockType);
  }
}

export default function InteractiveLessonEditor() {
  const navigate = useNavigate();
  const { courseId, lessonId } = useParams();
  const isEdit = !!lessonId;

  usePageTitle(isEdit ? 'Edit Interactive Lesson' : 'Create Interactive Lesson');

  const [lesson, setLesson] = useState({
    title: '',
    description: '',
    isOptional: false,
    lockNextBlockUntilComplete: true,
  });
  const [savedCourseId, setSavedCourseId] = useState(courseId || '');
  const [blocks, setBlocks] = useState([]);
  const [blockTypes, setBlockTypes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [blockForm, setBlockForm] = useState({
    title: '',
    blockType: 'questionnaire',
    formData: getEmptyFormData('questionnaire'),
    mediaAssetsJson: '[]',
  });
  const [htmlEditorBlock, setHtmlEditorBlock] = useState(null);
  const [htmlDraft, setHtmlDraft] = useState('');
  const [previewingBlock, setPreviewingBlock] = useState(null);
  const [previewHtmlOverride, setPreviewHtmlOverride] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [pendingVideoFile, setPendingVideoFile] = useState(null);
  const [savingBlock, setSavingBlock] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [generatingBlockId, setGeneratingBlockId] = useState(null);

  const returnUrl = courseId ? `/admin/courses/${courseId}/edit` : '/admin/courses';

  useEffect(() => {
    interactiveLessonsService.getBlockTypes().then(setBlockTypes).catch(console.error);
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const data = await interactiveLessonsService.getLesson(lessonId);
        setLesson({
          title: data.title,
          description: data.description || '',
          isOptional: data.isOptional,
          lockNextBlockUntilComplete: data.lockNextBlockUntilComplete,
        });
        setSavedCourseId(data.courseId);
        setBlocks(data.blocks || []);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load interactive lesson');
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, lessonId]);

  const handleSaveLesson = async () => {
    if (!lesson.title.trim()) {
      toast.error('Lesson title is required');
      return;
    }

    setSaving(true);
    try {
      if (!isEdit) {
        const created = await interactiveLessonsService.createLesson(courseId, {
          title: lesson.title.trim(),
          description: lesson.description,
          isOptional: lesson.isOptional,
          lockNextBlockUntilComplete: lesson.lockNextBlockUntilComplete,
        });
        toast.success('Interactive lesson created');
        navigate(`/admin/interactive/edit/${created.lessonId}`, { replace: true });
        return;
      }

      const updated = await interactiveLessonsService.updateLesson(lessonId, {
        title: lesson.title.trim(),
        description: lesson.description,
        isOptional: lesson.isOptional,
        lockNextBlockUntilComplete: lesson.lockNextBlockUntilComplete,
      });
      setBlocks(updated.blocks || []);
      toast.success('Lesson saved');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to save lesson');
    } finally {
      setSaving(false);
    }
  };

  const openNewBlockForm = () => {
    if (blocks.length >= INTERACTIVE_LESSON_MAX_BLOCKS) {
      toast.error(`Maximum ${INTERACTIVE_LESSON_MAX_BLOCKS} blocks allowed`);
      return;
    }
    setEditingBlock(null);
    setPendingVideoFile(null);
    setVideoUploadProgress(0);
    setBlockForm({
      title: '',
      blockType: 'questionnaire',
      formData: getEmptyFormData('questionnaire'),
      mediaAssetsJson: '[]',
    });
    setShowBlockForm(true);
  };

  const openEditBlockForm = (block) => {
    setEditingBlock(block);
    setPendingVideoFile(null);
    setVideoUploadProgress(0);
    setBlockForm({
      title: block.title,
      blockType: block.blockType,
      formData: parseFormPayload(block.formPayloadJson, block.blockType),
      mediaAssetsJson: block.mediaAssetsJson || '[]',
    });
    setShowBlockForm(true);
  };

  const handleSaveBlock = async () => {
    if (!lessonId) {
      toast.error('Save the lesson first');
      return;
    }
    if (!blockForm.title.trim()) {
      toast.error('Block title is required');
      return;
    }

    setSavingBlock(true);
    setVideoUploadProgress(0);
    let createdBlock = null;
    try {
      const shouldUploadVideo = blockForm.blockType === 'video' && !!pendingVideoFile;
      let formData = { ...blockForm.formData };
      if (blockForm.blockType === 'hero' && Array.isArray(formData.metaPills)) {
        formData = {
          ...formData,
          metaPills: formData.metaPills.map((p) => (p || '').trim()).filter(Boolean),
        };
      }
      if (blockForm.blockType === 'process') {
        formData = { ...formData, nodes: normalizeProcessNodes(formData) };
      }
      let mediaAssetsJson = blockForm.mediaAssetsJson;

      // New block without a pending video: create once and done.
      if (!editingBlock && !shouldUploadVideo) {
        const created = await interactiveLessonsService.createBlock(lessonId, {
          title: blockForm.title.trim(),
          blockType: blockForm.blockType,
          formPayloadJson: JSON.stringify(formData),
          mediaAssetsJson,
        });
        setBlocks((prev) => [...prev, created].sort((a, b) => a.ordinal - b.ordinal));
        toast.success('Block added');
        setShowBlockForm(false);
        setEditingBlock(null);
        setPendingVideoFile(null);
        setVideoUploadProgress(0);
        const refreshed = await interactiveLessonsService.getLesson(lessonId);
        setBlocks(refreshed.blocks || []);
        return;
      }

      let targetBlockId = editingBlock?.id;
      if (!targetBlockId) {
        createdBlock = await interactiveLessonsService.createBlock(lessonId, {
          title: blockForm.title.trim(),
          blockType: blockForm.blockType,
          formPayloadJson: JSON.stringify(formData),
          mediaAssetsJson,
        });
        targetBlockId = createdBlock.id;
      }

      if (shouldUploadVideo) {
        const uploadResult = await interactiveLessonsService.uploadBlockMedia(
          lessonId,
          targetBlockId,
          pendingVideoFile,
          setVideoUploadProgress
        );
        formData = { ...formData, videoUrl: uploadResult.url };
        mediaAssetsJson = uploadResult.mediaAssetsJson || mediaAssetsJson || '[]';
      }

      const updated = await interactiveLessonsService.updateBlock(lessonId, targetBlockId, {
        title: blockForm.title.trim(),
        blockType: blockForm.blockType,
        formPayloadJson: JSON.stringify(formData),
        mediaAssetsJson,
      });

      setBlocks((prev) => {
        const without = prev.filter((b) => b.id !== updated.id);
        return [...without, updated].sort((a, b) => a.ordinal - b.ordinal);
      });

      toast.success(
        editingBlock
          ? 'Block updated'
          : shouldUploadVideo
            ? 'Block added with video'
            : 'Block added'
      );
      setShowBlockForm(false);
      setEditingBlock(null);
      setPendingVideoFile(null);
      setVideoUploadProgress(0);
      const refreshed = await interactiveLessonsService.getLesson(lessonId);
      setBlocks(refreshed.blocks || []);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to save block');
      // If create succeeded but upload/update failed, switch to edit mode so Save can retry.
      if (createdBlock) {
        setEditingBlock(createdBlock);
        setBlocks((prev) => {
          if (prev.some((b) => b.id === createdBlock.id)) return prev;
          return [...prev, createdBlock].sort((a, b) => a.ordinal - b.ordinal);
        });
        setVideoUploadProgress(0);
      }
    } finally {
      setSavingBlock(false);
    }
  };

  const handleGenerate = async (block, regenerate = false) => {
    setGeneratingBlockId(block.id);
    try {
      const updated = regenerate
        ? await interactiveLessonsService.regenerateBlock(lessonId, block.id)
        : await interactiveLessonsService.generateBlock(lessonId, block.id);
      setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      toast.success(
        usesFixedTemplate(block.blockType)
          ? (regenerate ? 'Block template refreshed' : 'Block template applied')
          : (regenerate ? 'Block regenerated' : 'Block generated')
      );
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Generation failed. Form data preserved.');
    } finally {
      setGeneratingBlockId(null);
    }
  };

  const handleApprove = async (block) => {
    try {
      const updated = await interactiveLessonsService.approveBlock(lessonId, block.id);
      setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      toast.success('Block approved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve block');
    }
  };

  const handleDeleteBlock = async (block) => {
    if (!window.confirm('Delete this block?')) return;
    try {
      await interactiveLessonsService.deleteBlock(lessonId, block.id);
      setBlocks((prev) => prev.filter((b) => b.id !== block.id));
      toast.success('Block deleted');
    } catch (err) {
      toast.error('Failed to delete block');
    }
  };

  const moveBlock = async (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    const reordered = [...blocks];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    try {
      const updated = await interactiveLessonsService.reorderBlocks(lessonId, reordered.map((b) => b.id));
      setBlocks(updated);
    } catch (err) {
      toast.error('Failed to reorder blocks');
    }
  };

  const handleSaveHtml = async () => {
    if (!htmlEditorBlock) return;
    try {
      const updated = await interactiveLessonsService.updateBlockHtml(lessonId, htmlEditorBlock.id, htmlDraft);
      setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setHtmlEditorBlock(null);
      setHtmlDraft('');
      toast.success('HTML saved');
    } catch (err) {
      toast.error('Failed to save HTML');
    }
  };

  const closeBlockForm = () => {
    if (savingBlock) return;
    setShowBlockForm(false);
    setEditingBlock(null);
    setPendingVideoFile(null);
    setVideoUploadProgress(0);
  };

  const closeHtmlEditor = () => {
    setHtmlEditorBlock(null);
    setHtmlDraft('');
  };

  const openHtmlEditor = (block) => {
    setHtmlEditorBlock(block);
    setHtmlDraft(block.editedHtml || block.generatedHtml || '');
  };
  const handlePreview = () => {
    if (!lessonId) return;
    interactiveLessonsService.openLessonPreview(lessonId, savedCourseId || courseId);
  };

  const handlePreviewBlock = async (block) => {
    if (usesFixedTemplate(block.blockType)) {
      const formData = parseFormPayload(block.formPayloadJson, block.blockType);
      const hasContent =
        (block.blockType === 'hero' && formData.title?.trim()) ||
        (block.blockType === 'cards' && formData.cards?.length) ||
        (block.blockType === 'reveal' && formData.items?.length) ||
        (block.blockType === 'flip' && formData.cards?.length) ||
        (block.blockType === 'remember' && formData.body?.trim()) ||
        (block.blockType === 'warning' && formData.body?.trim()) ||
        (block.blockType === 'timeline' && formData.stages?.length) ||
        (block.blockType === 'reflection' && formData.title?.trim()) ||
        (block.blockType === 'hotspot' && formData.imageUrl?.trim() && formData.pins?.length) ||
        (block.blockType === 'process' && formData.steps?.length) ||
        (block.blockType === 'carousel' && formData.slides?.length) ||
        (block.blockType === 'accordion' && formData.panels?.length) ||
        (block.blockType === 'questionnaire' && formData.questions?.length) ||
        (block.blockType === 'text' && (formData.bodyHtml?.trim() || formData.body?.trim())) ||
        (block.blockType === 'video' && formData.videoUrl?.trim());

      if (!hasContent) {
        toast.error('Add content before previewing');
        return;
      }

      setIsPreviewLoading(true);
      setPreviewingBlock(block);
      setPreviewHtmlOverride(null);
      try {
        const result = await interactiveLessonsService.renderBlockTemplate(
          block.blockType,
          formData,
          block.id
        );
        setPreviewHtmlOverride(result.html || '');
      } catch (err) {
        console.error(err);
        setPreviewingBlock(null);
        toast.error(err.response?.data?.message || 'Failed to render block preview');
      } finally {
        setIsPreviewLoading(false);
      }
      return;
    }

    if (!block.displayHtml) {
      toast.error('Generate this block first before previewing');
      return;
    }
    setPreviewHtmlOverride(null);
    setPreviewingBlock(block);
  };

  const closeBlockPreview = () => {
    setPreviewingBlock(null);
    setPreviewHtmlOverride(null);
    setIsPreviewLoading(false);
  };

  const lessonStatus = blocks.length === 0
    ? 'Draft'
    : blocks.every((b) => b.status === 'Approved')
      ? 'Ready'
      : 'Draft';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminHeader />
        <div className="p-8">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button type="button" onClick={() => navigate(returnUrl)} className="text-sm text-[#1b365d] hover:underline">
              ← Back to course
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">
              {isEdit ? 'Edit Interactive Lesson' : 'Create Interactive Lesson'}
            </h1>
          </div>
          <div className="flex gap-2">
            {isEdit && (
              <button type="button" onClick={handlePreview} className="px-4 py-2 border rounded bg-white hover:bg-gray-50">
                Preview lesson
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveLesson}
              disabled={saving}
              className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save lesson'}
            </button>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Lesson details</h2>
            {isEdit && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${lessonStatus === 'Ready' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                {lessonStatus}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                value={lesson.title}
                onChange={(e) => setLesson((p) => ({ ...p, title: e.target.value }))}
                className="w-full border rounded px-3 py-2"
                placeholder="Interactive lesson title"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={lesson.description}
                onChange={(e) => setLesson((p) => ({ ...p, description: e.target.value }))}
                className="w-full border rounded px-3 py-2"
                rows={3}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={lesson.lockNextBlockUntilComplete}
                onChange={(e) => setLesson((p) => ({ ...p, lockNextBlockUntilComplete: e.target.checked }))}
              />
              Lock next block until current block is complete
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={lesson.isOptional}
                onChange={(e) => setLesson((p) => ({ ...p, isOptional: e.target.checked }))}
              />
              Optional lesson
            </label>
          </div>
        </div>

        {isEdit && (
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Blocks ({blocks.length}/{INTERACTIVE_LESSON_MAX_BLOCKS})</h2>
              <div className="flex items-center gap-4">
                <a
                  href="/design-system/examples/index.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#0059a3] underline underline-offset-2 hover:text-[#002e62]"
                >
                  Component examples
                </a>
                <button
                  type="button"
                  onClick={openNewBlockForm}
                  disabled={blocks.length >= INTERACTIVE_LESSON_MAX_BLOCKS}
                  className="px-4 py-2 bg-[#1b365d] text-white rounded hover:bg-[#234a7a] disabled:opacity-50"
                >
                  + Add block
                </button>
              </div>
            </div>

            {blocks.length === 0 ? (
              <p className="text-gray-500 text-sm">No blocks yet. Add at least one approved block before publishing.</p>
            ) : (
              <div className="space-y-3">
                {blocks.map((block, index) => (
                  <div key={block.id} className="border rounded-lg p-4 flex flex-wrap gap-3 justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{block.ordinal}. {block.title}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {block.blockType} · {block.status}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => moveBlock(index, 'up')} disabled={index === 0} className="px-2 py-1 text-sm border rounded disabled:opacity-40">↑</button>
                      <button type="button" onClick={() => moveBlock(index, 'down')} disabled={index === blocks.length - 1} className="px-2 py-1 text-sm border rounded disabled:opacity-40">↓</button>
                      <button type="button" onClick={() => openEditBlockForm(block)} className="px-3 py-1.5 text-sm border rounded">Edit form</button>
                      <button
                        type="button"
                        onClick={() => handleGenerate(block, !!block.generatedHtml)}
                        disabled={generatingBlockId === block.id}
                        className="px-3 py-1.5 text-sm bg-info text-[#1b365d] rounded disabled:opacity-50"
                      >
                        {generatingBlockId === block.id ? 'Generating...' : block.generatedHtml ? 'Regenerate' : 'Generate'}
                      </button>
                      {block.displayHtml && !usesFixedTemplate(block.blockType) && (
                        <button
                          type="button"
                          onClick={() => openHtmlEditor(block)}
                          className="px-3 py-1.5 text-sm border rounded"
                        >
                          Edit HTML
                        </button>
                      )}
                      {(block.displayHtml || (usesFixedTemplate(block.blockType) && block.formPayloadJson)) && (
                        <button
                          type="button"
                          onClick={() => handlePreviewBlock(block)}
                          className="px-3 py-1.5 text-sm border rounded bg-white hover:bg-gray-50"
                        >
                          Preview block
                        </button>
                      )}
                      {block.status !== 'Approved' && block.displayHtml && (
                        <button type="button" onClick={() => handleApprove(block)} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded">Approve</button>
                      )}
                      <button type="button" onClick={() => handleDeleteBlock(block)} className="px-3 py-1.5 text-sm bg-error text-error rounded">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Modal
          isOpen={showBlockForm}
          onClose={closeBlockForm}
          title={editingBlock ? 'Edit block form' : 'Add block'}
          size="lg"
          footer={(
            <>
              <button
                type="button"
                onClick={closeBlockForm}
                disabled={savingBlock}
                className="px-4 py-2 border rounded bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBlock}
                disabled={savingBlock}
                className="px-4 py-2 bg-[#1b365d] text-white rounded hover:bg-[#234a7a] disabled:opacity-50"
              >
                {savingBlock
                  ? (pendingVideoFile && videoUploadProgress > 0
                    ? `Uploading… ${videoUploadProgress}%`
                    : 'Saving…')
                  : 'Save block'}
              </button>
            </>
          )}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Block title *</label>
                <input
                  value={blockForm.title}
                  onChange={(e) => setBlockForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  disabled={savingBlock}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Block type</label>
                <select
                  value={blockForm.blockType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    if (nextType !== 'video') {
                      setPendingVideoFile(null);
                      setVideoUploadProgress(0);
                    }
                    setBlockForm((p) => ({
                      ...p,
                      blockType: nextType,
                      formData: editingBlock ? p.formData : getEmptyFormData(nextType),
                      mediaAssetsJson: editingBlock ? p.mediaAssetsJson : '[]',
                    }));
                  }}
                  className="w-full border rounded px-3 py-2"
                  disabled={!!editingBlock || savingBlock}
                >
                  {(blockTypes.length ? blockTypes : [{ type: 'questionnaire', label: 'Questionnaire' }]).map((t) => (
                    <option key={t.type} value={t.type}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {blockForm.blockType === 'hero' && (
              <HeroBlockForm
                value={blockForm.formData}
                onChange={(formData) => setBlockForm((p) => ({ ...p, formData }))}
                lessonId={lessonId}
                blockId={editingBlock?.id}
              />
            )}

            {blockForm.blockType === 'cards' && (
              <CardsBlockForm
                value={blockForm.formData}
                onChange={(formData) => setBlockForm((p) => ({ ...p, formData }))}
              />
            )}

            {blockForm.blockType === 'reveal' && (
              <RevealBlockForm
                value={blockForm.formData}
                onChange={(formData) => setBlockForm((p) => ({ ...p, formData }))}
              />
            )}

            {blockForm.blockType === 'flip' && (
              <FlipBlockForm
                value={blockForm.formData}
                onChange={(formData) => setBlockForm((p) => ({ ...p, formData }))}
              />
            )}

            {blockForm.blockType === 'remember' && (
              <RememberBlockForm
                value={blockForm.formData}
                onChange={(formData) => setBlockForm((p) => ({ ...p, formData }))}
              />
            )}

            {blockForm.blockType === 'warning' && (
              <WarningBlockForm
                value={blockForm.formData}
                onChange={(formData) => setBlockForm((p) => ({ ...p, formData }))}
              />
            )}

            {blockForm.blockType === 'timeline' && (
              <TimelineBlockForm
                value={blockForm.formData}
                onChange={(formData) => setBlockForm((p) => ({ ...p, formData }))}
              />
            )}

            {blockForm.blockType === 'reflection' && (
              <ReflectionBlockForm
                value={blockForm.formData}
                onChange={(formData) => setBlockForm((p) => ({ ...p, formData }))}
              />
            )}

            {blockForm.blockType === 'hotspot' && (
              <HotspotBlockForm
                value={blockForm.formData}
                onChange={(formData) => setBlockForm((p) => ({ ...p, formData }))}
                lessonId={lessonId}
                blockId={editingBlock?.id}
              />
            )}

            {blockForm.blockType === 'process' && (
              <ProcessBlockForm
                value={blockForm.formData}
                onChange={(formData) => setBlockForm((p) => ({ ...p, formData }))}
              />
            )}

            {blockForm.blockType === 'questionnaire' && (
              <QuestionnaireBlockForm
                value={blockForm.formData}
                onChange={(formData) => setBlockForm((p) => ({ ...p, formData }))}
                lessonId={lessonId}
                blockId={editingBlock?.id}
                mediaAssetsJson={blockForm.mediaAssetsJson}
                onMediaChange={(mediaAssetsJson) => setBlockForm((p) => ({ ...p, mediaAssetsJson }))}
              />
            )}

            {blockForm.blockType === 'carousel' && (
              <CarouselBlockForm
                value={blockForm.formData}
                onChange={(formData) => setBlockForm((p) => ({ ...p, formData }))}
                lessonId={lessonId}
                blockId={editingBlock?.id}
              />
            )}

            {blockForm.blockType === 'accordion' && (
              <AccordionBlockForm
                value={blockForm.formData}
                onChange={(formData) => setBlockForm((p) => ({ ...p, formData }))}
                blockId={editingBlock?.id}
              />
            )}

            {blockForm.blockType === 'text' && (
              <TextBlockForm
                value={blockForm.formData}
                onChange={(formData) => setBlockForm((p) => ({ ...p, formData }))}
              />
            )}

            {blockForm.blockType === 'video' && (
              <VideoBlockForm
                value={blockForm.formData}
                onChange={(formData) => setBlockForm((p) => ({ ...p, formData }))}
                lessonId={lessonId}
                blockId={editingBlock?.id}
                pendingFile={pendingVideoFile}
                onPendingFileChange={setPendingVideoFile}
                isBusy={savingBlock}
                uploadProgress={videoUploadProgress}
              />
            )}
          </div>
        </Modal>

        <Modal
          isOpen={!!previewingBlock}
          onClose={closeBlockPreview}
          title={`Preview block — ${previewingBlock?.title || ''}`}
          size="xl"
          footer={(
            <button type="button" onClick={closeBlockPreview} className="px-4 py-2 border rounded bg-white hover:bg-gray-50">
              Close
            </button>
          )}
        >
          {isPreviewLoading ? (
            <p className="text-sm text-gray-500 py-8 text-center">Rendering preview…</p>
          ) : (
            <InteractiveBlockPreview
              title={previewingBlock?.title}
              html={previewHtmlOverride ?? previewingBlock?.displayHtml}
              blockType={previewingBlock?.blockType}
              minHeight={previewingBlock?.blockType === 'hero' ? 420 : 160}
            />
          )}
        </Modal>

        <Modal
          isOpen={!!htmlEditorBlock}
          onClose={closeHtmlEditor}
          title={`Edit HTML — ${htmlEditorBlock?.title || ''}`}
          size="xl"
          footer={(
            <>
              <button type="button" onClick={closeHtmlEditor} className="px-4 py-2 border rounded bg-white hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={handleSaveHtml} className="px-4 py-2 bg-[#1b365d] text-white rounded hover:bg-[#234a7a]">
                Save HTML
              </button>
            </>
          )}
        >
          <textarea
            value={htmlDraft}
            onChange={(e) => setHtmlDraft(e.target.value)}
            className="w-full min-h-[28rem] border rounded font-mono text-sm p-3"
          />
        </Modal>
      </div>
    </div>
  );
}
