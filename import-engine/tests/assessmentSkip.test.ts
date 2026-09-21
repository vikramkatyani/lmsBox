import { describe, expect, it } from 'vitest';
import {
  isEvolveAssessmentComponentType,
  isEvolveAssessmentNode,
  isEvolveKnowledgeCheckNode,
} from '../src/config/assessmentSkip';

describe('assessmentSkip', () => {
  it('treats knowledge check and mini quiz titles as in-page checks, not scored assessments', () => {
    expect(isEvolveKnowledgeCheckNode({ title: 'Knowledge check' })).toBe(true);
    expect(isEvolveKnowledgeCheckNode({ title: 'Mini quiz - Question 1' })).toBe(true);
    expect(isEvolveAssessmentNode({ title: 'Knowledge check' })).toBe(false);
    expect(
      isEvolveAssessmentNode({
        title: 'Knowledge check',
        raw: { _assessment: true },
      })
    ).toBe(false);
  });

  it('detects final scored assessments by title, type, and pass mark', () => {
    expect(isEvolveAssessmentNode({ title: 'COMPETENCY ASSESSMENT' })).toBe(true);
    expect(isEvolveAssessmentNode({ title: 'Final quiz' })).toBe(true);
    expect(isEvolveAssessmentNode({ title: 'Welcome', type: 'assessment' })).toBe(true);
    expect(
      isEvolveAssessmentNode({
        title: 'Exam',
        raw: { _passMark: 80 },
      })
    ).toBe(true);
    expect(isEvolveAssessmentNode({ title: 'KEY PRODUCT FEATURES' })).toBe(false);
  });

  it('only treats assessmentResults as a scored assessment component', () => {
    expect(isEvolveAssessmentComponentType('assessmentResults')).toBe(true);
    expect(isEvolveAssessmentComponentType('mcq')).toBe(false);
    expect(isEvolveAssessmentComponentType('gmcq')).toBe(false);
  });
});
