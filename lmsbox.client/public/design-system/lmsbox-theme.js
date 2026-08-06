/**
 * LMSbox Interactive Component Theme — behaviours
 * =================================================
 * Progressive enhancement for learning components.
 *
 * Auto-initialises on DOMContentLoaded for:
 *   [data-lms-toggle]   — reveal / accordion / timeline expand
 *   [data-lms-quiz]     — multiple-choice knowledge checks
 *   [data-lms-flip]     — flip cards
 *   [data-lms-hotspot]  — hotspot diagrams
 *   [data-lms-process]  — step-by-step process flows
 *   [data-lms-reflect]  — reflection panels (localStorage)
 *   .lms-animate-in / .lms-rise — scroll fade-in
 *
 * Public API: window.LmsBoxTheme
 */
(function (global) {
  'use strict';

  var PLUS_SVG =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function prefersReducedMotion() {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* --------------------------------------------------------------------------
     Scroll reveal
     -------------------------------------------------------------------------- */

  function initScrollReveal(root) {
    var els = qsa('.lms-animate-in, .lms-rise', root);
    if (!els.length) return;

    if (prefersReducedMotion() || !('IntersectionObserver' in global)) {
      els.forEach(function (el) {
        el.classList.add('is-in', 'in');
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in', 'in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    els.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 70 + 'ms';
      io.observe(el);
    });
  }

  /* --------------------------------------------------------------------------
     Expandable body helpers (reveal / accordion / timeline)
     -------------------------------------------------------------------------- */

  function findExpandBody(el) {
    return (
      qs('.lms-reveal__body, .lms-accordion__body, .lms-timeline__body, .rbody, .abody, .tbody', el)
    );
  }

  function findExpandTrigger(el) {
    return (
      qs(
        '.lms-reveal__trigger, .lms-accordion__trigger, .lms-timeline__trigger, .rtop, .atop, .ttop, button',
        el
      )
    );
  }

  function setExpanded(el, open) {
    el.classList.toggle('is-open', open);
    el.classList.toggle('open', open);
    var btn = findExpandTrigger(el);
    if (btn) btn.setAttribute('aria-expanded', String(open));
    var body = findExpandBody(el);
    if (body) {
      body.style.maxHeight = open ? body.scrollHeight + 'px' : '0px';
    }
  }

  function closeOthers(el, exclusiveSel) {
    if (!exclusiveSel) return;
    qsa(exclusiveSel).forEach(function (other) {
      if (other !== el && (other.classList.contains('is-open') || other.classList.contains('open'))) {
        setExpanded(other, false);
      }
    });
  }

  function wireToggle(el, opts) {
    opts = opts || {};
    var btn = findExpandTrigger(el);
    if (!btn) return;

    if (!btn.getAttribute('aria-expanded')) {
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', function () {
      var open = el.classList.contains('is-open') || el.classList.contains('open');
      var exclusive = opts.exclusive || el.getAttribute('data-exclusive') || null;
      closeOthers(el, exclusive);
      setExpanded(el, !open);

      if (!open && opts.scroll !== false) {
        setTimeout(function () {
          var r = el.getBoundingClientRect();
          if (r.bottom > global.innerHeight) {
            el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
          }
        }, 340);
      }

      qsa('.lms-hint').forEach(function (h) {
        h.classList.add('is-gone', 'gone');
      });
    });
  }

  function initToggles(root) {
    qsa('[data-lms-toggle], [data-toggle]', root).forEach(function (el) {
      wireToggle(el, {
        exclusive: el.getAttribute('data-exclusive') || null
      });
    });

    // Also wire structural components that use standard class names
    qsa('.lms-reveal, .lms-accordion__item, .lms-timeline__item', root).forEach(function (el) {
      if (el.hasAttribute('data-lms-toggle') || el.hasAttribute('data-toggle')) return;
      if (!findExpandTrigger(el) || !findExpandBody(el)) return;
      wireToggle(el, {
        exclusive: el.getAttribute('data-exclusive') || null
      });
    });

    global.addEventListener('resize', function () {
      qsa('.is-open, .open', root || document).forEach(function (el) {
        var body = findExpandBody(el);
        if (body && (el.classList.contains('is-open') || el.classList.contains('open'))) {
          body.style.maxHeight = body.scrollHeight + 'px';
        }
      });
    });
  }

  /* --------------------------------------------------------------------------
     Multiple choice / quiz
     -------------------------------------------------------------------------- */

  function buildQuiz(root) {
    var opts = qsa('.lms-question__option, .opt', root);
    var fb = qs('.lms-question__feedback, .feedback', root);
    var done = false;

    opts.forEach(function (o) {
      o.addEventListener('click', function () {
        if (done) return;
        done = true;
        var best = o.getAttribute('data-correct') === 'true';

        opts.forEach(function (x) {
          x.disabled = true;
          if (x === o) {
            x.setAttribute('data-state', 'chosen');
          } else if (x.getAttribute('data-correct') === 'true') {
            x.setAttribute('data-state', 'best');
          } else {
            x.classList.add('is-dim', 'dim');
          }
        });

        if (fb) {
          var titleEl = qs('[data-fb-title]', fb);
          var textEl = qs('[data-fb-text]', fb);
          var lbl = qs('.lms-question__feedback-label, .lbl', fb);

          if (titleEl) titleEl.textContent = o.getAttribute('data-title') || '';
          if (textEl) textEl.innerHTML = o.getAttribute('data-text') || '';
          if (lbl) {
            lbl.textContent = best ? "That's right" : "Let's look at that again";
          }

          fb.setAttribute('data-correct', String(best));
          fb.classList.add('is-on', 'on');

          setTimeout(function () {
            fb.scrollIntoView({
              behavior: prefersReducedMotion() ? 'auto' : 'smooth',
              block: 'nearest'
            });
          }, 120);
        }
      });
    });
  }

  function initQuizzes(root) {
    qsa('[data-lms-quiz], [data-quiz], .lms-question', root).forEach(function (el) {
      if (!qs('.lms-question__option, .opt', el)) return;
      buildQuiz(el);
    });
  }

  /* --------------------------------------------------------------------------
     Flip cards
     -------------------------------------------------------------------------- */

  function initFlips(root) {
    qsa('[data-lms-flip], .lms-flip', root).forEach(function (el) {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
      el.setAttribute('aria-pressed', 'false');

      function flip() {
        var on = el.classList.toggle('is-flipped');
        el.setAttribute('aria-pressed', String(on));
      }

      el.addEventListener('click', flip);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          flip();
        }
      });
    });
  }

  /* --------------------------------------------------------------------------
     Hotspots
     -------------------------------------------------------------------------- */

  function initHotspots(root) {
    qsa('[data-lms-hotspot], .lms-hotspot', root).forEach(function (wrap) {
      var pins = qsa('.lms-hotspot__pin', wrap);
      var panels = qsa('.lms-hotspot__panel', wrap);

      function closeAll() {
        pins.forEach(function (p) {
          p.setAttribute('aria-expanded', 'false');
        });
        panels.forEach(function (panel) {
          panel.classList.remove('is-open');
          panel.setAttribute('data-open', '0');
          panel.hidden = true;
        });
      }

      closeAll();

      pins.forEach(function (pin) {
        var targetId = pin.getAttribute('aria-controls') || pin.getAttribute('data-panel');
        var panel = targetId
          ? document.getElementById(targetId) || qs('[data-panel-id="' + targetId + '"]', wrap)
          : null;

        if (!panel) {
          var idx = pins.indexOf(pin);
          panel = panels[idx] || null;
        }

        pin.setAttribute('aria-expanded', 'false');
        if (panel && panel.id) pin.setAttribute('aria-controls', panel.id);

        pin.addEventListener('click', function (e) {
          e.stopPropagation();
          var open = pin.getAttribute('aria-expanded') === 'true';
          closeAll();
          if (!open && panel) {
            pin.setAttribute('aria-expanded', 'true');
            panel.hidden = false;
            panel.classList.add('is-open');
            panel.setAttribute('data-open', '1');

            // Position panel near pin when absolute coords exist
            var top = pin.style.top;
            var left = pin.style.left;
            if (top && left && !panel.hasAttribute('data-fixed')) {
              var topN = parseFloat(top);
              var leftN = parseFloat(left);
              panel.style.top = Math.min(topN + 4, 72) + '%';
              panel.style.left = Math.min(Math.max(leftN, 8), 55) + '%';
            }
          }
        });
      });

      document.addEventListener('click', function (e) {
        if (!wrap.contains(e.target)) closeAll();
      });

      wrap.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeAll();
      });
    });
  }

  /* --------------------------------------------------------------------------
     Process flow
     -------------------------------------------------------------------------- */

  function initProcess(root) {
    qsa('[data-lms-process], .lms-process', root).forEach(function (wrap) {
      var nextBtn = qs('[data-lms-process-next], .lms-process__next', wrap);
      var resetBtn = qs('[data-lms-process-reset], .lms-process__reset', wrap);
      var prog = qs('[data-lms-process-progress], .lms-process__progress', wrap);
      var steps = qsa('.lms-process__step', wrap);
      var nodes = qsa('.lms-process__node', wrap);
      var finish = qs('[data-lms-process-finish]', wrap);
      var total = steps.length;
      var i = 0;

      // Optional node map: data-node-map="1,1,2,2,3"
      var mapAttr = wrap.getAttribute('data-node-map');
      var nodeMap = mapAttr
        ? mapAttr.split(',').map(function (n) {
            return Number(n.trim());
          })
        : null;

      function render() {
        steps.forEach(function (s) {
          var n = Number(s.getAttribute('data-step'));
          var show = n <= i;
          s.classList.toggle('is-show', show);
          s.classList.toggle('show', show);
        });

        nodes.forEach(function (n) {
          var id = Number(n.getAttribute('data-node'));
          var active = false;
          if (i > 0) {
            if (nodeMap && nodeMap[i] != null) {
              active = id === nodeMap[i];
            } else {
              active = id === i || id === Math.min(i, nodes.length);
            }
          }
          n.classList.toggle('is-on', active);
          n.classList.toggle('on', active);
        });

        if (prog) prog.textContent = 'Step ' + i + ' of ' + total;

        if (nextBtn) {
          if (i === 0) {
            nextBtn.hidden = false;
            nextBtn.textContent = nextBtn.getAttribute('data-label-start') || 'Start the sequence';
          } else if (i < total) {
            nextBtn.hidden = false;
            nextBtn.textContent =
              (nextBtn.getAttribute('data-label-next') || 'Reveal step') + ' ' + (i + 1);
          } else {
            nextBtn.hidden = true;
          }
        }

        if (resetBtn) resetBtn.hidden = i < total;
        if (finish) {
          finish.hidden = i < total;
          if (i >= total) {
            qsa('.lms-animate-in, .lms-rise', finish).forEach(function (el) {
              el.classList.add('is-in', 'in');
            });
          }
        }
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          if (i < total) {
            i++;
            render();
          }
        });
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          i = 0;
          render();
        });
      }

      render();
    });
  }

  /* --------------------------------------------------------------------------
     Reflection (optional local persistence)
     -------------------------------------------------------------------------- */

  function initReflection(root) {
    qsa('[data-lms-reflect], .lms-reflection', root).forEach(function (wrap) {
      var input = qs('textarea, .lms-reflection__input', wrap);
      var count = qs('.lms-reflection__count, [data-lms-reflect-count]', wrap);
      var saved = qs('.lms-reflection__saved, [data-lms-reflect-saved]', wrap);
      var saveBtn = qs('[data-lms-reflect-save]', wrap);
      var key = wrap.getAttribute('data-storage-key') || null;
      var timer;

      function wordCount(text) {
        var t = (text || '').trim();
        return t ? t.split(/\s+/).length : 0;
      }

      function updateCount() {
        if (count && input) {
          var n = wordCount(input.value);
          count.textContent = n + (n === 1 ? ' word' : ' words');
        }
      }

      function showSaved() {
        if (!saved) return;
        saved.classList.add('is-on', 'on');
        clearTimeout(timer);
        timer = setTimeout(function () {
          saved.classList.remove('is-on', 'on');
        }, 1800);
      }

      function persist() {
        if (!key || !input || !global.localStorage) return;
        try {
          global.localStorage.setItem(key, input.value);
          showSaved();
        } catch (e) {
          /* ignore quota / private mode */
        }
      }

      if (key && input && global.localStorage) {
        try {
          var existing = global.localStorage.getItem(key);
          if (existing != null) input.value = existing;
        } catch (e) {
          /* ignore */
        }
      }

      if (input) {
        input.addEventListener('input', updateCount);
        updateCount();
      }

      if (saveBtn) {
        saveBtn.addEventListener('click', persist);
      } else if (input && key) {
        var debounce;
        input.addEventListener('input', function () {
          clearTimeout(debounce);
          debounce = setTimeout(persist, 600);
        });
      }
    });
  }

  /* --------------------------------------------------------------------------
     Ensure plus icons exist where expected
     -------------------------------------------------------------------------- */

  function ensurePlusIcons(root) {
    qsa('.lms-plus:empty', root).forEach(function (el) {
      el.innerHTML = PLUS_SVG;
    });
  }

  /* --------------------------------------------------------------------------
     Public init
     -------------------------------------------------------------------------- */

  function init(root) {
    root = root || document;
    ensurePlusIcons(root);
    initScrollReveal(root);
    initToggles(root);
    initQuizzes(root);
    initFlips(root);
    initHotspots(root);
    initProcess(root);
    initReflection(root);
  }

  var api = {
    init: init,
    wireToggle: wireToggle,
    buildQuiz: buildQuiz,
    setExpanded: setExpanded
  };

  global.LmsBoxTheme = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init(document);
    });
  } else {
    init(document);
  }
})(typeof window !== 'undefined' ? window : this);
