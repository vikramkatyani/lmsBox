import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import AIAssistant from '../components/AIAssistant';
import toast from 'react-hot-toast';
import { getQuiz, saveQuiz as saveQuizApi } from '../services/quizzes';
import usePageTitle from '../hooks/usePageTitle';
import { Sparkles } from 'lucide-react';

export default function QuizCreator() {
  const navigate = useNavigate();
  const { courseId, quizId } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get('returnTo');
  const isEdit = !!quizId;
  
  usePageTitle(isEdit ? 'Edit Quiz' : 'Create Quiz');
  
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  
  usePageTitle(isEdit ? 'Edit Quiz' : 'Create Quiz');
  
  const [quizData, setQuizData] = useState({
    title: '',
    description: '',
    passingScore: 70,
    isTimed: false,
    timeLimit: 30,
    shuffleQuestions: false,
    shuffleAnswers: false,
    showResults: true,
    allowRetake: true,
    maxAttempts: 3,
    courseId: courseId || ''
  });

  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState({
    type: 'mc_single',
    question: '',
    points: 1,
    options: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ],
    explanation: ''
  });

  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  const questionTypes = [
    { value: 'mc_single', label: 'Multiple Choice (Single Answer)' },
    { value: 'mc_multi', label: 'Multiple Choice (Multiple Answers)' }
  ];

  const handleQuizInfoChange = (field, value) => {
    setQuizData(prev => ({ ...prev, [field]: value }));
  };

  const handleQuestionChange = (field, value) => {
    setCurrentQuestion(prev => ({ ...prev, [field]: value }));
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...currentQuestion.options];
    newOptions[index] = { ...newOptions[index], text: value };
    setCurrentQuestion(prev => ({ ...prev, options: newOptions }));
  };

  const addOption = () => {
    setCurrentQuestion(prev => ({
      ...prev,
      options: [...prev.options, { text: '', isCorrect: false }]
    }));
  };

  const removeOption = (index) => {
    if (currentQuestion.options.length <= 2) {
      toast.error('At least 2 options are required');
      return;
    }
    const newOptions = currentQuestion.options.filter((_, i) => i !== index);
    setCurrentQuestion(prev => ({
      ...prev,
      options: newOptions
    }));
  };

  const handleCorrectChange = (index, checked = true) => {
    setCurrentQuestion(prev => {
      const newOptions = prev.options.map((opt, i) => {
        if (prev.type === 'mc_single') {
          // Only one correct option allowed
          return { ...opt, isCorrect: i === index };
        }
        // Multiple correct allowed
        if (i === index) {
          return { ...opt, isCorrect: !!checked };
        }
        return opt;
      });
      return { ...prev, options: newOptions };
    });
  };

  const saveQuestion = () => {
    // Validation
    if (!currentQuestion.question.trim()) {
      toast.error('Question text is required');
      return;
    }

    if (currentQuestion.type === 'mc_single' || currentQuestion.type === 'mc_multi') {
      const validOptions = currentQuestion.options.filter(opt => opt.text.trim());
      if (validOptions.length < 2) {
        toast.error('At least 2 options are required');
        return;
      }
      const correctCount = currentQuestion.options.filter(opt => opt.isCorrect && opt.text.trim()).length;
      if (correctCount === 0) {
        toast.error('Select at least one correct answer');
        return;
      }
      if (currentQuestion.type === 'mc_single' && correctCount !== 1) {
        toast.error('Exactly one correct answer is required');
        return;
      }
    }

    if (editingIndex !== null) {
      const updatedQuestions = [...questions];
      updatedQuestions[editingIndex] = { ...currentQuestion };
      setQuestions(updatedQuestions);
      toast.success('Question updated');
    } else {
      setQuestions(prev => [...prev, { ...currentQuestion }]);
      toast.success('Question added');
    }

    resetQuestionForm();
  };

  const resetQuestionForm = () => {
    setCurrentQuestion({
      type: 'mc_single',
      question: '',
      points: 1,
      options: [
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false }
      ],
      explanation: ''
    });
    setIsAddingQuestion(false);
    setEditingIndex(null);
  };

  const editQuestion = (index) => {
    setCurrentQuestion({ ...questions[index] });
    setEditingIndex(index);
    setIsAddingQuestion(true);
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
          passingScore: q.passingScore,
          timeLimit: q.timeLimit,
          shuffleQuestions: q.shuffleQuestions,
          shuffleAnswers: q.shuffleAnswers,
          showResults: q.showResults,
          allowRetake: q.allowRetake,
          maxAttempts: q.maxAttempts,
          courseId: q.courseId
        });
        setQuestions(q.questions || []);
      } catch (e) {
        console.error('Failed to load quiz', e);
        toast.error('Failed to load quiz');
      }
    })();
  }, [isEdit, quizId]);

  const saveQuiz = async () => {
    if (!quizData.title.trim()) {
      toast.error('Quiz title is required');
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

    try {
      const quizPayload = {
        id: quizId,
        ...quizData,
        questions,
        totalPoints: questions.reduce((sum, q) => sum + q.points, 0)
      };

      console.log(isEdit ? 'Updating quiz:' : 'Creating quiz:', quizPayload);
      await saveQuizApi(quizPayload, isEdit);
      toast.success(isEdit ? 'Quiz updated successfully' : 'Quiz created successfully');

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
      toast.error('Failed to save quiz');
    }
  };

  const handleApplyAIQuestions = (content) => {
    try {
      // Strip markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```json\n/, '').replace(/^```\n/, '').replace(/\n```$/, '');
      }
      
      const parsed = JSON.parse(cleanContent);
      
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Transform AI format to quiz format
        const transformedQuestions = parsed.map((q, index) => ({
          type: q.options && q.options.length > 0 ? 'mc_single' : 'mc_single',
          question: q.question || '',
          points: 1,
          options: q.options && Array.isArray(q.options) 
            ? q.options.map(opt => ({
                text: opt.text || opt,
                isCorrect: opt.isCorrect || false
              }))
            : [
                { text: '', isCorrect: false },
                { text: '', isCorrect: false },
                { text: '', isCorrect: false },
                { text: '', isCorrect: false }
              ],
          explanation: q.explanation || ''
        }));
        
        setQuestions(prev => [...prev, ...transformedQuestions]);
        toast.success(`${transformedQuestions.length} questions added from AI!`);
      } else {
        toast.error('Invalid question format from AI');
      }
    } catch (e) {
      console.error('Failed to parse AI content:', e);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(content);
        toast('Content copied to clipboard for manual use', { icon: 'ℹ️' });
      } else {
        toast.error('Could not parse AI-generated questions');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <AIAssistant 
        mode="slideIn"
        isOpen={aiAssistantOpen}
        onClose={() => setAiAssistantOpen(false)}
        context={quizData.title ? `Creating quiz: ${quizData.title}` : 'Creating a new quiz'}
        onApplyContent={handleApplyAIQuestions}
        defaultTab="quiz"
      />
      
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
            <h1 className="text-3xl font-bold text-gray-900">{isEdit ? 'Edit Quiz' : 'Create Quiz'}</h1>
            <p className="text-gray-600 mt-2">{isEdit ? 'Update questions and settings of this quiz' : 'Build an interactive quiz for your course'}</p>
          </div>
          
          <button
            onClick={() => setAiAssistantOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            AI Assistant
          </button>
        </div>

        {/* Quiz Information */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Quiz Information</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quiz Title *</label>
              <input
                type="text"
                value={quizData.title}
                onChange={(e) => handleQuizInfoChange('title', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter quiz title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={quizData.description}
                onChange={(e) => handleQuizInfoChange('description', e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="Enter quiz description"
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
                  Timed Quiz
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

        {/* Questions List */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Questions ({questions.length})</h2>
              <p className="text-sm text-gray-600">Total Points: {questions.reduce((sum, q) => sum + q.points, 0)}</p>
            </div>
            {!isAddingQuestion && (
              <button
                onClick={() => setIsAddingQuestion(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add Question
              </button>
            )}
          </div>

          {/* Question Form */}
          {isAddingQuestion && (
            <div className="p-6 border-b bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingIndex !== null ? 'Edit Question' : 'Add New Question'}
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
                    <select
                      value={currentQuestion.type}
                      onChange={(e) => handleQuestionChange('type', e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {questionTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Points</label>
                    <input
                      type="number"
                      min="1"
                      value={currentQuestion.points}
                      onChange={(e) => handleQuestionChange('points', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
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

                {/* Options for Multiple Choice (Single or Multiple) */}
                {(currentQuestion.type === 'mc_single' || currentQuestion.type === 'mc_multi') && (
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
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={addOption}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Add Option
                      </button>
                    </div>
                  </div>
                )}


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

                <div className="flex space-x-2">
                  <button
                    onClick={saveQuestion}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    {editingIndex !== null ? 'Update Question' : 'Save Question'}
                  </button>
                  <button
                    onClick={resetQuestionForm}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Questions List */}
          <div className="divide-y">
            {questions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No questions added yet. Click "Add Question" to get started.
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
                          {questionTypes.find(t => t.value === q.type)?.label}
                        </span>
                        <span className="text-sm text-gray-600">{q.points} point{q.points !== 1 ? 's' : ''}</span>
                      </div>
                      <p className="text-gray-900 font-medium mb-2">{q.question}</p>
                      {(q.type === 'mc_single' || q.type === 'mc_multi') && (
                        <div className="ml-4 space-y-1">
                          {q.options.map((opt, i) => (
                            <div key={i} className="flex items-center space-x-2">
                              <span className={`text-sm ${opt.isCorrect ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                                {opt.isCorrect && '✓ '}{opt.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => moveQuestion(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveQuestion(index, 'down')}
                        disabled={index === questions.length - 1}
                        className="p-1 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => editQuestion(index)}
                        className="p-1 text-blue-600 hover:text-blue-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteQuestion(index)}
                        className="p-1 text-red-600 hover:text-red-700"
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

        {/* Save Quiz */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={saveQuiz}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {isEdit ? 'Update Quiz' : 'Save Quiz'}
          </button>
        </div>
      </div>
    </div>
  );
}
