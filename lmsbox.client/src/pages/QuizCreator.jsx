import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import toast from 'react-hot-toast';
import { createQuizFromBank, getQuiz, updateQuizFromBank } from '../services/quizzes';
import usePageTitle from '../hooks/usePageTitle';
import { listQuestionBankQuestionsForQuiz } from '../services/questionBankQuestions';
import SlideOver from '../components/SlideOver';
import Pagination from '../components/Pagination';
import { quizFeatureFlags } from '../config/quizFeatureFlags';

export default function QuizCreator() {
  const navigate = useNavigate();
  const { courseId, quizId } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get('returnTo');
  const isEdit = !!quizId;
  
  usePageTitle(isEdit ? 'Edit Assessment' : 'Create Assessment');
  
  const [quizData, setQuizData] = useState({
    title: '',
    description: '',
    introductionContent: '',
    passingScore: 70,
    isTimed: false,
    timeLimit: 30,
    shuffleQuestions: false,
    shuffleAnswers: false,
    showResults: true,
    allowRetake: true,
    maxAttempts: 3,
    questionsPerAttempt: '',
    questionsPerAttemptByCategory: {},
    courseId: courseId || ''
  });

  const [questions, setQuestions] = useState([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankItems, setBankItems] = useState([]);
  const [bankSearchInput, setBankSearchInput] = useState('');
  const [bankTagsInput, setBankTagsInput] = useState('');
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [bankTagsQuery, setBankTagsQuery] = useState('');
  const [bankPanelOpen, setBankPanelOpen] = useState(false);
  const [bankPage, setBankPage] = useState(1);
  const [bankPageSize, setBankPageSize] = useState(20);
  const [bankTotal, setBankTotal] = useState(0);
  const [bankSelectedIds, setBankSelectedIds] = useState(() => new Set());
  const [bankBulkAdding, setBankBulkAdding] = useState(false);

  const addedBankIds = useMemo(
    () => new Set(questions.map((q) => q.questionBankQuestionId).filter(Boolean)),
    [questions]
  );

  const bankTotalPages = Math.max(1, Math.ceil(bankTotal / bankPageSize) || 1);

  useEffect(() => {
    setBankSelectedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of addedBankIds) {
        if (next.delete(id)) changed = true;
      }
      return changed ? next : prev;
    });
  }, [addedBankIds]);

  const handleQuizInfoChange = (field, value) => {
    setQuizData(prev => ({ ...prev, [field]: value }));
  };

  const deleteQuestion = (index) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      setQuestions(prev => prev.filter((_, i) => i !== index));
      toast.success('Question deleted');
    }
  };

  const moveQuestion = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    const newQuestions = [...questions];
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setQuestions(newQuestions);
  };

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const q = await getQuiz(quizId);
        setQuizData({
          title: q.title,
          description: q.description,
          introductionContent: q.introductionContent || '',
          passingScore: q.passingScore,
          isTimed: q.isTimed,
          timeLimit: q.timeLimit,
          shuffleQuestions: q.shuffleQuestions,
          shuffleAnswers: q.shuffleAnswers,
          showResults: q.showResults,
          allowRetake: q.allowRetake,
          maxAttempts: q.maxAttempts,
          questionsPerAttempt: q.questionsPerAttempt ?? '',
          questionsPerAttemptByCategory: q.questionsPerAttemptByCategory || {},
          courseId: q.courseId
        });
        setQuestions(q.questions || []);
      } catch (e) {
        console.error('Failed to load quiz', e);
        toast.error('Failed to load assessment');
      }
    })();
  }, [isEdit, quizId]);

  const fetchBankItems = async () => {
    try {
      setBankLoading(true);
      const data = await listQuestionBankQuestionsForQuiz({
        search: bankSearchQuery,
        tags: bankTagsQuery,
        page: bankPage,
        pageSize: bankPageSize,
      });
      const total = Number(data.total) || 0;
      const pages = Math.max(1, Math.ceil(total / bankPageSize) || 1);
      if (bankPage > pages && total > 0) {
        setBankPage(pages);
        return;
      }
      setBankItems(Array.isArray(data.items) ? data.items : []);
      setBankTotal(total);
    } catch (e) {
      console.error('Failed to load question bank questions', e);
      toast.error('Failed to load Question Bank');
      setBankItems([]);
      setBankTotal(0);
    } finally {
      setBankLoading(false);
    }
  };

  useEffect(() => {
    fetchBankItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankSearchQuery, bankTagsQuery, bankPage, bankPageSize]);

  const applyBankFilters = () => {
    setBankSearchQuery(bankSearchInput.trim());
    setBankTagsQuery(bankTagsInput.trim());
    setBankPage(1);
  };

  useEffect(() => {
    const handle = setTimeout(() => {
      setBankSearchQuery(bankSearchInput.trim());
      setBankTagsQuery(bankTagsInput.trim());
      setBankPage(1);
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankSearchInput, bankTagsInput]);

  const addBankQuestion = (item) => {
    const exists = questions.some((q) => q.questionBankQuestionId === item.id);
    if (exists) {
      toast.error('Question already added');
      return;
    }
    setQuestions((prev) => [
      ...prev,
      {
        questionBankQuestionId: item.id,
        type: item.type,
        question: item.question,
        points: item.points ?? 1,
        category: item.category || '',
        isCriticalSafety: quizFeatureFlags.enableCriticalSafetyQuestions && !!item.isCriticalSafety,
        options: [],
        explanation: '',
        tags: item.tags || [],
      },
    ]);
    toast.success('Question added from bank');
  };

  const toggleBankSelected = (id, checked) => {
    if (addedBankIds.has(id)) return;
    setBankSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setBankSelectedIds((prev) => {
      const next = new Set(prev);
      for (const item of bankItems) {
        if (!addedBankIds.has(item.id)) next.add(item.id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setBankSelectedIds(new Set());
  };

  const addQuestionsFromItems = (items) => {
    const existing = new Set(questions.map((q) => q.questionBankQuestionId));
    const toAdd = [];
    for (const item of items) {
      if (existing.has(item.id)) continue;
      toAdd.push({
        questionBankQuestionId: item.id,
        type: item.type,
        question: item.question,
        points: item.points ?? 1,
        category: item.category || '',
        isCriticalSafety: quizFeatureFlags.enableCriticalSafetyQuestions && !!item.isCriticalSafety,
        options: [],
        explanation: '',
        tags: item.tags || [],
      });
      existing.add(item.id);
    }
    if (toAdd.length === 0) return 0;
    setQuestions((prev) => [...prev, ...toAdd]);
    return toAdd.length;
  };

  const addSelectedFromCurrentPage = () => {
    const selectedOnPage = bankItems.filter(
      (i) => bankSelectedIds.has(i.id) && !addedBankIds.has(i.id)
    );
    if (selectedOnPage.length === 0) {
      toast.error('Select at least one question');
      return;
    }
    const added = addQuestionsFromItems(selectedOnPage);
    toast.success(added ? `${added} question(s) added` : 'All selected questions were already added');
  };

  const addAllMatching = async () => {
    try {
      setBankBulkAdding(true);
      const pageSize = 200; // server max
      const first = await listQuestionBankQuestionsForQuiz({
        search: bankSearchQuery,
        tags: bankTagsQuery,
        page: 1,
        pageSize,
      });
      const total = Number(first.total) || 0;
      const all = Array.isArray(first.items) ? [...first.items] : [];
      const pages = Math.max(1, Math.ceil(total / pageSize));
      for (let p = 2; p <= pages; p++) {
        const res = await listQuestionBankQuestionsForQuiz({
          search: bankSearchQuery,
          tags: bankTagsQuery,
          page: p,
          pageSize,
        });
        if (Array.isArray(res.items)) all.push(...res.items);
      }
      const added = addQuestionsFromItems(all);
      toast.success(added ? `${added} question(s) added` : 'All matching questions were already added');
    } catch (e) {
      console.error('Failed to add all matching questions', e);
      toast.error('Failed to add all matching questions');
    } finally {
      setBankBulkAdding(false);
    }
  };

  const saveQuiz = async () => {
    if (!quizData.title.trim()) {
      toast.error('Assessment title is required');
      return;
    }

    if (!quizData.courseId.trim()) {
      toast.error('Course ID is required');
      return;
    }

    if (questions.length === 0) {
      toast.error('Add at least one question');
      return;
    }

    const missingBankRef = questions.some((q) => !q.questionBankQuestionId);
    if (missingBankRef) {
      toast.error('This assessment contains legacy questions. Phase 2 assessments must use Question Bank questions.');
      return;
    }

    const perAttemptRaw = quizData.questionsPerAttempt;
    const perAttempt = perAttemptRaw === '' || perAttemptRaw == null
      ? null
      : parseInt(perAttemptRaw, 10);

    if (perAttempt != null && (Number.isNaN(perAttempt) || perAttempt < 1 || perAttempt >= questions.length)) {
      toast.error(
        perAttempt >= questions.length
          ? `Questions per attempt must be less than the pool size (${questions.length}). Leave empty to show all questions.`
          : 'Questions per attempt must be a positive number, or leave empty to show all questions.'
      );
      return;
    }

    // Validate per-category config (optional)
    const byCat = quizData.questionsPerAttemptByCategory || {};
    const hasByCat = byCat && Object.keys(byCat).some((k) => Number(byCat[k]) > 0);
    if (hasByCat) {
      if (perAttempt == null) {
        toast.error('Set "Questions per attempt" before configuring per-category counts.');
        return;
      }

      const available = {};
      for (const q of questions) {
        const c = (q.category || '').trim();
        if (!c) continue;
        available[c] = (available[c] || 0) + 1;
      }

      let sum = 0;
      for (const [cat, raw] of Object.entries(byCat)) {
        const n = raw === '' || raw == null ? 0 : parseInt(raw, 10);
        if (Number.isNaN(n) || n < 0) {
          toast.error('Per-category counts must be 0 or greater.');
          return;
        }
        const max = available[cat] || 0;
        if (n > max) {
          toast.error(`"${cat}" has only ${max} question(s) in the pool.`);
          return;
        }
        sum += n;
      }

      if (sum !== perAttempt) {
        toast.error(`Sum of per-category counts must equal Questions per attempt (${perAttempt}).`);
        return;
      }
    }

    try {
      const payload = {
        title: quizData.title,
        description: quizData.description,
        introductionContent: quizData.introductionContent,
        passingScore: quizData.passingScore,
        isTimed: quizData.isTimed,
        timeLimit: quizData.timeLimit,
        shuffleQuestions: quizData.shuffleQuestions,
        shuffleAnswers: quizData.shuffleAnswers,
        showResults: quizData.showResults,
        allowRetake: quizData.allowRetake,
        maxAttempts: quizData.maxAttempts,
        questionsPerAttempt: perAttempt,
        questionsPerAttemptByCategory: hasByCat ? byCat : null,
        courseId: quizData.courseId,
        questionBankQuestionIds: questions.map((q) => q.questionBankQuestionId),
      };

      if (isEdit) {
        await updateQuizFromBank(quizId, payload);
      } else {
        await createQuizFromBank(payload);
      }
      toast.success(isEdit ? 'Assessment updated successfully' : 'Assessment created successfully');

      if (returnTo) {
        try {
          const target = decodeURIComponent(returnTo);
          navigate(target);
          return;
        } catch {
          // fall through
        }
      }
      if (quizData.courseId) {
        navigate(`/admin/courses/${quizData.courseId}/edit`);
      } else {
        navigate('/admin/courses');
      }
    } catch (error) {
      console.error('Error saving quiz:', error);
      const data = error.response?.data;
      let message = data?.message || 'Failed to save assessment';
      if (data?.errors?.length) {
        const details = data.errors
          .flatMap((e) => e.errors || [])
          .filter(Boolean)
          .join('; ');
        if (details) message = `${message}: ${details}`;
      }
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
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
            <h1 className="text-3xl font-bold text-gray-900">{isEdit ? 'Edit Assessment' : 'Create Assessment'}</h1>
            <p className="text-gray-600 mt-2">{isEdit ? 'Update questions and settings of this assessment' : 'Build an interactive assessment for your course'}</p>
          </div>
          
          <div className="text-sm text-gray-500">
            Build assessments by selecting questions from the Question Bank.
          </div>
        </div>

        {/* Assessment Information */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Assessment Information</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assessment Title *</label>
              <input
                type="text"
                value={quizData.title}
                onChange={(e) => handleQuizInfoChange('title', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter assessment title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={quizData.description}
                onChange={(e) => handleQuizInfoChange('description', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="Enter assessment description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Introduction Page Content</label>
              <p className="text-xs text-gray-500 mb-2">
                Shown to learners before they start the assessment. Supports HTML (e.g. instructions, rules).
              </p>
              <textarea
                value={quizData.introductionContent}
                onChange={(e) => handleQuizInfoChange('introductionContent', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                rows="8"
                placeholder="Enter instructions, rules, or welcome message for the introduction page..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Course ID *</label>
              <input
                type="text"
                value={quizData.courseId}
                onChange={(e) => handleQuizInfoChange('courseId', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter course ID"
                disabled={isEdit} // Don't allow changing course when editing
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Passing Score (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={quizData.passingScore}
                  onChange={(e) => handleQuizInfoChange('passingScore', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <input
                    type="checkbox"
                    checked={quizData.isTimed}
                    onChange={(e) => handleQuizInfoChange('isTimed', e.target.checked)}
                    className="rounded"
                  />
                  Timed Assessment
                </label>
                {quizData.isTimed && (
                  <input
                    type="number"
                    min="1"
                    value={quizData.timeLimit}
                    onChange={(e) => handleQuizInfoChange('timeLimit', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Time limit in minutes"
                  />
                )}
                {!quizData.isTimed && (
                  <div className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-400 text-sm">
                    No time limit
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Attempts</label>
                <input
                  type="number"
                  min="1"
                  value={quizData.maxAttempts}
                  onChange={(e) => handleQuizInfoChange('maxAttempts', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Questions per attempt (random subset)
              </label>
              <input
                type="number"
                min="1"
                max={Math.max(1, questions.length - 1)}
                value={quizData.questionsPerAttempt}
                onChange={(e) => handleQuizInfoChange('questionsPerAttempt', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`All ${questions.length} questions (default)`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to show every question each attempt. Enter a number smaller than the pool
                ({questions.length} questions) to show a random subset per attempt.
              </p>
            </div>

            {(() => {
              const perAttemptRaw = quizData.questionsPerAttempt;
              const perAttempt = perAttemptRaw === '' || perAttemptRaw == null ? null : parseInt(perAttemptRaw, 10);
              const isSubset = perAttempt != null && !Number.isNaN(perAttempt) && perAttempt > 0 && perAttempt < questions.length;
              if (!isSubset) return null;

              const categoryCounts = {};
              for (const q of questions) {
                const c = (q.category || '').trim();
                if (!c) continue;
                categoryCounts[c] = (categoryCounts[c] || 0) + 1;
              }
              const categories = Object.keys(categoryCounts).sort((a, b) => a.localeCompare(b));
              if (categories.length === 0) return null;

              const current = quizData.questionsPerAttemptByCategory || {};
              const sum = categories.reduce((acc, c) => acc + (parseInt(current[c] ?? 0, 10) || 0), 0);
              return (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Per-category questions per attempt</div>
                      <div className="text-xs text-gray-500">
                        Configure how many questions to draw from each category. Total must equal {perAttempt}.
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">Selected: {sum} / {perAttempt}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categories.map((cat) => (
                      <div key={cat} className="flex items-center justify-between gap-3 border rounded-lg bg-white px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{cat}</div>
                          <div className="text-xs text-gray-500">{categoryCounts[cat]} in pool</div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={categoryCounts[cat]}
                          value={current[cat] ?? 0}
                          onChange={(e) => {
                            const v = e.target.value;
                            setQuizData((prev) => ({
                              ...prev,
                              questionsPerAttemptByCategory: {
                                ...(prev.questionsPerAttemptByCategory || {}),
                                [cat]: v === '' ? '' : parseInt(v, 10),
                              },
                            }));
                          }}
                          className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={quizData.shuffleQuestions}
                  onChange={(e) => handleQuizInfoChange('shuffleQuestions', e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Shuffle Questions</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={quizData.shuffleAnswers}
                  onChange={(e) => handleQuizInfoChange('shuffleAnswers', e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Shuffle Answers</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={quizData.showResults}
                  onChange={(e) => handleQuizInfoChange('showResults', e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Show Results After Submission</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={quizData.allowRetake}
                  onChange={(e) => handleQuizInfoChange('allowRetake', e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Allow Retake</span>
              </label>
            </div>
          </div>
        </div>

        {/* Selected Questions */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Questions ({questions.length})</h2>
              <p className="text-sm text-gray-600">Total Points: {questions.reduce((sum, q) => sum + (q.points ?? 0), 0)}</p>
            </div>
            <button
              type="button"
              onClick={() => setBankPanelOpen(true)}
              className="px-4 py-2 bg-[#2afeae] text-[#1b365d] rounded hover:bg-[#25e89e]"
            >
              Add Question
            </button>
          </div>

          <div className="divide-y">
            {questions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No questions added yet. Use the Question Bank above to add questions.
              </div>
            ) : (
              questions.map((q, index) => (
                <div key={index} className="p-6 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          Q{index + 1}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">
                          {q.type === 'mc_multi' ? 'Multiple Choice (Multiple Answers)' : 'Multiple Choice (Single Answer)'}
                        </span>
                        <span className="text-sm text-gray-600">{q.points} point{q.points !== 1 ? 's' : ''}</span>
                        {q.category && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                            {q.category}
                          </span>
                        )}
                        {quizFeatureFlags.enableCriticalSafetyQuestions && q.isCriticalSafety && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                            Critical Safety
                          </span>
                        )}
                      </div>
                      <p className="text-gray-900 font-medium mb-2">{q.question}</p>
                      {q.questionBankQuestionId && (
                        <div className="text-xs text-gray-400">Bank ID: {q.questionBankQuestionId}</div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => moveQuestion(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                        type="button"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveQuestion(index, 'down')}
                        disabled={index === questions.length - 1}
                        className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                        type="button"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteQuestion(index)}
                        className="p-1 text-red-600 hover:text-red-700"
                        type="button"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <SlideOver
          isOpen={bankPanelOpen}
          title="Add questions from Question Bank"
          onClose={() => setBankPanelOpen(false)}
          widthClass="max-w-3xl"
        >
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={bankSearchInput}
                  onChange={(e) => setBankSearchInput(e.target.value)}
                  placeholder="Search question text, category, explanation..."
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={bankTagsInput}
                  onChange={(e) => setBankTagsInput(e.target.value)}
                  placeholder="e.g. fall protection, ppe"
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                {bankTotal ? `Total matches: ${bankTotal}` : ' '}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-3 py-2 rounded border text-sm"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={selectAllOnPage}
                  className="px-3 py-2 rounded border text-sm"
                >
                  Select page
                </button>
                <button
                  type="button"
                  onClick={addSelectedFromCurrentPage}
                  className="px-3 py-2 rounded-md shadow-sm text-sm font-medium bg-[#2afeae] text-[#1b365d] hover:bg-[#25e89e]"
                >
                  Add selected
                </button>
                <button
                  type="button"
                  onClick={addAllMatching}
                  disabled={bankBulkAdding || bankLoading}
                  className="px-3 py-2 rounded-md shadow-sm text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                  title="Adds all questions that match current filters"
                >
                  {bankBulkAdding ? 'Adding…' : 'Add all matches'}
                </button>
              </div>
            </div>

            {bankLoading ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : bankItems.length === 0 ? (
              <div className="text-sm text-gray-500">No matching questions found.</div>
            ) : (
              <div className="divide-y border rounded-lg overflow-hidden">
                {bankItems.map((item) => {
                  const isAdded = addedBankIds.has(item.id);
                  return (
                  <div
                    key={item.id}
                    className={`p-4 flex items-start justify-between gap-4 ${isAdded ? 'bg-gray-50 opacity-60' : ''}`}
                  >
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={!isAdded && bankSelectedIds.has(item.id)}
                        disabled={isAdded}
                        onChange={(e) => toggleBankSelected(item.id, e.target.checked)}
                        className="h-4 w-4 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 line-clamp-2">{item.question}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        ID: {item.id}
                        {item.category ? ` • ${item.category}` : ''}
                        {quizFeatureFlags.enableCriticalSafetyQuestions && item.isCriticalSafety ? ' • Critical' : ''}
                        {item.optionCount != null ? ` • ${item.optionCount} options` : ''}
                        {isAdded ? ' • Already in assessment' : ''}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(item.tags || []).slice(0, 6).map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                            {t}
                          </span>
                        ))}
                        {(item.tags || []).length > 6 && (
                          <span className="text-xs text-gray-400">+{item.tags.length - 6} more</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addBankQuestion(item)}
                      disabled={isAdded}
                      className="px-3 py-2 rounded whitespace-nowrap disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 bg-[#2afeae] text-[#1b365d] hover:bg-[#25e89e] disabled:hover:bg-gray-200"
                    >
                      {isAdded ? 'Added' : 'Add'}
                    </button>
                  </div>
                  );
                })}
              </div>
            )}

            {!bankLoading && bankTotal > 0 && (
              <Pagination
                currentPage={bankPage}
                totalPages={bankTotalPages}
                pageSize={bankPageSize}
                totalCount={bankTotal}
                onPageChange={setBankPage}
                onPageSizeChange={(size) => {
                  setBankPageSize(size);
                  setBankPage(1);
                }}
              />
            )}
          </div>
        </SlideOver>

        {/* Save Assessment */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={saveQuiz}
            className="px-6 py-3 bg-[#2afeae] text-[#1b365d] rounded-lg hover:bg-[#25e89e]"
          >
            {isEdit ? 'Update Assessment' : 'Save Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
}
