import { describe, expect, it } from 'vitest';
import { EvolveParser } from '../src/parsers/EvolveParser';
import { loadFixtureVfs } from './helpers/loadFixture';

describe('EvolveParser', () => {
  const parser = new EvolveParser();

  it('loads all Evolve JSON documents into memory without modifying them', () => {
    const vfs = loadFixtureVfs('evolve-minimal');
    const raw = parser.parse(vfs);

    expect(raw.contentRoot).toBe('course');
    expect(raw.config).toBeTypeOf('object');
    expect(raw.course.title).toBe('Employee Wellness Sample');
    expect(raw.contentObjects).toHaveLength(2);
    expect(raw.articles).toHaveLength(2);
    expect(raw.blocks).toHaveLength(4);
    expect(raw.components).toHaveLength(6);
    expect(raw.allJsonByPath['course/components.json']).toBeDefined();
  });

  it('preserves original component ids and types from JSON', () => {
    const vfs = loadFixtureVfs('evolve-minimal');
    const raw = parser.parse(vfs);
    const graphic = raw.components.find((c) => c._id === 'c-05');

    expect(graphic).toBeDefined();
    expect(graphic?._component).toBe('graphic');
    expect(graphic?._parentId).toBe('b-05');
  });

  it('throws when a required JSON array file is missing', () => {
    const vfs = loadFixtureVfs('evolve-missing-json');
    expect(() => parser.parse(vfs)).toThrow(/components\.json/i);
  });
});
