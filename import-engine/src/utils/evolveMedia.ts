import type { Asset } from '../models/Asset';

const MEDIA_EXTENSIONS =
  /\.(jpg|jpeg|png|gif|webp|svg|bmp|mp4|webm|mp3|wav|ogg|pdf)(\?|#|$)/i;

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|#|$)/i;

const MEDIA_OBJECT_KEYS = [
  'src',
  '_src',
  'large',
  'small',
  'path',
  '_path',
  'url',
  '_url',
  'href',
  'original',
  'poster',
  'desktop',
  'mobile',
  'tablet',
  'image',
  '_image',
  'filename',
  '_default',
  '_id',
  'id',
] as const;

const HTML_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  rsquo: '\u2019',
  lsquo: '\u2018',
  rdquo: '\u201D',
  ldquo: '\u201C',
  ndash: '\u2013',
  mdash: '\u2014',
  reg: '\u00AE',
  copy: '\u00A9',
  trade: '\u2122',
  hellip: '\u2026',
  pound: '\u00A3',
  euro: '\u20AC',
};

const TITLE_STOPWORDS = new Set([
  'title',
  'graphic',
  'image',
  'hot',
  'hotgraphic',
  'hotspot',
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'what',
  'next',
  'take',
  'look',
  'closer',
  'lets',
  'let',
  'contents',
  'are',
  'key',
  'features',
]);

const CHROME_ASSET =
  /(^|[-_\s])(logo|icon|favicon|sprite|bullet|spacer|pixel|blank|loading|spinner|pin)s?([-_\s.]|$)/i;

/** Mongo ObjectId used by Adapt/Evolve Asset:image fields before publish resolves a path. */
export function looksLikeAssetId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value.trim());
}

export function looksLikeMediaPath(value: string, options: { allowAssetId?: boolean } = {}): boolean {
  if (!value || value.length > 500) return false;
  const trimmed = value.trim();
  if (/^(https?:\/\/|data:|blob:)/i.test(trimmed)) return true;
  if (MEDIA_EXTENSIONS.test(trimmed)) return true;
  if (/(^|\/)(course|assets|images|media|video|audio)\//i.test(trimmed)) return true;
  if (options.allowAssetId && looksLikeAssetId(trimmed)) return true;
  return false;
}

export function isImageAsset(asset: Asset): boolean {
  const media = (asset.mediaType || '').toLowerCase();
  if (media.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.test(asset.filename || asset.path);
}

export function isChromeAsset(asset: Asset): boolean {
  return CHROME_ASSET.test(asset.filename || '');
}

export function extractMediaPath(value: unknown, depth = 0): string {
  if (value == null || depth > 5) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return looksLikeMediaPath(trimmed, { allowAssetId: true })
      ? trimmed.replace(/\\/g, '/')
      : '';
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractMediaPath(item, depth + 1);
      if (found) return found;
    }
    return '';
  }

  if (typeof value !== 'object') return '';
  const obj = value as Record<string, unknown>;

  const assetId = imageAssetIdFrom(obj);
  if (assetId) return assetId;

  for (const key of MEDIA_OBJECT_KEYS) {
    if (obj[key] === undefined) continue;
    const found = extractMediaPath(obj[key], depth + 1);
    if (found) return found;
  }

  const numericKeys = Object.keys(obj)
    .filter((key) => /^\d+$/.test(key))
    .map(Number)
    .sort((a, b) => b - a);
  for (const breakpoint of numericKeys) {
    const found = extractMediaPath(obj[String(breakpoint)], depth + 1);
    if (found) return found;
  }

  // Per-device renditions use keys such as _large / _small that are not in the known list.
  for (const [key, child] of Object.entries(obj)) {
    if (MEDIA_OBJECT_KEYS.includes(key as (typeof MEDIA_OBJECT_KEYS)[number])) continue;
    if (child && typeof child === 'object') {
      const found = extractMediaPath(child, depth + 1);
      if (found) return found;
    } else if (typeof child === 'string' && /<img\b|url\s*\(/i.test(child)) {
      const fromHtml = extractImgSrcFromHtml(child);
      if (fromHtml) return fromHtml;
    }
  }

  return '';
}

function imageAssetIdFrom(obj: Record<string, unknown>): string {
  const id = [obj._id, obj.id, obj.assetId, obj._assetId].find(
    (value) => typeof value === 'string' && looksLikeAssetId(value)
  );
  if (typeof id !== 'string') return '';
  const ext = String(obj._extension || obj.extension || '');
  const type = String(obj._type || obj.type || '');
  if (/(png|jpe?g|gif|webp|svg|bmp)/i.test(ext) || /image/i.test(type)) {
    return id.trim();
  }
  return '';
}

export function findFirstMediaString(node: unknown, depth = 0): string {
  if (node == null || depth > 8) return '';
  if (typeof node === 'string') {
    return looksLikeMediaPath(node) ? node.trim().replace(/\\/g, '/') : '';
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFirstMediaString(item, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof node !== 'object') return '';
  const obj = node as Record<string, unknown>;
  const preferred = [
    '_graphic',
    'graphic',
    '_mobileGraphic',
    '_src',
    'src',
    '_items',
    'items',
  ];
  for (const key of preferred) {
    if (obj[key] === undefined) continue;
    const found = findFirstMediaString(obj[key], depth + 1);
    if (found) return found;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (preferred.includes(key)) continue;
    if (key === 'alt' || key === 'title' || key === 'displayTitle' || key === 'body') continue;
    if (key === '_id' || key === 'id' || key === '_parentId' || key === '_component' || key === '_type') {
      continue;
    }
    const found = findFirstMediaString(value, depth + 1);
    if (found) return found;
  }
  return '';
}

/**
 * Evolve publishes a graphic as a folder:
 * `course/en/assets/{id}/asset.json` plus renditions (`original.jpg`, `large.png`, …).
 * Component JSON often points at `asset.json` or only the asset id.
 * Pick the image rendition instead of the metadata file.
 */
export function choosePackagedMedia(
  sourcePath: string,
  files: { path: string; filename: string }[]
): string {
  const normalised = sourcePath.replace(/\\/g, '/').replace(/^\.\//, '').trim();
  if (!normalised || /^https?:\/\//i.test(normalised)) return normalised;
  if (isDirectMediaFile(normalised) && normalised.includes('/')) return normalised;
  if (isDirectMediaFile(normalised)) {
    const match = files.find((file) => sameFilename(file, normalised));
    return match ? match.path.replace(/\\/g, '/') : normalised;
  }

  const folder = normalised.includes('/')
    ? normalised.slice(0, normalised.lastIndexOf('/'))
    : '';
  const assetId = assetIdFromReference(normalised);

  if (folder) {
    const inFolder = bestImage(
      files.filter((file) => isInsideFolder(file.path, folder))
    );
    if (inFolder) return inFolder;
  }

  if (assetId) {
    const lower = assetId.toLowerCase();
    const byId = bestImage(
      files.filter((file) => {
        const path = file.path.replace(/\\/g, '/').toLowerCase();
        const name = (file.filename || path.split('/').pop() || '').toLowerCase();
        return path.includes(`/${lower}/`) || path.includes(`/${lower}.`) || name.startsWith(lower);
      })
    );
    if (byId) return byId;
  }

  if (!normalised.includes('/')) {
    const byName = files.find((file) => sameFilename(file, normalised) && isDirectMediaFile(file.path));
    if (byName) return byName.path.replace(/\\/g, '/');
  }

  return '';
}

export function expandPackagePath(path: string, assets: Asset[]): string {
  if (!path) return '';
  const normalised = path.replace(/\\/g, '/');
  if (/^https?:\/\//i.test(normalised)) return normalised;

  const chosen = choosePackagedMedia(
    normalised,
    assets.map((asset) => ({
      path: asset.path.replace(/\\/g, '/'),
      filename: asset.filename,
    }))
  );
  if (chosen) return chosen;

  if (isDirectMediaFile(normalised) || normalised.includes('/')) return normalised;

  const lower = normalised.toLowerCase();
  const hit = assets.find((asset) => {
    const filename = asset.filename.toLowerCase();
    const assetPath = asset.path.toLowerCase().replace(/\\/g, '/');
    return filename === lower || assetPath.endsWith(`/${lower}`);
  });
  return hit?.path || normalised;
}

function sameFilename(file: { path: string; filename: string }, reference: string): boolean {
  const lower = reference.toLowerCase();
  const name = file.filename.toLowerCase();
  const path = file.path.replace(/\\/g, '/').toLowerCase();
  return name === lower || path.endsWith(`/${lower}`);
}

function isDirectMediaFile(path: string): boolean {
  return MEDIA_EXTENSIONS.test(path);
}

function assetIdFromReference(path: string): string {
  const trimmed = path.trim();
  if (looksLikeAssetId(trimmed)) return trimmed;
  const match = trimmed.match(/(?:^|\/)([a-f0-9]{24})(?:\/|\.|$)/i);
  return match?.[1] ?? '';
}

function isInsideFolder(path: string, folder: string): boolean {
  const prefix = `${folder.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()}/`;
  return path.replace(/\\/g, '/').toLowerCase().startsWith(prefix);
}

function bestImage(files: { path: string; filename: string }[]): string {
  const images = files.filter((file) =>
    IMAGE_EXTENSIONS.test(file.filename || file.path)
  );
  if (!images.length) return '';
  const ranked = [...images].sort((a, b) => imageRank(b) - imageRank(a));
  return ranked[0].path.replace(/\\/g, '/');
}

function imageRank(file: { path: string; filename: string }): number {
  const filename = file.filename || file.path.split('/').pop() || '';
  const stem = filename.replace(/\.[^.]+$/, '').toLowerCase();
  const rendition: Record<string, number> = {
    original: 100,
    extralarge: 80,
    'extra-large': 80,
    extra_large: 80,
    large: 70,
    desktop: 60,
    medium: 40,
    small: 20,
    mobile: 10,
    thumbnail: 5,
    thumb: 5,
  };
  const score = rendition[stem] ?? 50;
  const depth = file.path.split('/').length;
  return score * 10 - depth;
}

export function matchAssetByTitle(title: string, assets: Asset[]): Asset | undefined {
  const tokens = decodeHtmlEntities(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 5 && !TITLE_STOPWORDS.has(token));
  if (!tokens.length) return undefined;

  let best: { asset: Asset; score: number } | undefined;
  for (const asset of assets) {
    const haystack = `${asset.filename} ${asset.path}`.toLowerCase();
    const score = tokens.reduce((sum, token) => (haystack.includes(token) ? sum + token.length : sum), 0);
    if (score > 0 && (!best || score > best.score)) {
      best = { asset, score };
    }
  }
  return best?.asset;
}

export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&([a-z]+);/gi, (match, name: string) => HTML_ENTITIES[name.toLowerCase()] ?? match)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function acceptImageRef(value: string): string {
  const trimmed = decodeHtmlEntities(value).trim().replace(/\\/g, '/');
  if (!trimmed || /^about:blank$/i.test(trimmed)) return '';
  const unquoted = trimmed.replace(/^['"]|['"]$/g, '');
  return looksLikeMediaPath(unquoted, { allowAssetId: true }) ? unquoted : '';
}

/**
 * Pull the first content image out of Evolve rich text.
 * Item graphics are often an <img>, a srcset, or a CSS background on the step body.
 */
export function extractImgSrcFromHtml(html: string): string {
  if (!html) return '';
  const decoded = decodeHtmlEntities(html);

  const attr =
    decoded.match(/<img\b[^>]*\b(?:src|data-src|data-orig-src|data-path)\s*=\s*["']([^"']+)["']/i) ||
    decoded.match(/<img\b[^>]*\bsrc\s*=\s*([^\s>"']+)/i);
  const fromAttr = attr?.[1] ? acceptImageRef(attr[1]) : '';
  if (fromAttr) return fromAttr;

  const srcset = decoded.match(/\bsrcset\s*=\s*["']([^"']+)["']/i);
  if (srcset?.[1]) {
    const first = srcset[1].split(',')[0]?.trim().split(/\s+/)[0] || '';
    const fromSrcset = acceptImageRef(first);
    if (fromSrcset) return fromSrcset;
  }

  const background = decoded.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
  return background?.[1] ? acceptImageRef(background[1]) : '';
}
