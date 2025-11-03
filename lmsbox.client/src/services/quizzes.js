// Quiz service: list quizzes for selection in Curriculum builder
// Backend: GET /api/admin/quizzes?search=term -> { items: [{ id, title, ... }] }

import api from '../utils/api';

export async function listQuizzes(search = '') {
  const q = (search || '').trim();
  const url = `/api/admin/quizzes${q ? `?search=${encodeURIComponent(q)}` : ''}`;
  const res = await api.get(url);
  return res.data.items || [];
}

// Get a single quiz by id
export async function getQuiz(quizId) {
  const res = await api.get(`/api/admin/quizzes/${encodeURIComponent(quizId)}`);
  return normalizeQuiz(res.data);
}

// Save or create a quiz
export async function saveQuiz(quizData, isEdit = false) {
  const payload = {
    title: quizData.title,
    description: quizData.description,
    passingScore: quizData.passingScore,
    isTimed: quizData.isTimed,
    timeLimit: quizData.timeLimit,
    shuffleQuestions: quizData.shuffleQuestions,
    shuffleAnswers: quizData.shuffleAnswers,
    showResults: quizData.showResults,
    allowRetake: quizData.allowRetake,
    maxAttempts: quizData.maxAttempts,
    courseId: quizData.courseId,
    questions: quizData.questions.map((q, index) => ({
      question: q.question,
      type: q.type,
      points: q.points,
      explanation: q.explanation,
      options: q.options.map(o => ({
        text: o.text,
        isCorrect: o.isCorrect
      }))
    }))
  };

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
  // Pass-through if already in expected shape
  if (q?.questions && Array.isArray(q.questions) && q.questions[0]?.options && typeof q.questions[0].options[0] === 'object') {
    return q;
  }
  const mapQuestion = (item) => {
    const type = item.type === 'multiple-choice-single' ? 'mc_single' : item.type === 'multiple-choice-multi' ? 'mc_multi' : item.type || 'mc_single';
    const options = Array.isArray(item.options)
      ? item.options.map((o) => (typeof o === 'string' ? { text: o, isCorrect: false } : o))
      : [];
    return {
      type,
      question: item.question || '',
      points: item.points ?? 1,
      options,
      explanation: item.explanation || ''
    };
  };
  return {
    id: q.id,
    title: q.title || '',
    description: q.description || '',
    passingScore: q.passingScore ?? 70,
    timeLimit: q.timeLimit ?? 30,
    shuffleQuestions: !!q.shuffleQuestions,
    shuffleAnswers: !!q.shuffleAnswers,
    showResults: q.showResults ?? true,
    allowRetake: q.allowRetake ?? true,
    maxAttempts: q.maxAttempts ?? 3,
    questions: Array.isArray(q.questions) ? q.questions.map(mapQuestion) : []
  };
}
