(function () {
  if (window.__lmsboxInteractiveRuntimeLoaded) {
    return;
  }
  window.__lmsboxInteractiveRuntimeLoaded = true;

  window.lmsboxInteractive = window.lmsboxInteractive || {
    notifyComplete: function (blockId) {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: 'interactive-block-complete', blockId: blockId },
          '*'
        );
      }
    }
  };
})();
