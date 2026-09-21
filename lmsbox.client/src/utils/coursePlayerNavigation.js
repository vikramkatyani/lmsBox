/**
 * Course player Previous/Next rules.
 *
 * Sequential courses must not enable Next until the current item is complete.
 * Any-order courses may advance without completing the current lesson, as long
 * as the destination is not otherwise locked (pre-survey, certificate, etc.).
 */

export function isCurrentCurriculumItemComplete({
  showCertificate = false,
  activeSurvey = null,
  activeLesson = null,
} = {}) {
  if (showCertificate) {
    return true;
  }

  if (activeSurvey) {
    return !!activeSurvey.isCompleted;
  }

  return !!activeLesson?.isCompleted;
}

export function canNavigateToNext({
  nextItem,
  isNextLocked = false,
  requireSequentialLessons = false,
  isCurrentComplete = false,
  previewMode = false,
} = {}) {
  if (!nextItem) {
    return false;
  }

  if (previewMode) {
    return true;
  }

  if (isNextLocked) {
    return false;
  }

  if (requireSequentialLessons && !isCurrentComplete) {
    return false;
  }

  return true;
}

export function getNextButtonUnavailableReason({
  nextItem,
  canGoNext = false,
  requireSequentialLessons = false,
  isCurrentComplete = false,
} = {}) {
  if (!nextItem || canGoNext) {
    return null;
  }

  if (nextItem.type === 'certificate') {
    return 'Complete all course requirements to unlock your certificate';
  }

  if (nextItem.type === 'survey') {
    return 'Complete all lessons to unlock this survey';
  }

  if (requireSequentialLessons && !isCurrentComplete) {
    return 'Complete this lesson to continue';
  }

  return 'Complete the previous lesson to unlock the next one';
}
