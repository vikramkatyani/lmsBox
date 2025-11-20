import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { API_BASE } from '../utils/apiBase';

export default function QuizPlayer({ quizId, onComplete }) {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  useEffect(() => {
    if (!quizId) return;

    const fetchQuiz = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/api/learner/quizzes/${quizId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setQuiz(data);
          
          if (data.isTimed) {
            setTimeRemaining(data.timeLimit * 60); // Convert minutes to seconds
          }
        } else {
          toast.error('Failed to load quiz');
        }
      } catch (error) {
        console.error('Error loading quiz:', error);
        toast.error('Failed to load quiz');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  // Timer countdown
  useEffect(() => {
    if (!quiz?.isTimed || timeRemaining === null || submitted) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Auto-submit on time expiry, allow incomplete answers
          setSubmitted(true);
          setTimeout(() => {
            handleSubmit(true); // pass a flag to allow incomplete
          }, 100); // slight delay to ensure UI updates
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quiz, timeRemaining, submitted]);

  const handleAnswerChange = (questionId, value, isMultiple = false) => {
    setAnswers(prev => {
      if (isMultiple) {
        const current = prev[questionId] || [];
        if (current.includes(value)) {
          return { ...prev, [questionId]: current.filter(v => v !== value) };
        } else {
          return { ...prev, [questionId]: [...current, value] };
        }
      } else {
        return { ...prev, [questionId]: value };
      }
    });
  };

  const handleSubmit = async (allowIncomplete = false) => {
    if (submitted) return;

    // Validate all questions answered unless auto-submit
    const unanswered = quiz.questions.filter(q => !answers[q.id] || (Array.isArray(answers[q.id]) && answers[q.id].length === 0));
    if (!allowIncomplete && unanswered.length > 0) {
      toast.error(`Please answer all questions. ${unanswered.length} question(s) remaining.`);
      return;
    }

    setSubmitted(true);

    try {
      const token = localStorage.getItem('token');
      const submission = {
        answers: quiz.questions.map(q => {
          const answer = answers[q.id];
          return {
            questionId: q.id,
            selectedOptionId: !Array.isArray(answer) ? answer : null,
            selectedOptionIds: Array.isArray(answer) ? answer : null
          };
        })
      };

      const response = await fetch(`${API_BASE}/api/learner/quizzes/${quizId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submission)
      });

      if (response.ok) {
        const result = await response.json();
        setResults(result);

        if (result.passed) {
          toast.success(`Quiz passed! Score: ${result.score}%`);
          // Call onComplete to mark lesson as complete
          onComplete?.(result.score);
        } else {
          toast.error(`Quiz failed. Score: ${result.score}%. Required: ${result.passingScore}%`);
        }
      } else {
        toast.error('Failed to submit quiz');
        setSubmitted(false);
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast.error('Failed to submit quiz');
      setSubmitted(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading quiz...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Quiz not found</p>
      </div>
    );
  }

  if (submitted && results) {
    return (
      <div className="w-full h-full bg-white p-8 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <div className={`text-center mb-8 p-6 rounded-lg ${results.passed ? 'bg-green-50' : 'bg-red-50'}`}>
            <div className={`text-6xl mb-4 ${results.passed ? 'text-green-600' : 'text-red-600'}`}>
              {results.passed ? '✓' : '✗'}
            </div>
            <h2 className="text-2xl font-bold mb-2">{results.passed ? 'Congratulations!' : 'Keep Trying!'}</h2>
            <p className="text-lg mb-2">Your Score: {results.score}%</p>
            <p className="text-sm text-gray-600">
              {results.earnedPoints} / {results.totalPoints} points
            </p>
            <p className="text-sm text-gray-600">
              Passing Score: {results.passingScore}%
            </p>
          </div>

          {results.questionResults && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Question Results</h3>
              {quiz.questions.map((question, index) => {
                const result = results.questionResults.find(r => r.questionId === question.id);
                return (
                  <div key={question.id} className={`p-4 border rounded ${result?.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium">Question {index + 1}</p>
                      <span className={`text-sm ${result?.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                        {result?.isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-3">{question.question}</p>
                    {result?.explanation && (
                      <p className="text-sm text-gray-600 italic mt-2">
                        <strong>Explanation:</strong> {result.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {quiz.allowRetake && !results.passed && (
            <button
              onClick={() => {
                setSubmitted(false);
                setResults(null);
                setAnswers({});
                setCurrentQuestionIndex(0);
                if (quiz.isTimed) {
                  setTimeRemaining(quiz.timeLimit * 60);
                }
              }}
              className="mt-6 w-full bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
            >
              Retake Quiz
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white p-8 overflow-auto">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-semibold">{quiz.title}</h3>
            {quiz.description && <p className="text-gray-600 mt-1">{quiz.description}</p>}
          </div>
          {quiz.isTimed && timeRemaining !== null && (
            <div className={`text-lg font-semibold ${timeRemaining < 60 ? 'text-red-600' : 'text-gray-700'}`}>
              ⏱️ {formatTime(timeRemaining)}
            </div>
          )}
        </div>

        <div className="mb-6 p-4 bg-blue-50 rounded">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              <strong>Passing Score:</strong> {quiz.passingScore}% | 
              <strong className="ml-2">Total Points:</strong> {quiz.questions.reduce((sum, q) => sum + q.points, 0)}
            </p>
            <p className="text-sm font-semibold text-blue-600">
              Question {currentQuestionIndex + 1} of {quiz.questions.length}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Single Question Display */}
        {quiz.questions.map((question, index) => (
          index === currentQuestionIndex && (
            <div key={question.id} className="p-6 border rounded-lg mb-6">
              <p className="text-sm text-gray-500 mb-2">Question {index + 1} of {quiz.questions.length}</p>
              <p className="text-lg font-medium text-gray-900 mb-4">{question.question}</p>
              <p className="text-sm text-gray-500 mb-4">Points: {question.points}</p>

              <div className="space-y-3">
                {question.options.map(option => (
                  <label key={option.id} className="flex items-start space-x-3 p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type={question.type === 'mc_multi' ? 'checkbox' : 'radio'}
                      name={`question-${question.id}`}
                      value={option.id}
                      checked={
                        question.type === 'mc_multi'
                          ? (answers[question.id] || []).includes(option.id)
                          : answers[question.id] === option.id
                      }
                      onChange={(_e) => {
                        if (question.type === 'mc_multi') {
                          handleAnswerChange(question.id, option.id, true);
                        } else {
                          handleAnswerChange(question.id, option.id, false);
                        }
                      }}
                      className="mt-1 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      disabled={submitted}
                    />
                    <span className="flex-1 text-gray-700">{option.text}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        ))}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed font-medium"
          >
            ← Previous
          </button>

          {currentQuestionIndex < quiz.questions.length - 1 ? (
            <button
              onClick={() => setCurrentQuestionIndex(prev => Math.min(quiz.questions.length - 1, prev + 1))}
              className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitted}
              className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {submitted ? 'Submitting...' : 'Submit Quiz'}
            </button>
          )}
        </div>

        {/* Question Navigation Dots */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {quiz.questions.map((question, index) => {
            const isAnswered = question.type === 'mc_multi' 
              ? (answers[question.id] || []).length > 0
              : answers[question.id] !== undefined;
            
            return (
              <button
                key={question.id}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentQuestionIndex 
                    ? 'bg-blue-600 w-8' 
                    : isAnswered 
                      ? 'bg-green-500' 
                      : 'bg-gray-300'
                }`}
                title={`Question ${index + 1}${isAnswered ? ' (Answered)' : ''}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
