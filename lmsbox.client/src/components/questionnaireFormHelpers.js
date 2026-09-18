import {
  QUESTIONNAIRE_QUESTIONS_PER_BLOCK,
} from '../config/lessonFeatureFlags';

export const EMPTY_QUESTION = {
  text: '',
  type: 'single',
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
  ],
  correctFeedback: '',
  incorrectFeedback: '',
  imageUrl: '',
};

function cloneQuestion(question = EMPTY_QUESTION) {
  return {
    ...EMPTY_QUESTION,
    ...question,
    options: Array.isArray(question.options)
      ? question.options.map((o) => ({ text: o.text || '', isCorrect: !!o.isCorrect }))
      : EMPTY_QUESTION.options.map((o) => ({ ...o })),
    correctFeedback: question.correctFeedback || '',
    incorrectFeedback: question.incorrectFeedback || '',
    imageUrl: question.imageUrl || '',
  };
}

export function createEmptyQuestionnaireFormData() {
  return {
    contentDescription: '',
    showFeedbackPerQuestion: true,
    questions: [cloneQuestion()],
  };
}

export function normalizeQuestionnaireFormData(formData) {
  const questions = Array.isArray(formData?.questions)
    ? formData.questions.map((q) => cloneQuestion(q))
    : [];
  if (questions.length === 0 && QUESTIONNAIRE_QUESTIONS_PER_BLOCK >= 1) {
    questions.push(cloneQuestion());
  }
  if (questions.length > QUESTIONNAIRE_QUESTIONS_PER_BLOCK) {
    return {
      ...formData,
      questions: questions.slice(0, QUESTIONNAIRE_QUESTIONS_PER_BLOCK),
    };
  }
  return { ...formData, questions };
}
