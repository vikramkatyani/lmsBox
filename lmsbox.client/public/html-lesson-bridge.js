/**
 * HTML lesson completion bridge.
 * - If [data-lmsbox-complete-trigger] exists: complete when learner reaches it (scroll into view or click).
 * - Otherwise: complete when learner reaches the end of the content.
 */
(function () {
  if (window.__lmsboxHtmlBridgeLoaded) {
    return;
  }
  window.__lmsboxHtmlBridgeLoaded = true;

  var params = new URLSearchParams(window.location.search);
  var lessonId = params.get('lessonId');
  var completed = false;
  var SHORT_CONTENT_DWELL_MS = 1500;
  var END_THRESHOLD_PX = 48;

  function notifyComplete() {
    if (completed) {
      return;
    }
    completed = true;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: 'html-lesson-completed', lessonId: lessonId },
        '*'
      );
    }
  }

  function isElementInViewport(el) {
    var rect = el.getBoundingClientRect();
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    return rect.top < viewportHeight && rect.bottom > 0;
  }

  function observeReach(el, options) {
    options = options || {};
    var allowImmediate = !!options.allowImmediate;
    var wasInitiallyVisible = false;
    var hasScrolled = false;

    try {
      wasInitiallyVisible = isElementInViewport(el);
    } catch (e) {
      wasInitiallyVisible = false;
    }

    el.addEventListener('click', function () {
      notifyComplete();
    });

    window.addEventListener(
      'scroll',
      function () {
        hasScrolled = true;
      },
      { passive: true }
    );

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            if (!entry.isIntersecting) {
              continue;
            }
            // Trigger placed above the fold: require scroll or click (click handled separately).
            // End sentinel / below-fold trigger: complete on intersection.
            if (allowImmediate || !wasInitiallyVisible || hasScrolled) {
              notifyComplete();
              observer.disconnect();
              return;
            }
          }
        },
        { threshold: 0.15 }
      );
      observer.observe(el);
    }

    if (allowImmediate && wasInitiallyVisible) {
      // Short page: entire content already visible — complete after a brief dwell.
      setTimeout(function () {
        if (!completed && isElementInViewport(el)) {
          notifyComplete();
        }
      }, SHORT_CONTENT_DWELL_MS);
    }

    // Fallback scroll check when IntersectionObserver is unavailable.
    if (!('IntersectionObserver' in window)) {
      var check = function () {
        if (completed) {
          return;
        }
        if (!isElementInViewport(el)) {
          return;
        }
        if (allowImmediate || !wasInitiallyVisible || hasScrolled) {
          notifyComplete();
        }
      };
      window.addEventListener('scroll', check, { passive: true });
      window.addEventListener('resize', check);
      setTimeout(check, allowImmediate ? SHORT_CONTENT_DWELL_MS : 0);
    }
  }

  function setupEndOfContent() {
    var root = document.body || document.documentElement;
    if (!root) {
      return;
    }

    var sentinel = document.createElement('div');
    sentinel.setAttribute('data-lmsbox-end-sentinel', '');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'height:1px;width:100%;pointer-events:none;';
    root.appendChild(sentinel);

    // Also treat near-bottom scroll as completion for long pages.
    var checkScrollEnd = function () {
      if (completed) {
        return;
      }
      var doc = document.documentElement;
      var body = document.body;
      var scrollTop = window.pageYOffset || doc.scrollTop || 0;
      var viewport = window.innerHeight || doc.clientHeight || 0;
      var height = Math.max(
        doc.scrollHeight || 0,
        body ? body.scrollHeight : 0,
        doc.offsetHeight || 0
      );
      if (height <= viewport + END_THRESHOLD_PX) {
        return; // short content handled by sentinel dwell
      }
      if (scrollTop + viewport >= height - END_THRESHOLD_PX) {
        notifyComplete();
      }
    };

    window.addEventListener('scroll', checkScrollEnd, { passive: true });
    observeReach(sentinel, { allowImmediate: true });
  }

  function setup() {
    var trigger = document.querySelector('[data-lmsbox-complete-trigger]');
    if (trigger) {
      observeReach(trigger, { allowImmediate: false });
      return;
    }
    setupEndOfContent();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
