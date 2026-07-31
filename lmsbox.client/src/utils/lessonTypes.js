const LESSON_TYPE_LABELS = {
  video: 'Video',
  pdf: 'PDF',
  document: 'PDF',
  scorm: 'SCORM',
  html: 'HTML',
  quiz: 'Assessment',
  external: 'Practical',
  interactive: 'Interactive',
  content: 'Content',
  survey: 'Survey',
};

export function formatLessonTypeLabel(type) {
  if (!type) return 'Unknown';
  const normalized = String(type).toLowerCase();
  return LESSON_TYPE_LABELS[normalized] || type.charAt(0).toUpperCase() + type.slice(1);
}

export function getLessonTypeMenuLabel(type) {
  const label = formatLessonTypeLabel(type);
  if (type === 'quiz') return 'Assessment';
  if (type === 'external') return 'Practical';
  if (type === 'interactive') return 'Interactive Lesson';
  if (['video', 'pdf', 'scorm', 'html'].includes(type)) {
    return `${label} Lesson`;
  }
  return label;
}
