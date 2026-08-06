import { describe, expect, it } from 'vitest';
import { PublisherDetector } from '../src/detectors/PublisherDetector';
import { Publisher } from '../src/models/Publisher';
import { ZipExtractor } from '../src/services/ZipExtractor';
import { loadFixtureVfs } from './helpers/loadFixture';

describe('PublisherDetector', () => {
  const detector = new PublisherDetector();

  it('detects an Evolve package when all required markers are present', () => {
    const vfs = loadFixtureVfs('evolve-minimal');
    const result = detector.detect(vfs);

    expect(result.publisher).toBe(Publisher.EVOLVE);
    expect(result.missingMarkers).toEqual([]);
    expect(result.matchedMarkers.length).toBe(5);
  });

  it('returns UNSUPPORTED when required JSON files are missing', () => {
    const vfs = loadFixtureVfs('evolve-missing-json');
    const result = detector.detect(vfs);

    expect(result.publisher).toBe(Publisher.UNSUPPORTED);
    expect(result.missingMarkers).toContain('components.json');
  });

  it('returns UNSUPPORTED for a non-Evolve package', () => {
    const vfs = loadFixtureVfs('unsupported');
    const result = detector.detect(vfs);

    expect(result.publisher).toBe(Publisher.UNSUPPORTED);
    expect(result.missingMarkers).toEqual(
      expect.arrayContaining([
        'config.json',
        'contentObjects.json',
        'articles.json',
        'blocks.json',
        'components.json',
      ])
    );
  });

  it('returns UNSUPPORTED for an empty package', () => {
    const vfs = ZipExtractor.fromMap({});
    const result = detector.detect(vfs);
    expect(result.publisher).toBe(Publisher.UNSUPPORTED);
  });
});
