import type { Component } from '../models/Component';
import type { Course } from '../models/Course';
import type { Lesson } from '../models/Lesson';
import type { Page } from '../models/Page';
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

/** LMSBox interactive lesson hard limit — must match InteractiveLessonConstants.MaxBlocksPerLesson. Set to 20 when the higher block cap ships. */
export const MAX_BLOCKS_PER_LESSON = 5;

/** Must match InteractiveLessonConstants.QuestionnaireQuestionsPerBlock. Set to 20 when multi-question questionnaires ship. */
const MAX_QUESTIONS_PER_BLOCK = 1;

/**
 * Configuration: Evolve _component → LMSBox blockType.
 * Prefer extending this map over hardcoding inside mapComponent().
 * Assessment types (mcq/gmcq/…) are skipped by default — see skipAssessments.
 */
export const EVOLVE_TO_LMSBOX_BLOCK_TYPE: Record<string, string> = {
  text: 'text',
  blank: 'text',
  narrative: 'text',
  graphic: 'text',
  accordion: 'accordion',
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
};

export interface MapEvolveOptions {
  /** Override course title */
  titleOverride?: string;
  /** Append timestamp suffix to avoid duplicate title conflicts */
  uniquifyTitle?: boolean;
  /**
   * When true (default), skip Evolve scored assessment pages/lessons/components.
   * Use a separate LMSBox Quiz lesson for course assessment.
   */
  skipAssessments?: boolean;
}

/**
 * Maps an Evolve Course object model into an LMSBox draft import plan.
 *
 * - Flattens Pages (title prefix on lessons)
 * - Maps Components → Interactive Blocks
 * - Skips Evolve assessments by default (skipAssessments)
 * - Splits lessons when mapped blocks exceed MAX_BLOCKS_PER_LESSON
 * - Does not call LMS APIs or upload assets
 */
export class EvolveToLmsboxMapper {
  map(course: Course, options: MapEvolveOptions = {}): ImportDraftPlan {
    const skipAssessments = options.skipAssessments !== false;
    const report: MappingReportItem[] = [];
    const lessons: MappedLesson[] = [];

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

        if (pageIsAssessment) {
          const pagePath = prefixParts.join(' › ');
          for (const lesson of page.lessons) {
            report.push({
              sourceComponentId: lesson.id,
              sourceType: 'article',
              sourceTitle: lesson.displayTitle || lesson.title || lesson.id,
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

        for (const lesson of page.lessons) {
          const mapped = this.mapLesson(
            lesson,
            prefixParts,
            report,
            page.id,
            skipAssessments
          );
          lessons.push(...mapped);
        }
      }
    };

    walkPages(course.pages);

    // Orphan lessons not attached to a walked page (safety net) — append in source list order
    const seenLessonIds = new Set(lessons.map((l) => l.sourceLessonId));
    const reportedIds = new Set(report.map((r) => r.sourceComponentId));
    for (const lesson of course.lessons) {
      if (seenLessonIds.has(lesson.id) || reportedIds.has(lesson.id)) continue;
      lessons.push(
        ...this.mapLesson(lesson, [], report, undefined, skipAssessments)
      );
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

  private mapLesson(
    lesson: Lesson,
    pagePrefix: string[],
    report: MappingReportItem[],
    sourcePageId?: string,
    skipAssessments = true
  ): MappedLesson[] {
    const lessonTitle = lesson.displayTitle || lesson.title || lesson.id;
    const pagePath = pagePrefix.join(' › ') || undefined;

    if (skipAssessments && isEvolveAssessmentNode(lesson)) {
      report.push({
        sourceComponentId: lesson.id,
        sourceType: 'article',
        sourceTitle: lessonTitle,
        status: 'skipped',
        reasonCode: 'assessment_article',
        pagePath,
        message: `${evolveAssessmentSkipMessage()} (assessment article).`,
      });
      return [];
    }

    const fullTitle =
      pagePrefix.length > 0
        ? `${pagePrefix.join(' › ')} › ${lessonTitle}`
        : lessonTitle;

    const blocks: MappedBlock[] = [];
    let componentCount = 0;
    let assessmentComponentSkips = 0;

    for (const block of lesson.blocks) {
      for (const component of block.components) {
        componentCount += 1;
        const before = report.length;
        const mapped = this.mapComponent(component, report, skipAssessments);
        if (mapped) {
          blocks.push(mapped);
        } else if (
          report[report.length - 1]?.reasonCode === 'assessment_component' &&
          report.length > before
        ) {
          assessmentComponentSkips += 1;
        }
      }
    }

    if (blocks.length === 0) {
      const isTrulyEmpty = componentCount === 0;
      const onlyAssessments =
        !isTrulyEmpty && assessmentComponentSkips === componentCount;
      report.push({
        sourceComponentId: lesson.id,
        sourceType: 'article',
        sourceTitle: lessonTitle,
        status: 'skipped',
        reasonCode: 'empty_article',
        pagePath,
        message: isTrulyEmpty
          ? `Empty article — no components in Evolve package. Not converted to an LMSBox lesson.${pagePath ? ` (under ${pagePath})` : ''}`
          : onlyAssessments
            ? `Article had only assessment components (excluded). Not converted to an LMSBox lesson.${pagePath ? ` (under ${pagePath})` : ''}`
            : `Article has no mappable learning components. Not converted to an LMSBox lesson.${pagePath ? ` (under ${pagePath})` : ''}`,
      });
      return [];
    }

    // Split into chunks of MAX_BLOCKS_PER_LESSON
    const chunks: MappedBlock[][] = [];
    for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_LESSON) {
      chunks.push(blocks.slice(i, i + MAX_BLOCKS_PER_LESSON));
    }

    return chunks.map((chunk, index) => ({
      title:
        chunks.length === 1
          ? fullTitle
          : `${fullTitle} (part ${index + 1}/${chunks.length})`,
      description: lesson.description || lesson.body || undefined,
      sourcePageId,
      sourceLessonId: lesson.id,
      blocks: chunk,
    }));
  }

  private mapComponent(
    component: Component,
    report: MappingReportItem[],
    skipAssessments = true
  ): MappedBlock | null {
    const sourceType = (component.type || 'unknown').toLowerCase();
    const title = resolveHumanTitle(component, component.raw ?? {}, sourceType);

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
        component
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
    component: Component
  ): {
    formPayload: Record<string, unknown>;
    status: 'mapped' | 'stubbed';
    message: string;
    mediaAssets: PendingMediaAttachment[];
  } {
    const raw = component.raw ?? {};

    switch (targetType) {
      case 'text':
        return this.mapToText(sourceType, component, raw);
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
        return this.mapToQuestionnaire(component, raw);
      default:
        throw new Error(`No payload builder for target type "${targetType}"`);
    }
  }

  private mapToText(
    sourceType: string,
    component: Component,
    raw: Record<string, unknown>
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

    if (sourceType === 'graphic') {
      const src = resolveEvolveGraphicSrc(raw);
      const alt = resolveEvolveGraphicAlt(raw) || heading;
      if (src && isAbsoluteUrl(src)) {
        bodyHtml = `<p><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" /></p>${bodyHtml}`;
        body = stripHtml(bodyHtml);
        message = `Mapped graphic with absolute image URL → text.`;
      } else if (src) {
        mediaAssets.push(makePendingMedia(src, 'bodyHtml', alt));
        bodyHtml =
          bodyHtml ||
          `<p><em>Image will attach from Evolve package: ${escapeHtml(src)}</em></p>`;
        body = stripHtml(bodyHtml);
        status = 'stubbed';
        message = `Graphic queued for media attach (${src}).`;
      } else {
        bodyHtml =
          bodyHtml ||
          `<p><em>Graphic component imported without image asset.</em></p>`;
        body = stripHtml(bodyHtml);
        status = 'stubbed';
        message = 'Graphic had no image source.';
      }
    }

    if (!bodyHtml.trim() && !body.trim()) {
      body = heading || 'Imported content';
      bodyHtml = `<p>${escapeHtml(body)}</p>`;
    }

    return {
      formPayload: {
        heading: truncate(heading, 200),
        subheading: '',
        bodyHtml,
        body: truncate(body, 10000),
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
        const title =
          asString(row.title) ||
          asString(row.displayTitle) ||
          `Panel ${index + 1}`;
        const body = asString(row.body) || asString(row.text) || '';
        return { title: truncate(title, 200), body: stripHtml(body) || title };
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
        const title =
          asString(row.title) ||
          asString(row.displayTitle) ||
          `Slide ${index + 1}`;
        const body = stripHtml(asString(row.body) || asString(row.text) || '') || title;
        const imageSrc =
          resolveEvolveGraphicSrc(row) ||
          asString(row.src) ||
          '';
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
        const title =
          asString(row.title) ||
          asString(row.displayTitle) ||
          `Item ${index + 1}`;
        const body = stripHtml(asString(row.body) || '') || title;
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
    const imageSrc = resolveEvolveGraphicSrc(raw) || asString(raw.src) || '';
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
        return {
          title: truncate(title, 200),
          body,
          topPercent: clampPercent(top),
          leftPercent: clampPercent(left),
        };
      })
      .filter(Boolean) as Array<{
      title: string;
      body: string;
      topPercent: number;
      leftPercent: number;
    }>;

    if (pins.length === 0) {
      pins.push({
        title: component.title || 'Hotspot',
        body: stripHtml(component.body || '') || 'Imported hotspot pin.',
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
    raw: Record<string, unknown>
  ): {
    formPayload: Record<string, unknown>;
    status: 'mapped' | 'stubbed';
    message: string;
    mediaAssets: PendingMediaAttachment[];
  } {
    const items = asArray(raw._items ?? raw.items);
    const sourceItems = items.length > 0 ? items : [raw];
    const mappedItems = sourceItems.slice(0, MAX_QUESTIONS_PER_BLOCK);

    const questions = mappedItems.map((item, questionIndex) => {
      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const text =
        asString(row.text) ||
        asString(row.title) ||
        asString(raw.body) ||
        component.title ||
        `Question ${questionIndex + 1}`;
      const rawOptions = asArray(row._options ?? row.options);
      let options: { text: string; isCorrect: boolean }[] =
        rawOptions.length >= 2
          ? rawOptions.map((opt, index) => {
              if (typeof opt === 'string') {
                return { text: opt, isCorrect: index === 0 };
              }
              const o = (opt ?? {}) as Record<string, unknown>;
              return {
                text: asString(o.text) || asString(o.title) || `Option ${index + 1}`,
                isCorrect: Boolean(o._isCorrect ?? o.isCorrect ?? index === 0),
              };
            })
          : [
              { text: 'Option A', isCorrect: true },
              { text: 'Option B', isCorrect: false },
            ];

      if (!options.some((o) => o.isCorrect)) {
        options[0].isCorrect = true;
      }

      return {
        text: truncate(stripHtml(text), 500),
        type: 'single',
        options: options.slice(0, 6),
        correctFeedback: asString(row.correctFeedback || row._feedbackCorrect),
        incorrectFeedback: asString(row.incorrectFeedback || row._feedbackIncorrect),
        imageUrl: '',
      };
    });

    return {
      formPayload: {
        contentDescription:
          stripHtml(component.body || '') ||
          `Imported question from Evolve component ${component.id}`,
        showFeedbackPerQuestion: true,
        questions,
      },
      status: items.length > MAX_QUESTIONS_PER_BLOCK ? 'stubbed' : 'mapped',
      message:
        items.length > MAX_QUESTIONS_PER_BLOCK
          ? `Mapped first ${MAX_QUESTIONS_PER_BLOCK} MCQ items (${items.length} items in Evolve).`
          : `Mapped MCQ → questionnaire (${questions.length} question${questions.length === 1 ? '' : 's'}).`,
      mediaAssets: [],
    };
  }
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
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
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

/** Evolve graphics often use large/small instead of src. */
function resolveEvolveGraphicSrc(raw: Record<string, unknown>): string {
  return (
    asString(nested(raw, ['_graphic', 'src'])) ||
    asString(nested(raw, ['_graphic', 'large'])) ||
    asString(nested(raw, ['_graphic', 'small'])) ||
    asString(nested(raw, ['graphic', 'src'])) ||
    asString(nested(raw, ['graphic', 'large'])) ||
    asString(nested(raw, ['graphic', 'small'])) ||
    asString(raw.src) ||
    ''
  );
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
    .map((s) => s.trim())
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
  };

  return typeLabel[sourceType] || 'Content';
}

function looksLikeEvolveId(value: string): boolean {
  // e.g. c-06_01_030_g, b-06_01_040, a-05
  return /^[a-z]-\d/i.test(value) || /^[a-z]-\d[\w-]*$/i.test(value);
}
