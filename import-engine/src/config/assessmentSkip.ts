/**
 * Evolve scored / pass-fail assessments excluded from LMSBox interactive-lesson import.
 * In-page knowledge checks and mini quizzes are converted to questionnaire blocks.
 * Final assessments belong in a separate LMSBox Quiz lesson.
 */

/** Component types that only exist to show scored assessment results (pass/fail, marks). */
export const EVOLVE_ASSESSMENT_COMPONENT_TYPES: readonly string[] = [
  'assessmentResults',
] as const;

export const EVOLVE_ASSESSMENT_COMPONENT_TYPE_SET: ReadonlySet<string> = new Set(
  EVOLVE_ASSESSMENT_COMPONENT_TYPES.map((t) => t.toLowerCase())
);

/**
 * Title patterns for a dedicated Evolve scored assessment (pass/fail / marks).
 * Matched case-insensitively against the full title string.
 */
export const EVOLVE_ASSESSMENT_TITLE_PATTERNS: readonly RegExp[] = [
  /\bcompetency\s+assessment\b/i,
  /\bscored\s+assessment\b/i,
  /\bfinal\s+(quiz|assessment|test)\b/i,
  /\bsummative\b/i,
  /\bend[\s-]?of[\s-]?(module|course)\s+(quiz|test|assessment)\b/i,
  /^assessments?$/i,
];

/**
 * Informal in-page checks that must be imported even if Evolve marks them as questions.
 */
export const EVOLVE_KNOWLEDGE_CHECK_TITLE_PATTERNS: readonly RegExp[] = [
  /\bknowledge\s+check\b/i,
  /\bmini\s+quiz\b/i,
  /\bpractice\s+(quiz|question)s?\b/i,
];

const ASSESSMENT_SKIP_MESSAGE =
  'Excluded Evolve scored assessment (marks / pass-fail) — add as an LMSBox Quiz lesson instead.';

export function isEvolveAssessmentComponentType(type: string | undefined | null): boolean {
  if (!type) return false;
  return EVOLVE_ASSESSMENT_COMPONENT_TYPE_SET.has(type.trim().toLowerCase());
}

export function titleLooksLikeEvolveAssessment(title: string | undefined | null): boolean {
  const value = (title || '').trim();
  if (!value) return false;
  return EVOLVE_ASSESSMENT_TITLE_PATTERNS.some((pattern) => pattern.test(value));
}

export function titleLooksLikeEvolveKnowledgeCheck(title: string | undefined | null): boolean {
  const value = (title || '').trim();
  if (!value) return false;
  return EVOLVE_KNOWLEDGE_CHECK_TITLE_PATTERNS.some((pattern) => pattern.test(value));
}

export function isEvolveKnowledgeCheckNode(node: {
  title?: string;
  displayTitle?: string;
}): boolean {
  return (
    titleLooksLikeEvolveKnowledgeCheck(node.displayTitle) ||
    titleLooksLikeEvolveKnowledgeCheck(node.title)
  );
}

function hasEvolvePassFailScoring(raw: Record<string, unknown>): boolean {
  const passMark = raw._passMark ?? raw.passMark ?? raw._passScore ?? raw._scoreToPass;
  if (typeof passMark === 'number' && Number.isFinite(passMark)) {
    return true;
  }
  if (typeof passMark === 'string' && passMark.trim() !== '' && !Number.isNaN(Number(passMark))) {
    return true;
  }
  return raw._isFinal === true || raw.isFinal === true;
}

/**
 * Detect a dedicated Evolve scored assessment page/article (marks, pass/fail).
 * In-page knowledge checks / mini quizzes are not treated as scored assessments.
 */
export function isEvolveAssessmentNode(node: {
  title?: string;
  displayTitle?: string;
  type?: string;
  raw?: Record<string, unknown>;
}): boolean {
  if (isEvolveKnowledgeCheckNode(node)) {
    return false;
  }

  const raw = node.raw ?? {};
  const rawType = String(raw._type ?? node.type ?? '').toLowerCase();
  if (rawType === 'assessment' || rawType.includes('assessment')) {
    return true;
  }

  if (hasEvolvePassFailScoring(raw)) {
    return true;
  }

  if (raw._assessment === true || raw.assessment === true) {
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
