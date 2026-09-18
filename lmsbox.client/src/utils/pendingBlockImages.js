const pendingByUrl = new Map();

export function attachPendingImage(file) {
  const url = URL.createObjectURL(file);
  pendingByUrl.set(url, file);
  return url;
}

export function releasePendingImage(url) {
  if (!url || !pendingByUrl.has(url)) return;
  URL.revokeObjectURL(url);
  pendingByUrl.delete(url);
}

export function releaseAllPendingImages() {
  pendingByUrl.forEach((_, url) => URL.revokeObjectURL(url));
  pendingByUrl.clear();
}

export function getPendingImageFile(url) {
  return pendingByUrl.get(url) || null;
}

export function isPendingImageUrl(url) {
  return typeof url === 'string' && pendingByUrl.has(url);
}

function walk(value, onString) {
  if (typeof value === 'string') {
    return onString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, onString));
  }
  if (value && typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, item]) => {
      next[key] = walk(item, onString);
    });
    return next;
  }
  return value;
}

export function collectPendingImages(value) {
  const collected = [];
  const seen = new Set();
  walk(value, (url) => {
    const file = pendingByUrl.get(url);
    if (file && !seen.has(url)) {
      seen.add(url);
      collected.push({ url, file });
    }
    return url;
  });
  return collected;
}

export function replacePendingImageUrls(value, urlMap) {
  return walk(value, (url) => urlMap[url] ?? url);
}

export function withoutPendingImageUrls(value) {
  return walk(value, (url) => (pendingByUrl.has(url) ? '' : url));
}
