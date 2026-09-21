/** Re-enable Practical in the add-lesson menu when needed. */
export const SHOW_PRACTICAL_IN_ADD_MENU = false;

/** Safety cap after removing the original 5-block interactive lesson limit. Keep in sync with InteractiveLessonConstants.MaxBlocksPerLesson. */
export const INTERACTIVE_LESSON_MAX_BLOCKS = 100;

/** Active limit per questionnaire block. Set to QUESTIONNAIRE_MAX_QUESTIONS_PER_BLOCK to allow multiple. Keep in sync with InteractiveLessonConstants.QuestionnaireQuestionsPerBlock. */
export const QUESTIONNAIRE_QUESTIONS_PER_BLOCK = 1;

/** Ceiling per block when multi-question questionnaires are enabled (keep in sync with backend). */
export const QUESTIONNAIRE_MAX_QUESTIONS_PER_BLOCK = 20;

export const QUESTIONNAIRE_ALLOW_MULTIPLE_QUESTIONS =
  QUESTIONNAIRE_QUESTIONS_PER_BLOCK > 1;

export const QUESTIONNAIRE_MAX_AI_QUESTIONS = Math.min(
  10,
  QUESTIONNAIRE_QUESTIONS_PER_BLOCK
);