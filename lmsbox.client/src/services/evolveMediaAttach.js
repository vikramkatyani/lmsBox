import interactiveLessonsService from './interactiveLessons';
import { getFile, findFileBySuffix } from '@import-engine/src/types/VirtualFileSystem';
import { choosePackagedMedia } from '@import-engine/src/utils/evolveMedia';

/**
 * Sprint 3 — upload Evolve package media into created LMSBox draft blocks.
 */

function guessMime(fileName) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const map = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    flac: 'audio/flac',
  };
  return map[ext] || 'application/octet-stream';
}

function lookupPath(vfs, sourcePath) {
  const normalised = String(sourcePath).replace(/\\/g, '/').replace(/^\.\//, '');
  const candidates = [
    normalised,
    normalised.replace(/^\/+/, ''),
    `course/${normalised}`,
    `course/en/${normalised}`,
  ];
  if (normalised.startsWith('course/')) {
    candidates.push(normalised.slice('course/'.length));
  }
  for (const candidate of candidates) {
    const hit = getFile(vfs, candidate);
    if (hit?.data && !/\.json$/i.test(hit.filename || hit.path || '')) return hit;
  }
  const filename = normalised.split('/').pop() || normalised;
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|mp4|webm|mp3|wav|ogg|m4a|aac|flac|mov)$/i.test(filename)) {
    const suffixHit = findFileBySuffix(vfs, filename);
    if (suffixHit?.data) return suffixHit;
  }
  return null;
}

function resolveVfsFile(vfs, sourcePath) {
  if (!vfs || !sourcePath) return null;
  const normalised = String(sourcePath).replace(/\\/g, '/').replace(/^\.\//, '');
  const files = (vfs.paths || []).map((path) => {
    const clean = String(path).replace(/\\/g, '/');
    return { path: clean, filename: clean.split('/').pop() || clean };
  });
  const chosen = choosePackagedMedia(normalised, files);
  if (chosen) {
    const hit = lookupPath(vfs, chosen);
    if (hit) return hit;
  }
  return lookupPath(vfs, normalised);
}

function applyTargetField(formPayload, targetField, url, alt) {
  const next = { ...formPayload };

  if (targetField === 'bodyHtml') {
    const img = `<p><img src="${url}" alt="${alt || ''}" /></p>`;
    const existing = String(next.bodyHtml || '');
    // Replace attach placeholder notes when present.
    const cleaned = existing
      .replace(/<p><em>Image will attach from Evolve package:.*?<\/em><\/p>/gi, '')
      .replace(/<p><em>Graphic component imported without image asset\.<\/em><\/p>/gi, '');
    next.bodyHtml = `${img}${cleaned}`;
    next.body = String(next.body || '')
      .replace(/Image will attach from Evolve package:[^.]*\.?/gi, '')
      .replace(/Graphic component imported without image asset\.?/gi, '')
      .trim();
    if (!next.body) {
      next.body = alt || 'Image';
    }
    return next;
  }

  const slideMatch = /^(slides|panels|nodes|pins)\.(\d+)\.imageUrl$/.exec(targetField);
  if (slideMatch) {
    const key = slideMatch[1];
    const index = Number(slideMatch[2]);
    const list = Array.isArray(next[key]) ? [...next[key]] : [];
    if (list[index]) {
      list[index] = { ...list[index], imageUrl: url };
      next[key] = list;
    }
    return next;
  }

  const questionMatch = /^questions\.(\d+)\.imageUrl$/.exec(targetField);
  if (questionMatch) {
    const index = Number(questionMatch[1]);
    const list = Array.isArray(next.questions) ? [...next.questions] : [];
    if (list[index]) {
      list[index] = { ...list[index], imageUrl: url };
      next.questions = list;
    }
    return next;
  }

  next[targetField] = url;
  return next;
}

/**
 * @param {object} params
 * @param {object} params.importResult - API result from createDraftCourse
 * @param {object} params.plan - ImportDraftPlan (with mediaAssets on blocks)
 * @param {object} params.vfs - VirtualFileSystem from inspection
 * @param {(msg: string) => void} [params.onProgress]
 */
export async function attachEvolveMedia({ importResult, plan, vfs, onProgress }) {
  const planBlocksBySource = new Map();
  for (const lesson of plan?.lessons || []) {
    for (const block of lesson.blocks || []) {
      if (block.sourceComponentId) {
        planBlocksBySource.set(block.sourceComponentId, block);
      }
    }
  }

  let uploaded = 0;
  let failed = 0;
  const errors = [];
  const urlCache = new Map(); // sourcePath -> blob url (dedupe)

  for (const lesson of importResult?.lessons || []) {
    for (const created of lesson.blocks || []) {
      const planBlock = planBlocksBySource.get(created.sourceComponentId);
      const attachments = planBlock?.mediaAssets || [];
      if (!attachments.length || !created.blockId) continue;

      let formPayload = { ...(planBlock.formPayload || {}) };
      let mediaAssetsJson = '[]';

      for (const attachment of attachments) {
        const pathKey = attachment.sourcePath;
        try {
          let url = urlCache.get(pathKey);
          if (!url) {
            const fileEntry = resolveVfsFile(vfs, pathKey);
            if (!fileEntry?.data) {
              failed += 1;
              const label = String(pathKey).split('/').pop() || pathKey;
              errors.push(
                /\.json$/i.test(label)
                  ? `No image rendition in ZIP for ${pathKey}`
                  : `Missing in ZIP: ${pathKey}`
              );
              continue;
            }

            const mime = attachment.contentType || guessMime(fileEntry.filename || attachment.fileName || pathKey);
            const file = new File([fileEntry.data], fileEntry.filename || attachment.fileName || 'asset', {
              type: mime,
            });

            onProgress?.(`Uploading ${attachment.fileName || pathKey}…`);
            const upload = await interactiveLessonsService.uploadBlockMedia(
              lesson.lessonId,
              created.blockId,
              file
            );
            url = upload.url;
            urlCache.set(pathKey, url);
            mediaAssetsJson = upload.mediaAssetsJson || mediaAssetsJson;
          }

          formPayload = applyTargetField(
            formPayload,
            attachment.targetField,
            url,
            attachment.alt
          );
          uploaded += 1;
        } catch (err) {
          failed += 1;
          errors.push(
            `${pathKey}: ${err?.response?.data?.message || err.message || String(err)}`
          );
        }
      }

      try {
        await interactiveLessonsService.updateBlock(lesson.lessonId, created.blockId, {
          title: created.title || planBlock.title,
          blockType: created.blockType || planBlock.blockType,
          formPayloadJson: JSON.stringify(formPayload),
          mediaAssetsJson,
        });
      } catch (err) {
        failed += 1;
        errors.push(
          `Failed to save block ${created.blockId}: ${err?.response?.data?.message || err.message}`
        );
      }
    }
  }

  return { uploaded, failed, errors, dedupedUrls: urlCache.size };
}

export default { attachEvolveMedia };
