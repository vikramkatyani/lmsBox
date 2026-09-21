import { describe, expect, it } from 'vitest';
import {
  EvolveToLmsboxMapper,
  MAX_BLOCKS_PER_LESSON,
} from '../src/mappers/EvolveToLmsboxMapper';
import type { Course } from '../src/models/Course';
import type { Component } from '../src/models/Component';
import { Publisher } from '../src/models/Publisher';

function makeComponent(
  partial: Partial<Component> & Pick<Component, 'id' | 'type'>
): Component {
  return {
    parentId: 'b-1',
    title: partial.title ?? partial.id,
    displayTitle: partial.displayTitle,
    body: partial.body ?? '',
    layout: 'full',
    assets: [],
    relationships: {
      parentBlockId: 'b-1',
      parentLessonId: 'a-1',
      parentPageId: 'co-1',
      courseId: 'course',
      assetIds: [],
    },
    isKnownType: true,
    raw: partial.raw ?? {},
    ...partial,
  };
}

function makeCourse(components: Component[]): Course {
  return {
    id: 'course',
    title: 'Sample Evolve Course',
    displayTitle: 'Sample Evolve Course',
    description: 'A test course',
    publisher: Publisher.EVOLVE,
    pages: [
      {
        id: 'co-1',
        parentId: 'course',
        title: 'Introduction',
        displayTitle: 'Introduction',
        type: 'page',
        lessons: [
          {
            id: 'a-1',
            parentId: 'co-1',
            title: 'Welcome',
            displayTitle: 'Welcome',
            blocks: [
              {
                id: 'b-1',
                parentId: 'a-1',
                title: 'Block 1',
                components,
                raw: {},
              },
            ],
            raw: {},
          },
        ],
        childPages: [],
        raw: {},
      },
    ],
    lessons: [],
    blocks: [],
    components,
    assets: [],
    raw: {},
    contentRoot: 'course',
  };
}

describe('EvolveToLmsboxMapper', () => {
  const mapper = new EvolveToLmsboxMapper();

  it('maps text components to text blocks with required payload fields', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-1',
        type: 'text',
        title: 'Hello',
        body: '<p>Welcome body</p>',
        raw: { title: 'Hello', body: '<p>Welcome body</p>' },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });

    expect(plan.title).toBe('Sample Evolve Course');
    expect(plan.lessons).toHaveLength(1);
    expect(plan.lessons[0].title).toContain('Introduction');
    expect(plan.lessons[0].blocks).toHaveLength(1);
    expect(plan.lessons[0].blocks[0].blockType).toBe('text');
    expect(plan.lessons[0].blocks[0].formPayload).toMatchObject({
      heading: 'Hello',
      showContinueButton: true,
    });
    expect(plan.stats.mappedCount).toBe(1);
  });

  it('maps accordion items to panels', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-acc',
        type: 'accordion',
        title: 'Topics',
        raw: {
          _items: [
            { title: 'One', body: 'First' },
            { title: 'Two', body: 'Second' },
          ],
        },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });
    const block = plan.lessons[0].blocks[0];

    expect(block.blockType).toBe('accordion');
    expect(block.formPayload.contentDescription).toBeTruthy();
    expect(block.formPayload.panels).toHaveLength(2);
  });

  it('splits lessons when mapped blocks exceed the interactive lesson limit', () => {
    const components = Array.from({ length: MAX_BLOCKS_PER_LESSON + 2 }, (_, i) =>
      makeComponent({
        id: `c-${i}`,
        type: 'text',
        title: `Part ${i}`,
        body: `<p>Body ${i}</p>`,
        raw: { title: `Part ${i}`, body: `<p>Body ${i}</p>` },
      })
    );

    const plan = mapper.map(makeCourse(components), { uniquifyTitle: false });

    expect(plan.lessons.length).toBe(2);
    expect(plan.lessons[0].blocks).toHaveLength(MAX_BLOCKS_PER_LESSON);
    expect(plan.lessons[1].blocks).toHaveLength(2);
    expect(plan.lessons[0].title).toContain('part 1');
  });

  it('skips unknown component types and records them in the report', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-x',
        type: 'mysteryWidget',
        title: 'Mystery',
        raw: {},
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });

    expect(plan.lessons).toHaveLength(0);
    expect(plan.stats.skippedCount).toBeGreaterThan(0);
    expect(plan.report.some((r) => r.sourceType === 'mysterywidget')).toBe(true);
  });

  it('queues Evolve graphic large/small paths for media attach and uses alt as title', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-06_01_030_g',
        type: 'graphic',
        title: 'c-06_01_030_g', // ObjectModelBuilder often copies id when title is empty
        raw: {
          title: '',
          displayTitle: '',
          _graphic: {
            large: 'course/en/images/06_01_030/06_01_030_image_white.png',
            small: 'course/en/images/06_01_030/06_01_030_image_white.png',
            alt: 'Minibus with labelled check areas',
          },
        },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });
    const block = plan.lessons[0].blocks[0];

    expect(block.title).toBe('Minibus with labelled check areas');
    expect(block.formPayload.heading).toBe('Minibus with labelled check areas');
    expect(block.mediaAssets).toHaveLength(1);
    expect(block.mediaAssets[0]).toMatchObject({
      sourcePath: 'course/en/images/06_01_030/06_01_030_image_white.png',
      targetField: 'bodyHtml',
    });
    expect(String(block.formPayload.bodyHtml)).toMatch(/Image will attach from Evolve package/);
  });

  it('uses body text as title when Evolve title fields are empty', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-06_01_040_t',
        type: 'text',
        title: 'c-06_01_040_t',
        body: '<p>Example checklist adapted from gov.uk PSV checklist</p>',
        raw: {
          title: '',
          displayTitle: '',
          body: '<p>Example checklist adapted from gov.uk PSV checklist</p>',
        },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });
    expect(plan.lessons[0].blocks[0].title).toMatch(/Example checklist/i);
  });

  it('maps audio components to audio blocks with pending media', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-a',
        type: 'audio',
        title: 'Narration',
        raw: { _media: { mp3: 'course/assets/clip.mp3' } },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });
    const block = plan.lessons[0].blocks[0];

    expect(block.blockType).toBe('audio');
    expect(block.formPayload.audioUrl).toBe('');
    expect(block.mediaAssets[0]).toMatchObject({
      sourcePath: 'course/assets/clip.mp3',
      targetField: 'audioUrl',
    });
  });

  it('maps hotspot components to hotspot blocks with pending diagram', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-h',
        type: 'hotspot',
        title: 'Zones',
        raw: {
          _graphic: { src: 'course/assets/map.png', alt: 'Map' },
          _items: [{ title: 'A', body: 'Alpha', _top: 20, _left: 30 }],
        },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });
    const block = plan.lessons[0].blocks[0];

    expect(block.blockType).toBe('hotspot');
    expect(block.formPayload.pins).toHaveLength(1);
    expect(block.mediaAssets[0].targetField).toBe('imageUrl');
  });

  it('queues graphics when Evolve stores _graphic as an Asset:image string', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-g',
        type: 'graphic',
        title: 'Graphic Title',
        raw: {
          title: 'Graphic Title',
          _graphic: 'course/en/assets/kit-contents.png',
        },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });
    const block = plan.lessons[0].blocks[0];

    expect(block.mediaAssets[0]).toMatchObject({
      sourcePath: 'course/en/assets/kit-contents.png',
      targetField: 'bodyHtml',
    });
    expect(plan.report[0].message).toMatch(/queued for media attach/i);
  });

  it('queues graphics when src is a language/default object', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-g',
        type: 'graphic',
        title: 'Graphic Title',
        raw: {
          title: 'Graphic Title',
          _graphic: {
            alt: 'Test device',
            src: { _default: 'course/en/assets/test-device.png' },
          },
        },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });
    expect(plan.lessons[0].blocks[0].mediaAssets[0].sourcePath).toBe(
      'course/en/assets/test-device.png'
    );
  });

  it('falls back to harvested component assets when _graphic has no src fields', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-g',
        type: 'graphic',
        title: 'Graphic Title',
        assets: [
          {
            id: 'asset:course/en/assets/visitecht-kit.png',
            filename: 'visitecht-kit.png',
            path: 'course/en/assets/visitecht-kit.png',
            mediaType: 'image/png',
            exists: true,
            parentComponentId: 'c-g',
          },
        ],
        raw: {
          title: 'Graphic Title',
          _graphic: { alt: 'Kit contents', attribution: '' },
        },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });
    expect(plan.lessons[0].blocks[0].mediaAssets[0].sourcePath).toBe(
      'course/en/assets/visitecht-kit.png'
    );
  });

  it('matches package images to hotgraphics by filename or component id', () => {
    const hotspot = makeComponent({
      id: 'c-06_01_050_hg',
      type: 'hotgraphic',
      title: 'Hot Graphic Title',
      raw: {
        title: 'Hot Graphic Title',
        _graphic: { alt: 'Sampling device', filename: 'sampling-device.png' },
        _items: [{ title: 'A', body: 'Alpha', _top: 20, _left: 30 }],
      },
    });
    const course = makeCourse([hotspot]);
    course.assets = [
      {
        id: 'asset:course/en/assets/sampling-device.png',
        filename: 'sampling-device.png',
        path: 'course/en/assets/sampling-device.png',
        mediaType: 'image/png',
        exists: true,
      },
    ];

    const plan = mapper.map(course, { uniquifyTitle: false });
    const block = plan.lessons[0].blocks[0];

    expect(block.blockType).toBe('hotspot');
    expect(block.mediaAssets[0]).toMatchObject({
      sourcePath: 'course/en/assets/sampling-device.png',
      targetField: 'imageUrl',
    });
    expect(plan.report[0].message).toMatch(/queued for media attach/i);
  });

  it('skips mcq components by default (assessment exclusion)', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-mcq',
        type: 'mcq',
        title: 'Scored question',
        raw: {
          _items: [
            {
              text: 'What is 2+2?',
              _options: [
                { text: '4', _isCorrect: true },
                { text: '5', _isCorrect: false },
              ],
            },
          ],
        },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });

    expect(plan.lessons).toHaveLength(0);
    expect(plan.report.some((r) => r.sourceType === 'mcq' && r.status === 'skipped')).toBe(
      true
    );
    expect(plan.report[0].message).toMatch(/LMSBox Quiz/i);
  });

  it('can map mcq when skipAssessments is false', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-mcq',
        type: 'mcq',
        title: 'Scored question',
        raw: {
          _items: [
            {
              text: 'What is 2+2?',
              _options: [
                { text: '4', _isCorrect: true },
                { text: '5', _isCorrect: false },
              ],
            },
          ],
        },
      }),
    ]);

    const plan = mapper.map(course, {
      uniquifyTitle: false,
      skipAssessments: false,
    });

    expect(plan.lessons[0].blocks[0].blockType).toBe('questionnaire');
  });

  it('skips empty articles with reasonCode empty_article and highlights them in stats', () => {
    const course = makeCourse([]);
    // Empty components array already — article has a block with no components
    course.pages[0].lessons[0].blocks[0].components = [];

    const plan = mapper.map(course, { uniquifyTitle: false });

    expect(plan.lessons).toHaveLength(0);
    expect(plan.stats.emptyArticleCount).toBe(1);
    expect(plan.report[0]).toMatchObject({
      status: 'skipped',
      reasonCode: 'empty_article',
      sourceType: 'article',
    });
    expect(plan.report[0].message).toMatch(/Empty article/i);
  });

  it('skips lessons under a Competency Assessment page', () => {
    const course: Course = {
      id: 'course',
      title: 'AccuBio',
      publisher: Publisher.EVOLVE,
      pages: [
        {
          id: 'assess-page',
          parentId: 'course',
          title: 'COMPETENCY ASSESSMENT',
          displayTitle: 'COMPETENCY ASSESSMENT',
          type: 'page',
          lessons: [
            {
              id: 'q-10',
              parentId: 'assess-page',
              title: 'Question 10',
              blocks: [
                {
                  id: 'b-q',
                  parentId: 'q-10',
                  title: 'Block',
                  components: [
                    makeComponent({
                      id: 'c-text',
                      type: 'text',
                      title: 'Stem',
                      body: '<p>Question stem</p>',
                      raw: { title: 'Stem', body: '<p>Question stem</p>' },
                    }),
                  ],
                  raw: {},
                },
              ],
              raw: {},
            },
          ],
          childPages: [],
          raw: {},
        },
      ],
      lessons: [],
      blocks: [],
      components: [],
      assets: [],
      raw: {},
      contentRoot: 'course',
    };

    const plan = mapper.map(course, { uniquifyTitle: false });

    expect(plan.lessons).toHaveLength(0);
    expect(
      plan.report.some(
        (r) =>
          r.sourceComponentId === 'q-10' &&
          r.status === 'skipped' &&
          r.reasonCode === 'assessment_page' &&
          /assessment page/i.test(r.message)
      )
    ).toBe(true);
  });

  it('maps tabs items to tab panels', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-tabs',
        type: 'tabs',
        title: 'Topics',
        raw: {
          _items: [
            { title: 'One', body: 'First tab' },
            { title: 'Two', body: 'Second tab' },
          ],
        },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });
    const block = plan.lessons[0].blocks[0];

    expect(block.blockType).toBe('tabs');
    expect(block.formPayload.panels).toHaveLength(2);
    expect((block.formPayload.panels as { title: string }[])[0].title).toBe('One');
  });

  it('maps flowChart items to flowchart nodes', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-flow',
        type: 'flowChart',
        title: 'Process',
        raw: {
          _items: [
            { title: 'Start', body: 'Begin here' },
            { title: 'Decide?', body: 'Choose a path' },
            { title: 'Finish', body: 'Done' },
          ],
        },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });
    const block = plan.lessons[0].blocks[0];

    expect(block.blockType).toBe('flowchart');
    expect(block.formPayload.nodes).toHaveLength(3);
    const nodes = block.formPayload.nodes as { title: string; variant: string }[];
    expect(nodes[0].variant).toBe('start');
    expect(nodes[1].variant).toBe('decision');
    expect(nodes[2].variant).toBe('end');
  });

  it('maps ordering items in source order', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-ord',
        type: 'ordering',
        title: 'Sequence',
        body: 'Put these in order',
        raw: {
          instruction: 'Arrange the steps',
          _items: [{ text: 'Prepare' }, { text: 'Act' }, { text: 'Review' }],
          _feedback: { correct: 'Well done', incorrect: 'Try again' },
        },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });
    const block = plan.lessons[0].blocks[0];

    expect(block.blockType).toBe('ordering');
    expect(block.formPayload.items).toEqual([
      { text: 'Prepare' },
      { text: 'Act' },
      { text: 'Review' },
    ]);
    expect(block.formPayload.correctFeedback).toBe('Well done');
  });
});
