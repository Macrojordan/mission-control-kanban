(function() {
  const Api = window.MissionControl.Api;
  const ModalManager = window.MissionControl.ModalManager;

  const TYPE_ICONS = {
    task: '📋',
    memory: '🧠',
    document: '📄'
  };

  const TYPE_LABELS = {
    task: 'Task',
    memory: 'Memory',
    document: 'Document'
  };

  let searchTimer = null;
  let selectedIndex = -1;
  let currentResults = [];

  const overlay = document.getElementById('globalSearchOverlay');
  const input = document.getElementById('globalSearchInput');
  const resultsContainer = document.getElementById('globalSearchResults');
  const btnOpen = document.getElementById('btnGlobalSearch');

  // Document preview modal
  const docModal = ModalManager.bindModal('docPreviewModal', ['#docPreviewClose']);
  const docTitle = document.getElementById('docPreviewTitle');
  const docContent = document.getElementById('docPreviewContent');

  function openSearch() {
    overlay.classList.add('active');
    input.value = '';
    input.focus();
    selectedIndex = -1;
    currentResults = [];
    resultsContainer.innerHTML = '<div class="global-search-empty">Type to search across everything...</div>';
  }

  function closeSearch() {
    overlay.classList.remove('active');
    input.value = '';
  }

  function renderResults(results) {
    currentResults = results;
    selectedIndex = -1;

    if (!results.length) {
      resultsContainer.innerHTML = '<div class="global-search-empty">No results found</div>';
      return;
    }

    resultsContainer.innerHTML = results.map((r, i) => `
      <div class="global-search-item" data-index="${i}" tabindex="-1">
        <span class="gs-icon">${TYPE_ICONS[r.type] || '📄'}</span>
        <div class="gs-info">
          <div class="gs-title">${escapeHtml(r.title)}</div>
          <div class="gs-snippet">${r.snippet || ''}</div>
          <div class="gs-meta">
            <span class="gs-type gs-type-${r.type}">${TYPE_LABELS[r.type] || r.type}</span>
            ${r.path ? `<span class="gs-path">${escapeHtml(r.path)}</span>` : ''}
            ${r.status ? `<span class="gs-status">${r.status}</span>` : ''}
            ${r.project ? `<span class="gs-project">${escapeHtml(r.project)}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    // Bind clicks
    resultsContainer.querySelectorAll('.global-search-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index);
        handleSelect(currentResults[idx]);
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function updateSelection() {
    const items = resultsContainer.querySelectorAll('.global-search-item');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === selectedIndex);
    });
    if (items[selectedIndex]) {
      items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  async function handleSelect(result) {
    if (!result) return;
    closeSearch();

    if (result.type === 'task' && result.id) {
      // Open task in kanban - find and click
      // Switch to kanban view first
      const kanbanNav = document.querySelector('[data-view="kanban"]');
      if (kanbanNav) kanbanNav.click();

      // Small delay then find the task card
      setTimeout(() => {
        const card = document.querySelector(`.task-card[data-task-id="${result.id}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.click();
        }
      }, 200);
    } else if (result.path) {
      // Show document content in modal
      const data = await Api.getFileContent(result.path);
      if (data && data.content) {
        docTitle.textContent = result.title || result.path;
        docContent.textContent = data.content;
        docModal.open();
      }
    }
  }

  async function doSearch(query) {
    if (!query || query.length < 2) {
      resultsContainer.innerHTML = '<div class="global-search-empty">Type to search across everything...</div>';
      currentResults = [];
      return;
    }

    resultsContainer.innerHTML = '<div class="global-search-empty">Searching...</div>';
    const results = await Api.globalSearch(query);
    renderResults(results || []);
  }

  // Event listeners
  btnOpen.addEventListener('click', openSearch);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSearch();
  });

  input.addEventListener('input', () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(input.value.trim()), 250);
  });

  input.addEventListener('keydown', (e) => {
    const items = resultsContainer.querySelectorAll('.global-search-item');
    if (e.key === 'Escape') {
      closeSearch();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && currentResults[selectedIndex]) {
        handleSelect(currentResults[selectedIndex]);
      }
    }
  });

  // Global Ctrl+K / Cmd+K
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (overlay.classList.contains('active')) {
        closeSearch();
      } else {
        openSearch();
      }
    }
  });

  window.MissionControl = window.MissionControl || {};
  window.MissionControl.Search = { open: openSearch, close: closeSearch };
})();
