import React, { useEffect, useMemo, useState } from 'react';
import interactiveLessonsService from '../services/interactiveLessons';
import InteractiveBlockPreview from './InteractiveBlockPreview';
import {
  QUESTIONNAIRE_ALLOW_MULTIPLE_QUESTIONS,
  QUESTIONNAIRE_MAX_AI_QUESTIONS,
  QUESTIONNAIRE_QUESTIONS_PER_BLOCK,
} from '../config/lessonFeatureFlags';
import {
  EMPTY_QUESTION,
  normalizeQuestionnaireFormData,
} from './questionnaireFormHelpers';
import toast from 'react-hot-toast';

const PREVIEW_DEBOUNCE_MS = 450;

function questionsReadyForPreview(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return false;
  return questions.every((q) => {
    if (!q.text?.trim()) return false;
    const type = (q.type || 'single').toLowerCase();
    if (type === 'text') return true;
    const options = q.options || [];
    if (options.length < 2) return false;
    return options.every((o) => o.text?.trim());
  });
}

export default function QuestionnaireBlockForm({
  value,
  onChange,
  lessonId,
  blockId,
  mediaAssetsJson,
  onMediaChange,
}) {
  const [aiQuestionCount, setAiQuestionCount] = useState(
    QUESTIONNAIRE_ALLOW_MULTIPLE_QUESTIONS ? 5 : 1
  );
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const update = (patch) => onChange(normalizeQuestionnaireFormData({ ...value, ...patch }));
  const questions = value.questions || [];
  const canAddQuestion = questions.length < QUESTIONNAIRE_QUESTIONS_PER_BLOCK;

  useEffect(() => {
    if ((value.questions || []).length === 0) {
      onChange(normalizeQuestionnaireFormData(value));
    }
    // Seed a question slot once when the form opens empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewPayloadKey = useMemo(() => {
    if (!questionsReadyForPreview(questions)) return '';
    return JSON.stringify({
      contentDescription: value.contentDescription || 'Questionnaire preview',
      showFeedbackPerQuestion: !!value.showFeedbackPerQuestion,
      questions: questions.map((q) => ({
        text: q.text || '',
        type: q.type || 'single',
        options: (q.options || []).map((o) => ({
          text: o.text || '',
          isCorrect: !!o.isCorrect,
        })),
      })),
    });
  }, [questions, value.contentDescription, value.showFeedbackPerQuestion]);

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
          payload.contentDescription = 'Questionnaire preview';
        }
        const result = await interactiveLessonsService.renderBlockTemplate(
          'questionnaire',
          payload,
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

  const updateQuestion = (index, patch) => {
    update({
      questions: questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    });
  };

  const addQuestion = () => {
    if (!canAddQuestion) {
      toast.error(`A questionnaire can have at most ${QUESTIONNAIRE_QUESTIONS_PER_BLOCK} question(s)`);
      return;
    }
    update({
      questions: [
        ...questions,
        { ...EMPTY_QUESTION, options: EMPTY_QUESTION.options.map((o) => ({ ...o })) },
      ],
    });
  };

  const removeQuestion = (index) => {
    update({ questions: questions.filter((_, i) => i !== index) });
  };

  const addOption = (qIndex) => {
    const next = [...questions];
    next[qIndex] = {
      ...next[qIndex],
      options: [...(next[qIndex].options || []), { text: '', isCorrect: false }],
    };
    update({ questions: next });
  };

  const updateOption = (qIndex, oIndex, patch) => {
    const next = [...questions];
    const options = next[qIndex].options.map((o, i) => (i === oIndex ? { ...o, ...patch } : o));
    next[qIndex] = { ...next[qIndex], options };
    update({ questions: next });
  };

  const hasExistingQuestionContent = () =>
    questions.some((q) => q.text?.trim() || (q.options || []).some((o) => o.text?.trim()));

  const handleGenerateQuestions = async () => {
    const description = value.contentDescription?.trim();
    if (!description) {
      toast.error('Enter a content description before generating questions');
      return;
    }

    const count = QUESTIONNAIRE_ALLOW_MULTIPLE_QUESTIONS
      ? Number(aiQuestionCount)
      : 1;

    if (!Number.isFinite(count) || count < 1 || count > QUESTIONNAIRE_MAX_AI_QUESTIONS) {
      toast.error(`Enter a number between 1 and ${QUESTIONNAIRE_MAX_AI_QUESTIONS}`);
      return;
    }

    if (hasExistingQuestionContent()) {
      const confirmed = window.confirm(
        QUESTIONNAIRE_ALLOW_MULTIPLE_QUESTIONS
          ? 'This will replace your current questions with AI-generated MCQs. Continue?'
          : 'This will replace your current question with an AI-generated MCQ. Continue?'
      );
      if (!confirmed) return;
    }

    setIsGeneratingQuestions(true);
    try {
      const result = await interactiveLessonsService.generateQuestionnaireQuestions(description, count);
      const generated = (result.questions || [])
        .slice(0, QUESTIONNAIRE_QUESTIONS_PER_BLOCK)
        .map((q) => ({
          text: q.text || '',
          type: 'single',
          options: (q.options || []).map((o) => ({
            text: o.text || '',
            isCorrect: !!o.isCorrect,
          })),
        }));

      if (!generated.length) {
        toast.error('No questions were generated. Please try again.');
        return;
      }

      update({ questions: generated });
      toast.success(
        generated.length === 1
          ? 'Generated 1 MCQ question'
          : `Generated ${generated.length} MCQ questions`
      );
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to generate questions');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !lessonId || !blockId) {
      if (!blockId) toast.error('Save the block first before uploading images');
      return;
    }
    try {
      const result = await interactiveLessonsService.uploadBlockMedia(lessonId, blockId, file);
      onMediaChange(result.mediaAssetsJson || '[]');
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    }
  };

  let mediaAssets = [];
  try {
    mediaAssets = JSON.parse(mediaAssetsJson || '[]');
  } catch {
    mediaAssets = [];
  }

  const questionSectionTitle = QUESTIONNAIRE_ALLOW_MULTIPLE_QUESTIONS
    ? `Questions (${questions.length}/${QUESTIONNAIRE_QUESTIONS_PER_BLOCK})`
    : 'Question';

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <label className="block text-sm font-medium mb-1">Content description *</label>
        <textarea
          value={value.contentDescription || ''}
          onChange={(e) => update({ contentDescription: e.target.value })}
          className="w-full border rounded px-3 py-2"
          rows={4}
          placeholder="Describe the learning goals and context for this questionnaire..."
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!value.showFeedbackPerQuestion}
          onChange={(e) => update({ showFeedbackPerQuestion: e.target.checked })}
        />
        Show feedback after each question
      </label>

      <div className="space-y-4">
        <h4 className="font-medium">{questionSectionTitle}</h4>

        {questions.length === 0 && (
          <p className="text-sm text-gray-500">
            {QUESTIONNAIRE_ALLOW_MULTIPLE_QUESTIONS
              ? 'No questions yet. Add questions manually below, or use AI as an optional starting point.'
              : 'Add your question below, or use AI as an optional starting point.'}
          </p>
        )}

        {questions.map((question, qIndex) => (
          <div key={qIndex} className="border rounded p-4 space-y-3 bg-gray-50">
            {QUESTIONNAIRE_ALLOW_MULTIPLE_QUESTIONS && (
              <div className="flex justify-between gap-2">
                <span className="text-sm font-medium text-gray-700">Question {qIndex + 1}</span>
                {(questions.length > 1 || question.text?.trim()) && (
                  <button type="button" onClick={() => removeQuestion(qIndex)} className="text-sm text-red-600">
                    Remove
                  </button>
                )}
              </div>
            )}
            <input
              value={question.text}
              onChange={(e) => updateQuestion(qIndex, { text: e.target.value })}
              className="w-full border rounded px-3 py-2"
              placeholder="Question text"
            />
            <select
              value={question.type}
              onChange={(e) => updateQuestion(qIndex, { type: e.target.value })}
              className="border rounded px-3 py-2"
            >
              <option value="single">Single choice</option>
              <option value="multiple">Multiple choice</option>
              <option value="text">Short text</option>
            </select>

            {question.type !== 'text' && (
              <div className="space-y-2 pl-2">
                {(question.options || []).map((option, oIndex) => (
                  <div key={oIndex} className="flex items-center gap-2">
                    <input
                      value={option.text}
                      onChange={(e) => updateOption(qIndex, oIndex, { text: e.target.value })}
                      className="flex-1 border rounded px-3 py-2"
                      placeholder={`Option ${oIndex + 1}`}
                    />
                    <label className="text-xs flex items-center gap-1 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={!!option.isCorrect}
                        onChange={(e) => updateOption(qIndex, oIndex, { isCorrect: e.target.checked })}
                      />
                      Correct
                    </label>
                  </div>
                ))}
                <button type="button" onClick={() => addOption(qIndex)} className="text-sm text-[#1b365d]">
                  + Add option
                </button>
              </div>
            )}
          </div>
        ))}

        {QUESTIONNAIRE_ALLOW_MULTIPLE_QUESTIONS && (
          <button
            type="button"
            onClick={addQuestion}
            disabled={!canAddQuestion}
            className="w-full px-4 py-2.5 text-sm border border-dashed border-[#1b365d] text-[#1b365d] rounded hover:bg-[#f8fbff] disabled:opacity-50 disabled:hover:bg-transparent"
          >
            + Add new question
          </button>
        )}
      </div>

      <div className="rounded-lg border border-[#d9e5f2] bg-[#f8fbff] p-4 space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-[#1b365d]">
            Optional: generate {QUESTIONNAIRE_ALLOW_MULTIPLE_QUESTIONS ? 'questions' : 'question'} with AI
          </h4>
          <p className="text-xs text-gray-600 mt-1">
            {QUESTIONNAIRE_ALLOW_MULTIPLE_QUESTIONS
              ? `Creates up to ${QUESTIONNAIRE_MAX_AI_QUESTIONS} single-answer MCQs from the content description. You can edit all questions and options afterwards.`
              : 'Creates one single-answer MCQ from the content description. You can edit the question and options afterwards.'}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {QUESTIONNAIRE_ALLOW_MULTIPLE_QUESTIONS && (
            <div>
              <label className="block text-sm font-medium mb-1">Number of questions</label>
              <input
                type="number"
                min={1}
                max={QUESTIONNAIRE_MAX_AI_QUESTIONS}
                value={aiQuestionCount}
                onChange={(e) => setAiQuestionCount(e.target.value)}
                className="w-28 border rounded px-3 py-2"
              />
            </div>
          )}
          <button
            type="button"
            onClick={handleGenerateQuestions}
            disabled={isGeneratingQuestions || !value.contentDescription?.trim()}
            className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 disabled:opacity-50"
          >
            {isGeneratingQuestions
              ? 'Generating...'
              : QUESTIONNAIRE_ALLOW_MULTIPLE_QUESTIONS
                ? 'Generate MCQs'
                : 'Generate MCQ'}
          </button>
        </div>
      </div>

      {blockId && (
        <div>
          <label className="block text-sm font-medium mb-1">Images (optional)</label>
          <input type="file" accept="image/*" onChange={handleImageUpload} />
          {mediaAssets.length > 0 && (
            <ul className="mt-2 text-xs text-gray-600 space-y-1">
              {mediaAssets.map((asset, i) => (
                <li key={i}>{asset.fileName || asset.url}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-[#1b365d]">Live preview</h4>
          {isPreviewLoading && (
            <span className="text-xs text-gray-500">Updating…</span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          Shows how learners will see this questionnaire. Complete question text and options to enable preview.
        </p>
        {previewError && (
          <p className="text-xs text-red-600">{previewError}</p>
        )}
        <div className="border rounded bg-[#f8fafc] overflow-hidden">
          <InteractiveBlockPreview
            title="Questionnaire"
            html={previewHtml}
            minHeight={320}
            emptyMessage="Add at least one complete question to see the live preview."
          />
        </div>
      </div>
    </div>
  );
}
