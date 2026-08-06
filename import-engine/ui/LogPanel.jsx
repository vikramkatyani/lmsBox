import React from 'react';

/**
 * Structured pipeline log viewer.
 */
export function LogPanel({ logs }) {
  if (!logs?.length) {
    return <p className="text-sm text-slate-500">No log entries.</p>;
  }

  return (
    <ol className="space-y-2 font-mono text-xs">
      {logs.map((entry, index) => (
        <li
          key={`${entry.timestamp}-${entry.event}-${index}`}
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <div className="flex flex-wrap gap-2 text-slate-500">
            <span>{entry.timestamp}</span>
            <span className="uppercase">{entry.level}</span>
            <span className="font-semibold text-slate-700">{entry.event}</span>
          </div>
          <p className="mt-1 text-slate-800">{entry.message}</p>
          {entry.data && (
            <pre className="mt-2 overflow-auto rounded bg-slate-950 p-2 text-emerald-100 max-h-40">
              {JSON.stringify(entry.data, null, 2)}
            </pre>
          )}
        </li>
      ))}
    </ol>
  );
}

export default LogPanel;
