// Quiz service: list quizzes for selection in Curriculum builder
// Expected backend: GET /api/admin/quizzes?search=term -> { items: [{ id, title }] }
// Fallback to mock data if backend is not available.

export async function listQuizzes(search = '') {
  const q = (search || '').trim();
  const url = `/api/admin/quizzes${q ? `?search=${encodeURIComponent(q)}` : ''}`;
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    return items.map((it) => ({ id: it.id, title: it.title || it.name || it.id }));
  } catch (_err) {
    // Fallback mock list
    const mock = [
      { id: 'qz-101', title: 'Security Basics' },
      { id: 'qz-102', title: 'GDPR Quiz' },
      { id: 'qz-103', title: 'Workplace Communication' },
      { id: 'qz-104', title: 'Cyber Awareness' },
    ];
    if (!q) return mock;
    const lower = q.toLowerCase();
    return mock.filter((m) => m.title.toLowerCase().includes(lower) || m.id.toLowerCase().includes(lower));
  }
}

// Get a single quiz by id
export async function getQuiz(quizId) {
  try {
    const res = await fetch(`/api/admin/quizzes/${encodeURIComponent(quizId)}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return normalizeQuiz(data);
  } catch (_err) {
    // mock fallback
    return {
      id: quizId,
      title: 'Sample Quiz',
      description: 'Mock quiz for editing',
      passingScore: 70,
      timeLimit: 30,
      shuffleQuestions: false,
      shuffleAnswers: false,
      showResults: true,
      allowRetake: true,
      maxAttempts: 3,
      questions: [
        {
          type: 'mc_single',
          question: 'Which one is a fruit?',
          points: 1,
          options: [
            { text: 'Carrot', isCorrect: false },
            { text: 'Apple', isCorrect: true },
          ],
          explanation: 'Apple is a fruit.'
        }
      ]
    };
  }
}

// Save or update a quiz (stub)
export async function saveQuiz(quiz, _isEdit = false) {
  // If your backend exists, replace with fetch POST/PUT calls.
  // We simulate a short delay.
  await new Promise((r) => setTimeout(r, 500));
  // In real implementation, return created/updated id
  return { id: quiz.id || 'qz-' + Math.random().toString(36).slice(2, 8) };
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
