import React, { useCallback, useMemo, useState } from 'react';
import {
  ImportEngineOrchestrator,
  Publisher,
  EvolveToLmsboxMapper,
} from '../src/index';
import { PackageUpload } from './PackageUpload';
import { CourseTree } from './CourseTree';
import { ComponentInspector } from './ComponentInspector';
import { ValidationReportPanel } from './ValidationReportPanel';
import { LogPanel } from './LogPanel';

/**
 * Evolve Package Inspector + Sprint 2/3 draft import with media attach.
 *
 * Upload → Inspect → Map → Create Draft Course → Attach package media.
 * No HTML rendering of Evolve content. No AI enhancement.
 *
 * @param {{ onCreateDraftCourse?: (plan: object, ctx?: { vfs: object, onProgress?: Function }) => Promise<object> }} props
 */
export function EvolvePackageInspector({ onCreateDraftCourse }) {
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [activeTab, setActiveTab] = useState('inspector');
  const [draftPlan, setDraftPlan] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [skipAssessments, setSkipAssessments] = useState(true);
  const [courseTreeCollapsed, setCourseTreeCollapsed] = useState(false);

  const orchestrator = useMemo(() => new ImportEngineOrchestrator(), []);
  const mapper = useMemo(() => new EvolveToLmsboxMapper(), []);

  const rebuildPlan = useCallback(
    (course, skip) => {
      if (!course) {
        setDraftPlan(null);
        return;
      }
      setDraftPlan(mapper.map(course, { skipAssessments: skip }));
    },
    [mapper]
  );

  const handleUpload = useCallback(
    async (file) => {
      setBusy(true);
      setError(null);
      setResult(null);
      setSelectedKey(null);
      setDraftPlan(null);
      setImportResult(null);
      setCourseTreeCollapsed(false);

      try {
        const inspection = await orchestrator.inspectPackage(file, {
          filename: file.name,
        });
        setResult(inspection);
        if (inspection.tree?.root?.key) {
          setSelectedKey(inspection.tree.root.key);
        }

        if (inspection.course && inspection.detection?.publisher === Publisher.EVOLVE) {
          rebuildPlan(inspection.course, skipAssessments);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [orchestrator, rebuildPlan, skipAssessments]
  );

  const handleSkipAssessmentsChange = useCallback(
    (checked) => {
      setSkipAssessments(checked);
      setImportResult(null);
      if (result?.course && result?.detection?.publisher === Publisher.EVOLVE) {
        rebuildPlan(result.course, checked);
      }
    },
    [rebuildPlan, result]
  );

  const openConversionReport = useCallback(() => {
    setActiveTab('mapping');
    setCourseTreeCollapsed(true);
  }, []);

  const handleCreateDraft = useCallback(async () => {
    if (!draftPlan || !onCreateDraftCourse) return;

    setImporting(true);
    setError(null);
    setImportResult(null);
    setImportProgress('Creating draft course…');

    try {
      const created = await onCreateDraftCourse(draftPlan, {
        vfs: result?.vfs,
        onProgress: setImportProgress,
      });
      setImportResult(created);
      setActiveTab('import');
      if (created?.mediaAttach?.failed > 0) {
        setError(
          `Draft created, but ${created.mediaAttach.failed} media attach step(s) failed. ${
            created.mediaAttach.errors?.slice(0, 3).join(' · ') || ''
          }`
        );
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.join?.('; ') ||
        (err instanceof Error ? err.message : String(err));
      setError(message);
    } finally {
      setImporting(false);
      setImportProgress('');
    }
  }, [draftPlan, onCreateDraftCourse, result?.vfs]);

  const selectedNode =
    result?.tree && selectedKey
      ? result.tree.nodeIndex?.[selectedKey] ?? null
      : null;

  const issueCount =
    result?.validation?.issueCount ?? result?.validation?.issues?.length ?? 0;
  const assetCount = result?.course?.assets?.length ?? 0;
  const canImport =
    !!onCreateDraftCourse &&
    !!draftPlan &&
    draftPlan.stats.blockCount > 0 &&
    result?.detection?.publisher === Publisher.EVOLVE;

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Import Engine · Sprint 3
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-[#1b365d]">
              Evolve Package Inspector
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Upload an Evolve ZIP to inspect structure, create a Draft LMSBox
              course, and attach package media (images, video, audio, hotspot).
              No AI generation or publish.
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

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[240px]">
            <PackageUpload onUpload={handleUpload} busy={busy || importing} />
          </div>
          {canImport && (
            <button
              type="button"
              disabled={importing}
              onClick={handleCreateDraft}
              className="rounded-md bg-[#1b365d] px-4 py-2 text-sm font-medium text-white hover:bg-[#152a4a] disabled:opacity-60"
            >
              {importing ? importProgress || 'Creating draft…' : 'Create Draft Course'}
            </button>
          )}
        </div>

        {result?.detection?.publisher === Publisher.EVOLVE && (
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={skipAssessments}
              disabled={busy || importing}
              onChange={(e) => handleSkipAssessmentsChange(e.target.checked)}
            />
            <span>
              Exclude Evolve assessments from Draft import
              <span className="block text-xs text-slate-500">
                Skips the final scored Evolve assessment (marks / pass-fail), such as
                Competency Assessment. In-page knowledge checks and mini quizzes are
                converted. Add an LMSBox Quiz lesson separately for the final assessment.
              </span>
            </span>
          </label>
        )}

        {draftPlan && !importResult && (
          <p className="mt-3 text-sm text-slate-600">
            Ready to import:{' '}
            <span className="font-medium text-slate-800">{draftPlan.title}</span>
            {' — '}
            <span className="text-emerald-800 font-medium">
              {draftPlan.stats.lessonCount} lesson(s) will convert
            </span>
            {draftPlan.stats.emptyArticleCount > 0 && (
              <span className="text-amber-800 font-medium">
                {`, ${draftPlan.stats.emptyArticleCount} empty article(s) will not`}
              </span>
            )}
            {draftPlan.stats.assessmentSkippedCount > 0
              ? `, ${draftPlan.stats.assessmentSkippedCount} assessment item(s) excluded`
              : ''}
            {draftPlan.stats.pendingMediaCount
              ? `, ${draftPlan.stats.pendingMediaCount} media file(s) to attach`
              : ''}
            .
            {(draftPlan.stats.emptyArticleCount > 0 ||
              draftPlan.stats.skippedCount > 0) && (
              <button
                type="button"
                className="ml-2 text-[#1b365d] underline"
                onClick={openConversionReport}
              >
                View conversion report
              </button>
            )}
          </p>
        )}

        {error && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {importResult && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            <p className="font-medium">
              Draft course created: {importResult.title}
            </p>
            <p className="mt-1">
              {importResult.lessonCount} interactive lesson(s),{' '}
              {importResult.blockCount} block(s) — all Draft (not generated/approved).
            </p>
            {draftPlan && (
              <ConversionNotice
                plan={draftPlan}
                onOpenReport={() => {
                  setActiveTab('import');
                  setCourseTreeCollapsed(true);
                }}
              />
            )}
            {importResult.mediaAttach && !importResult.mediaAttach.skipped && (
              <p className="mt-1">
                Media attach: {importResult.mediaAttach.uploaded} uploaded
                {importResult.mediaAttach.failed
                  ? `, ${importResult.mediaAttach.failed} failed`
                  : ''}
                .
              </p>
            )}
            <a
              href={`/admin/courses/${importResult.courseId}/edit`}
              className="mt-3 inline-flex items-center rounded-md bg-[#1b365d] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-[#152a4a]"
            >
              Open course editor
            </a>
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
        <div
          className={`grid grid-cols-1 gap-4 ${
            courseTreeCollapsed ? '' : 'min-h-[640px] xl:grid-cols-12'
          }`}
        >
          <aside
            className={`${
              courseTreeCollapsed ? '' : 'xl:col-span-4 min-h-[200px]'
            } flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm`}
          >
            <button
              type="button"
              onClick={() => setCourseTreeCollapsed((collapsed) => !collapsed)}
              aria-expanded={!courseTreeCollapsed}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50 ${
                courseTreeCollapsed ? '' : 'border-b border-slate-200'
              }`}
            >
              <span
                className="inline-flex h-4 w-4 items-center justify-center text-[10px] text-slate-400"
                aria-hidden="true"
              >
                {courseTreeCollapsed ? '▶' : '▼'}
              </span>
              Course Tree
            </button>
            {!courseTreeCollapsed && (
              <div className="flex-1 overflow-auto p-2">
                {result.tree?.root ? (
                  <CourseTree
                    root={result.tree.root}
                    selectedKey={selectedKey}
                    onSelect={setSelectedKey}
                  />
                ) : (
                  <p className="p-3 text-sm text-slate-500">
                    No tree available ({result.detection?.reason ?? 'unsupported package'})
                  </p>
                )}
              </div>
            )}
          </aside>

          <section
            className={`${
              courseTreeCollapsed ? 'min-h-[640px]' : 'xl:col-span-8'
            } flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm`}
          >
            <div className="flex flex-wrap border-b border-slate-200">
              {[
                { id: 'inspector', label: 'Inspector' },
                { id: 'validation', label: `Validation (${issueCount})` },
                { id: 'assets', label: `Assets (${assetCount})` },
                {
                  id: 'mapping',
                  label: `Mapping (${draftPlan?.report?.length ?? 0})`,
                },
                { id: 'import', label: 'Import' },
                { id: 'logs', label: 'Logs' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
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
              {activeTab === 'mapping' && (
                <MappingReportPanel plan={draftPlan} />
              )}
              {activeTab === 'import' && (
                <ImportSummaryPanel
                  plan={draftPlan}
                  importResult={importResult}
                  canImport={canImport}
                  importing={importing}
                  onCreateDraft={handleCreateDraft}
                />
              )}
              {activeTab === 'logs' && <LogPanel logs={result.logs ?? []} />}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ConversionNotice({ plan, onOpenReport }) {
  const empty = plan?.stats?.emptyArticleCount ?? 0;
  const assessment = plan?.stats?.assessmentSkippedCount ?? 0;
  const unsupported = plan?.stats?.unsupportedSkippedCount ?? 0;
  if (!empty && !assessment && !unsupported) return null;

  return (
    <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
      <p className="font-medium">Admin notice — not everything was converted</p>
      <ul className="mt-1 list-disc pl-5 text-sm">
        {empty > 0 && (
          <li>
            <strong>{empty}</strong> empty article(s) had no mappable components and were
            not converted into LMSBox blocks.
          </li>
        )}
        {assessment > 0 && (
          <li>
            <strong>{assessment}</strong> scored assessment item(s) were excluded (marks /
            pass-fail). In-page knowledge checks are converted. Use an LMSBox Quiz
            lesson for the final assessment.
          </li>
        )}
        {unsupported > 0 && (
          <li>
            <strong>{unsupported}</strong> unsupported component(s) were skipped.
          </li>
        )}
      </ul>
      {onOpenReport && (
        <button
          type="button"
          onClick={onOpenReport}
          className="mt-2 text-sm font-medium text-[#1b365d] underline"
        >
          Open detailed conversion report
        </button>
      )}
    </div>
  );
}

function MappingReportPanel({ plan }) {
  const [filter, setFilter] = React.useState('all');

  if (!plan?.report?.length) {
    return (
      <p className="text-sm text-slate-500">
        No mapping report yet. Inspect an Evolve package first.
      </p>
    );
  }

  const emptyArticles = plan.report.filter((r) => r.reasonCode === 'empty_article');
  const convertedLessons = plan.lessons || [];
  const filtered = plan.report.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'converted') return item.status === 'mapped' || item.status === 'stubbed';
    if (filter === 'empty') return item.reasonCode === 'empty_article';
    if (filter === 'assessment') {
      return (
        item.reasonCode === 'assessment_page' ||
        item.reasonCode === 'assessment_article' ||
        item.reasonCode === 'assessment_component'
      );
    }
    if (filter === 'skipped') return item.status === 'skipped';
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
        <p className="font-medium text-[#1b365d]">Conversion summary</p>
        <p className="mt-1">
          <span className="text-emerald-800 font-medium">
            {convertedLessons.length} lesson(s) will be created
          </span>
          {' · '}
          <span className="text-amber-800 font-medium">
            {emptyArticles.length} empty article(s) will not
          </span>
          {' · '}
          {plan.stats.assessmentSkippedCount || 0} assessment skip(s) ·{' '}
          {plan.stats.unsupportedSkippedCount || 0} unsupported skip(s)
        </p>
      </div>

      {emptyArticles.length > 0 && (
        <div className="rounded-md border-2 border-amber-400 bg-amber-50 px-3 py-3">
          <p className="text-sm font-semibold text-amber-950">
            Empty articles not converted ({emptyArticles.length})
          </p>
          <p className="mt-1 text-xs text-amber-900">
            These Evolve articles have no mappable learning components. Admins should
            review them in the package or recreate content manually in LMSBox if needed.
          </p>
          <ul className="mt-2 space-y-1.5">
            {emptyArticles.map((item, index) => (
              <li
                key={`empty-${item.sourceComponentId}-${index}`}
                className="rounded border border-amber-300 bg-white px-2.5 py-2 text-sm text-amber-950"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-amber-200 px-1.5 py-0.5 font-mono text-[10px] uppercase">
                    not converted
                  </span>
                  <span className="font-medium">{item.sourceTitle}</span>
                  <span className="font-mono text-xs text-amber-800">{item.sourceComponentId}</span>
                </div>
                {item.pagePath && (
                  <p className="mt-0.5 text-xs text-amber-800">Path: {item.pagePath}</p>
                )}
                <p className="mt-1 text-xs">{item.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <Stat label="Mapped" value={plan.stats.mappedCount} tone="ok" />
        <Stat label="Stubbed" value={plan.stats.stubbedCount} tone="warn" />
        <Stat label="Empty articles" value={plan.stats.emptyArticleCount || 0} tone="warn" />
        <Stat label="Skipped" value={plan.stats.skippedCount} tone="bad" />
        <Stat label="Lessons" value={plan.stats.lessonCount} />
        <Stat label="Blocks" value={plan.stats.blockCount} />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All' },
          { id: 'converted', label: 'Converted' },
          { id: 'empty', label: `Empty (${emptyArticles.length})` },
          { id: 'assessment', label: 'Assessment' },
          { id: 'skipped', label: 'All skipped' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              filter === tab.id
                ? 'bg-[#1b365d] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {filtered.map((item, index) => (
          <li
            key={`${item.sourceComponentId}-${index}`}
            className={`rounded-md border px-3 py-2 text-sm ${reportItemStyles(item)}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] uppercase">
                {item.reasonCode === 'empty_article' ? 'not converted' : item.status}
              </span>
              {item.reasonCode && (
                <span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px]">
                  {item.reasonCode}
                </span>
              )}
              <span className="font-medium">{item.sourceTitle}</span>
              <span className="font-mono text-xs opacity-70">{item.sourceType}</span>
              {item.targetBlockType && (
                <span className="text-xs opacity-70">→ {item.targetBlockType}</span>
              )}
            </div>
            {item.pagePath && (
              <p className="mt-0.5 text-xs opacity-70">Path: {item.pagePath}</p>
            )}
            <p className="mt-1 opacity-90">{item.message}</p>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="text-sm text-slate-500">No items in this filter.</li>
        )}
      </ul>
    </div>
  );
}

function ImportSummaryPanel({ plan, importResult, canImport, importing, onCreateDraft }) {
  if (importResult) {
    const emptyArticles =
      plan?.report?.filter((r) => r.reasonCode === 'empty_article') ?? [];
    return (
      <div className="space-y-4 text-sm">
        <p className="font-medium text-emerald-800">Import complete</p>
        <p>
          Course <span className="font-mono">{importResult.courseId}</span> created as{' '}
          <strong>{importResult.status}</strong>.
        </p>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Converted lessons ({importResult.lessons?.length ?? 0})
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
            {importResult.lessons?.map((lesson) => (
              <li key={lesson.lessonId}>
                {lesson.title} — {lesson.blockCount} block(s)
              </li>
            ))}
          </ul>
        </div>

        {emptyArticles.length > 0 && (
          <div className="rounded-md border-2 border-amber-400 bg-amber-50 px-3 py-3 text-amber-950">
            <p className="font-semibold">
              Not converted — empty articles ({emptyArticles.length})
            </p>
            <p className="mt-1 text-xs">
              These Evolve articles were skipped because they had no mappable components.
            </p>
            <ul className="mt-2 space-y-1">
              {emptyArticles.map((item) => (
                <li key={item.sourceComponentId} className="text-sm">
                  <span className="font-medium">{item.sourceTitle}</span>
                  {item.pagePath ? (
                    <span className="text-xs text-amber-800"> — {item.pagePath}</span>
                  ) : null}
                  <span className="block font-mono text-[11px] opacity-70">
                    {item.sourceComponentId}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {plan && <ConversionNotice plan={plan} />}

        <a
          href={`/admin/courses/${importResult.courseId}/edit`}
          className="inline-flex items-center rounded-md bg-[#1b365d] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-[#152a4a]"
        >
          Open course editor
        </a>
      </div>
    );
  }

  if (!plan) {
    return (
      <p className="text-sm text-slate-500">
        Inspect an Evolve package to prepare a draft import plan.
      </p>
    );
  }

  const emptyArticles = plan.report.filter((r) => r.reasonCode === 'empty_article');

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Draft plan
        </p>
        <h3 className="text-lg font-semibold text-[#1b365d]">{plan.title}</h3>
        {plan.description && (
          <p className="mt-1 text-slate-600 line-clamp-3">{plan.description}</p>
        )}
      </div>
      <p className="text-slate-700">
        Will create {plan.stats.lessonCount} interactive lesson(s) with{' '}
        {plan.stats.blockCount} Draft block(s). Blocks are not AI-generated or
        approved — open the interactive editor to review.
      </p>

      {emptyArticles.length > 0 && (
        <div className="rounded-md border-2 border-amber-400 bg-amber-50 px-3 py-3 text-amber-950">
          <p className="font-semibold">
            {emptyArticles.length} empty article(s) will not be converted
          </p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
            {emptyArticles.map((item) => (
              <li key={item.sourceComponentId}>
                <span className="font-medium">{item.sourceTitle}</span>
                {item.pagePath ? (
                  <span className="text-xs"> — {item.pagePath}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canImport ? (
        <button
          type="button"
          disabled={importing}
          onClick={onCreateDraft}
          className="rounded-md bg-[#1b365d] px-4 py-2 text-sm font-medium text-white hover:bg-[#152a4a] disabled:opacity-60"
        >
          {importing ? 'Creating draft…' : 'Create Draft Course'}
        </button>
      ) : (
        <p className="text-amber-800">
          Nothing to import — no mappable components found, or create handler is not
          wired.
        </p>
      )}
    </div>
  );
}

function reportItemStyles(item) {
  if (item.reasonCode === 'empty_article') {
    return 'border-amber-400 bg-amber-50 text-amber-950 ring-1 ring-amber-300';
  }
  return statusStyles(item.status);
}

function Stat({ label, value, tone }) {
  const toneClass =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : tone === 'bad'
          ? 'border-red-200 bg-red-50 text-red-900'
          : 'border-slate-200 bg-slate-50 text-slate-800';

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function statusStyles(status) {
  if (status === 'mapped') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (status === 'stubbed') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-slate-200 bg-slate-50 text-slate-800';
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
            <th className="px-2 py-2 font-semibold">Exists</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr key={asset.id} className="border-b border-slate-100">
              <td className="px-2 py-2 font-medium text-slate-800">{asset.filename}</td>
              <td className="px-2 py-2 font-mono text-xs text-slate-600">{asset.path}</td>
              <td className="px-2 py-2 text-slate-600">{asset.mediaType ?? '—'}</td>
              <td className="px-2 py-2">
                <span
                  className={
                    asset.exists ? 'text-emerald-700' : 'font-medium text-amber-700'
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
