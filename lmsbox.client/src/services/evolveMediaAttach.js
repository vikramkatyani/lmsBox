import interactiveLessonsService from './interactiveLessons';
import { getFile, findFileBySuffix } from '@import-engine/src/types/VirtualFileSystem';
import { choosePackagedMedia, resolveAssetIdFromManifests } from '@import-engine/src/utils/evolveMedia';

const ATTACH_PLACEHOLDER_HTML = /<p><em>(Image will attach from Evolve package:.*?|Graphic component imported without image asset\.)<\/em><\/p>/gi;
const ATTACH_PLACEHOLDER_TEXT = /(Image will attach from Evolve package:\s*\S*|Graphic component imported without image asset\.?)/gi;

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
  const direct = lookupPath(vfs, normalised);
  if (direct) return direct;

  const fromManifest = resolveAssetIdFromManifests(normalised, jsonManifests(vfs), files);
  return fromManifest ? lookupPath(vfs, fromManifest) : null;
}

const manifestCache = new WeakMap();

function jsonManifests(vfs) {
  if (manifestCache.has(vfs)) return manifestCache.get(vfs);
  const manifests = [];
  for (const path of vfs.paths || []) {
    if (!/\.json$/i.test(path)) continue;
    const entry = getFile(vfs, path);
    if (!entry) continue;
    const text = entry.text ?? (entry.data ? new TextDecoder().decode(entry.data) : null);
    manifests.push({ path, text });
  }
  manifestCache.set(vfs, manifests);
  return manifests;
}

function withoutAttachPlaceholders(formPayload) {
  const next = { ...formPayload };
  next.bodyHtml = String(next.bodyHtml || '').replace(ATTACH_PLACEHOLDER_HTML, '').trim();
  next.body = String(next.body || '').replace(ATTACH_PLACEHOLDER_TEXT, '').trim();
  return next;
}

function withMissingImageNote(formPayload, sourcePath) {
  const note = `Image could not be imported from the Evolve package (${sourcePath}). Upload it in the block editor.`;
  const next = withoutAttachPlaceholders(formPayload);
  const escaped = note.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  next.bodyHtml = `<p><em>${escaped}</em></p>${next.bodyHtml}`;
  next.body = next.body ? `${note}\n\n${next.body}` : note;
  return next;
}

function applyTargetField(formPayload, targetField, url, alt) {
  const next = { ...formPayload };

  if (targetField === 'imageUrl' || targetField === 'bodyHtml') {
    const cleaned = withoutAttachPlaceholders(next);
    cleaned.imageUrl = url;
    if (!cleaned.imageAlt && alt) cleaned.imageAlt = String(alt).slice(0, 300);
    return cleaned;
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
              if (attachment.targetField === 'imageUrl' || attachment.targetField === 'bodyHtml') {
                formPayload = withMissingImageNote(formPayload, pathKey);
              }
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
