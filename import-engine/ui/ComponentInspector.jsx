import React, { useState } from 'react';

/**
 * Read-only Component / node Inspector.
 * Shows type, properties, assets, relationships, and original JSON.
 */
export function ComponentInspector({ node }) {
  const [jsonExpanded, setJsonExpanded] = useState(true);

  if (!node) {
    return (
      <p className="text-sm text-slate-500">
        Select a node in the course tree to inspect it.
      </p>
    );
  }

  const isComponent = node.kind === 'component';
  const meta = node.meta ?? {};

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {node.kind}
        </p>
        <h2 className="text-xl font-semibold text-[#1b365d]">{node.label}</h2>
        {node.id && (
          <p className="mt-1 font-mono text-xs text-slate-500">id: {node.id}</p>
        )}
      </div>

      {isComponent && (
        <Section title="Component Type">
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
            <Field label="Type" value={node.badge || meta.type} />
            <Field
              label="Known type"
              value={meta.isKnownType ? 'Yes' : 'No (flagged in validation)'}
            />
            <Field label="Title" value={meta.title} />
            <Field label="Layout" value={meta.layout || '—'} />
          </dl>
        </Section>
      )}

      {isComponent && meta.properties && (
        <Section title="Properties">
          <pre className="overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100 max-h-64">
            {JSON.stringify(meta.properties, null, 2)}
          </pre>
        </Section>
      )}

      {isComponent && Array.isArray(meta.assets) && (
        <Section title="Assets">
          {meta.assets.length === 0 ? (
            <p className="text-sm text-slate-500">No assets on this component.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {meta.assets.map((asset) => (
                <li key={asset.id} className="font-mono text-xs text-slate-700">
                  {asset.filename}{' '}
                  <span className="text-slate-400">
                    ({asset.mediaType}
                    {asset.width && asset.height
                      ? `, ${asset.width}×${asset.height}`
                      : ''}
                    {!asset.exists ? ', missing' : ''})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {isComponent && meta.relationships && (
        <Section title="Relationships">
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
            {Object.entries(meta.relationships).map(([key, value]) => (
              <Field
                key={key}
                label={key}
                value={Array.isArray(value) ? value.join(', ') || '—' : String(value ?? '—')}
              />
            ))}
          </dl>
        </Section>
      )}

      {!isComponent && meta && Object.keys(meta).length > 0 && (
        <Section title="Metadata">
          <pre className="overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100 max-h-48">
            {JSON.stringify(meta, null, 2)}
          </pre>
        </Section>
      )}

      <Section
        title="Original JSON"
        action={
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-800"
            onClick={() => setJsonExpanded((v) => !v)}
          >
            {jsonExpanded ? 'Collapse' : 'Expand'}
          </button>
        }
      >
        {jsonExpanded && (
          <pre className="overflow-auto rounded-md bg-slate-950 p-3 text-xs text-emerald-100 max-h-[480px]">
            {node.raw ? JSON.stringify(node.raw, null, 2) : 'null'}
          </pre>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children, action }) {
  return (
    <section className="rounded-md border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {title}
        </h3>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-mono text-slate-800 break-all">{value ?? '—'}</dd>
    </div>
  );
}

export default ComponentInspector;
