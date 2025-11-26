import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import toast from 'react-hot-toast';
import { adminSurveyService } from '../services/surveys';
import usePageTitle from '../hooks/usePageTitle';

export default function AdminSurveyEditor() {
  const navigate = useNavigate();
  const { surveyId } = useParams();
  const isNew = !surveyId;

  usePageTitle(isNew ? 'Create Survey' : 'Edit Survey');

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    surveyType: 'Standalone',
    isActive: true
  });
  const [questions, setQuestions] = useState([]);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [questionForm, setQuestionForm] = useState({
    questionText: '',
    questionType: 'Text',
    options: [],
    isRequired: true,
    minRating: 1,
    maxRating: 5
  });

  useEffect(() => {
    if (!isNew && surveyId) {
      loadSurvey();
    }
  }, [surveyId, isNew]);

  const loadSurvey = async () => {
    try {
      setLoading(true);
      const data = await adminSurveyService.getSurvey(surveyId);
      setForm({
        title: data.title,
        description: data.description || '',
        surveyType: data.surveyType,
        isActive: data.isActive
      });
      setQuestions(data.questions || []);
    } catch (error) {
      console.error('Error loading survey:', error);
      toast.error('Failed to load survey');
      navigate('/admin/courses');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error('Survey title is required');
      return;
    }

    try {
      setSaving(true);
      if (isNew) {
        const created = await adminSurveyService.createSurvey(form);
        toast.success('Survey created successfully');
        navigate(`/admin/surveys/edit/${created.id}`);
      } else {
        await adminSurveyService.updateSurvey(surveyId, form);
        toast.success('Survey updated successfully');
      }
    } catch (error) {
      console.error('Error saving survey:', error);
      toast.error(error.response?.data?.message || 'Failed to save survey');
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!questionForm.questionText.trim()) {
      toast.error('Question text is required');
      return;
    }

    try {
      if (editingQuestion) {
        await adminSurveyService.updateQuestion(surveyId, editingQuestion.id, questionForm);
        toast.success('Question updated successfully');
      } else {
        await adminSurveyService.addQuestion(surveyId, questionForm);
        toast.success('Question added successfully');
      }
      setQuestionForm({
        questionText: '',
        questionType: 'Text',
        options: [],
        isRequired: true,
        minRating: 1,
        maxRating: 5
      });
      setEditingQuestion(null);
      loadSurvey();
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('Failed to save question');
    }
  };

  const handleEditQuestion = (question) => {
    setEditingQuestion(question);
    setQuestionForm({
      questionText: question.questionText,
      questionType: question.questionType,
      options: question.options || [],
      isRequired: question.isRequired,
      minRating: question.minRating || 1,
      maxRating: question.maxRating || 5
    });
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Delete this question?')) return;

    try {
      await adminSurveyService.deleteQuestion(surveyId, questionId);
      toast.success('Question deleted successfully');
      loadSurvey();
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Failed to delete question');
    }
  };

  const addOption = () => {
    setQuestionForm(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const updateOption = (index, value) => {
    setQuestionForm(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  const removeOption = (index) => {
    setQuestionForm(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">{isNew ? 'Create Survey' : 'Edit Survey'}</h1>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center text-gray-500">Loading...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Survey Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Survey Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Survey Title <span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    className="w-full border border-gray-300 rounded px-4 py-2"
                    placeholder="Enter survey title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="w-full border border-gray-300 rounded px-4 py-2"
                    rows={3}
                    placeholder="Brief description of the survey"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Survey Type</label>
                    <select
                      value={form.surveyType}
                      onChange={(e) => handleChange('surveyType', e.target.value)}
                      className="w-full border border-gray-300 rounded px-4 py-2"
                    >
                      <option value="Standalone">Standalone</option>
                      <option value="PreCourse">Pre-Course</option>
                      <option value="PostCourse">Post-Course</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <label className="inline-flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) => handleChange('isActive', e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Active</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t">
                  <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Survey'}
                  </button>
                </div>
              </div>
            </div>

            {/* Questions Section */}
            {!isNew && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Survey Questions</h2>
                
                {/* Question List */}
                {questions.length > 0 && (
                  <div className="space-y-3 mb-6">
                    {questions.map((q, index) => (
                      <div key={q.id} className="border rounded p-4 bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-500">Q{index + 1}</span>
                              <span className="text-sm text-gray-900">{q.questionText}</span>
                              {q.isRequired && <span className="text-red-600 text-xs">*</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                {q.questionType}
                              </span>
                              {(q.questionType === 'MultipleChoice' || q.questionType === 'SingleChoice') && q.options && (
                                <span className="text-xs text-gray-500">{q.options.length} options</span>
                              )}
                              {q.questionType === 'Rating' && (
                                <span className="text-xs text-gray-500">Range: {q.minRating}-{q.maxRating}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditQuestion(q)}
                              className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="px-3 py-1 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add/Edit Question Form */}
                <div className="border rounded p-4 bg-blue-50">
                  <h3 className="font-medium text-gray-900 mb-4">{editingQuestion ? 'Edit Question' : 'Add New Question'}</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Question Text <span className="text-red-600">*</span></label>
                      <input
                        type="text"
                        value={questionForm.questionText}
                        onChange={(e) => setQuestionForm(prev => ({ ...prev, questionText: e.target.value }))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                        placeholder="Enter your question"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Question Type</label>
                        <select
                          value={questionForm.questionType}
                          onChange={(e) => setQuestionForm(prev => ({ ...prev, questionType: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-3 py-2"
                        >
                          <option value="Text">Text</option>
                          <option value="SingleChoice">Single Choice</option>
                          <option value="MultipleChoice">Multiple Choice</option>
                          <option value="Rating">Rating</option>
                          <option value="YesNo">Yes/No</option>
                        </select>
                      </div>

                      <div>
                        <label className="inline-flex items-center gap-2 mt-6">
                          <input
                            type="checkbox"
                            checked={questionForm.isRequired}
                            onChange={(e) => setQuestionForm(prev => ({ ...prev, isRequired: e.target.checked }))}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Required</span>
                        </label>
                      </div>
                    </div>

                    {/* Options for Multiple Choice */}
                    {(questionForm.questionType === 'MultipleChoice' || questionForm.questionType === 'SingleChoice') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                        <div className="space-y-2">
                          {questionForm.options.map((option, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => updateOption(index, e.target.value)}
                                className="flex-1 border border-gray-300 rounded px-3 py-2"
                                placeholder={`Option ${index + 1}`}
                              />
                              <button
                                onClick={() => removeOption(index)}
                                className="px-3 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={addOption}
                            className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                          >
                            + Add Option
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Rating Range */}
                    {questionForm.questionType === 'Rating' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Min Rating</label>
                          <input
                            type="number"
                            value={questionForm.minRating}
                            onChange={(e) => setQuestionForm(prev => ({ ...prev, minRating: parseInt(e.target.value) }))}
                            className="w-full border border-gray-300 rounded px-3 py-2"
                            min="1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Max Rating</label>
                          <input
                            type="number"
                            value={questionForm.maxRating}
                            onChange={(e) => setQuestionForm(prev => ({ ...prev, maxRating: parseInt(e.target.value) }))}
                            className="w-full border border-gray-300 rounded px-3 py-2"
                            min="2"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      {editingQuestion && (
                        <button
                          onClick={() => {
                            setEditingQuestion(null);
                            setQuestionForm({
                              questionText: '',
                              questionType: 'Text',
                              options: [],
                              isRequired: true,
                              minRating: 1,
                              maxRating: 5
                            });
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={handleAddQuestion}
                        className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90"
                      >
                        {editingQuestion ? 'Update Question' : 'Add Question'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isNew && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                <strong>Note:</strong> Please save the survey first before adding questions.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
