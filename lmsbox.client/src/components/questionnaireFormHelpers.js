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
};

export function createEmptyQuestionnaireFormData() {
  const questions = [];
  const slots = Math.max(1, QUESTIONNAIRE_QUESTIONS_PER_BLOCK);
  for (let i = 0; i < slots; i++) {
    questions.push({ ...EMPTY_QUESTION, options: EMPTY_QUESTION.options.map((o) => ({ ...o })) });
  }
  return {
    contentDescription: '',
    showFeedbackPerQuestion: true,
    questions,
  };
}

export function normalizeQuestionnaireFormData(formData) {
  const questions = Array.isArray(formData?.questions) ? [...formData.questions] : [];
  if (questions.length === 0 && QUESTIONNAIRE_QUESTIONS_PER_BLOCK >= 1) {
    questions.push({ ...EMPTY_QUESTION, options: EMPTY_QUESTION.options.map((o) => ({ ...o })) });
  }
  if (questions.length > QUESTIONNAIRE_QUESTIONS_PER_BLOCK) {
    return {
      ...formData,
      questions: questions.slice(0, QUESTIONNAIRE_QUESTIONS_PER_BLOCK),
    };
  }
  return { ...formData, questions };
}
