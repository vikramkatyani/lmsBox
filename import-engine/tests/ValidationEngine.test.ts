import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { PublisherDetector } from '../src/detectors/PublisherDetector';
import { EvolveParser } from '../src/parsers/EvolveParser';
import { AssetIndexer } from '../src/services/AssetIndexer';
import { ImportEngineOrchestrator } from '../src/services/ImportEngineOrchestrator';
import { ObjectModelBuilder } from '../src/services/ObjectModelBuilder';
import { ZipExtractor } from '../src/services/ZipExtractor';
import { ValidationEngine } from '../src/validators/ValidationEngine';
import { Publisher } from '../src/models/Publisher';
import { loadFixtureVfs } from './helpers/loadFixture';

describe('ValidationEngine', () => {
  const detector = new PublisherDetector();
  const parser = new EvolveParser();
  const builder = new ObjectModelBuilder(new AssetIndexer());
  const validator = new ValidationEngine();

  it('reports missing required JSON files', () => {
    const vfs = loadFixtureVfs('evolve-missing-json');
    const detection = detector.detect(vfs);
    const report = validator.validate({ detection, vfs, raw: null, course: null });

    expect(report.isValid).toBe(false);
    expect(report.issues.some((i) => i.code === 'MISSING_JSON')).toBe(true);
    expect(report.issues.some((i) => i.path === 'components.json')).toBe(true);
  });

  it('reports broken parent references', () => {
    const vfs = loadFixtureVfs('evolve-broken');
    const detection = detector.detect(vfs);
    const raw = parser.parse(vfs);
    const course = builder.build(raw, vfs);
    const report = validator.validate({ detection, vfs, raw, course });

    expect(report.issues.some((i) => i.code === 'BROKEN_REFERENCE')).toBe(true);
  });

  it('reports duplicate ids', () => {
    const vfs = loadFixtureVfs('evolve-broken');
    const detection = detector.detect(vfs);
    const raw = parser.parse(vfs);
    const course = builder.build(raw, vfs);
    const report = validator.validate({ detection, vfs, raw, course });

    expect(report.issues.some((i) => i.code === 'DUPLICATE_ID')).toBe(true);
  });

  it('reports missing assets', () => {
    const vfs = loadFixtureVfs('evolve-broken');
    const detection = detector.detect(vfs);
    const raw = parser.parse(vfs);
    const course = builder.build(raw, vfs);
    const report = validator.validate({ detection, vfs, raw, course });

    expect(report.issues.some((i) => i.code === 'MISSING_ASSET')).toBe(true);
  });

  it('reports unknown component types', () => {
    const vfs = loadFixtureVfs('evolve-minimal');
    const detection = detector.detect(vfs);
    const raw = parser.parse(vfs);
    const course = builder.build(raw, vfs);
    const report = validator.validate({ detection, vfs, raw, course });

    const unknown = report.issues.filter((i) => i.code === 'UNKNOWN_COMPONENT_TYPE');
    expect(unknown.some((i) => i.details?.type === 'customWidget')).toBe(true);
  });

  it('passes a healthy minimal package with only unknown-type warnings', () => {
    const vfs = loadFixtureVfs('evolve-minimal');
    const detection = detector.detect(vfs);
    const raw = parser.parse(vfs);
    const course = builder.build(raw, vfs);
    const report = validator.validate({ detection, vfs, raw, course });

    expect(report.errorCount).toBe(0);
    expect(report.isValid).toBe(true);
  });
});

describe('AssetIndexer', () => {
  it('indexes assets with filename, path, media type, dimensions, and parent component', () => {
    const vfs = loadFixtureVfs('evolve-minimal');
    const course = new ObjectModelBuilder(new AssetIndexer()).build(
      new EvolveParser().parse(vfs),
      vfs
    );

    const welcome = course.assets.find((a) => a.filename === 'welcome.png');
    expect(welcome).toMatchObject({
      filename: 'welcome.png',
      path: expect.stringContaining('welcome.png'),
      mediaType: 'image/png',
      width: 800,
      height: 450,
      parentComponentId: 'c-05',
      exists: true,
    });
  });
});

describe('ZipExtractor', () => {
  it('extracts a zip while preserving directory structure', async () => {
    const zip = new JSZip();
    zip.file('course/config.json', '{"ok":true}');
    zip.file('course/assets/a.png', 'png');
    const buffer = await zip.generateAsync({ type: 'uint8array' });

    const extractor = new ZipExtractor();
    const { vfs, fileCount } = await extractor.extract(buffer, { originalName: 't.zip' });

    expect(fileCount).toBe(2);
    expect(vfs.paths).toEqual(expect.arrayContaining(['course/config.json', 'course/assets/a.png']));
  });
});

describe('ImportEngineOrchestrator', () => {
  it('runs the full inspection pipeline for an Evolve fixture', async () => {
    const vfs = loadFixtureVfs('evolve-minimal');
    const orchestrator = new ImportEngineOrchestrator();
    const result = orchestrator.inspectVirtualFileSystem(vfs);

    expect(result.detection.publisher).toBe(Publisher.EVOLVE);
    expect(result.course?.title).toBe('Employee Wellness Sample');
    expect(result.tree?.root.children.length).toBeGreaterThan(0);
    expect(result.logs.map((l) => l.event)).toEqual(
      expect.arrayContaining([
        'publisher_detected',
        'json_loaded',
        'object_model_built',
        'assets_indexed',
        'validation_complete',
        'tree_built',
      ])
    );
  });
});
