import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import toast from 'react-hot-toast';
import usePageTitle from '../hooks/usePageTitle';
import SearchableSelect from '../components/SearchableSelect';
import QuestionBankCategoryManager from '../components/QuestionBankCategoryManager';
import {
  createQuestionBankQuestion,
  getQuestionBankQuestion,
  updateQuestionBankQuestion,
} from '../services/questionBankQuestions';
import { createQuestionBankCategory, listQuestionBankCategories } from '../services/questionBankCategories';
import { isSuperAdmin } from '../config/adminFeatureFlags';
import { quizFeatureFlags } from '../config/quizFeatureFlags';

export default function QuestionBankQuestionCreator() {
  const navigate = useNavigate();
  const { questionId } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get('returnTo');
  const isEdit = !!questionId;
  const isGlobalBank = isSuperAdmin();

  usePageTitle(isEdit ? 'Edit Question Bank Question' : 'Create Question Bank Question');

  const [saving, setSaving] = useState(false);
  const [tagsText, setTagsText] = useState('');
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState({
    type: 'mc_single',
    question: '',
    points: 1,
    category: '',
    isCriticalSafety: false,
    options: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ],
    explanation: '',
  });

  const questionTypes = [
    { value: 'mc_single', label: 'Multiple Choice (Single Answer)' },
    { value: 'mc_multi', label: 'Multiple Choice (Multiple Answers)' },
  ];

  const loadCategories = async () => {
    try {
      const res = await listQuestionBankCategories();
      const items = Array.isArray(res?.items) ? res.items : [];
      setCategoryOptions(items.map((c) => c.name).filter(Boolean));
    } catch (e) {
      console.error('Failed to load categories', e);
      setCategoryOptions([]);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const q = await getQuestionBankQuestion(questionId);
        setCurrentQuestion({
          type: q.type || 'mc_single',
          question: q.question || '',
          points: q.points ?? 1,
          category: q.category || '',
          isCriticalSafety: !!q.isCriticalSafety,
          options:
            Array.isArray(q.options) && q.options.length
              ? q.options
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((o) => ({ text: o.text || '', isCorrect: !!o.isCorrect }))
              : [
                  { text: '', isCorrect: false },
                  { text: '', isCorrect: false },
                  { text: '', isCorrect: false },
                  { text: '', isCorrect: false },
                ],
          explanation: q.explanation || '',
        });
        setTagsText(Array.isArray(q.tags) ? q.tags.join(', ') : '');
      } catch (e) {
        console.error('Failed to load question bank question', e);
        toast.error('Failed to load question');
      }
    })();
  }, [isEdit, questionId]);

  const handleQuestionChange = (field, value) => {
    setCurrentQuestion((prev) => ({ ...prev, [field]: value }));
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...currentQuestion.options];
    newOptions[index] = { ...newOptions[index], text: value };
    setCurrentQuestion((prev) => ({ ...prev, options: newOptions }));
  };

  const addOption = () => {
    setCurrentQuestion((prev) => ({
      ...prev,
      options: [...prev.options, { text: '', isCorrect: false }],
    }));
  };

  const removeOption = (index) => {
    if (currentQuestion.options.length <= 2) {
      toast.error('At least 2 options are required');
      return;
    }
    const newOptions = currentQuestion.options.filter((_, i) => i !== index);
    setCurrentQuestion((prev) => ({
      ...prev,
      options: newOptions,
    }));
  };

  const handleCorrectChange = (index, checked = true) => {
    setCurrentQuestion((prev) => {
      const newOptions = prev.options.map((opt, i) => {
        if (prev.type === 'mc_single') {
          return { ...opt, isCorrect: i === index };
        }
        if (i === index) return { ...opt, isCorrect: !!checked };
        return opt;
      });
      return { ...prev, options: newOptions };
    });
  };

  const parseTags = () => {
    const parts = (tagsText || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    return [...new Set(parts.map((t) => t.toLowerCase()))].map((t) => parts.find((p) => p.toLowerCase() === t));
  };

  const ensureCategoryExists = async (categoryName) => {
    const name = (categoryName || '').trim();
    if (!name) return;

    // Fast-path: already in loaded options (case-insensitive)
    const exists = (categoryOptions || []).some((c) => (c || '').toLowerCase() === name.toLowerCase());
    if (exists) return;

    try {
      await createQuestionBankCategory({ name, description: null });
      await loadCategories();
    } catch (e) {
      // If it already exists (race / another user), ignore; otherwise surface error.
      const msg = e?.response?.data?.message || '';
      if (/already exists/i.test(msg)) {
        await loadCategories();
        return;
      }
      throw e;
    }
  };

  const save = async () => {
    if (!currentQuestion.question.trim()) {
      toast.error('Question text is required');
      return;
    }

    const validOptions = currentQuestion.options.filter((opt) => opt.text.trim());
    if (validOptions.length < 2) {
      toast.error('At least 2 options are required');
      return;
    }
    const correctCount = currentQuestion.options.filter((opt) => opt.isCorrect && opt.text.trim()).length;
    if (correctCount === 0) {
      toast.error('Select at least one correct answer');
      return;
    }
    if (currentQuestion.type === 'mc_single' && correctCount !== 1) {
      toast.error('Exactly one correct answer is required');
      return;
    }

    const payload = {
      question: currentQuestion.question.trim(),
      type: currentQuestion.type || 'mc_single',
      points: Number(currentQuestion.points) || 1,
      category: currentQuestion.category?.trim() || null,
      isCriticalSafety: quizFeatureFlags.enableCriticalSafetyQuestions && !!currentQuestion.isCriticalSafety,
      explanation: currentQuestion.explanation?.trim() || null,
      tags: parseTags().filter(Boolean),
      options: validOptions.map((o) => ({ text: o.text.trim(), isCorrect: !!o.isCorrect })),
    };

    try {
      setSaving(true);
      if (payload.category) {
        await ensureCategoryExists(payload.category);
      }
      if (isEdit) {
        await updateQuestionBankQuestion(questionId, payload);
        toast.success('Question updated');
      } else {
        await createQuestionBankQuestion(payload);
        toast.success('Question created');
      }

      if (returnTo) {
        try {
          navigate(decodeURIComponent(returnTo));
          return;
        } catch {
          // ignore
        }
      }
      navigate('/admin/question-bank/questions');
    } catch (e) {
      console.error('Failed to save question', e);
      toast.error(e.response?.data?.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <QuestionBankCategoryManager
        isOpen={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
        onChanged={loadCategories}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEdit ? 'Edit Question Bank Question' : 'Create Question Bank Question'}
            </h1>
            <p className="text-gray-600 mt-2">
              {isGlobalBank
                ? 'Create global questions and tag them for filtering.'
                : 'Create organisation questions and tag them for filtering.'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Question</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
                <select
                  value={currentQuestion.type}
                  onChange={(e) => handleQuestionChange('type', e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {questionTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Points</label>
                <input
                  type="number"
                  min="1"
                  value={currentQuestion.points}
                  onChange={(e) => handleQuestionChange('points', parseInt(e.target.value, 10))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <SearchableSelect
                  label="Category"
                  value={currentQuestion.category}
                  onChange={(v) => handleQuestionChange('category', v)}
                  options={categoryOptions}
                  placeholder="Search or type to create..."
                />
                <div className="mt-1 text-xs text-gray-500">
                  Can't find category?{' '}
                  <button
                    type="button"
                    className="text-blue-600 hover:text-blue-700 underline"
                    onClick={() => setCategoryManagerOpen(true)}
                  >
                    Manage Category
                  </button>
                </div>
              </div>

              {quizFeatureFlags.enableCriticalSafetyQuestions && (
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentQuestion.isCriticalSafety}
                    onChange={(e) => handleQuestionChange('isCriticalSafety', e.target.checked)}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  Critical Safety question
                </label>
                <span className="ml-2 text-xs text-gray-500">(wrong answer fails quiz)</span>
              </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma separated)</label>
              <input
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. fall protection, ppe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Question *</label>
              <textarea
                value={currentQuestion.question}
                onChange={(e) => handleQuestionChange('question', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="Enter your question"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Answer Options</label>
              <div className="space-y-2">
                {currentQuestion.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    {currentQuestion.type === 'mc_single' ? (
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={!!option.isCorrect}
                        onChange={() => handleCorrectChange(index, true)}
                        className="text-green-600 focus:ring-green-500"
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={!!option.isCorrect}
                        onChange={(e) => handleCorrectChange(index, e.target.checked)}
                        className="rounded text-green-600 focus:ring-green-500"
                      />
                    )}
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={`Option ${index + 1}`}
                    />
                    {currentQuestion.options.length > 2 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        type="button"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addOption}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  type="button"
                >
                  Add Option
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Explanation (Optional)</label>
              <textarea
                value={currentQuestion.explanation}
                onChange={(e) => handleQuestionChange('explanation', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="2"
                placeholder="Provide an explanation for the answer"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="px-6 py-3 bg-[#2afeae] text-[#1b365d] rounded-lg hover:bg-[#25e89e] disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Saving...' : isEdit ? 'Update Question' : 'Save Question'}
          </button>
        </div>
      </div>
    </div>
  );
}

