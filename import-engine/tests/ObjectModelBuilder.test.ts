import { describe, expect, it } from 'vitest';
import { EvolveParser } from '../src/parsers/EvolveParser';
import { EvolveToLmsboxMapper } from '../src/mappers/EvolveToLmsboxMapper';
import { AssetIndexer } from '../src/services/AssetIndexer';
import { ObjectModelBuilder } from '../src/services/ObjectModelBuilder';
import { PreviewTreeBuilder } from '../src/services/PreviewTreeBuilder';
import { Publisher } from '../src/models/Publisher';
import type { EvolveRawPackage } from '../src/parsers/IPackageParser';
import { loadFixtureVfs } from './helpers/loadFixture';

describe('ObjectModelBuilder — relationship building', () => {
  const parser = new EvolveParser();
  const builder = new ObjectModelBuilder(new AssetIndexer());

  it('builds Course → Pages → Lessons → Blocks → Components using source ids', () => {
    const vfs = loadFixtureVfs('evolve-minimal');
    const raw = parser.parse(vfs);
    const course = builder.build(raw, vfs);

    expect(course.id).toBe('course');
    expect(course.pages).toHaveLength(2);
    expect(course.pages[0].id).toBe('co-05');
    expect(course.pages[0].title).toBe('Introduction');
    expect(course.pages[0].lessons).toHaveLength(1);
    expect(course.pages[0].lessons[0].id).toBe('a-05');

    const introComponents = course.pages[0].lessons[0].blocks.flatMap((b) => b.components);
    expect(introComponents.map((c) => c.type)).toEqual(
      expect.arrayContaining(['graphic', 'text', 'accordion'])
    );

    const features = course.pages[1];
    expect(features.id).toBe('co-10');
    const featureTypes = features.lessons[0].blocks.flatMap((b) => b.components).map((c) => c.type);
    expect(featureTypes).toEqual(expect.arrayContaining(['media', 'text', 'customWidget']));
  });

  it('wires component relationships to page, lesson, block, and course', () => {
    const vfs = loadFixtureVfs('evolve-minimal');
    const course = builder.build(parser.parse(vfs), vfs);
    const graphic = course.components.find((c) => c.id === 'c-05');

    expect(graphic?.relationships).toEqual({
      parentBlockId: 'b-05',
      parentLessonId: 'a-05',
      parentPageId: 'co-05',
      courseId: 'course',
      assetIds: expect.arrayContaining([expect.stringContaining('welcome.png')]),
    });
  });

  it('never invents ids — only uses Evolve-supplied values', () => {
    const vfs = loadFixtureVfs('evolve-minimal');
    const course = builder.build(parser.parse(vfs), vfs);
    const ids = [
      course.id,
      ...course.pages.map((p) => p.id),
      ...course.lessons.map((l) => l.id),
      ...course.blocks.map((b) => b.id),
      ...course.components.map((c) => c.id),
    ];

    expect(ids).toEqual(
      expect.arrayContaining(['course', 'co-05', 'co-10', 'a-05', 'a-10', 'b-05', 'c-05'])
    );
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
  });

  it('orders siblings by _sortOrder even when JSON array order differs', () => {
    const raw = {
      publisher: Publisher.EVOLVE,
      contentRoot: 'course',
      config: {},
      course: { _id: 'course', title: 'Ordered Course' },
      contentObjects: [
        {
          _id: 'co-later',
          _parentId: 'course',
          _type: 'page',
          _sortOrder: 2,
          title: 'Second page',
        },
        {
          _id: 'co-first',
          _parentId: 'course',
          _type: 'page',
          _sortOrder: 1,
          title: 'First page',
        },
      ],
      articles: [
        {
          _id: 'a-b',
          _parentId: 'co-first',
          _type: 'article',
          _sortOrder: 2,
          title: 'Article B',
        },
        {
          _id: 'a-a',
          _parentId: 'co-first',
          _type: 'article',
          _sortOrder: 1,
          title: 'Article A',
        },
      ],
      blocks: [
        {
          _id: 'b-2',
          _parentId: 'a-a',
          _type: 'block',
          _sortOrder: 2,
          title: 'Block 2',
        },
        {
          _id: 'b-1',
          _parentId: 'a-a',
          _type: 'block',
          _sortOrder: 1,
          title: 'Block 1',
        },
      ],
      components: [
        {
          _id: 'c-2',
          _parentId: 'b-1',
          _type: 'component',
          _component: 'text',
          _sortOrder: 2,
          title: 'Text 2',
          body: '<p>Two</p>',
        },
        {
          _id: 'c-1',
          _parentId: 'b-1',
          _type: 'component',
          _component: 'text',
          _sortOrder: 1,
          title: 'Text 1',
          body: '<p>One</p>',
        },
      ],
      allJsonByPath: {},
    } as unknown as EvolveRawPackage;

    const course = new ObjectModelBuilder(new AssetIndexer()).build(raw);
    expect(course.pages.map((p) => p.id)).toEqual(['co-first', 'co-later']);
    expect(course.pages[0].lessons.map((l) => l.id)).toEqual(['a-a', 'a-b']);
    expect(course.pages[0].lessons[0].blocks.map((b) => b.id)).toEqual(['b-1', 'b-2']);
    expect(
      course.pages[0].lessons[0].blocks[0].components.map((c) => c.id)
    ).toEqual(['c-1', 'c-2']);

    const plan = new EvolveToLmsboxMapper().map(course, {
      uniquifyTitle: false,
      skipAssessments: true,
    });
    // a-b has no components so it is skipped; remaining lesson/blocks keep Evolve order
    expect(plan.lessons.map((l) => l.sourceLessonId)).toEqual(['a-a']);
    expect(plan.lessons[0].blocks.map((b) => b.sourceComponentId)).toEqual([
      'c-1',
      'c-2',
    ]);
    expect(plan.lessons[0].blocks.map((b) => b.sourceOrder)).toEqual([1, 2]);
    expect(plan.lessons[0].sourceOrder).toBe(1);
  });
});

describe('PreviewTreeBuilder', () => {
  it('builds a file-explorer style tree with component type labels', () => {
    const vfs = loadFixtureVfs('evolve-minimal');
    const course = new ObjectModelBuilder(new AssetIndexer()).build(
      new EvolveParser().parse(vfs),
      vfs
    );
    const tree = new PreviewTreeBuilder().build(course);

    expect(tree.root.label).toBe('Employee Wellness Sample');
    expect(tree.root.children[0].label).toBe('Introduction');

    const introLesson = tree.root.children[0].children.find((n) => n.kind === 'lesson');
    expect(introLesson?.label).toBe('Lesson');

    const componentLabels = introLesson?.children
      .flatMap((block) => block.children)
      .filter((n) => n.kind === 'component')
      .map((n) => n.label);

    expect(componentLabels).toEqual(expect.arrayContaining(['Graphic', 'Text', 'Accordion']));
  });
});
