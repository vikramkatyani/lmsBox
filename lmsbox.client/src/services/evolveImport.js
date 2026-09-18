import api from '../utils/api';
import { attachEvolveMedia } from './evolveMediaAttach';

/**
 * Sprint 2/3 — commit a mapped Evolve import plan as a Draft LMSBox course,
 * then attach package media from the in-memory VFS.
 */
export const evolveImportService = {
  /**
   * POST /api/admin/import/evolve
   * @param {object} plan - ImportDraftPlan from EvolveToLmsboxMapper
   */
  async createDraftCourse(plan) {
    const payload = {
      title: plan.title,
      description: plan.description ?? null,
      shortDescription: plan.shortDescription ?? null,
      category: 'Imported',
      tags: plan.tags?.length ? plan.tags : ['evolve', 'import'],
      certificateEnabled: true,
      requireSequentialLessons: plan.requireSequentialLessons ?? true,
      showLessonNavigation: plan.showLessonNavigation ?? true,
      lessons: (plan.lessons || []).map((lesson, lessonIndex) => ({
        title: lesson.title,
        description: lesson.description ?? null,
        sourcePageId: lesson.sourcePageId ?? null,
        sourceLessonId: lesson.sourceLessonId ?? null,
        sourceOrder: lesson.sourceOrder ?? lessonIndex + 1,
        blocks: (lesson.blocks || []).map((block, blockIndex) => ({
          title: block.title,
          blockType: block.blockType,
          formPayloadJson: JSON.stringify(block.formPayload ?? {}),
          mediaAssetsJson: JSON.stringify(block.mediaAssets ?? []),
          sourceComponentId: block.sourceComponentId ?? null,
          sourceType: block.sourceType ?? null,
          sourceOrder: block.sourceOrder ?? blockIndex + 1,
        })),
      })),
      report: (plan.report || []).map((item) => ({
        sourceComponentId: item.sourceComponentId,
        sourceType: item.sourceType,
        sourceTitle: item.sourceTitle,
        status: item.status,
        targetBlockType: item.targetBlockType ?? null,
        message: item.message,
        reasonCode: item.reasonCode ?? null,
        pagePath: item.pagePath ?? null,
      })),
    };

    const response = await api.post('/api/admin/import/evolve', payload);
    return response.data;
  },

  /**
   * Create draft course then upload pending Evolve media into block payloads.
   * @param {object} plan
   * @param {object} vfs - inspection VFS
   * @param {(msg: string) => void} [onProgress]
   */
  async createDraftCourseWithMedia(plan, vfs, onProgress) {
    onProgress?.('Creating draft course…');
    const importResult = await this.createDraftCourse(plan);
    const pendingCount = plan?.stats?.pendingMediaCount ?? 0;

    if (!vfs || pendingCount === 0) {
      return {
        ...importResult,
        mediaAttach: { uploaded: 0, failed: 0, errors: [], skipped: true },
      };
    }

    onProgress?.('Attaching media from package…');
    const mediaAttach = await attachEvolveMedia({
      importResult,
      plan,
      vfs,
      onProgress,
    });

    return {
      ...importResult,
      mediaAttach,
    };
  },
};

export default evolveImportService;
