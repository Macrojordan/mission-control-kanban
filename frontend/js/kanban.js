(function() {
  const STATUS_DEFINITIONS = [
    { key: 'backlog', label: 'Backlog' },
    { key: 'todo', label: 'To Do' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'review', label: 'Review' },
    { key: 'done', label: 'Done' }
  ];

  const STATUS_LOOKUP = STATUS_DEFINITIONS.reduce((acc, status) => {
    acc[status.key] = status.label;
    return acc;
  }, {});

  function getStatusOrder() {
    return STATUS_DEFINITIONS.map(status => status.key);
  }

  function isValidStatus(status) {
    return !!STATUS_LOOKUP[status];
  }

  function normalizeStatus(status) {
    return isValidStatus(status) ? status : 'backlog';
  }

  function getStatusLabel(status) {
    return STATUS_LOOKUP[status] || status || 'Backlog';
  }

  function createTaskCard(task, options) {
    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority || 'medium'}`;
    card.draggable = true;
    card.dataset.taskId = task.id;

    const randyStatus = (task.randy_status || 'pending').replace('_', '-');
    const hasNotion = !!task.notion_page_id || !!task.notion_link;
    const notionId = task.notion_page_id || '';
    const notionUrl = task.notion_link || '';
    
    // Format tags for mobile
    const tags = (task.tags || []).slice(0, 3); // Limit to 3 tags
    const tagClasses = {
      'ux': 'tag-ux',
      'bug': 'tag-bug',
      'ui': 'tag-ui',
      'feature': 'tag-feature',
      'design': 'tag-ux',
      'dev': 'tag-ui',
      'content': 'tag-feature'
    };

    // Format due date
    let dueDateHtml = '';
    if (task.due_date) {
      const due = new Date(task.due_date);
      const now = new Date();
      const isOverdue = due < now;
      const isSoon = !isOverdue && (due - now) < (3 * 24 * 60 * 60 * 1000); // 3 days
      const dateClass = isOverdue ? 'overdue' : isSoon ? 'soon' : '';
      const dateIcon = isOverdue ? '⚠️' : '📅';
      dueDateHtml = `<span class="task-date ${dateClass}">${dateIcon} ${due.toLocaleDateString()}</span>`;
    }

    // Get assignee avatar
    const assigneeAvatar = task.assigned_to === 'randy' 
      ? 'assets/randy-1.jpg' 
      : task.assigned_to === 'ruben'
      ? 'assets/ruben.jpg'
      : null;
    const assigneeName = task.assigned_to === 'randy' 
      ? 'Randy' 
      : task.assigned_to === 'ruben' 
      ? 'Ruben' 
      : 'Unassigned';

    card.innerHTML = `
      <div class="task-header">
        <div class="task-title">${task.title}</div>
        <button class="task-menu" type="button">⋯</button>
      </div>
      ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
      ${tags.length ? `
        <div class="task-tags">
          ${tags.map(tag => {
            const tagClass = tagClasses[tag.toLowerCase()] || 'tag-default';
            return `<span class="task-tag ${tagClass}">${tag}</span>`;
          }).join('')}
        </div>
      ` : ''}
      <div class="task-footer">
        <div class="task-meta">
          ${assigneeAvatar ? `
            <span class="task-assignee">
              <img src="${assigneeAvatar}" alt="${assigneeName}" class="task-assignee-avatar">
              <span class="task-assignee-name">${assigneeName}</span>
            </span>
          ` : `<span class="task-assignee-name">${assigneeName}</span>`}
          <span class="task-project">
            <span class="project-indicator" style="background:${task.project_color || '#6366f1'}"></span>
            ${task.project_name || 'General'}
          </span>
          ${hasNotion ? `<span class="task-notion" data-notion-id="${notionId}" data-notion-url="${notionUrl}">📝 Notion</span>` : ''}
        </div>
        ${dueDateHtml}
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
    createTaskCard,
    getStatusOrder,
    getStatusLabel,
    isValidStatus,
    normalizeStatus
  };
})();
