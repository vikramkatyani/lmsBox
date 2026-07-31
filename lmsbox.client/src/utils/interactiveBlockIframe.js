const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Builds a srcDoc document for interactive block HTML.
 * Height reporting measures the content root only (not body/html),
 * so parent iframe resizing cannot create a feedback loop.
 */
export function buildInteractiveBlockSrcDoc(html) {
  if (!html) return '';

  const runtimeScript = `<script src="${API_BASE}/interactive-lesson-runtime.js"></script>`;
  const resizeScript = `<script>
(function () {
  var lastReported = 0;
  var scheduled = null;

  function getContentRoot() {
    return document.querySelector('.lmsbox-interactive-block')
      || document.body.querySelector(':scope > div, :scope > section, :scope > article, :scope > form')
      || document.body.firstElementChild;
  }

  function getContentHeight() {
    var root = getContentRoot();
    if (!root) return 0;
    var rect = root.getBoundingClientRect();
    var style = window.getComputedStyle(root);
    var marginTop = parseFloat(style.marginTop) || 0;
    var marginBottom = parseFloat(style.marginBottom) || 0;
    return Math.ceil(rect.height + marginTop + marginBottom);
  }

  function reportHeight() {
    var height = getContentHeight();
    if (!height || Math.abs(height - lastReported) < 2) return;
    lastReported = height;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'interactive-block-resize', height: height }, '*');
    }
  }

  function scheduleReport() {
    if (scheduled) return;
    scheduled = requestAnimationFrame(function () {
      scheduled = null;
      reportHeight();
    });
  }

  window.addEventListener('load', scheduleReport);
  document.addEventListener('DOMContentLoaded', function () {
    scheduleReport();
    setTimeout(scheduleReport, 100);
    setTimeout(scheduleReport, 400);
    var root = getContentRoot();
    if (root && window.ResizeObserver) {
      new ResizeObserver(scheduleReport).observe(root);
    }
  });
})();
</script>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;padding:0;background:transparent;height:auto!important;min-height:0!important;overflow:hidden;}
</style></head><body>${html}${runtimeScript}${resizeScript}</body></html>`;
}

export function nextIframeHeight(currentHeight, reportedHeight, minHeight = 200) {
  if (typeof reportedHeight !== 'number' || !Number.isFinite(reportedHeight)) {
    return currentHeight;
  }
  const next = Math.max(minHeight, Math.ceil(reportedHeight));
  if (typeof currentHeight === 'number' && Math.abs(next - currentHeight) < 2) {
    return currentHeight;
  }
  return next;
}
