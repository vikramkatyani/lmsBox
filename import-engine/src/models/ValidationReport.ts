/**
 * Structured validation findings for an inspected package.
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

export type ValidationCode =
  | 'MISSING_JSON'
  | 'MISSING_ASSET'
  | 'BROKEN_REFERENCE'
  | 'DUPLICATE_ID'
  | 'UNKNOWN_COMPONENT_TYPE'
  | 'UNSUPPORTED_PUBLISHER'
  | 'EMPTY_PACKAGE'
  | 'PARSE_ERROR';

export interface ValidationIssue {
  code: ValidationCode;
  severity: ValidationSeverity;
  message: string;
  /** Entity id when applicable */
  entityId?: string;
  /** Entity kind: course | page | lesson | block | component | asset */
  entityKind?: string;
  /** Related path or JSON key */
  path?: string;
  details?: Record<string, unknown>;
}

export interface ValidationReport {
  isValid: boolean;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
  generatedAt: string;
}
