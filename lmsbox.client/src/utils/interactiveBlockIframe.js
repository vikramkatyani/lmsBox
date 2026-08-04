import themeCss from '../styles/lmsbox-theme.css?raw';
import blocksCss from '../styles/lmsbox-interactive-blocks.css?raw';
import { API_BASE } from './apiBase';

/** Permissions needed for HTML5 video, YouTube/Vimeo embeds, and block scripts. */
export const INTERACTIVE_BLOCK_IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox allow-forms';

export const INTERACTIVE_BLOCK_IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';

/**
 * Builds a srcDoc document for interactive block HTML.
 * Height reporting measures the content root only (not body/html),
 * so parent iframe resizing cannot create a feedback loop.
 *
 * Design-system CSS is inlined so blocks inherit LMSbox styling without
 * depending on an external stylesheet fetch inside the srcDoc iframe.
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

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
html,body{margin:0;padding:0;background:transparent!important;height:auto!important;min-height:0!important;overflow:hidden;}
${themeCss}
${blocksCss}
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
