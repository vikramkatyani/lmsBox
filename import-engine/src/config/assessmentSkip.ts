/**
 * Evolve assessment / scoring content excluded from LMSBox interactive-lesson import.
 * Assessments belong in a separate LMSBox Quiz lesson, not Draft interactive templates.
 */

/** Component types treated as scored Evolve assessment interactions. */
export const EVOLVE_ASSESSMENT_COMPONENT_TYPES: readonly string[] = [
  'mcq',
  'gmcq',
  'assessmentResults',
  'matching',
  'textInput',
  'slider',
  'ranking',
  'confidenceSlider',
  'openTextInput',
] as const;

export const EVOLVE_ASSESSMENT_COMPONENT_TYPE_SET: ReadonlySet<string> = new Set(
  EVOLVE_ASSESSMENT_COMPONENT_TYPES.map((t) => t.toLowerCase())
);

/**
 * Title / displayTitle patterns that mark a page or article as assessment structure.
 * Matched case-insensitively against the full title string.
 */
export const EVOLVE_ASSESSMENT_TITLE_PATTERNS: readonly RegExp[] = [
  /\bcompetency\s+assessment\b/i,
  /\bscored\s+assessment\b/i,
  /\bknowledge\s+check\b/i,
  /\bfinal\s+(quiz|assessment|test)\b/i,
  /\bsummative\b/i,
  /\bend[\s-]?of[\s-]?(module|course)\s+(quiz|test|assessment)\b/i,
  /^assessments?$/i,
];

const ASSESSMENT_SKIP_MESSAGE =
  'Excluded Evolve assessment — add as an LMSBox Quiz / assessment lesson instead.';

export function isEvolveAssessmentComponentType(type: string | undefined | null): boolean {
  if (!type) return false;
  return EVOLVE_ASSESSMENT_COMPONENT_TYPE_SET.has(type.trim().toLowerCase());
}

export function titleLooksLikeEvolveAssessment(title: string | undefined | null): boolean {
  const value = (title || '').trim();
  if (!value) return false;
  return EVOLVE_ASSESSMENT_TITLE_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Detect assessment pages/articles from Evolve raw flags and titles.
 */
export function isEvolveAssessmentNode(node: {
  title?: string;
  displayTitle?: string;
  type?: string;
  raw?: Record<string, unknown>;
}): boolean {
  const raw = node.raw ?? {};
  if (raw._assessment === true || raw.assessment === true) {
    return true;
  }

  const rawType = String(raw._type ?? node.type ?? '').toLowerCase();
  if (rawType === 'assessment' || rawType.includes('assessment')) {
    return true;
  }

  return (
    titleLooksLikeEvolveAssessment(node.displayTitle) ||
    titleLooksLikeEvolveAssessment(node.title)
  );
}

export function evolveAssessmentSkipMessage(): string {
  return ASSESSMENT_SKIP_MESSAGE;
}
