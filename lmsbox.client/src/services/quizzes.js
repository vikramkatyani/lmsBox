// Quiz service: list quizzes for selection in Curriculum builder
// Backend: GET /api/admin/quizzes?search=term -> { items: [{ id, title, ... }] }

import api from '../utils/api';
import { quizFeatureFlags } from '../config/quizFeatureFlags';

export async function listQuizzes(search = '') {
  const q = (search || '').trim();
  const url = `/api/admin/quizzes${q ? `?search=${encodeURIComponent(q)}` : ''}`;
  const res = await api.get(url);
  return res.data.items || [];
}

// Question bank (SuperAdmin)
export async function listQuestionBankQuizzes(search = '') {
  const q = (search || '').trim();
  const url = `/api/superadmin/question-bank/quizzes${q ? `?search=${encodeURIComponent(q)}` : ''}`;
  const res = await api.get(url);
  return res.data.items || [];
}

export async function getQuestionBankQuiz(quizId) {
  const res = await api.get(`/api/superadmin/question-bank/quizzes/${encodeURIComponent(quizId)}`);
  return normalizeQuiz(res.data);
}

export async function saveQuestionBankQuiz(quizData, isEdit = false) {
  const payload = buildQuizPayload({
    ...quizData,
    courseId: null,
  });

  if (isEdit) {
    const res = await api.put(`/api/superadmin/question-bank/quizzes/${encodeURIComponent(quizData.id)}`, payload);
    return res.data;
  } else {
    const res = await api.post('/api/superadmin/question-bank/quizzes', payload);
    return res.data;
  }
}

export async function deleteQuestionBankQuiz(quizId) {
  const res = await api.delete(`/api/superadmin/question-bank/quizzes/${encodeURIComponent(quizId)}`);
  return res.data;
}

// Import a bank quiz into a course (creates a copy and returns new quiz id)
export async function importQuestionBankQuizToCourse(courseId, bankQuizId) {
  const res = await api.post(
    `/api/admin/courses/${encodeURIComponent(courseId)}/quizzes/import-from-bank/${encodeURIComponent(bankQuizId)}`
  );
  return res.data; // { id }
}

// Get a single quiz by id
export async function getQuiz(quizId) {
  const res = await api.get(`/api/admin/quizzes/${encodeURIComponent(quizId)}`);
  return normalizeQuiz(res.data);
}

export async function createQuizFromBank(payload) {
  const res = await api.post('/api/admin/quizzes/from-bank', payload);
  return res.data;
}

export async function updateQuizFromBank(quizId, payload) {
  const res = await api.put(`/api/admin/quizzes/${encodeURIComponent(quizId)}/from-bank`, payload);
  return res.data;
}

function buildQuizPayload(quizData) {
  return {
    title: quizData.title?.trim(),
    description: quizData.description?.trim() || null,
    introductionContent: quizData.introductionContent?.trim() || null,
    passingScore: Number(quizData.passingScore) || 70,
    isTimed: !!quizData.isTimed,
    timeLimit: Number(quizData.timeLimit) || 30,
    shuffleQuestions: !!quizData.shuffleQuestions,
    shuffleAnswers: !!quizData.shuffleAnswers,
    showResults: quizData.showResults !== false,
    allowRetake: quizData.allowRetake !== false,
    maxAttempts: Number(quizData.maxAttempts) || 3,
    questionsPerAttempt: quizData.questionsPerAttempt ?? null,
    courseId: quizData.courseId == null ? null : quizData.courseId?.trim(),
    questions: (quizData.questions || []).map((q) => ({
      question: q.question?.trim(),
      type: q.type || 'mc_single',
      points: Number(q.points) || 1,
      explanation: q.explanation?.trim() || null,
      category: q.category?.trim() || null,
      isCriticalSafety: quizFeatureFlags.enableCriticalSafetyQuestions && !!q.isCriticalSafety,
      // Backend requires non-empty option text; UI keeps blank placeholder rows.
      options: (q.options || [])
        .filter((o) => (o.text || '').trim())
        .map((o) => ({
          text: o.text.trim(),
          isCorrect: !!o.isCorrect,
        })),
    })),
  };
}

// Save or create a quiz
export async function saveQuiz(quizData, isEdit = false) {
  const payload = buildQuizPayload(quizData);

  if (isEdit) {
    const res = await api.put(`/api/admin/quizzes/${encodeURIComponent(quizData.id)}`, payload);
    return res.data;
  } else {
    const res = await api.post('/api/admin/quizzes', payload);
    return res.data;
  }
}

// Delete a quiz
export async function deleteQuiz(quizId) {
  const res = await api.delete(`/api/admin/quizzes/${encodeURIComponent(quizId)}`);
  return res.data;
}

// Normalize backend quiz shape to UI shape used by QuizCreator
function normalizeQuiz(q) {
  const rawQuestions = q.questions || q.Questions || [];
  const mapQuestion = (item) => {
    const type = item.type === 'multiple-choice-single' ? 'mc_single' : item.type === 'multiple-choice-multi' ? 'mc_multi' : item.type || 'mc_single';
    const rawOptions = item.options || item.Options || [];
    const options = Array.isArray(rawOptions)
      ? rawOptions.map((o) => (typeof o === 'string' ? { text: o, isCorrect: false } : {
          text: o.text || '',
          isCorrect: !!o.isCorrect
        }))
      : [];
    return {
      questionBankQuestionId: item.questionBankQuestionId ?? item.QuestionBankQuestionId ?? null,
      type,
      question: item.question || item.Question || '',
      points: item.points ?? item.Points ?? 1,
      options,
      explanation: item.explanation || item.Explanation || '',
      category: item.category || item.Category || '',
      isCriticalSafety: quizFeatureFlags.enableCriticalSafetyQuestions
        && !!(item.isCriticalSafety ?? item.IsCriticalSafety)
    };
  };
  return {
    id: q.id,
    title: q.title || '',
    description: q.description || '',
    introductionContent: q.introductionContent || '',
    passingScore: q.passingScore ?? 70,
    isTimed: !!q.isTimed,
    timeLimit: q.timeLimit ?? 30,
    courseId: q.courseId || q.CourseId || '',
    shuffleQuestions: !!q.shuffleQuestions,
    shuffleAnswers: !!q.shuffleAnswers,
    showResults: q.showResults ?? true,
    allowRetake: q.allowRetake ?? true,
    maxAttempts: q.maxAttempts ?? 3,
    questionsPerAttempt: q.questionsPerAttempt ?? null,
    questionsPerAttemptByCategory: q.questionsPerAttemptByCategory || q.QuestionsPerAttemptByCategory || null,
    questions: Array.isArray(rawQuestions) ? rawQuestions.map(mapQuestion) : []
  };
}
