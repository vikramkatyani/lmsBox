import React, { useCallback, useMemo, useState } from 'react';
import {
  ImportEngineOrchestrator,
  Publisher,
} from '../src/index';
import { PackageUpload } from './PackageUpload';
import { CourseTree } from './CourseTree';
import { ComponentInspector } from './ComponentInspector';
import { ValidationReportPanel } from './ValidationReportPanel';
import { LogPanel } from './LogPanel';

/**
 * Developer Debug View — Evolve Package Inspector.
 *
 * Upload → Extract → Detect → Parse → Object Model → Tree + Inspector.
 * Read-only. No HTML rendering of course content. No AI. No LMS import.
 *
 * Business logic lives in ImportEngineOrchestrator; this component only
 * coordinates UI state.
 */
export function EvolvePackageInspector() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [activeTab, setActiveTab] = useState('inspector');

  const orchestrator = useMemo(() => new ImportEngineOrchestrator(), []);

  const handleUpload = useCallback(
    async (file) => {
      setBusy(true);
      setError(null);
      setResult(null);
      setSelectedKey(null);

      try {
        const inspection = await orchestrator.inspectPackage(file, {
          filename: file.name,
        });
        setResult(inspection);
        if (inspection.tree?.root?.key) {
          setSelectedKey(inspection.tree.root.key);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [orchestrator]
  );

  const selectedNode =
    result?.tree && selectedKey ? result.tree.nodeIndex[selectedKey] ?? null : null;

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Import Engine · Sprint 1
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-[#1b365d]">
              Evolve Package Inspector
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Developer debug view. Upload an exported Evolve ZIP to reverse-engineer
              structure as an object model. No HTML rendering, AI, or LMS publishing.
            </p>
          </div>
          {result?.detection && (
            <div
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                result.detection.publisher === Publisher.EVOLVE
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-amber-50 text-amber-900'
              }`}
            >
              Publisher: {result.detection.publisher}
            </div>
          )}
        </div>

        <div className="mt-4">
          <PackageUpload onUpload={handleUpload} busy={busy} />
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}
      </header>

      {!result && !busy && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center text-slate-500">
          Upload an Evolve package ZIP to inspect its course tree, components, assets,
          and validation report.
        </div>
      )}

      {busy && (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-slate-600">
          Extracting and inspecting package…
        </div>
      )}

      {result && !busy && (
        <div className="grid min-h-[640px] grid-cols-1 gap-4 xl:grid-cols-12">
          {/* Course tree — file explorer */}
          <aside className="xl:col-span-4 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Course Tree
            </div>
            <div className="flex-1 overflow-auto p-2">
              {result.tree ? (
                <CourseTree
                  root={result.tree.root}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                />
              ) : (
                <p className="p-3 text-sm text-slate-500">
                  No tree available ({result.detection.reason})
                </p>
              )}
            </div>
          </aside>

          {/* Inspector / Validation / Logs */}
          <section className="xl:col-span-8 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="flex border-b border-slate-200">
              {[
                { id: 'inspector', label: 'Inspector' },
                { id: 'validation', label: `Validation (${result.validation.issueCount})` },
                { id: 'assets', label: `Assets (${result.course?.assets?.length ?? 0})` },
                { id: 'logs', label: 'Logs' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-[#1b365d] text-[#1b365d]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto p-4">
              {activeTab === 'inspector' && (
                <ComponentInspector node={selectedNode} />
              )}
              {activeTab === 'validation' && (
                <ValidationReportPanel report={result.validation} />
              )}
              {activeTab === 'assets' && (
                <AssetIndexTable assets={result.course?.assets ?? []} />
              )}
              {activeTab === 'logs' && <LogPanel logs={result.logs} />}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function AssetIndexTable({ assets }) {
  if (!assets.length) {
    return <p className="text-sm text-slate-500">No assets indexed.</p>;
  }

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-2 py-2 font-semibold">Filename</th>
            <th className="px-2 py-2 font-semibold">Path</th>
            <th className="px-2 py-2 font-semibold">Media type</th>
            <th className="px-2 py-2 font-semibold">Dimensions</th>
            <th className="px-2 py-2 font-semibold">Parent</th>
            <th className="px-2 py-2 font-semibold">Exists</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id} className="border-b border-slate-100">
              <td className="px-2 py-2 font-medium text-slate-800">{asset.filename}</td>
              <td className="px-2 py-2 font-mono text-xs text-slate-600">{asset.path}</td>
              <td className="px-2 py-2 text-slate-600">{asset.mediaType}</td>
              <td className="px-2 py-2 text-slate-600">
                {asset.width && asset.height ? `${asset.width}×${asset.height}` : '—'}
              </td>
              <td className="px-2 py-2 font-mono text-xs text-slate-600">
                {asset.parentComponentId ?? '—'}
              </td>
              <td className="px-2 py-2">
                <span
                  className={
                    asset.exists ? 'text-emerald-700' : 'text-amber-700 font-medium'
                  }
                >
                  {asset.exists ? 'Yes' : 'Missing'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default EvolvePackageInspector;
