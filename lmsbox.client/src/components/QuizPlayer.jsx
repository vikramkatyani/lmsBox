import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { API_BASE } from '../utils/apiBase';
import { quizFeatureFlags } from '../config/quizFeatureFlags';

function mapAdminQuizForPreview(adminQuiz) {
  const rawQuestions = adminQuiz.Questions || adminQuiz.questions || [];
  const questions = rawQuestions.map((q, index) => ({
    id: q.Id ?? q.id,
    question: q.Question ?? q.question,
    type: q.Type ?? q.type,
    points: q.Points ?? q.points,
    explanation: q.Explanation ?? q.explanation,
    category: q.Category ?? q.category,
    isCriticalSafety: q.IsCriticalSafety ?? q.isCriticalSafety,
    order: index + 1,
    options: (q.Options || q.options || [])
      .sort((a, b) => (a.Order ?? a.order ?? 0) - (b.Order ?? b.order ?? 0))
      .map((o) => ({
        id: o.Id ?? o.id,
        text: o.Text ?? o.text,
      })),
  }));

  return {
    id: adminQuiz.Id ?? adminQuiz.id,
    title: adminQuiz.Title ?? adminQuiz.title,
    description: adminQuiz.Description ?? adminQuiz.description,
    introductionContent: adminQuiz.IntroductionContent ?? adminQuiz.introductionContent,
    passingScore: adminQuiz.PassingScore ?? adminQuiz.passingScore,
    isTimed: adminQuiz.IsTimed ?? adminQuiz.isTimed,
    timeLimit: adminQuiz.TimeLimit ?? adminQuiz.timeLimit,
    showResults: adminQuiz.ShowResults ?? adminQuiz.showResults,
    allowRetake: adminQuiz.AllowRetake ?? adminQuiz.allowRetake,
    maxAttempts: adminQuiz.MaxAttempts ?? adminQuiz.maxAttempts,
    questions,
    canAttempt: true,
    attemptCount: 0,
    hasPassed: false,
  };
}

export default function QuizPlayer({ quizId, onComplete, previewMode = false }) {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [attemptId, setAttemptId] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | intro | playing | results
  const [startingAttempt, setStartingAttempt] = useState(false);
  const quizStartedAtRef = useRef(null);
  const questionShownAtRef = useRef({});
  const responseTimesRef = useRef({});

  const startQuizAttempt = async (token) => {
    const response = await fetch(`${API_BASE}/api/learner/quizzes/${quizId}/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to start assessment attempt');
    }

    return response.json();
  };

  const beginAttempt = (data) => {
    setAttemptId(data.attemptId);
    setQuiz(prev => ({
      ...prev,
      questions: data.questions || []
    }));
    quizStartedAtRef.current = Date.now();
    questionShownAtRef.current = {};
    responseTimesRef.current = {};
    setCurrentQuestionIndex(0);
    setAnswers({});
    setSubmitted(false);
    setResults(null);
    setPhase('playing');

    if (data.questions?.length > 0) {
      questionShownAtRef.current[data.questions[0].id] = Date.now();
    }
  };

  const handleRetakeAssessment = () => {
    setSubmitted(false);
    setResults(null);
    setTimeRemaining(null);
    setAnswers({});
    setAttemptId(null);
    setCurrentQuestionIndex(0);
    questionShownAtRef.current = {};
    responseTimesRef.current = {};
    quizStartedAtRef.current = null;
    setPhase('intro');
  };

  const getAttemptLabel = (attemptNumber) => {
    if (!quiz?.maxAttempts || attemptNumber < 1) return null;
    return `Attempt number ${attemptNumber} of ${quiz.maxAttempts}`;
  };

  const handleStartQuiz = async () => {
    if (startingAttempt) return;

    try {
      setStartingAttempt(true);

      if (previewMode) {
        beginAttempt({
          attemptId: 'preview',
          questions: quiz?.questions || [],
        });
        if (quiz?.isTimed) {
          setTimeRemaining(quiz.timeLimit * 60);
        }
        return;
      }

      const token = localStorage.getItem('token');
      const startData = await startQuizAttempt(token);
      beginAttempt(startData);

      if (quiz?.isTimed) {
        setTimeRemaining(quiz.timeLimit * 60);
      }
    } catch (error) {
      console.error('Error starting quiz:', error);
      toast.error(error.message || 'Failed to start assessment');
    } finally {
      setStartingAttempt(false);
    }
  };

  useEffect(() => {
    if (!quizId) return;

    const fetchQuiz = async () => {
      try {
        const token = localStorage.getItem('token');
        const endpoint = previewMode
          ? `${API_BASE}/api/admin/quizzes/${quizId}`
          : `${API_BASE}/api/learner/quizzes/${quizId}`;
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = previewMode ? mapAdminQuizForPreview(await response.json()) : await response.json();
          setQuiz(data);

          if (!previewMode && data.inProgressAttempt && data.questions?.length > 0) {
            if (data.isTimed) {
              setTimeRemaining(data.timeLimit * 60);
            }
            beginAttempt({ attemptId: data.attemptId, questions: data.questions });
            return;
          }

          // After any completed attempt, show Feedback until the learner clicks Retake.
          if (!previewMode && data.lastAttemptResult) {
            setSubmitted(true);
            setResults(data.lastAttemptResult);
            setPhase('results');
            setAnswers({});
            setAttemptId(null);
            if (data.lastAttemptResult.passed) {
              onComplete?.(data.lastAttemptResult.score);
            }
            return;
          }

          setPhase('intro');
        } else {
          toast.error('Failed to load assessment');
        }
      } catch (error) {
        console.error('Error loading quiz:', error);
        toast.error('Failed to load assessment');
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId, previewMode]);

  useEffect(() => {
    if (!quiz?.questions?.length) return;
    const question = quiz.questions[currentQuestionIndex];
    if (!question) return;

    if (!questionShownAtRef.current[question.id]) {
      questionShownAtRef.current[question.id] = Date.now();
    }
  }, [currentQuestionIndex, quiz]);

  // Timer countdown (only while actively taking the quiz)
  useEffect(() => {
    if (phase !== 'playing' || !quiz?.isTimed || timeRemaining === null || submitted) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setSubmitted(true);
          setTimeout(() => {
            handleSubmit(true);
          }, 100);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quiz, timeRemaining, submitted, phase]);

  const recordResponseTime = (questionId) => {
    const shownAt = questionShownAtRef.current[questionId];
    if (shownAt) {
      responseTimesRef.current[questionId] = Date.now() - shownAt;
    }
  };

  const handleAnswerChange = (questionId, value, isMultiple = false) => {
    recordResponseTime(questionId);
    setAnswers(prev => {
      if (isMultiple) {
        const current = prev[questionId] || [];
        if (current.includes(value)) {
          return { ...prev, [questionId]: current.filter(v => v !== value) };
        }
        return { ...prev, [questionId]: [...current, value] };
      }
      return { ...prev, [questionId]: value };
    });
  };

  const isQuestionAnswered = (question) => {
    const answer = answers[question.id];
    if (question.type === 'mc_multi') {
      return Array.isArray(answer) && answer.length > 0;
    }
    return answer !== undefined && answer !== null;
  };

  const goToQuestion = (index) => {
    if (!quiz?.questions?.length) return;
    const current = quiz.questions[currentQuestionIndex];
    if (index > currentQuestionIndex && current && !isQuestionAnswered(current)) {
      toast.error('Please select an answer before continuing.');
      return;
    }
    if (current) {
      recordResponseTime(current.id);
    }
    setCurrentQuestionIndex(index);
  };

  const handleSubmit = async (allowIncomplete = false) => {
    if (submitted && results) return;

    const unanswered = quiz.questions.filter(q => !answers[q.id] || (Array.isArray(answers[q.id]) && answers[q.id].length === 0));
    if (!allowIncomplete && unanswered.length > 0) {
      toast.error(`Please answer all questions. ${unanswered.length} question(s) remaining.`);
      return;
    }

    setSubmitted(true);

    if (previewMode) {
      toast.success('Preview only — assessment responses were not submitted');
      setPhase('intro');
      setSubmitted(false);
      setAnswers({});
      setCurrentQuestionIndex(0);
      setAttemptId(null);
      return;
    }

    const completedAt = new Date().toISOString();
    const startedAt = quizStartedAtRef.current
      ? new Date(quizStartedAtRef.current).toISOString()
      : completedAt;
    const durationSeconds = quizStartedAtRef.current
      ? Math.round((Date.now() - quizStartedAtRef.current) / 1000)
      : 0;

    try {
      const token = localStorage.getItem('token');
      const submission = {
        attemptId,
        startedAt,
        completedAt,
        durationSeconds,
        answers: quiz.questions.map(q => {
          const answer = answers[q.id];
          return {
            questionId: q.id,
            selectedOptionId: !Array.isArray(answer) ? answer : null,
            selectedOptionIds: Array.isArray(answer) ? answer : null,
            responseTimeMs: responseTimesRef.current[q.id] ?? null
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
        setPhase('results');
        setAnswers({});
        setCurrentQuestionIndex(0);
        setQuiz(prev => prev ? {
          ...prev,
          attemptCount: result.attemptCount ?? prev.attemptCount,
          canAttempt: result.canAttempt ?? false,
          hasPassed: prev.hasPassed || result.passed
        } : prev);

        if (result.passed) {
          onComplete?.(result.score);
        } else if (quizFeatureFlags.enableCriticalSafetyQuestions && result.failedCriticalSafety) {
          toast.error(`Assessment failed: a Critical Safety question was answered incorrectly. Score: ${result.score}%`);
        } else {
          toast.error(`Assessment failed. Score: ${result.score}%. Required: ${result.passingScore}%`);
        }
      } else if (response.status === 403) {
        const err = await response.json().catch(() => ({}));
        toast.error(err.message || 'You cannot submit another attempt for this assessment.');
        setSubmitted(false);
      } else {
        toast.error('Failed to submit assessment');
        setSubmitted(false);
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast.error('Failed to submit assessment');
      setSubmitted(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds) => {
    if (seconds == null) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading assessment...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Assessment not found</p>
      </div>
    );
  }

  const canRetake = quiz?.canAttempt
    && quiz?.allowRetake
    && !results?.passed;

  const showResultsPage = phase === 'results' || (submitted && results) || (quiz && !quiz.canAttempt);

  if (phase === 'intro' && quiz) {
    const questionCount = quiz.usesRandomSubset && quiz.questionsPerAttempt
      ? quiz.questionsPerAttempt
      : quiz.questionPoolSize;
    const nextAttemptNumber = (quiz.attemptCount ?? 0) + 1;
    const attemptLabel = getAttemptLabel(nextAttemptNumber);

    return (
      <div className="w-full h-full bg-white p-8 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-2xl font-semibold text-gray-900 mb-6">{quiz.title}</h3>

          {quiz.introductionContent ? (
            <div
              className="prose max-w-none mb-8 p-6 bg-gray-50 border rounded-lg text-gray-800 text-[21.6px] [&_*]:text-[21.6px]"
              dangerouslySetInnerHTML={{ __html: quiz.introductionContent }}
            />
          ) : (
            <div className="mb-8 p-6 bg-gray-50 border rounded-lg text-gray-700 text-[21.6px]">
              <p>Review the assessment details below, then click Start when you are ready to begin.</p>
            </div>
          )}

          <div className="mb-8 p-4 bg-info rounded text-sm text-gray-700 space-y-1">
            <p><strong>Passing score:</strong> {quiz.passingScore}%</p>
            {attemptLabel && (
              <p><strong>{attemptLabel}</strong></p>
            )}
            {quiz.isTimed && (
              <p><strong>Time limit:</strong> {quiz.timeLimit} minute{quiz.timeLimit !== 1 ? 's' : ''}</p>
            )}
            {questionCount > 0 && (
              <p>
                <strong>Questions:</strong> {questionCount}
              </p>
            )}
            {quiz.maxAttempts > 0 && (
              <p><strong>Attempts allowed:</strong> {quiz.maxAttempts}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleStartQuiz}
            disabled={startingAttempt}
            className="w-full bg-[#2afeae] text-[#1b365d] px-6 py-3 rounded-lg hover:bg-[#25e89e] disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold text-lg"
          >
            {startingAttempt ? 'Starting...' : 'Start Assessment'}
          </button>
        </div>
      </div>
    );
  }

  if (showResultsPage) {
    const lockedView = quiz && !quiz.canAttempt;

    if (lockedView && !results) {
      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="max-w-md text-center">
            <p className="text-gray-700 font-medium mb-2">
              {quiz.hasPassed
                ? 'You have already passed this assessment.'
                : `You have used all ${quiz.maxAttempts} attempt(s) for this assessment.`}
            </p>
            <p className="text-sm text-gray-500">No attempt results are available to display.</p>
          </div>
        </div>
      );
    }

    if (!results) {
      return null;
    }

    const isFinalAttemptFail = !results.passed && !canRetake;
    const passMark = results.passingScore ?? quiz.passingScore ?? 80;
    const completedAttemptNumber = results.attemptCount ?? quiz.attemptCount ?? 0;
    const feedbackAttemptLabel = getAttemptLabel(completedAttemptNumber);

    let feedbackHeadline = null;
    let feedbackBody = null;
    let feedbackGuidance = null;

    if (results.passed) {
      feedbackHeadline = 'Well done!';
      feedbackBody =
        'You have passed your theory assessment. You can now review your answers and make a note of any questions you weren’t sure about. You will be able to discuss these when you attend your practical.';
      feedbackGuidance = 'Select the next module from the menu to continue.';
    } else if (isFinalAttemptFail) {
      feedbackBody = `Unfortunately you scored below the required pass mark of ${passMark}%. As this was your last attempt, you will now need to contact your organisation about next steps.`;
    } else {
      feedbackHeadline = 'Keep Trying!';
      feedbackBody = `Unfortunately, you scored below the required pass mark of ${passMark}%. Select Retake Assessment to try again.`;
      feedbackGuidance =
        'You can return to any of the modules that you have covered already before trying again.';
    }

    return (
      <div className="w-full h-full bg-white p-8 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <div className={`text-center mb-8 p-6 rounded-lg ${results.passed ? 'bg-success' : 'bg-error'}`}>
            <div className="flex justify-center mb-4">
              {results.passed ? (
                <CheckCircleIcon className="h-16 w-16 text-green-600" aria-hidden="true" />
              ) : (
                <XCircleIcon className="h-16 w-16 text-red-600" aria-hidden="true" />
              )}
            </div>
            {feedbackHeadline && (
              <h2 className="text-2xl font-bold mb-2">{feedbackHeadline}</h2>
            )}
            {feedbackAttemptLabel && (
              <p className="text-sm font-semibold text-gray-700 mb-2">{feedbackAttemptLabel}</p>
            )}
            <p className="text-lg mb-2">Your Score: {results.score}%</p>
            <p className="text-sm text-gray-600">
              Passing Score: {passMark}%
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Time taken: {formatDuration(results.durationSeconds)}
            </p>
            {quizFeatureFlags.enableCriticalSafetyQuestions && results.failedCriticalSafety && (
              <p className="text-sm text-red-700 font-medium mt-2">
                Failed due to incorrect Critical Safety question(s).
              </p>
            )}
            {feedbackBody && (
              <p className="text-base text-gray-800 mt-4 max-w-xl mx-auto">{feedbackBody}</p>
            )}
            {feedbackGuidance && (
              <p className="text-sm text-gray-700 mt-3 max-w-xl mx-auto">{feedbackGuidance}</p>
            )}
          </div>

          {!quiz.canAttempt && results.questionResults?.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Question Results</h3>
              {results.questionResults.map((result, index) => {
                const questionMeta = quiz.questions?.find(q => q.id === result.questionId);
                const questionText = result.question ?? questionMeta?.question;
                const category = result.category ?? questionMeta?.category;
                const isCriticalSafety = result.isCriticalSafety ?? questionMeta?.isCriticalSafety;

                return (
                  <div key={result.questionId} className={`p-4 border rounded ${result.isCorrect ? 'bg-success border-success' : 'bg-error border-error'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">Question {index + 1}</p>
                        {category && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">{category}</span>
                        )}
                        {quizFeatureFlags.enableCriticalSafetyQuestions && isCriticalSafety && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">Critical Safety</span>
                        )}
                      </div>
                      <span className={`text-sm font-medium ${result.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                        {result.isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>

                    {questionText && (
                      <p className="text-gray-800 font-medium mb-3 text-[21.6px]">{questionText}</p>
                    )}

                    {result.selectedAnswerTexts?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Your answer</p>
                        {result.selectedAnswerTexts.map((text, i) => (
                          <p key={i} className={`text-sm px-3 py-1.5 rounded ${result.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {text}
                          </p>
                        ))}
                      </div>
                    )}

                    {!result.isCorrect && result.correctAnswerTexts?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Correct answer</p>
                        {result.correctAnswerTexts.map((text, i) => (
                          <p key={i} className="text-sm px-3 py-1.5 rounded bg-green-100 text-green-800">
                            {text}
                          </p>
                        ))}
                      </div>
                    )}

                    {result.responseTimeMs != null && (
                      <p className="text-xs text-gray-500 mt-2">
                        Response time: {formatDuration(Math.round(result.responseTimeMs / 1000))}
                      </p>
                    )}

                    {result.explanation && (
                      <p className="text-gray-600 italic mt-2 text-[21.6px]">
                        <strong>Explanation:</strong> {result.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {canRetake && (
            <button
              onClick={handleRetakeAssessment}
              className="mt-6 w-full bg-[#2afeae] text-[#1b365d] px-6 py-3 rounded hover:bg-[#25e89e]"
            >
              Retake Assessment
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const isCurrentQuestionAnswered = currentQuestion ? isQuestionAnswered(currentQuestion) : false;
  const playingAttemptNumber = (quiz.attemptCount ?? 0) + 1;
  const playingAttemptLabel = getAttemptLabel(playingAttemptNumber);

  return (
    <div className="w-full h-full bg-white p-8 overflow-auto">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-semibold">{quiz.title}</h3>
            {quiz.description && <p className="text-gray-600 mt-1 text-[21.6px]">{quiz.description}</p>}
          </div>
          {quiz.isTimed && timeRemaining !== null && (
            <div className={`text-lg font-semibold ${timeRemaining < 60 ? 'text-red-600' : 'text-gray-700'}`}>
              ⏱️ {formatTime(timeRemaining)}
            </div>
          )}
        </div>

        <div className="mb-6 p-4 bg-info rounded">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-gray-700">
              <strong>Passing Score:</strong> {quiz.passingScore}%
              {playingAttemptLabel && (
                <span className="ml-3">{playingAttemptLabel}</span>
              )}
            </p>
            <p className="text-sm font-semibold text-blue-600">
              Question {currentQuestionIndex + 1} of {quiz.questions.length}
            </p>
          </div>
        </div>

        {currentQuestion && (
          <div key={`${attemptId}-${currentQuestion.id}`} className="p-6 border rounded-lg mb-6">
            <p className="font-medium text-gray-900 mb-4 text-[21.6px]">{currentQuestion.question}</p>

            <div className="space-y-3">
              {currentQuestion.options.map(option => {
                const isSelected = currentQuestion.type === 'mc_multi'
                  ? (answers[currentQuestion.id] || []).includes(option.id)
                  : answers[currentQuestion.id] === option.id;

                return (
                  <label
                    key={`${attemptId}-${option.id}`}
                    className={`flex items-start space-x-3 p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${
                      isSelected ? 'border-[#009fe3]' : 'border-gray-200'
                    }`}
                  >
                  <input
                    type={currentQuestion.type === 'mc_multi' ? 'checkbox' : 'radio'}
                    name={`question-${attemptId}-${currentQuestion.id}`}
                    value={option.id}
                    checked={
                      currentQuestion.type === 'mc_multi'
                        ? (answers[currentQuestion.id] || []).includes(option.id)
                        : answers[currentQuestion.id] === option.id
                    }
                    onChange={() => {
                      if (currentQuestion.type === 'mc_multi') {
                        handleAnswerChange(currentQuestion.id, option.id, true);
                      } else {
                        handleAnswerChange(currentQuestion.id, option.id, false);
                      }
                    }}
                    className="mt-1 accent-[#009fe3] focus:ring-2 focus:ring-[#009fe3]"
                    disabled={submitted}
                  />
                  <span className="flex-1 text-gray-700 text-[21.6px]">{option.text}</span>
                </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => goToQuestion(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed font-medium"
          >
            ← Previous
          </button>

          {currentQuestionIndex < quiz.questions.length - 1 ? (
            <button
              onClick={() => goToQuestion(Math.min(quiz.questions.length - 1, currentQuestionIndex + 1))}
              disabled={!isCurrentQuestionAnswered}
              className="px-6 py-3 bg-[#1b365d] text-white rounded hover:bg-[#234a7a] disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed font-medium"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={() => handleSubmit()}
              disabled={submitted || !isCurrentQuestionAnswered}
              className="px-6 py-3 bg-[#2afeae] text-[#1b365d] rounded hover:bg-[#25e89e] disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {submitted ? 'Submitting...' : 'Submit Assessment'}
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-6">
          {quiz.questions.map((question, index) => {
            const isAnswered = isQuestionAnswered(question);
            const canNavigateToQuestion = index <= currentQuestionIndex
              || (currentQuestion && isQuestionAnswered(currentQuestion));

            return (
              <button
                key={question.id}
                onClick={() => canNavigateToQuestion && goToQuestion(index)}
                disabled={!canNavigateToQuestion}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentQuestionIndex
                    ? 'bg-[#2afeae] w-8'
                    : isAnswered
                      ? 'bg-[#2afeae]'
                      : 'bg-gray-300'
                } ${!canNavigateToQuestion ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                title={`Question ${index + 1}${isAnswered ? ' (Answered)' : ''}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
