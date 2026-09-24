import { describe, expect, it } from 'vitest';
import { EvolveToLmsboxMapper } from '../src/mappers/EvolveToLmsboxMapper';
import type { Course } from '../src/models/Course';
import type { Component } from '../src/models/Component';
import type { Lesson } from '../src/models/Lesson';
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

function makeArticle(
  id: string,
  title: string,
  components: Component[]
): Lesson {
  return {
    id,
    parentId: 'co-1',
    title,
    displayTitle: title,
    blocks: [
      {
        id: `b-${id}`,
        parentId: id,
        title: 'Block',
        components,
        raw: {},
      },
    ],
    raw: {},
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

  it('keeps all mapped blocks on one lesson when they exceed the old 5-block cap', () => {
    const components = Array.from({ length: 7 }, (_, i) =>
      makeComponent({
        id: `c-${i}`,
        type: 'text',
        title: `Part ${i}`,
        body: `<p>Body ${i}</p>`,
        raw: { title: `Part ${i}`, body: `<p>Body ${i}</p>` },
      })
    );

    const plan = mapper.map(makeCourse(components), { uniquifyTitle: false });

    expect(plan.lessons).toHaveLength(1);
    expect(plan.lessons[0].blocks).toHaveLength(7);
    expect(plan.lessons[0].title).toBe('Introduction');
    expect(plan.lessons[0].title).not.toMatch(/part \d/i);
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

  it('queues a popup image for each hotspot pin', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-h',
        type: 'hotgraphic',
        title: 'Device',
        raw: {
          _graphic: { src: 'course/assets/device.png', alt: 'Device' },
          _items: [
            {
              title: 'Cap',
              body: 'Remove the cap',
              _top: 20,
              _left: 30,
              _graphic: { src: 'course/assets/cap.png', alt: 'Cap' },
            },
          ],
        },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });
    const block = plan.lessons[0].blocks[0];

    expect(block.mediaAssets.map((asset) => asset.targetField)).toEqual([
      'imageUrl',
      'pins.0.imageUrl',
    ]);
    expect(block.mediaAssets.map((asset) => asset.sourcePath)).toEqual([
      'course/assets/device.png',
      'course/assets/cap.png',
    ]);
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

  it('assigns leftover package images to graphics with empty _graphic', () => {
    const graphic = makeComponent({
      id: 'c-g',
      type: 'graphic',
      title: 'Graphic Title',
      raw: { title: 'Graphic Title', _graphic: { alt: '', attribution: '' } },
    });
    const course = makeCourse([graphic]);
    course.assets = [
      {
        id: 'asset:course/en/assets/kit.png',
        filename: 'kit.png',
        path: 'course/en/assets/kit.png',
        mediaType: 'image/png',
        exists: true,
      },
    ];

    const plan = mapper.map(course, { uniquifyTitle: false });
    expect(plan.lessons[0].blocks[0].mediaAssets[0].sourcePath).toBe(
      'course/en/assets/kit.png'
    );
    expect(plan.report[0].message).toMatch(/queued for media attach/i);
  });

  it('resolves Evolve Asset:image ObjectIds against package filenames', () => {
    const assetId = '5f8a1b2c3d4e5f6a7b8c9d0e';
    const graphic = makeComponent({
      id: 'c-g',
      type: 'graphic',
      title: 'Graphic Title',
      raw: {
        title: 'Graphic Title',
        _graphic: { src: assetId, alt: 'Kit' },
      },
    });
    const course = makeCourse([graphic]);
    course.assets = [
      {
        id: `asset:course/en/assets/${assetId}.png`,
        filename: `${assetId}.png`,
        path: `course/en/assets/${assetId}.png`,
        mediaType: 'image/png',
        exists: true,
      },
    ];

    const plan = mapper.map(course, { uniquifyTitle: false });
    expect(plan.lessons[0].blocks[0].mediaAssets[0].sourcePath).toBe(
      `course/en/assets/${assetId}.png`
    );
  });

  it('decodes HTML entities in mapped titles', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-t',
        type: 'text',
        title: "What&rsquo;s next?",
        raw: { title: "What&rsquo;s next? &nbsp;", body: '<p>Hi</p>' },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });
    expect(plan.lessons[0].blocks[0].title).toMatch(/What’s next/i);
  });

  it('maps in-page mcq knowledge checks to questionnaire blocks', () => {
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

    expect(plan.lessons).toHaveLength(1);
    expect(plan.lessons[0].blocks[0].blockType).toBe('questionnaire');
    expect(plan.report.some((r) => r.sourceType === 'mcq' && r.status === 'mapped')).toBe(
      true
    );
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

  it('skips assessmentResults components (score / pass-fail display)', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-results',
        type: 'assessmentResults',
        title: 'Your score',
        raw: { title: 'Your score' },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });

    expect(plan.lessons).toHaveLength(0);
    expect(
      plan.report.some(
        (r) =>
          r.sourceType === 'assessmentresults' &&
          r.status === 'skipped' &&
          r.reasonCode === 'assessment_component'
      )
    ).toBe(true);
    expect(plan.report[0].message).toMatch(/pass-fail|LMSBox Quiz/i);
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

  it('maps page knowledge checks and mini quizzes instead of skipping them', () => {
    const mcq = (id: string, question: string): ReturnType<typeof makeComponent> =>
      makeComponent({
        id,
        type: 'mcq',
        title: question,
        raw: {
          title: question,
          _items: [
            {
              text: question,
              _options: [
                { text: 'Yes', _isCorrect: true },
                { text: 'No', _isCorrect: false },
              ],
            },
          ],
        },
      });

    const course: Course = {
      id: 'course',
      title: 'AccuBio',
      displayTitle: 'AccuBio',
      publisher: Publisher.EVOLVE,
      pages: [
        {
          id: 'co-features',
          parentId: 'course',
          title: 'KEY PRODUCT FEATURES',
          displayTitle: 'KEY PRODUCT FEATURES',
          type: 'page',
          lessons: [
            makeArticle('a-check', 'Knowledge check', [
              makeComponent({
                id: 'c-intro',
                type: 'text',
                title: 'Check your understanding',
                body: '<p>Answer the questions below.</p>',
                raw: {
                  title: 'Check your understanding',
                  body: '<p>Answer the questions below.</p>',
                },
              }),
            ]),
            makeArticle('a-q1', 'Mini quiz - Question 1', [mcq('c-q1', 'Question 1')]),
            makeArticle('a-q2', 'Mini quiz - Question 2', [mcq('c-q2', 'Question 2')]),
            makeArticle('a-q3', 'Mini quiz - Question 3', [mcq('c-q3', 'Question 3')]),
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

    expect(plan.lessons).toHaveLength(1);
    expect(plan.lessons[0].title).toBe('KEY PRODUCT FEATURES');
    expect(plan.lessons[0].blocks.map((block) => block.blockType)).toEqual([
      'text',
      'questionnaire',
      'questionnaire',
      'questionnaire',
    ]);
    expect(
      plan.report.some(
        (item) =>
          item.sourceTitle === 'Knowledge check' &&
          item.status === 'skipped' &&
          (item.reasonCode === 'assessment_article' || item.reasonCode === 'assessment_page')
      )
    ).toBe(false);
    expect(plan.stats.assessmentSkippedCount).toBe(0);
  });

  it('still maps a knowledge check article when Evolve flags it as _assessment', () => {
    const article = makeArticle('a-check', 'Knowledge check', [
      makeComponent({
        id: 'c-q',
        type: 'mcq',
        title: 'A question',
        raw: {
          title: 'A question',
          _assessment: true,
          _items: [
            {
              text: 'A question',
              _options: [
                { text: 'A', _isCorrect: true },
                { text: 'B', _isCorrect: false },
              ],
            },
          ],
        },
      }),
    ]);
    article.raw = { _assessment: true, title: 'Knowledge check' };

    const course: Course = {
      id: 'course',
      title: 'AccuBio',
      publisher: Publisher.EVOLVE,
      pages: [
        {
          id: 'co-features',
          parentId: 'course',
          title: 'KEY PRODUCT FEATURES',
          displayTitle: 'KEY PRODUCT FEATURES',
          type: 'page',
          lessons: [article],
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

    expect(plan.lessons).toHaveLength(1);
    expect(plan.lessons[0].blocks[0].blockType).toBe('questionnaire');
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

  it('links flowchart stage images stored as per-device asset ids', () => {
    const assetId = '5f8a1b2c3d4e5f6a7b8c9d0e';
    const course = makeCourse([
      makeComponent({
        id: 'c-flow',
        type: 'flowChart',
        title: 'HIV progression',
        raw: {
          _items: [
            {
              body: '<p>Why are CD4+ T cell counts important?</p>',
              _graphic: {
                alt: 'HIV Progression',
                _srcAdvanced: {
                  _isEnabled: true,
                  _large: { _id: assetId, _extension: 'png', _type: 'image' },
                },
              },
            },
          ],
        },
      }),
    ]);
    course.assets = [
      {
        id: `asset:course/en/assets/${assetId}/original.png`,
        filename: 'original.png',
        path: `course/en/assets/${assetId}/original.png`,
        mediaType: 'image/png',
        exists: true,
      },
    ];

    const plan = mapper.map(course, { uniquifyTitle: false });
    const block = plan.lessons[0].blocks[0];

    expect(block.mediaAssets[0]).toMatchObject({
      sourcePath: `course/en/assets/${assetId}/original.png`,
      targetField: 'nodes.0.imageUrl',
    });
  });

  it('links an image on each flowChart stage', () => {
    const course = makeCourse([
      makeComponent({
        id: 'c-flow',
        type: 'flowChart',
        title: 'HIV progression',
        raw: {
          instruction: 'Select a stage to read more',
          _items: [
            {
              title: 'Stage 1',
              body: '<p>Why are CD4+ T cell counts important?</p>',
              _graphic: {
                src: 'course/en/assets/hiv-progression.png',
                alt: 'HIV Progression',
              },
            },
            {
              title: 'Stage 2',
              body: '<p>Acute infection <img src="course/en/assets/acute.png" alt="Acute"></p>',
            },
            {
              title: 'Stage 3',
              body: '<p>Chronic</p><div style="background-image:url(course/en/assets/chronic.jpg)"></div>',
            },
          ],
        },
      }),
    ]);

    const plan = mapper.map(course, { uniquifyTitle: false });
    const block = plan.lessons[0].blocks[0];

    expect(block.mediaAssets.map((asset) => asset.targetField)).toEqual([
      'nodes.0.imageUrl',
      'nodes.1.imageUrl',
      'nodes.2.imageUrl',
    ]);
    expect(block.mediaAssets.map((asset) => asset.sourcePath)).toEqual([
      'course/en/assets/hiv-progression.png',
      'course/en/assets/acute.png',
      'course/en/assets/chronic.jpg',
    ]);
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

  it('maps each Evolve page to one LMSBox lesson and articles to blocks', () => {
    const course: Course = {
      id: 'course',
      title: 'Sample Evolve Course',
      displayTitle: 'Sample Evolve Course',
      publisher: Publisher.EVOLVE,
      pages: [
        {
          id: 'co-welcome',
          parentId: 'course',
          title: 'WELCOME AND INTRODUCTION',
          displayTitle: 'WELCOME AND INTRODUCTION',
          type: 'page',
          lessons: [
            makeArticle('a-overview', 'VISITECT overview', [
              makeComponent({
                id: 'c-ov',
                type: 'text',
                title: 'Overview',
                body: '<p>About the test</p>',
                raw: { title: 'Overview', body: '<p>About the test</p>' },
              }),
            ]),
            makeArticle('a-objectives', 'Learning objectives', [
              makeComponent({
                id: 'c-obj',
                type: 'text',
                title: 'Objectives',
                body: '<p>You will learn</p>',
                raw: { title: 'Objectives', body: '<p>You will learn</p>' },
              }),
            ]),
          ],
          childPages: [],
          raw: {},
        },
        {
          id: 'co-features',
          parentId: 'course',
          title: 'KEY PRODUCT FEATURES',
          displayTitle: 'KEY PRODUCT FEATURES',
          type: 'page',
          lessons: [
            makeArticle('a-feat', 'What are the key features?', [
              makeComponent({
                id: 'c-feat',
                type: 'text',
                title: 'Features',
                body: '<p>Key features</p>',
                raw: { title: 'Features', body: '<p>Key features</p>' },
              }),
            ]),
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

    expect(plan.lessons).toHaveLength(2);
    expect(plan.lessons.map((lesson) => lesson.title)).toEqual([
      'WELCOME AND INTRODUCTION',
      'KEY PRODUCT FEATURES',
    ]);
    expect(plan.lessons[0].sourceLessonId).toBe('co-welcome');
    expect(plan.lessons[0].sourcePageId).toBe('co-welcome');
    expect(plan.lessons[0].blocks).toHaveLength(2);
    expect(plan.lessons[1].blocks).toHaveLength(1);
  });

  it('converts New Article Title page intros into a Hero block', () => {
    const course: Course = {
      id: 'course',
      title: 'AccuBio',
      displayTitle: 'AccuBio',
      publisher: Publisher.EVOLVE,
      pages: [
        {
          id: 'co-welcome',
          parentId: 'course',
          title: 'WELCOME AND INTRODUCTION',
          displayTitle: 'WELCOME AND INTRODUCTION',
          type: 'page',
          lessons: [
            makeArticle('a-intro', 'New Article Title', [
              makeComponent({
                id: 'c-hero-g',
                type: 'graphic',
                title: 'Graphic Title',
                raw: {
                  title: 'Graphic Title',
                  _graphic: 'course/en/assets/5fe06d9366d85155e5700dca/extraLarge.png',
                },
              }),
            ]),
            makeArticle('a-next', "What's next?", [
              makeComponent({
                id: 'c-next',
                type: 'text',
                title: "What's next?",
                body: '<p>Continue to the next section</p>',
                raw: {
                  title: "What's next?",
                  body: '<p>Continue to the next section</p>',
                },
              }),
            ]),
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
    const lesson = plan.lessons[0];

    expect(plan.lessons).toHaveLength(1);
    expect(lesson.title).toBe('WELCOME AND INTRODUCTION');
    expect(lesson.blocks).toHaveLength(2);
    expect(lesson.blocks[0]).toMatchObject({
      blockType: 'hero',
      title: 'WELCOME AND INTRODUCTION',
      sourceType: 'graphic',
    });
    expect(lesson.blocks[0].formPayload).toMatchObject({
      title: 'WELCOME AND INTRODUCTION',
      backgroundImageUrl: '',
    });
    expect(lesson.blocks[0].mediaAssets[0]).toMatchObject({
      sourcePath: 'course/en/assets/5fe06d9366d85155e5700dca/extraLarge.png',
      targetField: 'backgroundImageUrl',
    });
    expect(lesson.blocks[1].blockType).toBe('text');
    expect(plan.report.some((item) => item.targetBlockType === 'hero')).toBe(true);
  });
});
