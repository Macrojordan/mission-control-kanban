(function() {
  function createTaskCard(task, options) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.taskId = task.id;

    const randyStatus = (task.randy_status || 'pending').replace('_', '-');
    const hasNotion = !!task.notion_page_id || !!task.notion_link;
    const notionId = task.notion_page_id || '';
    const notionUrl = task.notion_link || '';

    card.innerHTML = `
      <span class="task-priority ${task.priority || 'medium'}"></span>
      <div class="task-header">
        <div class="task-title">${task.title}</div>
        <div class="task-actions">
          ${hasNotion ? `<button class="task-notion" type="button" title="Open in Notion" data-notion-id="${notionId}" data-notion-url="${notionUrl}">📝 Notion</button>` : ''}
          <button class="task-menu" type="button">⋯</button>
        </div>
      </div>
      ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
      <div class="task-meta">
        <span class="task-project">
          <span class="project-indicator" style="background:${task.project_color || '#6366f1'}"></span>
          ${task.project_name || 'Geral'}
        </span>
        <span class="task-assignee">${task.assigned_to || 'Unassigned'}</span>
      </div>
      <div class="task-footer">
        <div class="task-stats">
          ${(task.tags || []).map(tag => `<span class="task-tag">${tag}</span>`).join('')}
        </div>
        <span class="task-randy-status status-${randyStatus}">${task.randy_status || 'pending'}</span>
      </div>
    `;

    const menu = card.querySelector('.task-menu');
    if (menu) {
      menu.addEventListener('click', event => event.stopPropagation());
    }

    const notionButton = card.querySelector('.task-notion');
    if (notionButton) {
      notionButton.addEventListener('click', event => event.stopPropagation());
    }

    if (options && typeof options.onClick === 'function') {
      card.addEventListener('click', () => options.onClick(task));
    }

    if (options && typeof options.onDragStart === 'function') {
      card.addEventListener('dragstart', event => options.onDragStart(event, task));
    }

    if (options && typeof options.onDragEnd === 'function') {
      card.addEventListener('dragend', event => options.onDragEnd(event, task));
    }

    return card;
  }

  window.MissionControl = window.MissionControl || {};
  window.MissionControl.Kanban = {
    createTaskCard
  };
})();
