import React, { useState } from 'react';
import toast from 'react-hot-toast';
import RatingSlider from './RatingSlider';

/**
 * SurveyPlayer Component
 * Displays survey questions and collects responses
 * Supports question types: Text, MultipleChoice, SingleChoice, Rating, YesNo
 */
export default function SurveyPlayer({ survey, onSubmit, onCancel, surveyType = 'pre', previewMode = false }) {
  const [responses, setResponses] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Initialize responses with existing answers if survey is completed
  React.useEffect(() => {
    if (survey?.alreadyCompleted && survey?.questions) {
      const existingResponses = {};
      survey.questions.forEach(q => {
        if (q.response) {
          existingResponses[q.id] = {
            questionId: q.id,
            answerText: q.response.answerText,
            selectedOptions: q.response.selectedOptions,
            ratingValue: q.response.ratingValue
          };
        }
      });
      setResponses(existingResponses);
    }
  }, [survey]);

  const sortedQuestions = [...(survey?.questions || [])].sort(
    (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
  );

  if (!survey || sortedQuestions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No questions available</p>
      </div>
    );
  }

  const isReadOnly = survey.alreadyCompleted;

  const handleTextChange = (questionId, value) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: { questionId, answerText: value }
    }));
  };

  const handleMultipleChoiceChange = (questionId, option, isMulti) => {
    setResponses(prev => {
      const current = prev[questionId] || { questionId, selectedOptions: [] };
      
      if (isMulti) {
        // Multiple selection (checkbox)
        const selected = current.selectedOptions || [];
        const newSelected = selected.includes(option)
          ? selected.filter(o => o !== option)
          : [...selected, option];
        
        return {
          ...prev,
          [questionId]: { questionId, selectedOptions: newSelected }
        };
      } else {
        // Single selection (radio)
        return {
          ...prev,
          [questionId]: { questionId, selectedOptions: [option] }
        };
      }
    });
  };

  const handleRatingChange = (questionId, value) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: { questionId, ratingValue: parseInt(value) }
    }));
  };

  const handleYesNoChange = (questionId, value) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: { questionId, answerText: value }
    }));
  };

  const validateResponses = () => {
    const requiredQuestions = sortedQuestions.filter(q => q.isRequired);
    
    for (const question of requiredQuestions) {
      const response = responses[question.id];
      
      if (!response) {
        toast.error(`Please answer: ${question.questionText}`);
        return false;
      }

      if (question.questionType === 'Text' && !response.answerText?.trim()) {
        toast.error(`Please answer: ${question.questionText}`);
        return false;
      }

      if ((question.questionType === 'MultipleChoice' || question.questionType === 'SingleChoice') && 
          (!response.selectedOptions || response.selectedOptions.length === 0)) {
        toast.error(`Please select an option for: ${question.questionText}`);
        return false;
      }

      if (question.questionType === 'Rating' && !response.ratingValue) {
        toast.error(`Please provide a rating for: ${question.questionText}`);
        return false;
      }

      if (question.questionType === 'YesNo' && !response.answerText?.trim()) {
        toast.error(`Please answer: ${question.questionText}`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateResponses()) return;

    if (previewMode) {
      toast.success('Preview only — responses were not submitted');
      return;
    }

    setSubmitting(true);
    try {
      const answers = Object.values(responses);
      await onSubmit(answers);
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast.error('Failed to submit survey');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question, index) => {
    const response = responses[question.id];

    switch (question.questionType) {
      case 'Text':
        return (
          <div key={question.id} className="mb-6 p-4 bg-white rounded-lg border">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {index + 1}. {question.questionText}
              {question.isRequired && !isReadOnly && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={response?.answerText || ''}
              onChange={(e) => handleTextChange(question.id, e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Enter your response..."
              required={question.isRequired}
              disabled={isReadOnly}
            />
          </div>
        );

      case 'SingleChoice':
      case 'MultipleChoice': {
        const options = question.options || [];
        const isMulti = question.questionType === 'MultipleChoice';
        const selectedOptions = response?.selectedOptions || [];

        return (
          <div key={question.id} className="mb-6 p-4 bg-white rounded-lg border">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {index + 1}. {question.questionText}
              {question.isRequired && !isReadOnly && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {options.map((option, optIndex) => (
                <label key={optIndex} className={`flex items-center gap-2 p-2 rounded ${!isReadOnly ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed'}`}>
                  <input
                    type={isMulti ? 'checkbox' : 'radio'}
                    name={`question-${question.id}`}
                    checked={selectedOptions.includes(option)}
                    onChange={() => handleMultipleChoiceChange(question.id, option, isMulti)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                    disabled={isReadOnly}
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>
        );
      }

      case 'Rating': {
        const minRating = question.minRating || 1;
        const maxRating = question.maxRating || 5;
        const ratingValue = response?.ratingValue;

        return (
          <div key={question.id} className="mb-6 p-4 bg-white rounded-lg border">
            <label className="block text-sm font-medium text-gray-900 mb-4">
              {index + 1}. {question.questionText}
              {question.isRequired && !isReadOnly && <span className="text-red-500 ml-1">*</span>}
            </label>
            <RatingSlider
              min={minRating}
              max={maxRating}
              value={ratingValue}
              onChange={(val) => handleRatingChange(question.id, val)}
              disabled={isReadOnly}
            />
          </div>
        );
      }

      case 'YesNo': {
        const selectedAnswer = response?.answerText || '';

        return (
          <div key={question.id} className="mb-6 p-4 bg-white rounded-lg border">
            <label className="block text-sm font-medium text-gray-900 mb-3">
              {index + 1}. {question.questionText}
              {question.isRequired && !isReadOnly && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="flex gap-4">
              {['Yes', 'No'].map((option) => (
                <label
                  key={option}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                    selectedAnswer === option
                      ? 'border-[#2afeae] bg-[#e8fdf6]'
                      : 'border-gray-300'
                  } ${!isReadOnly ? 'cursor-pointer hover:bg-gray-50' : 'cursor-not-allowed'}`}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    checked={selectedAnswer === option}
                    onChange={() => handleYesNoChange(question.id, option)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                    disabled={isReadOnly}
                  />
                  <span className="text-sm text-gray-700">{option}</span>
                </label>
              ))}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{survey.title}</h2>
        {survey.description && (
          <p className="text-gray-600 mt-2">{survey.description}</p>
        )}
        {previewMode && (
          <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Preview mode.</span> This is how learners will see the survey. Responses are not saved.
            </p>
          </div>
        )}
        {survey.isMandatory && !isReadOnly && !previewMode && (
          <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <span className="font-medium">⚠️ This survey is mandatory.</span> You must complete it to {surveyType === 'pre' ? 'access the course content' : 'receive your certificate'}.
            </p>
          </div>
        )}
        {isReadOnly && (
          <div className="mt-3 px-3 py-2 bg-success border border-success rounded-lg">
            <p className="text-sm text-green-800">
              <span className="font-medium">✓ Survey completed</span> on {new Date(survey.completedAt).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {sortedQuestions.map((question, index) => renderQuestion(question, index))}
      </div>

      <div className="mt-8 flex justify-end gap-3">
        {!isReadOnly && (
          <>
            {onCancel && !survey.isMandatory && (
              <button
                onClick={onCancel}
                disabled={submitting}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Skip for Now
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-[#2afeae] text-[#1b365d] rounded-lg hover:bg-[#25e89e] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Survey'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
