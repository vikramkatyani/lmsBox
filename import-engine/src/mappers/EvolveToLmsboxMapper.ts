import type { Asset } from '../models/Asset';
import type { Component } from '../models/Component';
import type { Course } from '../models/Course';
import type { Lesson } from '../models/Lesson';
import type { Page } from '../models/Page';
import {
  decodeHtmlEntities,
  expandPackagePath,
  extractImgSrcFromHtml,
  extractMediaPath,
  findFirstMediaString,
  isChromeAsset,
  isImageAsset,
  matchAssetByTitle,
} from '../utils/evolveMedia';
import {
  evolveAssessmentSkipMessage,
  isEvolveAssessmentComponentType,
  isEvolveAssessmentNode,
} from '../config/assessmentSkip';
import type {
  ImportDraftPlan,
  MappedBlock,
  MappedLesson,
  MappingReportItem,
  PendingMediaAttachment,
} from './ImportDraftPlan';

/**
 * LMSBox interactive lesson safety cap — must match InteractiveLessonConstants.MaxBlocksPerLesson.
 * Import no longer splits lessons at this bound; Evolve pages can map to many native blocks.
 */
export const MAX_BLOCKS_PER_LESSON = 100;

const PLACEHOLDER_ARTICLE_TITLES = new Set([
  'new article title',
  'new article',
  'untitled',
]);

const PLACEHOLDER_COMPONENT_TITLES = new Set([
  'graphic title',
  'hot graphic title',
  'new component title',
  'image',
]);

/** Must match InteractiveLessonConstants.QuestionnaireQuestionsPerBlock. Set to 20 when multi-question questionnaires ship. */
const MAX_QUESTIONS_PER_BLOCK = 1;

/**
 * Configuration: Evolve _component → LMSBox blockType.
 * Prefer extending this map over hardcoding inside mapComponent().
 * Scored Evolve assessments (pass/fail / marks) are skipped by default — see skipAssessments.
 * In-page knowledge checks and mini quizzes map to questionnaire blocks.
 */
export const EVOLVE_TO_LMSBOX_BLOCK_TYPE: Record<string, string> = {
  text: 'text',
  blank: 'text',
  narrative: 'text',
  graphic: 'text',
  accordion: 'accordion',
  tabs: 'tabs',
  carousel: 'carousel',
  reveal: 'reveal',
  flipcard: 'flip',
  media: 'video',
  video: 'video',
  audio: 'audio',
  hotspot: 'hotspot',
  hotgraphic: 'hotspot',
  mcq: 'questionnaire',
  gmcq: 'questionnaire',
  flowchart: 'flowchart',
  ordering: 'ordering',
};

export interface MapEvolveOptions {
  /** Override course title */
  titleOverride?: string;
  /** Append timestamp suffix to avoid duplicate title conflicts */
  uniquifyTitle?: boolean;
  /**
   * When true (default), skip Evolve scored assessment pages (marks / pass-fail).
   * In-page knowledge checks are still converted. Use a separate LMSBox Quiz lesson
   * for the final course assessment.
   */
  skipAssessments?: boolean;
}

/**
 * Maps an Evolve Course object model into an LMSBox draft import plan.
 *
 * - Evolve pages (contentObjects) → LMSBox interactive lessons
 * - Evolve lessons (articles) → LMSBox native blocks
 * - "New Article Title" page-intro articles → Hero blocks
 * - Maps Components → Interactive Blocks
 * - Skips Evolve scored assessments by default (skipAssessments); keeps knowledge checks
 * - Does not call LMS APIs or upload assets
 */
export class EvolveToLmsboxMapper {
  private courseAssets: Asset[] = [];
  private leftoverImages: Asset[] = [];

  map(course: Course, options: MapEvolveOptions = {}): ImportDraftPlan {
    this.courseAssets = course.assets ?? [];
    const referenced = new Set(
      (course.components ?? []).flatMap((component) =>
        (component.assets ?? [])
          .filter(isImageAsset)
          .map((asset) => asset.path.toLowerCase())
      )
    );
    this.leftoverImages = this.courseAssets.filter(
      (asset) =>
        isImageAsset(asset) &&
        asset.exists !== false &&
        !referenced.has(asset.path.toLowerCase()) &&
        !isChromeAsset(asset)
    );
    const skipAssessments = options.skipAssessments !== false;
    const report: MappingReportItem[] = [];
    const lessons: MappedLesson[] = [];

    const seenArticleIds = new Set<string>();

    const walkPages = (
      pages: Page[],
      ancestors: string[] = [],
      ancestorIsAssessment = false
    ): void => {
      for (const page of pages) {
        const pageIsAssessment =
          skipAssessments &&
          (ancestorIsAssessment || isEvolveAssessmentNode(page));

        if (page.type === 'menu' || page.childPages.length > 0) {
          walkPages(
            page.childPages,
            [...ancestors, page.displayTitle || page.title],
            pageIsAssessment
          );
        }

        const pageLabel = page.displayTitle || page.title;
        const prefixParts = [...ancestors, pageLabel].filter(Boolean);

        for (const article of page.lessons) {
          seenArticleIds.add(article.id);
        }

        if (pageIsAssessment) {
          const pagePath = prefixParts.join(' › ');
          for (const article of page.lessons) {
            report.push({
              sourceComponentId: article.id,
              sourceType: 'article',
              sourceTitle: article.displayTitle || article.title || article.id,
              status: 'skipped',
              reasonCode: 'assessment_page',
              pagePath,
              message: `${evolveAssessmentSkipMessage()} (assessment page/section).`,
            });
          }
          if (page.lessons.length === 0) {
            report.push({
              sourceComponentId: page.id,
              sourceType: 'page',
              sourceTitle: pageLabel,
              status: 'skipped',
              reasonCode: 'assessment_page',
              pagePath,
              message: `${evolveAssessmentSkipMessage()} (assessment page/section).`,
            });
          }
          continue;
        }

        const mappedPage = this.mapPage(
          page,
          prefixParts,
          report,
          skipAssessments
        );
        if (mappedPage) {
          lessons.push(mappedPage);
        }
      }
    };

    walkPages(course.pages);

    // Orphan articles not attached to a walked page (safety net) — one lesson each
    const reportedIds = new Set(report.map((r) => r.sourceComponentId));
    for (const article of course.lessons) {
      if (seenArticleIds.has(article.id) || reportedIds.has(article.id)) continue;
      const orphanPage = this.mapOrphanArticle(article, report, skipAssessments);
      if (orphanPage) {
        lessons.push(orphanPage);
      }
    }

    // Stamp stable 1-based presentation order for LMSBox ordinals
    lessons.forEach((lesson, lessonIndex) => {
      lesson.sourceOrder = lessonIndex + 1;
      lesson.blocks.forEach((block, blockIndex) => {
        block.sourceOrder = blockIndex + 1;
      });
    });

    const mappedCount = report.filter((r) => r.status === 'mapped').length;
    const skippedCount = report.filter((r) => r.status === 'skipped').length;
    const stubbedCount = report.filter((r) => r.status === 'stubbed').length;
    const emptyArticleCount = report.filter(
      (r) => r.reasonCode === 'empty_article'
    ).length;
    const assessmentSkippedCount = report.filter((r) =>
      r.reasonCode === 'assessment_page' ||
      r.reasonCode === 'assessment_article' ||
      r.reasonCode === 'assessment_component'
    ).length;
    const unsupportedSkippedCount = report.filter(
      (r) => r.reasonCode === 'unsupported_type' || r.reasonCode === 'map_failed'
    ).length;
    const blockCount = lessons.reduce((n, l) => n + l.blocks.length, 0);
    const pendingMediaCount = lessons.reduce(
      (n, l) => n + l.blocks.reduce((bn, b) => bn + (b.mediaAssets?.length ?? 0), 0),
      0
    );

    let title =
      options.titleOverride?.trim() ||
      course.displayTitle?.trim() ||
      course.title?.trim() ||
      'Imported Evolve Course';

    if (options.uniquifyTitle !== false) {
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      title = `${title} (Import ${stamp})`;
    }

    const description = course.description || course.body || undefined;

    return {
      title,
      description,
      shortDescription: description
        ? truncate(stripHtml(description), 240)
        : undefined,
      tags: ['evolve', 'import'],
      requireSequentialLessons: true,
      showLessonNavigation: true,
      lessons,
      report,
      stats: {
        pageCount: countPages(course.pages),
        lessonCount: lessons.length,
        blockCount,
        mappedCount,
        skippedCount,
        stubbedCount,
        pendingMediaCount,
        emptyArticleCount,
        assessmentSkippedCount,
        unsupportedSkippedCount,
      },
    };
  }

  private mapPage(
    page: Page,
    titleParts: string[],
    report: MappingReportItem[],
    skipAssessments = true
  ): MappedLesson | null {
    if (page.lessons.length === 0) {
      return null;
    }

    const pageTitle = page.displayTitle || page.title || page.id;
    const pagePath = titleParts.join(' › ') || pageTitle;
    const blocks: MappedBlock[] = [];

    page.lessons.forEach((article) => {
      blocks.push(
        ...this.mapArticleToBlocks(
          article,
          {
            pageTitle,
            pagePath,
            isIntro: isPageIntroductionArticle(article),
            skipAssessments,
          },
          report
        )
      );
    });

    if (blocks.length === 0) {
      return null;
    }

    return {
      title: pagePath,
      description: page.description || page.body || undefined,
      sourcePageId: page.id,
      sourceLessonId: page.id,
      blocks,
    };
  }

  private mapOrphanArticle(
    article: Lesson,
    report: MappingReportItem[],
    skipAssessments = true
  ): MappedLesson | null {
    const title = article.displayTitle || article.title || article.id;
    const blocks = this.mapArticleToBlocks(
      article,
      {
        pageTitle: title,
        pagePath: undefined,
        isIntro: isPageIntroductionArticle(article),
        skipAssessments,
      },
      report
    );
    if (blocks.length === 0) return null;
    return {
      title,
      description: article.description || article.body || undefined,
      sourceLessonId: article.id,
      blocks,
    };
  }

  private mapArticleToBlocks(
    article: Lesson,
    options: {
      pageTitle: string;
      pagePath?: string;
      isIntro: boolean;
      skipAssessments: boolean;
    },
    report: MappingReportItem[]
  ): MappedBlock[] {
    const articleTitle = article.displayTitle || article.title || article.id;

    if (options.skipAssessments && isEvolveAssessmentNode(article)) {
      report.push({
        sourceComponentId: article.id,
        sourceType: 'article',
        sourceTitle: articleTitle,
        status: 'skipped',
        reasonCode: 'assessment_article',
        pagePath: options.pagePath,
        message: `${evolveAssessmentSkipMessage()} (assessment article).`,
      });
      return [];
    }

    const components = article.blocks.flatMap((block) => block.components);
    const consumedIds = new Set<string>();
    const blocks: MappedBlock[] = [];

    if (options.isIntro) {
      const hero = this.mapIntroArticleToHero(
        article,
        components,
        options.pageTitle,
        options.pagePath,
        report
      );
      if (hero) {
        blocks.push(hero.block);
        hero.consumedComponentIds.forEach((id) => consumedIds.add(id));
      }
    }

    const unmapped = components.filter((component) => !consumedIds.has(component.id));

    let assessmentComponentSkips = 0;
    const companionsByQuestion = pairQuestionCompanions(unmapped);
    const componentById = new Map(unmapped.map((component) => [component.id, component]));
    const questionById = componentById;
    const companionOwnerId = new Map<string, string>();
    for (const [questionId, companions] of companionsByQuestion) {
      for (const companion of companions) {
        companionOwnerId.set(companion.id, questionId);
      }
    }
    const emittedQuestionIds = new Set<string>();
    const textCompanions = pairTextWithGraphics(
      unmapped.filter(
        (component) =>
          !companionOwnerId.has(component.id) && !companionsByQuestion.has(component.id)
      )
    );
    const textCompanionOwner = new Map<string, string>();
    for (const [textId, companions] of textCompanions) {
      for (const companion of companions) {
        textCompanionOwner.set(companion.id, textId);
      }
    }
    const emittedTextIds = new Set<string>();

    const emitTextWithGraphics = (text: Component): void => {
      if (emittedTextIds.has(text.id)) return;
      emittedTextIds.add(text.id);
      const mapped = this.mapComponent(
        text,
        report,
        options.skipAssessments,
        textCompanions.get(text.id) ?? []
      );
      if (mapped) blocks.push(mapped);
    };

    const emitQuestion = (question: Component): void => {
      if (emittedQuestionIds.has(question.id)) return;
      emittedQuestionIds.add(question.id);
      const before = report.length;
      const mapped = this.mapComponent(
        question,
        report,
        options.skipAssessments,
        companionsByQuestion.get(question.id) ?? []
      );
      if (mapped) {
        blocks.push(mapped);
      } else if (
        report[report.length - 1]?.reasonCode === 'assessment_component' &&
        report.length > before
      ) {
        assessmentComponentSkips += 1;
      }
    };

    for (const component of unmapped) {
      const textOwnerId = textCompanionOwner.get(component.id);
      if (textOwnerId) {
        const owner = componentById.get(textOwnerId);
        if (owner) emitTextWithGraphics(owner);
        const sourceType = (component.type || 'unknown').toLowerCase();
        report.push({
          sourceComponentId: component.id,
          sourceType,
          sourceTitle: resolveHumanTitle(component, component.raw ?? {}, sourceType),
          status: 'mapped',
          targetBlockType: 'text',
          message: isGraphicType(sourceType)
            ? 'Included in the text block as its image.'
            : 'Included in the text block.',
        });
        continue;
      }

      if (textCompanions.has(component.id)) {
        emitTextWithGraphics(component);
        continue;
      }

      const ownerId = companionOwnerId.get(component.id);
      if (ownerId) {
        const owner = questionById.get(ownerId);
        if (owner) emitQuestion(owner);
        const sourceType = (component.type || 'unknown').toLowerCase();
        report.push({
          sourceComponentId: component.id,
          sourceType,
          sourceTitle: resolveHumanTitle(component, component.raw ?? {}, sourceType),
          status: 'mapped',
          targetBlockType: 'questionnaire',
          message: 'Included with the questionnaire as question text or image.',
        });
        continue;
      }

      if (companionsByQuestion.has(component.id)) {
        emitQuestion(component);
        continue;
      }

      const before = report.length;
      const mapped = this.mapComponent(
        component,
        report,
        options.skipAssessments
      );
      if (mapped) {
        blocks.push(mapped);
      } else if (
        report[report.length - 1]?.reasonCode === 'assessment_component' &&
        report.length > before
      ) {
        assessmentComponentSkips += 1;
      }
    }

    if (blocks.length === 0) {
      const isTrulyEmpty = components.length === 0;
      const onlyAssessments =
        !isTrulyEmpty && assessmentComponentSkips === components.length;
      report.push({
        sourceComponentId: article.id,
        sourceType: 'article',
        sourceTitle: articleTitle,
        status: 'skipped',
        reasonCode: 'empty_article',
        pagePath: options.pagePath,
        message: isTrulyEmpty
          ? `Empty article — no components in Evolve package. Not converted to an LMSBox block.${options.pagePath ? ` (under ${options.pagePath})` : ''}`
          : onlyAssessments
            ? `Article had only assessment components (excluded). Not converted to an LMSBox block.${options.pagePath ? ` (under ${options.pagePath})` : ''}`
            : `Article has no mappable learning components. Not converted to an LMSBox block.${options.pagePath ? ` (under ${options.pagePath})` : ''}`,
      });
      return [];
    }

    return blocks;
  }

  private mapIntroArticleToHero(
    article: Lesson,
    components: Component[],
    pageTitle: string,
    pagePath: string | undefined,
    report: MappingReportItem[]
  ): { block: MappedBlock; consumedComponentIds: string[] } | null {
    const graphic = components.find(
      (component) => (component.type || '').toLowerCase() === 'graphic'
    );
    const textComponents = components.filter((component) => {
      const type = (component.type || '').toLowerCase();
      return type === 'text' || type === 'blank' || type === 'narrative';
    });
    const consumedComponentIds = [
      ...(graphic ? [graphic.id] : []),
      ...textComponents.map((component) => component.id),
    ];

    const raw = graphic?.raw ?? article.raw ?? {};
    const mediaAssets: PendingMediaAttachment[] = [];
    let backgroundImageUrl = '';
    let status: 'mapped' | 'stubbed' = 'mapped';
    let message = `Mapped page introduction → hero${pagePath ? ` (${pagePath})` : ''}.`;

    if (graphic) {
      const src = this.resolveImageSource(raw, graphic);
      const alt = resolveEvolveGraphicAlt(raw);
      if (src && isAbsoluteUrl(src)) {
        backgroundImageUrl = src;
        message = `Mapped page introduction graphic with absolute image URL → hero.`;
      } else if (src) {
        mediaAssets.push(makePendingMedia(src, 'backgroundImageUrl', alt || pageTitle));
        status = 'stubbed';
        message = `Page introduction graphic queued for hero background (${src}).`;
      } else {
        status = 'stubbed';
        message = 'Page introduction mapped to hero without an image asset.';
      }
    }

    const introParts = [
      stripHtml(article.body || article.description || ''),
      ...textComponents.map((component) => {
        const componentRaw = component.raw ?? {};
        return (
          stripHtml(asString(componentRaw.body) || component.body || '') ||
          stripHtml(asString(componentRaw.content) || '')
        );
      }),
      graphic ? resolveEvolveGraphicAlt(raw) : '',
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !isPlaceholderComponentTitle(part));

    const uniqueIntro = [...new Set(introParts)];
    const intro = truncate(uniqueIntro.join(' '), 500);
    const heroTitle = truncate(pageTitle, 200) || 'Introduction';

    report.push({
      sourceComponentId: graphic?.id || article.id,
      sourceType: graphic ? 'graphic' : 'article',
      sourceTitle: heroTitle,
      status,
      targetBlockType: 'hero',
      pagePath,
      message,
    });

    return {
      block: {
        title: heroTitle,
        blockType: 'hero',
        formPayload: {
          kicker: '',
          title: heroTitle,
          intro,
          metaPills: [],
          backgroundImageUrl,
        },
        mediaAssets,
        sourceComponentId: graphic?.id || article.id,
        sourceType: graphic ? 'graphic' : 'article',
      },
      consumedComponentIds,
    };
  }

  private mapComponent(
    component: Component,
    report: MappingReportItem[],
    skipAssessments = true,
    companions: Component[] = []
  ): MappedBlock | null {
    const sourceType = (component.type || 'unknown').toLowerCase();
    let title = resolveHumanTitle(component, component.raw ?? {}, sourceType);
    if (companions.length > 0 && isGenericQuestionTitle(title)) {
      const companionTitle = companions
        .map((companion) =>
          resolveHumanTitle(companion, companion.raw ?? {}, (companion.type || '').toLowerCase())
        )
        .find((value) => value && !isGenericQuestionTitle(value));
      if (companionTitle) title = companionTitle;
    }

    if (skipAssessments && isEvolveAssessmentComponentType(sourceType)) {
      report.push({
        sourceComponentId: component.id,
        sourceType,
        sourceTitle: title,
        status: 'skipped',
        reasonCode: 'assessment_component',
        message: evolveAssessmentSkipMessage(),
      });
      return null;
    }

    const targetType = EVOLVE_TO_LMSBOX_BLOCK_TYPE[sourceType];

    if (!targetType) {
      report.push({
        sourceComponentId: component.id,
        sourceType,
        sourceTitle: title,
        status: 'skipped',
        reasonCode: 'unsupported_type',
        message: `Unknown / unsupported Evolve component type "${sourceType}".`,
      });
      return null;
    }

    try {
      const { formPayload, status, message, mediaAssets } = this.buildPayload(
        sourceType,
        targetType,
        component,
        companions
      );

      report.push({
        sourceComponentId: component.id,
        sourceType,
        sourceTitle: title,
        status,
        targetBlockType: targetType,
        message,
      });

      return {
        title: truncate(title, 200) || targetType,
        blockType: targetType,
        formPayload,
        mediaAssets,
        sourceComponentId: component.id,
        sourceType,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      report.push({
        sourceComponentId: component.id,
        sourceType,
        sourceTitle: title,
        status: 'skipped',
        reasonCode: 'map_failed',
        message: `Failed to map: ${msg}`,
      });
      return null;
    }
  }

  private buildPayload(
    sourceType: string,
    targetType: string,
    component: Component,
    companions: Component[] = []
  ): {
    formPayload: Record<string, unknown>;
    status: 'mapped' | 'stubbed';
    message: string;
    mediaAssets: PendingMediaAttachment[];
  } {
    const raw = component.raw ?? {};

    switch (targetType) {
      case 'text':
        return this.mapToText(sourceType, component, raw, companions);
      case 'accordion':
        return this.mapToAccordion(component, raw);
      case 'carousel':
        return this.mapToCarousel(component, raw);
      case 'reveal':
        return this.mapToReveal(component, raw);
      case 'flip':
        return this.mapToFlip(component, raw);
      case 'video':
        return this.mapToVideo(component, raw);
      case 'audio':
        return this.mapToAudio(component, raw);
      case 'hotspot':
        return this.mapToHotspot(component, raw);
      case 'questionnaire':
        return this.mapToQuestionnaire(component, raw, companions);
      case 'tabs':
        return this.mapToTabs(component, raw);
      case 'flowchart':
        return this.mapToFlowchart(component, raw);
      case 'ordering':
        return this.mapToOrdering(component, raw);
      default:
        throw new Error(`No payload builder for target type "${targetType}"`);
    }
  }

  private mapToText(
    sourceType: string,
    component: Component,
    raw: Record<string, unknown>,
    companions: Component[] = []
  ): {
    formPayload: Record<string, unknown>;
    status: 'mapped' | 'stubbed';
    message: string;
    mediaAssets: PendingMediaAttachment[];
  } {
    const heading = resolveHumanTitle(component, raw, sourceType);
    let bodyHtml =
      asString(raw.body) ||
      component.body ||
      asString(raw.content) ||
      '';
    let body = stripHtml(bodyHtml);
    let status: 'mapped' | 'stubbed' = 'mapped';
    let message = `Mapped ${sourceType} → text.`;
    const mediaAssets: PendingMediaAttachment[] = [];
    let imageUrl = '';
    let imageAlt = '';
    let imagePlacement = '';

    for (const extra of companions.filter((item) => isPlainTextType(item.type))) {
      const extraRaw = extra.raw ?? {};
      const extraHtml =
        asString(extraRaw.body) || extra.body || asString(extraRaw.content) || '';
      if (stripHtml(extraHtml)) bodyHtml = `${bodyHtml}${extraHtml}`;
    }
    body = stripHtml(bodyHtml);

    const graphic =
      sourceType === 'graphic'
        ? component
        : companions.find((item) => isGraphicType(item.type));
    if (graphic) {
      const graphicRaw = graphic.raw ?? {};
      const src = this.resolveImageSource(graphicRaw, graphic);
      const alt = usableImageAlt(
        resolveEvolveGraphicAlt(graphicRaw),
        sourceType === 'graphic' ? heading : ''
      );
      imageAlt = truncate(alt, 300);
      if (sourceType !== 'graphic') imagePlacement = 'below';
      if (src && isAbsoluteUrl(src)) {
        imageUrl = src;
        message =
          sourceType === 'graphic'
            ? 'Mapped graphic with absolute image URL → text.'
            : 'Mapped text with the graphic from the same Evolve block.';
      } else if (src) {
        mediaAssets.push(makePendingMedia(src, 'imageUrl', alt));
        if (sourceType === 'graphic' && !bodyHtml.trim()) {
          bodyHtml = `<p><em>Image will attach from Evolve package: ${escapeHtml(src)}</em></p>`;
          body = stripHtml(bodyHtml);
        }
        status = 'stubbed';
        message =
          sourceType === 'graphic'
            ? `Graphic queued for media attach (${src}).`
            : `Text and graphic combined; image queued for media attach (${src}).`;
      } else if (sourceType === 'graphic') {
        bodyHtml =
          bodyHtml || `<p><em>Graphic component imported without image asset.</em></p>`;
        body = stripHtml(bodyHtml);
        status = 'stubbed';
        message = 'Graphic had no image source.';
      } else {
        status = 'stubbed';
        message = 'Text and graphic combined, but the graphic had no image source.';
      }
    }

    if (!bodyHtml.trim() && !body.trim() && !imageUrl) {
      body = heading || 'Imported content';
      bodyHtml = `<p>${escapeHtml(body)}</p>`;
    }

    return {
      formPayload: {
        heading: truncate(heading, 200),
        subheading: '',
        bodyHtml,
        body: truncate(body, 10000),
        ...(graphic ? { imageUrl, imageAlt, ...(imagePlacement ? { imagePlacement } : {}) } : {}),
        showContinueButton: true,
      },
      status,
      message,
      mediaAssets,
    };
  }

  private mapToAccordion(
    component: Component,
    raw: Record<string, unknown>
  ): {
    formPayload: Record<string, unknown>;
    status: 'mapped' | 'stubbed';
    message: string;
    mediaAssets: PendingMediaAttachment[];
  } {
    const items = asArray(raw._items ?? raw.items);
    const panels = items
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const resolved = resolveItemHeading(row, index, 'Panel');
        return {
          title: truncate(resolved.title, 200),
          body: resolved.bodyText || resolved.title,
        };
      })
      .filter((p): p is { title: string; body: string } => !!p);

    if (panels.length === 0) {
      panels.push({
        title: component.title || 'Item',
        body: stripHtml(component.body || '') || 'Imported accordion item.',
      });
    }

    return {
      formPayload: {
        contentDescription:
          stripHtml(component.body || '') ||
          `Imported accordion: ${component.title || component.id}`,
        panels: panels.slice(0, 10),
      },
      status: 'mapped',
      message: `Mapped accordion with ${panels.length} panel(s).`,
      mediaAssets: [],
    };
  }

  private mapToCarousel(
    component: Component,
    raw: Record<string, unknown>
  ): {
    formPayload: Record<string, unknown>;
    status: 'mapped' | 'stubbed';
    message: string;
    mediaAssets: PendingMediaAttachment[];
  } {
    const items = asArray(raw._items ?? raw.items ?? raw._slides);
    const mediaAssets: PendingMediaAttachment[] = [];
    const slides = items
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const resolved = resolveItemHeading(row, index, 'Slide');
        const title = resolved.title;
        const body = resolved.bodyText || title;
        const imageSrc = resolveEvolveGraphicSrc(row, component, this.courseAssets, {
          allowAssetFallback: false,
        });
        let imageUrl = '';
        if (imageSrc && isAbsoluteUrl(imageSrc)) {
          imageUrl = imageSrc;
        } else if (imageSrc) {
          mediaAssets.push(makePendingMedia(imageSrc, `slides.${index}.imageUrl`));
        }
        return { title: truncate(title, 200), body, imageUrl };
      })
      .filter((s): s is { title: string; body: string; imageUrl: string } => !!s);

    if (slides.length === 0) {
      slides.push({
        title: component.title || 'Slide',
        body: stripHtml(component.body || '') || 'Imported slide.',
        imageUrl: '',
      });
    }

    return {
      formPayload: {
        contentDescription:
          stripHtml(component.body || '') ||
          `Imported carousel: ${component.title || component.id}`,
        slides: slides.slice(0, 10),
      },
      status: mediaAssets.length > 0 ? 'stubbed' : 'mapped',
      message:
        mediaAssets.length > 0
          ? `Mapped carousel; ${mediaAssets.length} slide image(s) queued for attach.`
          : `Mapped carousel with ${slides.length} slide(s).`,
      mediaAssets,
    };
  }

  private mapToReveal(
    component: Component,
    raw: Record<string, unknown>
  ): {
    formPayload: Record<string, unknown>;
    status: 'mapped' | 'stubbed';
    message: string;
    mediaAssets: PendingMediaAttachment[];
  } {
    const items = asArray(raw._items ?? raw.items);
    const revealItems = items
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const resolved = resolveItemHeading(row, index, 'Item');
        const title = resolved.title;
        const body = resolved.bodyText || title;
        return {
          label: asString(row.label) || 'Click to reveal',
          title: truncate(title, 200),
          body,
          variant: 'default',
        };
      })
      .filter(Boolean);

    if (revealItems.length === 0) {
      revealItems.push({
        label: 'Click to reveal',
        title: component.title || 'Reveal',
        body: stripHtml(component.body || '') || 'Imported reveal content.',
        variant: 'default',
      });
    }

    return {
      formPayload: {
        hint: 'Select each card to reveal the answer.',
        items: revealItems.slice(0, 8),
      },
      status: 'mapped',
      message: `Mapped reveal with ${revealItems.length} item(s).`,
      mediaAssets: [],
    };
  }

  private mapToFlip(
    component: Component,
    raw: Record<string, unknown>
  ): {
    formPayload: Record<string, unknown>;
    status: 'mapped' | 'stubbed';
    message: string;
    mediaAssets: PendingMediaAttachment[];
  } {
    const items = asArray(raw._items ?? raw.items);
    const cards = items
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const frontTitle =
          asString(row.frontTitle) ||
          asString(row.title) ||
          `Card ${index + 1}`;
        const backBody =
          stripHtml(
            asString(row.backBody) ||
              asString(row.body) ||
              asString(row.back)
          ) || frontTitle;
        return {
          frontTitle: truncate(frontTitle, 200),
          frontHint: 'Tap to flip',
          backBody,
          backHint: 'Tap to flip back',
        };
      })
      .filter(Boolean);

    if (cards.length === 0) {
      cards.push({
        frontTitle: component.title || 'Card',
        frontHint: 'Tap to flip',
        backBody: stripHtml(component.body || '') || 'Imported flip card.',
        backHint: 'Tap to flip back',
      });
    }

    return {
      formPayload: { cards: cards.slice(0, 8) },
      status: 'mapped',
      message: `Mapped flipcard with ${cards.length} card(s).`,
      mediaAssets: [],
    };
  }

  private mapToVideo(
    component: Component,
    raw: Record<string, unknown>
  ): {
    formPayload: Record<string, unknown>;
    status: 'mapped' | 'stubbed';
    message: string;
    mediaAssets: PendingMediaAttachment[];
  } {
    const videoSrc =
      asString(nested(raw, ['_media', 'mp4'])) ||
      asString(nested(raw, ['_media', 'src'])) ||
      asString(raw.src) ||
      '';
    const isAbsolute = isAbsoluteUrl(videoSrc);
    const mediaAssets: PendingMediaAttachment[] = [];

    if (videoSrc && !isAbsolute) {
      mediaAssets.push(makePendingMedia(videoSrc, 'videoUrl'));
    }

    return {
      formPayload: {
        title: component.displayTitle || component.title || 'Video',
        description: stripHtml(component.body || ''),
        videoUrl: isAbsolute ? videoSrc : '',
      },
      status: isAbsolute || !videoSrc ? (isAbsolute ? 'mapped' : 'stubbed') : 'stubbed',
      message: isAbsolute
        ? 'Mapped video with absolute URL.'
        : videoSrc
          ? `Video queued for media attach (${videoSrc}).`
          : 'Stubbed video block (no source path).',
      mediaAssets,
    };
  }

  private mapToAudio(
    component: Component,
    raw: Record<string, unknown>
  ): {
    formPayload: Record<string, unknown>;
    status: 'mapped' | 'stubbed';
    message: string;
    mediaAssets: PendingMediaAttachment[];
  } {
    const audioSrc =
      asString(nested(raw, ['_media', 'mp3'])) ||
      asString(nested(raw, ['_media', 'src'])) ||
      asString(raw.src) ||
      '';
    const isAbsolute = isAbsoluteUrl(audioSrc);
    const mediaAssets: PendingMediaAttachment[] = [];

    if (audioSrc && !isAbsolute) {
      mediaAssets.push(makePendingMedia(audioSrc, 'audioUrl'));
    }

    return {
      formPayload: {
        title: component.displayTitle || component.title || 'Audio',
        description: stripHtml(component.body || ''),
        audioUrl: isAbsolute ? audioSrc : '',
      },
      status: isAbsolute ? 'mapped' : 'stubbed',
      message: isAbsolute
        ? 'Mapped audio with absolute URL.'
        : audioSrc
          ? `Audio queued for media attach (${audioSrc}).`
          : 'Stubbed audio block (no source path).',
      mediaAssets,
    };
  }

  private mapToHotspot(
    component: Component,
    raw: Record<string, unknown>
  ): {
    formPayload: Record<string, unknown>;
    status: 'mapped' | 'stubbed';
    message: string;
    mediaAssets: PendingMediaAttachment[];
  } {
    const imageSrc = this.resolveImageSource(raw, component);
    const alt =
      resolveEvolveGraphicAlt(raw) ||
      resolveHumanTitle(component, raw, 'hotspot') ||
      'Hotspot diagram';
    const mediaAssets: PendingMediaAttachment[] = [];
    let imageUrl = '';

    if (imageSrc && isAbsoluteUrl(imageSrc)) {
      imageUrl = imageSrc;
    } else if (imageSrc) {
      mediaAssets.push(makePendingMedia(imageSrc, 'imageUrl', alt));
    }

    const items = asArray(raw._items ?? raw.items ?? raw._hotspots);
    const pins = items
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const title =
          asString(row.title) ||
          asString(row.displayTitle) ||
          `Pin ${index + 1}`;
        const body =
          stripHtml(asString(row.body) || asString(row.text) || '') || title;
        const top = Number(row._top ?? row.top ?? row.topPercent ?? 50);
        const left = Number(row._left ?? row.left ?? row.leftPercent ?? 50);
        const pinImageSrc = resolveEvolveGraphicSrc(row, component, this.courseAssets, {
          allowAssetFallback: false,
        });
        const pinAlt = resolveEvolveGraphicAlt(row) || title;
        let pinImageUrl = '';
        if (pinImageSrc && isAbsoluteUrl(pinImageSrc)) {
          pinImageUrl = pinImageSrc;
        } else if (pinImageSrc) {
          mediaAssets.push(makePendingMedia(pinImageSrc, `pins.${index}.imageUrl`, pinAlt));
        }
        return {
          title: truncate(title, 200),
          body,
          imageUrl: pinImageUrl,
          topPercent: clampPercent(top),
          leftPercent: clampPercent(left),
        };
      })
      .filter(Boolean) as Array<{
      title: string;
      body: string;
      imageUrl: string;
      topPercent: number;
      leftPercent: number;
    }>;

    if (pins.length === 0) {
      pins.push({
        title: component.title || 'Hotspot',
        body: stripHtml(component.body || '') || 'Imported hotspot pin.',
        imageUrl: '',
        topPercent: 50,
        leftPercent: 50,
      });
    }

    return {
      formPayload: {
        imageUrl,
        imageAlt: alt,
        pins: pins.slice(0, 12),
      },
      status: imageUrl || mediaAssets.length ? (imageUrl ? 'mapped' : 'stubbed') : 'stubbed',
      message: imageUrl
        ? `Mapped hotspot with ${pins.length} pin(s).`
        : imageSrc
          ? `Hotspot diagram queued for media attach (${imageSrc}).`
          : 'Hotspot mapped without diagram image.',
      mediaAssets,
    };
  }

  private mapToQuestionnaire(
    component: Component,
    raw: Record<string, unknown>,
    companions: Component[] = []
  ): {
    formPayload: Record<string, unknown>;
    status: 'mapped' | 'stubbed';
    message: string;
    mediaAssets: PendingMediaAttachment[];
  } {
    const mediaAssets: PendingMediaAttachment[] = [];
    const items = asArray(raw._items ?? raw.items);
    const feedback = readEvolveFeedback(raw);
    const companionCopy = readCompanionCopy(companions);
    const stem = firstDistinctText([
      stripHtml(readEvolveText(raw.body) || component.body || ''),
      ...companionCopy.bodies,
    ]);
    const instruction = firstDistinctText(
      [stripHtml(readEvolveText(raw.instruction)), ...companionCopy.instructions],
      stem
    );

    // Adapt/Evolve MCQ stores one question per component. `_items` are the answer
    // choices (`text` + `_shouldBeSelected`). A nested `_options` list is the older
    // shape used when one component carries several questions.
    const itemsAreQuestions = items.length > 0 && items.every((item) => hasNestedOptions(item));
    const questionSources = itemsAreQuestions ? items : [raw];
    const mappedSources = questionSources.slice(0, MAX_QUESTIONS_PER_BLOCK);
    const optionSource = itemsAreQuestions ? [] : items.length > 0 ? items : asArray(raw._options ?? raw.options);

    const questions = mappedSources.map((item, questionIndex) => {
      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const rowFeedback = readEvolveFeedback(row);
      const rawOptions = itemsAreQuestions
        ? asArray(row._options ?? row.options)
        : optionSource;
      const options = mapAnswerOptions(rawOptions);
      const text = itemsAreQuestions
        ? stripHtml(
            readEvolveText(row.text) ||
              readEvolveText(row.title) ||
              readEvolveText(row.body) ||
              stem ||
              component.title ||
              `Question ${questionIndex + 1}`
          )
        : stem ||
          instruction ||
          readComponentTitle(component) ||
          companionCopy.titles[0] ||
          `Question ${questionIndex + 1}`;

      const selectable = Number(raw._selectable ?? row._selectable ?? 1);
      const correctCount = options.filter((option) => option.isCorrect).length;
      const type = selectable > 1 || correctCount > 1 ? 'multiple' : 'single';

      return {
        text: truncate(text, 500),
        type,
        options: options.slice(0, 6),
        correctFeedback: truncate(
          stripHtml(rowFeedback.correct || feedback.correct || readEvolveText(row.correctFeedback) || readEvolveText(row._feedbackCorrect)),
          1000
        ),
        incorrectFeedback: truncate(
          stripHtml(
            rowFeedback.incorrect ||
              feedback.incorrect ||
              readEvolveText(row.incorrectFeedback) ||
              readEvolveText(row._feedbackIncorrect)
          ),
          1000
        ),
        imageUrl: '',
      };
    });

    const imageSrc = this.resolveQuestionImage(component, companions);
    if (imageSrc && questions[0]) {
      const alt =
        resolveEvolveGraphicAlt(raw) ||
        companions.map((companion) => resolveEvolveGraphicAlt(companion.raw ?? {})).find(Boolean) ||
        questions[0].text;
      if (isAbsoluteUrl(imageSrc)) {
        questions[0].imageUrl = imageSrc;
      } else {
        mediaAssets.push(makePendingMedia(imageSrc, 'questions.0.imageUrl', alt));
      }
    }

    const heading = firstDistinctText(
      [readComponentTitle(component), ...companionCopy.titles],
      questions[0]?.text || ''
    );
    const intro = firstDistinctText([instruction, ...companionCopy.bodies], questions[0]?.text || '');
    const contentDescription =
      firstDistinctText([stem, ...companionCopy.bodies, instruction, questions[0]?.text || '']) ||
      `Imported question from Evolve component ${component.id}`;

    const optionCount = questions[0]?.options.length ?? 0;
    const truncatedQuestions = itemsAreQuestions && items.length > MAX_QUESTIONS_PER_BLOCK;
    let message = truncatedQuestions
      ? `Mapped first ${MAX_QUESTIONS_PER_BLOCK} MCQ items (${items.length} items in Evolve).`
      : `Mapped MCQ → questionnaire (${questions.length} question${questions.length === 1 ? '' : 's'}, ${optionCount} option${optionCount === 1 ? '' : 's'}).`;
    if (mediaAssets.length > 0) {
      message += ` Question image queued for attach (${mediaAssets[0].sourcePath}).`;
    } else if (imageSrc) {
      message += ' Question image attached.';
    }
    if (companions.length > 0) {
      message += ` Included ${companions.length} companion component${companions.length === 1 ? '' : 's'} (text/image).`;
    }

    return {
      formPayload: {
        contentDescription: truncate(contentDescription, 2000),
        heading: truncate(heading, 200),
        intro: truncate(intro, 500),
        showFeedbackPerQuestion: true,
        questions,
      },
      status: truncatedQuestions || mediaAssets.length > 0 ? 'stubbed' : 'mapped',
      message,
      mediaAssets,
    };
  }

  /**
   * Question image comes from the MCQ/GMCQ graphic, then from a sibling graphic
   * in the same article. Answer-choice graphics are not reused as the prompt image.
   */
  private resolveQuestionImage(component: Component, companions: Component[]): string {
    const sources = [
      ...this.questionImageSources(component, false),
      ...companions.flatMap((companion) => this.questionImageSources(companion, true)),
    ];
    const seen = new Set<string>();
    for (const src of sources) {
      const key = src.toLowerCase();
      if (!src || seen.has(key)) continue;
      seen.add(key);
      this.markImageUsed(src);
      return src;
    }
    return '';
  }

  private questionImageSources(component: Component, includeItemGraphics: boolean): string[] {
    const raw = component.raw ?? {};
    const sourceType = (component.type || '').toLowerCase();
    const direct = resolveEvolveGraphicSrc(raw, component, this.courseAssets, {
      allowAssetFallback: sourceType === 'graphic' || sourceType === 'mcq' || sourceType === 'gmcq',
      includeItems: false,
    });
    const sources = direct ? [direct] : [];
    if (!includeItemGraphics) return sources;

    for (const item of asArray(raw._items ?? raw.items)) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      if (isAnswerOptionRow(row)) continue;
      const src = resolveEvolveGraphicSrc(row, component, this.courseAssets, {
        allowAssetFallback: false,
        includeItems: false,
      });
      if (src) sources.push(src);
    }
    return sources;
  }

  private mapToTabs(
    component: Component,
    raw: Record<string, unknown>
  ): {
    formPayload: Record<string, unknown>;
    status: 'mapped' | 'stubbed';
    message: string;
    mediaAssets: PendingMediaAttachment[];
  } {
    const mediaAssets: PendingMediaAttachment[] = [];
    const items = asArray(raw._items ?? raw.items ?? raw._tabs ?? raw._tabItems ?? raw.tabs);
    const panels = items
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const resolved = resolveItemHeading(row, index, 'Tab');
        const title = resolved.title;
        const body = resolved.bodyText || title;
        const imageSrc = resolveEvolveGraphicSrc(row, component, this.courseAssets, {
          allowAssetFallback: false,
        });
        let imageUrl = '';
        if (imageSrc && isAbsoluteUrl(imageSrc)) {
          imageUrl = imageSrc;
        } else if (imageSrc) {
          mediaAssets.push(makePendingMedia(imageSrc, `panels.${index}.imageUrl`));
        }
        return { title: truncate(title, 200), body, imageUrl, icon: '' };
      })
      .filter((p): p is { title: string; body: string; imageUrl: string; icon: string } => !!p);

    if (panels.length === 0) {
      panels.push({
        title: component.title || 'Tab',
        body: stripHtml(component.body || '') || 'Imported tab content.',
        imageUrl: '',
        icon: '',
      });
    }

    return {
      formPayload: {
        heading: truncate(resolveHumanTitle(component, raw, 'tabs'), 200),
        panels: panels.slice(0, 10),
      },
      status: mediaAssets.length > 0 ? 'stubbed' : 'mapped',
      message:
        mediaAssets.length > 0
          ? `Mapped tabs; ${mediaAssets.length} image(s) queued for attach.`
          : `Mapped tabs with ${panels.length} panel(s).`,
      mediaAssets,
    };
  }

  private mapToFlowchart(
    component: Component,
    raw: Record<string, unknown>
  ): {
    formPayload: Record<string, unknown>;
    status: 'mapped' | 'stubbed';
    message: string;
    mediaAssets: PendingMediaAttachment[];
  } {
    const mediaAssets: PendingMediaAttachment[] = [];
    const items = asArray(raw._items ?? raw.items ?? raw._nodes ?? raw.nodes);
    const nodes = items
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const resolved = resolveItemHeading(row, index, 'Stage');
        const title = resolved.title;
        const body = resolved.bodyText || title;
        const imageSrc = resolveEvolveGraphicSrc(row, component, this.courseAssets, {
          allowAssetFallback: false,
        });
        let imageUrl = '';
        if (imageSrc && isAbsoluteUrl(imageSrc)) {
          imageUrl = imageSrc;
        } else if (imageSrc) {
          mediaAssets.push(makePendingMedia(imageSrc, `nodes.${index}.imageUrl`));
        }
        const rawVariant = (
          asString(row._type) ||
          asString(row.type) ||
          asString(row._shape) ||
          asString(row.shape) ||
          asString(row.variant)
        ).toLowerCase();
        let variant = 'step';
        if (rawVariant.includes('start') || index === 0) variant = 'start';
        if (rawVariant.includes('end') || (items.length > 1 && index === items.length - 1)) {
          variant = 'end';
        }
        if (rawVariant.includes('decision') || rawVariant.includes('diamond') || looksLikeDecisionLabel(title)) {
          variant = 'decision';
        }
        return {
          title: truncate(title, 200),
          body,
          imageUrl,
          icon: '',
          variant,
        };
      })
      .filter(
        (n): n is {
          title: string;
          body: string;
          imageUrl: string;
          icon: string;
          variant: string;
        } => !!n
      );

    if (nodes.length === 0) {
      nodes.push({
        title: component.title || 'Stage',
        body: stripHtml(component.body || '') || 'Imported flowchart stage.',
        imageUrl: '',
        icon: '',
        variant: 'start',
      });
    }

    return {
      formPayload: {
        heading: truncate(resolveHumanTitle(component, raw, 'flowchart'), 200),
        hint: asString(raw.instruction) || 'Select a stage to read more',
        nodes: nodes.slice(0, 10),
      },
      status: mediaAssets.length > 0 ? 'stubbed' : 'mapped',
      message:
        mediaAssets.length > 0
          ? `Mapped flowchart; ${mediaAssets.length} image(s) queued for attach.`
          : `Mapped flowchart with ${nodes.length} stage(s).`,
      mediaAssets,
    };
  }

  private mapToOrdering(
    component: Component,
    raw: Record<string, unknown>
  ): {
    formPayload: Record<string, unknown>;
    status: 'mapped' | 'stubbed';
    message: string;
    mediaAssets: PendingMediaAttachment[];
  } {
    const items = asArray(raw._items ?? raw.items)
      .map((item, index) => {
        if (typeof item === 'string') {
          return { text: truncate(stripHtml(item), 300) };
        }
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const text =
          asString(row.text) ||
          asString(row.title) ||
          asString(row.body) ||
          `Item ${index + 1}`;
        return { text: truncate(stripHtml(text), 300) };
      })
      .filter((item): item is { text: string } => !!item && !!item.text);

    while (items.length < 2) {
      items.push({
        text:
          items.length === 0
            ? stripHtml(component.body || component.title || '') || 'Item 1'
            : 'Item 2',
      });
    }

    const feedback =
      nested(raw, ['_feedback']) && typeof nested(raw, ['_feedback']) === 'object'
        ? (nested(raw, ['_feedback']) as Record<string, unknown>)
        : {};

    return {
      formPayload: {
        instruction:
          stripHtml(asString(raw.instruction) || component.body || '') ||
          'Put these items in the correct order.',
        hint: 'Use the arrows to rearrange, then check your answer.',
        items: items.slice(0, 10),
        correctFeedback: stripHtml(
          asString(feedback.correct) || asString(raw.correctFeedback)
        ),
        incorrectFeedback: stripHtml(
          asString(feedback.incorrect) || asString(raw.incorrectFeedback)
        ),
      },
      status: items.length > 10 ? 'stubbed' : 'mapped',
      message: `Mapped ordering with ${Math.min(items.length, 10)} item(s).`,
      mediaAssets: [],
    };
  }

  private resolveImageSource(
    raw: Record<string, unknown>,
    component: Component
  ): string {
    const found = resolveEvolveGraphicSrc(raw, component, this.courseAssets);
    if (found) {
      this.markImageUsed(found);
      return found;
    }
    const title = resolveHumanTitle(component, raw, component.type);
    return this.takePackageImage(title);
  }

  private markImageUsed(path: string): void {
    const lower = path.toLowerCase();
    const filename = lower.split('/').pop() || lower;
    this.leftoverImages = this.leftoverImages.filter((asset) => {
      const assetPath = asset.path.toLowerCase();
      return assetPath !== lower && asset.filename.toLowerCase() !== filename;
    });
  }

  private takePackageImage(title: string): string {
    if (this.leftoverImages.length === 0) return '';
    const byTitle = matchAssetByTitle(title, this.leftoverImages);
    const chosen = byTitle ?? this.leftoverImages[0];
    this.markImageUsed(chosen.path);
    return chosen.path;
  }
}

function isPageIntroductionArticle(article: Lesson): boolean {
  const title = (article.displayTitle || article.title || '').trim();
  return isPlaceholderArticleTitle(title);
}

function isPlaceholderArticleTitle(title: string): boolean {
  return PLACEHOLDER_ARTICLE_TITLES.has(title.trim().toLowerCase());
}

function isPlaceholderComponentTitle(title: string): boolean {
  return PLACEHOLDER_COMPONENT_TITLES.has(title.trim().toLowerCase());
}

function countPages(pages: Page[]): number {
  let n = 0;
  const walk = (list: Page[]): void => {
    for (const p of list) {
      if (p.type !== 'menu') n += 1;
      if (p.childPages.length) walk(p.childPages);
    }
  };
  walk(pages);
  return n;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Evolve often stores copy as a string or a language map `{ _default, en }`. */
function readEvolveText(value: unknown): string {
  if (typeof value === 'string') {
    return decodeHtmlEntities(value).trim();
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '';
  }
  const row = value as Record<string, unknown>;
  for (const key of ['_default', 'en', 'en-gb', 'en-us', 'text', 'title', 'displayTitle', 'body']) {
    if (typeof row[key] === 'string' && row[key].trim()) {
      return decodeHtmlEntities(row[key] as string).trim();
    }
  }
  for (const nestedValue of Object.values(row)) {
    if (typeof nestedValue === 'string' && nestedValue.trim() && !/[\\/]|\.(png|jpe?g|gif|webp|svg|mp3|mp4)$/i.test(nestedValue)) {
      return decodeHtmlEntities(nestedValue).trim();
    }
  }
  return '';
}

const QUESTIONNAIRE_SOURCE_TYPES = new Set(['mcq', 'gmcq']);
const QUESTION_COMPANION_TYPES = new Set(['graphic', 'text', 'blank', 'narrative']);

function isQuestionnaireSourceType(type: string | undefined): boolean {
  return QUESTIONNAIRE_SOURCE_TYPES.has((type || '').toLowerCase());
}

function isQuestionCompanionType(type: string | undefined): boolean {
  return QUESTION_COMPANION_TYPES.has((type || '').toLowerCase());
}

const PLAIN_TEXT_TYPES = new Set(['text', 'blank', 'narrative']);

function isPlainTextType(type: string | undefined): boolean {
  return PLAIN_TEXT_TYPES.has((type || '').toLowerCase());
}

function isGraphicType(type: string | undefined): boolean {
  return (type || '').toLowerCase() === 'graphic';
}

/**
 * Evolve lays a text component and a graphic out as one block.
 * Fold that graphic into the text block instead of creating a second block.
 * Leave the group alone when the block also has another interaction.
 */
function pairTextWithGraphics(components: Component[]): Map<string, Component[]> {
  const paired = new Map<string, Component[]>();
  const byBlock = new Map<string, Component[]>();
  for (const component of components) {
    const blockId = component.relationships?.parentBlockId;
    if (!blockId) continue;
    const list = byBlock.get(blockId) ?? [];
    list.push(component);
    byBlock.set(blockId, list);
  }

  for (const group of byBlock.values()) {
    const texts = group.filter((component) => isPlainTextType(component.type));
    const graphics = group.filter((component) => isGraphicType(component.type));
    if (texts.length === 0 || graphics.length === 0) continue;
    const hasOther = group.some(
      (component) => !isPlainTextType(component.type) && !isGraphicType(component.type)
    );
    if (hasOther) continue;
    paired.set(texts[0].id, [...texts.slice(1), ...graphics]);
  }
  return paired;
}

function usableImageAlt(alt: string, fallback: string): string {
  const value = alt.trim();
  if (value && !isPlaceholderComponentTitle(value)) return value;
  const backup = fallback.trim();
  if (backup && !isPlaceholderComponentTitle(backup)) return backup;
  return '';
}

/**
 * A knowledge-check article is usually the question plus the text/graphic beside it.
 * Fold those into one questionnaire. When the article also has other interactions,
 * only fold companions that share the question's Evolve block.
 */
function pairQuestionCompanions(components: Component[]): Map<string, Component[]> {
  const questions = components.filter((component) => isQuestionnaireSourceType(component.type));
  const paired = new Map<string, Component[]>();
  if (questions.length === 0) return paired;

  const others = components.filter((component) => !isQuestionnaireSourceType(component.type));
  if (
    questions.length === 1 &&
    others.length > 0 &&
    others.every((component) => isQuestionCompanionType(component.type))
  ) {
    paired.set(questions[0].id, others);
    return paired;
  }

  for (const question of questions) {
    const blockId = question.relationships?.parentBlockId;
    if (!blockId) continue;
    const inBlock = components.filter(
      (component) => component.relationships?.parentBlockId === blockId
    );
    const blockQuestions = inBlock.filter((component) => isQuestionnaireSourceType(component.type));
    if (blockQuestions.length !== 1) continue;
    const companions = inBlock.filter((component) => isQuestionCompanionType(component.type));
    if (companions.length > 0) paired.set(question.id, companions);
  }
  return paired;
}

function hasNestedOptions(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const row = item as Record<string, unknown>;
  return asArray(row._options ?? row.options).length > 0;
}

function isAnswerOptionRow(row: Record<string, unknown>): boolean {
  if (hasNestedOptions(row)) return false;
  return '_shouldBeSelected' in row || '_isCorrect' in row || 'isCorrect' in row;
}

function mapAnswerOptions(rawOptions: unknown[]): { text: string; isCorrect: boolean }[] {
  const rows = rawOptions.filter((opt) => opt != null);
  const explicit = rows.some((opt) => {
    if (!opt || typeof opt !== 'object') return false;
    const row = opt as Record<string, unknown>;
    return '_shouldBeSelected' in row || '_isCorrect' in row || 'isCorrect' in row || '_score' in row;
  });

  const options = rows
    .map((opt, index) => {
      if (typeof opt === 'string') {
        const text = stripHtml(opt);
        return text ? { text, isCorrect: !explicit && index === 0 } : null;
      }
      const row = opt as Record<string, unknown>;
      const text = stripHtml(
        readEvolveText(row.text) || readEvolveText(row.title) || readEvolveText(row.body)
      );
      if (!text) return null;
      return { text, isCorrect: optionIsCorrect(row, index, explicit) };
    })
    .filter((option): option is { text: string; isCorrect: boolean } => !!option);

  if (options.length >= 2) {
    if (!options.some((option) => option.isCorrect)) {
      options[0].isCorrect = true;
    }
    return options;
  }

  return [
    { text: 'Option A', isCorrect: true },
    { text: 'Option B', isCorrect: false },
  ];
}

function optionIsCorrect(
  row: Record<string, unknown>,
  index: number,
  anyExplicit: boolean
): boolean {
  if ('_shouldBeSelected' in row) return Boolean(row._shouldBeSelected);
  if ('_isCorrect' in row) return Boolean(row._isCorrect);
  if ('isCorrect' in row) return Boolean(row.isCorrect);
  if (typeof row._score === 'number') return row._score > 0;
  return !anyExplicit && index === 0;
}

function readEvolveFeedback(raw: Record<string, unknown>): { correct: string; incorrect: string } {
  const feedback = raw._feedback;
  if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) {
    return { correct: '', incorrect: '' };
  }
  const row = feedback as Record<string, unknown>;
  const incorrectNode = row._incorrect ?? row.incorrect;
  let incorrect = '';
  if (typeof incorrectNode === 'string') {
    incorrect = incorrectNode;
  } else if (incorrectNode && typeof incorrectNode === 'object' && !Array.isArray(incorrectNode)) {
    const nestedFeedback = incorrectNode as Record<string, unknown>;
    incorrect =
      readEvolveText(nestedFeedback.final) ||
      readEvolveText(nestedFeedback.notFinal) ||
      readEvolveText(nestedFeedback);
  }
  return {
    correct: readEvolveText(row.correct),
    incorrect,
  };
}

function readComponentTitle(component: Component): string {
  const raw = component.raw ?? {};
  const candidates = [
    readEvolveText(raw.displayTitle),
    readEvolveText(raw.title),
    component.displayTitle || '',
    component.title && component.title !== component.id ? component.title : '',
  ]
    .map((value) => decodeHtmlEntities(value).trim())
    .filter((value) => value && !looksLikeEvolveId(value) && !isPlaceholderComponentTitle(value));
  return candidates[0] || '';
}

function readCompanionCopy(companions: Component[]): {
  bodies: string[];
  instructions: string[];
  titles: string[];
} {
  const bodies: string[] = [];
  const instructions: string[] = [];
  const titles: string[] = [];
  for (const companion of companions) {
    const raw = companion.raw ?? {};
    const body = stripHtml(readEvolveText(raw.body) || companion.body || '');
    const instruction = stripHtml(readEvolveText(raw.instruction));
    const title = readComponentTitle(companion);
    if (body) bodies.push(body);
    if (instruction) instructions.push(instruction);
    if (title && !isGenericQuestionTitle(title)) titles.push(title);
  }
  return { bodies, instructions, titles };
}

function firstDistinctText(candidates: string[], excluded = ''): string {
  const skip = excluded.trim().toLowerCase();
  for (const candidate of candidates) {
    const value = candidate.trim();
    if (!value || value.toLowerCase() === skip) continue;
    if (isGenericQuestionTitle(value) || isPlaceholderComponentTitle(value)) continue;
    return value;
  }
  return '';
}

function isGenericQuestionTitle(title: string): boolean {
  const value = title.trim();
  if (!value) return true;
  if (isGenericItemTitle(value)) return true;
  return /^(question|mcq|gmcq)(\s*[-–:]?\s*\d+)?$/i.test(value);
}

function isGenericItemTitle(title: string): boolean {
  const value = title.trim();
  if (!value) return true;
  if (looksLikeEvolveId(value)) return true;
  if (isPlaceholderComponentTitle(value) || isPlaceholderArticleTitle(value)) {
    return true;
  }
  return /^(stage|panel|item|slide|tab|step|node|pin)(\s*\d+)?$/i.test(value);
}

/** Short flowchart labels like "Decide?" stay decisions; long question headings do not. */
function looksLikeDecisionLabel(title: string): boolean {
  const value = title.trim();
  if (!value.includes('?')) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (/^(why|what|how|when|where|which|who|whose|whom)\b/i.test(value) && words.length >= 4) {
    return false;
  }
  return value.length <= 40 && words.length <= 4;
}

function extractHeadingFromHtml(html: string): { heading: string; remainingHtml: string } {
  if (!html.trim()) return { heading: '', remainingHtml: html };

  const headingTag = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (headingTag) {
    const heading = stripHtml(headingTag[1]);
    if (heading) {
      return { heading, remainingHtml: html.replace(headingTag[0], '') };
    }
  }

  const strongTag = html.match(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/i);
  if (strongTag) {
    const heading = stripHtml(strongTag[2]);
    if (heading && heading.length <= 80) {
      return { heading, remainingHtml: html.replace(strongTag[0], '') };
    }
  }

  const paragraph = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  const firstChunk = paragraph ? stripHtml(paragraph[1]) : stripHtml(html);
  const question = firstChunk.match(/^(.{8,200}?\?)/);
  if (question) {
    const heading = question[1].trim();
    if (paragraph && stripHtml(paragraph[1]).trim() === heading) {
      return { heading, remainingHtml: html.replace(paragraph[0], '') };
    }
    if (!paragraph && firstChunk.trim() === heading) {
      return { heading, remainingHtml: '' };
    }
    if (firstChunk.startsWith(heading)) {
      const rest = firstChunk.slice(heading.length).trim();
      return {
        heading,
        remainingHtml: rest ? `<p>${escapeHtml(rest)}</p>` : html.replace(heading, ''),
      };
    }
    return { heading, remainingHtml: html };
  }

  const shortLabel =
    firstChunk.length >= 2 &&
    firstChunk.length <= 80 &&
    !firstChunk.includes('.') &&
    firstChunk.split(/\s+/).length <= 8;
  if (shortLabel && paragraph) {
    const restHasContent = stripHtml(html.replace(paragraph[0], '')).length > 0;
    if (restHasContent) {
      return { heading: firstChunk, remainingHtml: html.replace(paragraph[0], '') };
    }
  }

  return { heading: '', remainingHtml: html };
}

/**
 * Prefer the author's visible item heading. Evolve flowChart/accordion items often
 * use empty or "Stage 1" titles and put the real heading in the body.
 */
function resolveItemHeading(
  row: Record<string, unknown>,
  index: number,
  fallbackPrefix: string
): { title: string; bodyHtml: string; bodyText: string } {
  const declared = [
    row.displayTitle,
    row.title,
    row.heading,
    row.label,
    row.tabTitle,
    row._tabTitle,
    row._title,
    row.ariaLabel,
    row._ariaLabel,
    row.name,
    row.caption,
  ]
    .map((value) => stripHtml(readEvolveText(value)))
    .find((value) => value && !isGenericItemTitle(value)) || '';
  const bodyHtml =
    readEvolveText(row.body) ||
    readEvolveText(row.text) ||
    readEvolveText(row.description);
  const extracted = extractHeadingFromHtml(bodyHtml);
  const graphicAlt = stripHtml(
    readEvolveText(nested(row, ['_graphic', 'alt']) || nested(row, ['graphic', 'alt']))
  );

  let title = declared;
  let remainingHtml = bodyHtml;
  if (!title && extracted.heading) {
    title = extracted.heading;
    remainingHtml = extracted.remainingHtml.trim() ? extracted.remainingHtml : bodyHtml;
  }
  if (!title && graphicAlt && !isGenericItemTitle(graphicAlt)) {
    title = graphicAlt;
  }

  const bodyText = stripHtml(remainingHtml);
  return {
    title: truncate(title, 200) || `${fallbackPrefix} ${index + 1}`,
    bodyHtml: remainingHtml,
    bodyText: bodyText || title || `${fallbackPrefix} ${index + 1}`,
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nested(
  obj: Record<string, unknown>,
  path: string[]
): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(text: string, max: number): string {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  if (value <= 1 && value >= 0) return Math.round(value * 100);
  return Math.max(0, Math.min(100, Math.round(value)));
}

function makePendingMedia(
  sourcePath: string,
  targetField: string,
  alt?: string
): PendingMediaAttachment {
  const normalised = sourcePath.replace(/\\/g, '/');
  const fileName = normalised.split('/').pop() || normalised;
  return {
    sourcePath: normalised,
    fileName,
    targetField,
    alt,
  };
}

/**
 * Evolve / Adapt image fields are inconsistent across versions:
 * - object with src / large / small
 * - Asset:image field stored as a string path on `_graphic` itself
 * - `_src`, `path`, `{ _default: "..." }`, numeric srcset maps
 * When JSON has no path, fall back to assets already harvested from the component
 * or matched in the package by filename / component id.
 */
function resolveEvolveGraphicSrc(
  raw: Record<string, unknown>,
  component?: Component,
  courseAssets: Asset[] = [],
  options: { allowAssetFallback?: boolean; includeItems?: boolean } = {}
): string {
  const pool = [...(component?.assets ?? []), ...courseAssets];
  const includeItems = options.includeItems !== false;
  const fromJson = [
    extractMediaPath(raw._graphic),
    extractMediaPath(raw.graphic),
    extractMediaPath(raw._mobileGraphic),
    extractMediaPath(raw.mobileGraphic),
    extractMediaPath(raw._background),
    extractMediaPath(raw._backgroundImage),
    extractMediaPath(raw.src),
    extractMediaPath(raw._src),
    extractMediaPath(raw._image),
    extractMediaPath(raw.image),
    extractMediaPath(raw._srcAdvanced),
    extractMediaPath(raw.srcAdvanced),
    extractImgSrcFromHtml(asString(raw.body)),
    extractImgSrcFromHtml(readEvolveText(raw.body)),
    extractImgSrcFromHtml(asString(raw.text)),
    extractImgSrcFromHtml(asString(raw.description)),
    ...(includeItems
      ? [
          extractMediaPath(raw),
          findFirstMediaString(raw._items),
          findFirstMediaString(raw.items),
          findFirstMediaString(raw),
        ]
      : []),
  ].find(Boolean);

  if (fromJson) {
    return expandPackagePath(fromJson, pool);
  }
  if (options.allowAssetFallback === false) return '';
  return pickImagePathFromAssets(raw, component, courseAssets);
}

function pickImagePathFromAssets(
  raw: Record<string, unknown>,
  component: Component | undefined,
  courseAssets: Asset[]
): string {
  const owned = (component?.assets ?? []).filter(isImageAsset);
  if (owned.length === 1) return owned[0].path;
  if (owned.length > 1) {
    return [...owned].sort((a, b) => scoreImageAsset(b) - scoreImageAsset(a))[0].path;
  }

  const filenameHint = extractFilenameHint(raw);
  const pool = courseAssets.filter(isImageAsset);
  if (filenameHint) {
    const lower = filenameHint.toLowerCase();
    const byName = pool.find(
      (asset) =>
        asset.filename.toLowerCase() === lower ||
        asset.path.toLowerCase().endsWith(`/${lower}`)
    );
    if (byName) return byName.path;
  }

  if (!component?.id) return '';
  const matches = pool.filter((asset) => assetMatchesComponentId(asset, component.id));
  if (matches.length === 1) return matches[0].path;
  if (matches.length > 1) {
    return [...matches].sort((a, b) => scoreImageAsset(b) - scoreImageAsset(a))[0].path;
  }
  return '';
}

function extractFilenameHint(raw: Record<string, unknown>): string {
  const graphic = raw._graphic ?? raw.graphic;
  if (graphic && typeof graphic === 'object' && !Array.isArray(graphic)) {
    const row = graphic as Record<string, unknown>;
    const name =
      asString(row.filename) ||
      asString(row.title) ||
      asString(row.name);
    if (name && /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name)) return name;
  }
  return '';
}

function assetMatchesComponentId(asset: Asset, componentId: string): boolean {
  const path = asset.path.toLowerCase().replace(/\\/g, '/');
  const id = componentId.toLowerCase();
  const stripped = id.replace(/^[a-z]-/, '');
  if (path.includes(`/${id}/`) || path.includes(`/${id}.`) || path.endsWith(`/${id}`)) {
    return true;
  }
  // Avoid short ids like "c-05" matching unrelated files
  if (stripped.length >= 6) {
    return path.includes(`/${stripped}/`) || path.includes(`/${stripped}.`);
  }
  return false;
}

function scoreImageAsset(asset: Asset): number {
  const path = asset.path.toLowerCase();
  let score = 0;
  if (path.includes('large')) score += 3;
  if (path.includes('desktop')) score += 2;
  if (path.includes('small') || path.includes('mobile')) score -= 1;
  if (/\.(png|jpe?g)$/i.test(asset.filename)) score += 2;
  if (asset.exists) score += 1;
  return score;
}

function resolveEvolveGraphicAlt(raw: Record<string, unknown>): string {
  return (
    asString(nested(raw, ['_graphic', 'alt'])) ||
    asString(nested(raw, ['graphic', 'alt'])) ||
    ''
  );
}

/**
 * Prefer human titles; Evolve often ships empty title/displayTitle and only an id.
 */
function resolveHumanTitle(
  component: Component,
  raw: Record<string, unknown>,
  sourceType: string
): string {
  const candidates = [
    asString(raw.displayTitle),
    asString(raw.title),
    component.displayTitle || '',
    // Ignore ObjectModelBuilder fallback that copied the id into title
    component.title && component.title !== component.id ? component.title : '',
    resolveEvolveGraphicAlt(raw),
    stripHtml(asString(raw.body) || component.body || ''),
    asString(raw.instruction),
  ]
    .map((s) => decodeHtmlEntities(s).trim())
    .filter(Boolean)
    .filter((s) => !looksLikeEvolveId(s));

  if (candidates.length > 0) {
    return truncate(candidates[0], 120);
  }

  const typeLabel: Record<string, string> = {
    graphic: 'Image',
    text: 'Text',
    blank: 'Text',
    narrative: 'Narrative',
    audio: 'Audio',
    video: 'Video',
    media: 'Video',
    hotspot: 'Hotspot',
    hotgraphic: 'Hotspot',
    accordion: 'Accordion',
    carousel: 'Carousel',
    reveal: 'Reveal',
    flipcard: 'Flip cards',
    mcq: 'Question',
    gmcq: 'Question',
    tabs: 'Tabs',
    flowchart: 'Flowchart',
    ordering: 'Ordering',
  };

  return typeLabel[sourceType] || 'Content';
}

function looksLikeEvolveId(value: string): boolean {
  // e.g. c-06_01_030_g, b-06_01_040, a-05
  return /^[a-z]-\d/i.test(value) || /^[a-z]-\d[\w-]*$/i.test(value);
}
