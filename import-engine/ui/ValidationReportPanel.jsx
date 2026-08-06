import React from 'react';

/**
 * Read-only validation report panel.
 */
export function ValidationReportPanel({ report }) {
  if (!report) {
    return <p className="text-sm text-slate-500">No validation report.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <Stat
          label="Status"
          value={report.isValid ? 'Valid (no errors)' : 'Has errors'}
          tone={report.isValid ? 'ok' : 'bad'}
        />
        <Stat label="Issues" value={String(report.issueCount)} />
        <Stat label="Errors" value={String(report.errorCount)} tone={report.errorCount ? 'bad' : 'ok'} />
        <Stat
          label="Warnings"
          value={String(report.warningCount)}
          tone={report.warningCount ? 'warn' : 'ok'}
        />
      </div>

      {report.issues.length === 0 ? (
        <p className="text-sm text-emerald-700">No validation issues found.</p>
      ) : (
        <ul className="space-y-2">
          {report.issues.map((issue, index) => (
            <li
              key={`${issue.code}-${issue.entityId ?? ''}-${index}`}
              className={`rounded-md border px-3 py-2 text-sm ${severityStyles(issue.severity)}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] uppercase">
                  {issue.code}
                </span>
                <span className="text-xs uppercase tracking-wide opacity-70">
                  {issue.severity}
                </span>
                {issue.entityId && (
                  <span className="font-mono text-xs opacity-70">{issue.entityId}</span>
                )}
              </div>
              <p className="mt-1">{issue.message}</p>
              {issue.path && (
                <p className="mt-1 font-mono text-xs opacity-70">{issue.path}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  const toneClass =
    tone === 'bad'
      ? 'border-red-200 bg-red-50 text-red-900'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : tone === 'ok'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-slate-200 bg-slate-50 text-slate-800';

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function severityStyles(severity) {
  if (severity === 'error') return 'border-red-200 bg-red-50 text-red-900';
  if (severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-slate-200 bg-slate-50 text-slate-800';
}

export default ValidationReportPanel;
