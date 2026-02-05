(function() {
  function bindModal(modalId, closeSelectors) {
    const modal = document.getElementById(modalId);
    if (!modal) return null;

    function close() {
      modal.classList.remove('active');
    }

    function open() {
      modal.classList.add('active');
    }

    closeSelectors.forEach(selector => {
      const btn = modal.querySelector(selector) || document.getElementById(selector.replace('#', ''));
      if (btn) {
        btn.addEventListener('click', close);
      }
    });

    const overlay = modal.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', close);
    }

    return { open, close, modal };
  }

  window.MissionControl = window.MissionControl || {};
  window.MissionControl.ModalManager = {
    bindModal
  };
})();
