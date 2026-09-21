(function () {
  if (window.__lmsboxInteractiveRuntimeLoaded) {
    return;
  }
  window.__lmsboxInteractiveRuntimeLoaded = true;

  var AUTO_COMPLETE_ON_VIEW_TYPES = {
    hero: true,
    cards: true,
    remember: true,
    warning: true
  };

  function sendComplete(blockId) {
    if (!blockId || !window.parent || window.parent === window) {
      return;
    }
    window.parent.postMessage(
      { type: 'interactive-block-complete', blockId: Number(blockId) },
      '*'
    );
  }

  function shouldAutoComplete(el) {
    var type = (el.getAttribute('data-block-type') || '').toLowerCase();
    if (AUTO_COMPLETE_ON_VIEW_TYPES[type]) {
      return true;
    }
    return type === 'text' && el.getAttribute('data-show-continue') === '0';
  }

  function notifyPassiveBlocks() {
    var nodes = document.querySelectorAll('.lmsbox-interactive-block[data-block-id]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!shouldAutoComplete(el)) {
        continue;
      }
      sendComplete(el.getAttribute('data-block-id'));
    }
  }

  function schedulePassiveCompletion() {
    notifyPassiveBlocks();
    setTimeout(notifyPassiveBlocks, 250);
    setTimeout(notifyPassiveBlocks, 1000);
  }

  window.lmsboxInteractive = window.lmsboxInteractive || {
    notifyComplete: function (blockId) {
      sendComplete(blockId);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedulePassiveCompletion);
  } else {
    schedulePassiveCompletion();
  }
})();
