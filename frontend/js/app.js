(function() {
  const Api = window.MissionControl.Api;
  const ModalManager = window.MissionControl.ModalManager;
  const Kanban = window.MissionControl.Kanban;

  const DEFAULT_TEMPLATES = [
    {
      id: 'default-bug',
      name: 'Bug Report',
      data: { priority: 'high', tags: ['bug'], status: 'todo' }
    },
    {
      id: 'default-feature',
      name: 'Feature Request',
      data: { priority: 'medium', tags: ['feature'] }
    },
    {
      id: 'default-content',
      name: 'Content Task',
      data: { assigned_to: 'ruben', tags: ['content'] }
    },
    {
      id: 'default-randy',
      name: 'Randy Task',
      data: { assigned_to: 'randy', status: 'todo', tags: ['ai'] }
    },
    {
      id: 'default-quick',
      name: 'Quick Win',
      data: { priority: 'low', estimated_hours: 1 }
    }
  ];

  const state = {
    tasks: [],
    projects: [],
    notion: {
      results: [],
      selected: null,
      loading: false,
      lastQuery: '',
      hasAttempted: false,
      online: null
    },
    templates: {
      list: [],
      custom: []
    },
    filters: {
      priority: '',
      project: '',
      assignee: '',
      search: ''
    },
    view: 'kanban',
    currentTaskId: null,
    offline: false,
    dragTaskId: null
  };

  let projectContextMenu = null;
  let taskContextMenu = null;
  let notionSearchTimer = null;

  const elements = {
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    navItems: Array.from(document.querySelectorAll('.nav-item')),
    pageTitle: document.getElementById('pageTitle'),
    headerSubtitle: document.getElementById('headerSubtitle'),
    statusIndicator: document.getElementById('statusIndicator'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    searchInput: document.getElementById('searchInput'),
    btnFilter: document.getElementById('btnFilter'),
    filtersBar: document.getElementById('filtersBar'),
    filterPriority: document.getElementById('filterPriority'),
    filterProject: document.getElementById('filterProject'),
    filterAssignee: document.getElementById('filterAssignee'),
    btnClearFilters: document.getElementById('btnClearFilters'),
    btnNewTask: document.getElementById('btnNewTask'),
    btnAddProject: document.getElementById('btnAddProject'),
    projectsList: document.getElementById('projectsList'),
    fridgeProjectsList: document.getElementById('fridgeProjectsList'),
    kanbanBoard: document.getElementById('kanbanBoard'),
    randyBadge: document.getElementById('randyBadge'),
    views: {
      kanban: document.getElementById('kanbanView'),
      dashboard: document.getElementById('dashboardView'),
      randy: document.getElementById('randyView')
    },
    metrics: {
      total: document.getElementById('metricTotal'),
      completed: document.getElementById('metricCompleted'),
      avgTime: document.getElementById('metricAvgTime'),
      rate: document.getElementById('metricRate')
    },
    charts: {
      status: document.getElementById('statusChart'),
      priority: document.getElementById('priorityChart')
    },
    activityList: document.getElementById('activityList'),
    randyStats: {
      total: document.getElementById('randyTotal'),
      inProgress: document.getElementById('randyInProgress'),
      done: document.getElementById('randyDone')
    },
    randyTasks: document.getElementById('randyTasks'),
    randyCurrent: document.getElementById('randyCurrentTask'),
    taskModal: document.getElementById('taskModal'),
    projectModal: document.getElementById('projectModal'),
    taskForm: document.getElementById('taskForm'),
    projectForm: document.getElementById('projectForm'),
    taskId: document.getElementById('taskId'),
    taskTitle: document.getElementById('taskTitle'),
    taskDescription: document.getElementById('taskDescription'),
    taskStatus: document.getElementById('taskStatus'),
    taskPriority: document.getElementById('taskPriority'),
    taskPriorityIndicator: document.getElementById('taskPriorityIndicator'),
    taskProject: document.getElementById('taskProject'),
    taskAssignee: document.getElementById('taskAssignee'),
    taskTags: document.getElementById('taskTags'),
    taskDueDate: document.getElementById('taskDueDate'),
    notionSearchInput: document.getElementById('notionSearchInput'),
    notionSearchResults: document.getElementById('notionSearchResults'),
    notionSelected: document.getElementById('notionSelected'),
    notionClear: document.getElementById('notionClear'),
    notionStatus: document.getElementById('notionStatus'),
    notionBadge: document.getElementById('notionBadge'),
    notionGroup: document.querySelector('.notion-group'),
    taskNotionId: document.getElementById('taskNotionId'),
    taskNotionUrl: document.getElementById('taskNotionUrl'),
    taskEstimated: document.getElementById('taskEstimated'),
    taskActual: document.getElementById('taskActual'),
    taskRandyStatus: document.getElementById('taskRandyStatus'),
    modalTitle: document.getElementById('modalTitle'),
    btnSave: document.getElementById('btnSave'),
    btnDelete: document.getElementById('btnDelete'),
    btnCancel: document.getElementById('btnCancel'),
    btnQuickAdd: document.getElementById('btnQuickAdd'),
    taskQuickTitle: document.getElementById('taskQuickTitle'),
    templateSelect: document.getElementById('templateSelect'),
    btnSaveTemplate: document.getElementById('btnSaveTemplate'),
    btnManageTemplates: document.getElementById('btnManageTemplates'),
    templateManagerList: document.getElementById('templateManagerList'),
    commentsSection: document.getElementById('commentsSection'),
    commentsList: document.getElementById('commentsList'),
    newComment: document.getElementById('newComment'),
    btnAddComment: document.getElementById('btnAddComment'),
    btnSaveProject: document.getElementById('btnSaveProject'),
    btnCancelProject: document.getElementById('btnCancelProject'),
    projectName: document.getElementById('projectName'),
    projectDescription: document.getElementById('projectDescription'),
    projectColor: document.getElementById('projectColor')
  };

  const taskModal = ModalManager.bindModal('taskModal', ['#modalClose', '#btnCancel']);
  const projectModal = ModalManager.bindModal('projectModal', ['#projectModalClose', '#btnCancelProject']);
  const templatesModal = ModalManager.bindModal('templatesModal', ['#templatesModalClose', '#btnCloseTemplates']);

  Api.setStatusHandler((offline) => {
    state.offline = offline;
    updateStatusBar();
  });

  function updateStatusBar() {
    const taskLabel = getCurrentRandyTask();
    if (elements.statusIndicator) {
      elements.statusIndicator.classList.toggle('offline', state.offline);
    }
    if (elements.statusDot) {
      elements.statusDot.classList.toggle('offline', state.offline);
    }
    if (elements.statusText) {
      elements.statusText.textContent = state.offline ? 'Randy Offline' : 'Randy Online';
    }
    elements.headerSubtitle.textContent = taskLabel ? `Agora: ${taskLabel}` : '';
    if (elements.randyCurrent) {
      elements.randyCurrent.textContent = taskLabel ? `Trabalhando agora: ${taskLabel}` : 'Nenhuma tarefa ativa no momento.';
    }
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return date.toLocaleString();
  }

  function toDateInputValue(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function updatePriorityIndicator(value) {
    if (!elements.taskPriorityIndicator) return;
    elements.taskPriorityIndicator.className = 'priority-indicator';
    if (value) {
      elements.taskPriorityIndicator.classList.add(value);
    }
  }

  function buildNotionUrl(pageId) {
    if (!pageId) return '';
    return `https://www.notion.so/${pageId.replace(/-/g, '')}`;
  }

  function getNotionIconMarkup(item) {
    if (!item || !item.icon) return '📄';
    if (item.icon_type === 'emoji') return item.icon;
    if (item.icon_type === 'external' || item.icon_type === 'file') {
      return `<img src="${item.icon}" alt="" class="notion-icon-image">`;
    }
    return '📄';
  }

  function renderNotionSelection() {
    if (!elements.notionSelected) return;
    const selection = state.notion.selected;
    if (!selection) {
      elements.notionSelected.innerHTML = '';
      if (elements.taskNotionId) elements.taskNotionId.value = '';
      if (elements.taskNotionUrl) elements.taskNotionUrl.value = '';
      if (elements.notionSearchInput) elements.notionSearchInput.value = '';
      return;
    }

    const iconMarkup = getNotionIconMarkup(selection);
    const title = selection.title || 'Notion page';
    elements.notionSelected.innerHTML = `
      <div class="notion-selected-card">
        <span class="notion-icon">${iconMarkup}</span>
        <span class="notion-title">${title}</span>
      </div>
    `;

    if (elements.taskNotionId) elements.taskNotionId.value = selection.id || '';
    if (elements.taskNotionUrl) elements.taskNotionUrl.value = selection.url || '';
    if (elements.notionSearchInput) elements.notionSearchInput.value = selection.title || '';
  }

  function clearNotionSelection() {
    state.notion.selected = null;
    if (elements.notionSearchInput) elements.notionSearchInput.value = '';
    renderNotionSelection();
    renderNotionResults([]);
  }

  function renderNotionResults(results) {
    if (!elements.notionSearchResults) return;
    elements.notionSearchResults.innerHTML = '';
    if (!results || !results.length) {
      return;
    }

    results.forEach(item => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'notion-result';
      option.innerHTML = `
        <span class="notion-icon">${getNotionIconMarkup(item)}</span>
        <span class="notion-title">${item.title}</span>
        <span class="notion-type">${item.type}</span>
      `;
      option.addEventListener('click', () => {
        state.notion.selected = item;
        renderNotionSelection();
        renderNotionResults([]);
        if (elements.taskTitle) {
          elements.taskTitle.value = item.title;
        }
      });
      elements.notionSearchResults.appendChild(option);
    });
  }

  function setNotionStatus(message) {
    if (!elements.notionStatus) return;
    elements.notionStatus.textContent = message || '';
  }

  function updateNotionBadge() {
    if (!elements.notionBadge) return;
    if (!state.notion.hasAttempted) {
      elements.notionBadge.hidden = true;
      elements.notionBadge.classList.remove('online', 'offline');
      if (elements.notionGroup) {
        elements.notionGroup.classList.remove('offline');
      }
      return;
    }
    const online = state.notion.online !== false;
    elements.notionBadge.hidden = false;
    elements.notionBadge.textContent = online ? 'Notion Online' : 'Notion Offline';
    elements.notionBadge.classList.toggle('online', online);
    elements.notionBadge.classList.toggle('offline', !online);
    if (elements.notionGroup) {
      elements.notionGroup.classList.toggle('offline', !online);
    }
  }

  function setNotionConnectivity(online) {
    state.notion.hasAttempted = true;
    state.notion.online = online;
    updateNotionBadge();
  }

  async function searchNotion(query) {
    if (!query) {
      renderNotionResults([]);
      return;
    }
    state.notion.loading = true;
    setNotionStatus('Buscando no Notion...');
    const results = await Api.searchNotion(query);
    state.notion.loading = false;
    state.notion.results = results || [];
    setNotionConnectivity(!state.offline);
    if (state.offline) {
      setNotionStatus('Sem conexão com Notion.');
    } else {
      setNotionStatus(results && results.length ? '' : 'Nenhum resultado encontrado.');
    }
    renderNotionResults(state.notion.results);
  }

  function closeNotionResults() {
    renderNotionResults([]);
    setNotionStatus('');
  }

  function getTemplatePayloadFromForm() {
    return {
      status: elements.taskStatus ? elements.taskStatus.value : 'backlog',
      priority: elements.taskPriority ? elements.taskPriority.value : 'medium',
      assigned_to: elements.taskAssignee ? elements.taskAssignee.value : '',
      tags: elements.taskTags && elements.taskTags.value
        ? elements.taskTags.value.split(',').map(tag => tag.trim()).filter(Boolean)
        : [],
      estimated_hours: elements.taskEstimated && elements.taskEstimated.value
        ? parseFloat(elements.taskEstimated.value)
        : null
    };
  }

  function applyTemplateData(data) {
    if (!data) return;
    if (data.status && elements.taskStatus) elements.taskStatus.value = data.status;
    if (data.priority && elements.taskPriority) elements.taskPriority.value = data.priority;
    if (data.assigned_to !== undefined && elements.taskAssignee) elements.taskAssignee.value = data.assigned_to;
    if (data.tags && elements.taskTags) elements.taskTags.value = data.tags.join(', ');
    if (data.estimated_hours !== undefined && elements.taskEstimated) {
      elements.taskEstimated.value = data.estimated_hours === null ? '' : data.estimated_hours;
    }
    updatePriorityIndicator(elements.taskPriority.value);
  }

  function renderTemplateOptions() {
    if (!elements.templateSelect) return;
    const options = ['<option value="">Selecionar template...</option>'];
    DEFAULT_TEMPLATES.forEach(template => {
      options.push(`<option value="${template.id}">${template.name}</option>`);
    });
    state.templates.custom.forEach(template => {
      options.push(`<option value="custom:${template.id}">Custom: ${template.name}</option>`);
    });
    elements.templateSelect.innerHTML = options.join('');
  }

  async function refreshTemplates() {
    const templates = await Api.getTemplates();
    state.templates.custom = (templates || []).map(template => ({
      id: template.id,
      name: template.name,
      updated_at: template.updated_at,
      data: typeof template.data === 'string' ? (() => {
        try {
          return JSON.parse(template.data);
        } catch {
          return {};
        }
      })() : template.data
    }));
    renderTemplateOptions();
  }

  async function saveTemplateFromForm() {
    const name = prompt('Nome do template?');
    if (!name) return;
    const data = getTemplatePayloadFromForm();
    const template = await Api.createTemplate({ name, data });
    await refreshTemplates();
    if (elements.templateSelect && template && template.id) {
      elements.templateSelect.value = `custom:${template.id}`;
    }
    if (templatesModal && templatesModal.modal && templatesModal.modal.classList.contains('active')) {
      renderTemplateManagerList();
    }
    showNotification('Template salvo', 'success');
  }

  function renderTemplateManagerList() {
    if (!elements.templateManagerList) return;
    if (!state.templates.custom.length) {
      elements.templateManagerList.innerHTML = '<div class="template-manager-empty">Nenhum template salvo ainda.</div>';
      return;
    }

    const rows = state.templates.custom.map(template => {
      const updatedAt = template.updated_at ? formatDate(template.updated_at) : '';
      return `
        <div class="template-manager-item" data-template-id="${template.id}">
          <div class="template-manager-info">
            <div class="template-manager-name">${template.name}</div>
            <div class="template-manager-meta">${updatedAt ? `Atualizado em ${updatedAt}` : 'Sem data de atualização'}</div>
          </div>
          <div class="template-manager-actions">
            <button type="button" class="btn-secondary template-rename">Renomear</button>
            <button type="button" class="btn-danger template-delete">Excluir</button>
          </div>
        </div>
      `;
    });

    elements.templateManagerList.innerHTML = rows.join('');
  }

  async function openTemplateManager() {
    await refreshTemplates();
    renderTemplateManagerList();
    if (templatesModal) {
      templatesModal.open();
    }
  }

  function normalizeTask(task) {
    const project = state.projects.find(p => String(p.id) === String(task.project_id));
    const normalizedRandy = (task.randy_status || 'pending').replace('_', '-');
    return {
      ...task,
      project_name: task.project_name || (project ? project.name : 'Geral'),
      project_color: task.project_color || (project ? project.color : '#6366f1'),
      tags: Array.isArray(task.tags) ? task.tags : task.tags ? task.tags.split(',').map(tag => tag.trim()) : [],
      randy_status: normalizedRandy
    };
  }

  function normalizeProject(project) {
    return {
      ...project,
      is_fridge: !!project.is_fridge
    };
  }

  function applyFilters(tasks) {
    // Get fridge project IDs
    const fridgeProjectIds = (state.projects || [])
      .filter(p => p.is_fridge)
      .map(p => String(p.id));

    return tasks.filter(task => {
      // Exclude tasks from fridge projects (unless explicitly filtering to that project)
      if (!state.filters.project && fridgeProjectIds.includes(String(task.project_id))) return false;
      if (state.filters.priority && task.priority !== state.filters.priority) return false;
      if (state.filters.project && String(task.project_id) !== String(state.filters.project)) return false;
      if (state.filters.assignee) {
        if (state.filters.assignee === 'unassigned') {
          if (task.assigned_to) return false;
        } else if ((task.assigned_to || '') !== state.filters.assignee) {
          return false;
        }
      }
      if (state.filters.search) {
        const term = state.filters.search.toLowerCase();
        const haystack = `${task.title || ''} ${task.description || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }

  function renderKanban() {
    const columns = Array.from(document.querySelectorAll('.kanban-column'));
    const filtered = applyFilters(state.tasks);

    columns.forEach(column => {
      const status = column.dataset.status;
      const content = column.querySelector('.column-content');
      const count = column.querySelector('.column-count');
      content.innerHTML = '';

      const tasks = filtered.filter(task => task.status === status).map(normalizeTask);
      tasks.forEach(task => {
        const card = Kanban.createTaskCard(task, {
          onClick: openTaskModal,
          onDragStart: handleDragStart,
          onDragEnd: handleDragEnd
        });
        const notionButton = card.querySelector('.task-notion');
        if (notionButton) {
          notionButton.addEventListener('click', event => {
            event.stopPropagation();
            const url = notionButton.dataset.notionUrl || buildNotionUrl(notionButton.dataset.notionId);
            if (url) {
              window.open(url, '_blank', 'noopener');
            }
          });
        }
        card.addEventListener('contextmenu', event => {
          event.preventDefault();
          openTaskContextMenu(task, { x: event.clientX, y: event.clientY });
        });
        const menuButton = card.querySelector('.task-menu');
        if (menuButton) {
          menuButton.addEventListener('click', event => {
            event.stopPropagation();
            const rect = menuButton.getBoundingClientRect();
            openTaskContextMenu(task, { x: rect.left, y: rect.bottom + 6 });
          });
        }
        content.appendChild(card);
      });

      count.textContent = tasks.length;
    });
  }

  function ensureProjectContextMenu() {
    if (projectContextMenu) return;
    projectContextMenu = document.createElement('div');
    projectContextMenu.className = 'project-context-menu';
    document.body.appendChild(projectContextMenu);

    document.addEventListener('click', (event) => {
      if (!projectContextMenu) return;
      if (projectContextMenu.contains(event.target)) return;
      if (event.target.closest('.project-action')) return;
      hideProjectContextMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideProjectContextMenu();
    });

    window.addEventListener('resize', hideProjectContextMenu);
    window.addEventListener('scroll', hideProjectContextMenu, true);
  }

  function hideProjectContextMenu() {
    if (!projectContextMenu) return;
    projectContextMenu.style.display = 'none';
  }

  function ensureTaskContextMenu() {
    if (taskContextMenu) return;
    taskContextMenu = document.createElement('div');
    taskContextMenu.className = 'task-context-menu';
    document.body.appendChild(taskContextMenu);

    document.addEventListener('click', (event) => {
      if (!taskContextMenu) return;
      if (taskContextMenu.contains(event.target)) return;
      if (event.target.closest('.task-menu')) return;
      hideTaskContextMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') hideTaskContextMenu();
    });

    window.addEventListener('resize', hideTaskContextMenu);
    window.addEventListener('scroll', hideTaskContextMenu, true);
  }

  function hideTaskContextMenu() {
    if (!taskContextMenu) return;
    taskContextMenu.style.display = 'none';
  }

  function duplicateTask(task) {
    if (!task) return;
    const copy = {
      ...task,
      id: null,
      title: `${task.title} (Copy)`
    };
    openTaskModal(copy);
  }

  function openTaskContextMenu(task, coords) {
    ensureTaskContextMenu();
    taskContextMenu.innerHTML = '';

    const duplicateAction = document.createElement('button');
    duplicateAction.type = 'button';
    duplicateAction.textContent = 'Duplicar';
    duplicateAction.addEventListener('click', () => {
      duplicateTask(task);
      hideTaskContextMenu();
    });

    taskContextMenu.appendChild(duplicateAction);
    taskContextMenu.style.display = 'block';

    const menuRect = taskContextMenu.getBoundingClientRect();
    const left = Math.min(coords.x, window.innerWidth - menuRect.width - 8);
    const top = Math.min(coords.y, window.innerHeight - menuRect.height - 8);
    taskContextMenu.style.left = `${Math.max(8, left)}px`;
    taskContextMenu.style.top = `${Math.max(8, top)}px`;
  }

  function openProjectContextMenu(project, coords) {
    ensureProjectContextMenu();
    projectContextMenu.innerHTML = '';

    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = project.is_fridge ? 'Restaurar da Geladeira' : 'Mover para Geladeira';
    action.addEventListener('click', async () => {
      await toggleProjectFridge(project, !project.is_fridge);
      hideProjectContextMenu();
    });

    projectContextMenu.appendChild(action);
    projectContextMenu.style.display = 'block';

    const menuRect = projectContextMenu.getBoundingClientRect();
    const left = Math.min(coords.x, window.innerWidth - menuRect.width - 8);
    const top = Math.min(coords.y, window.innerHeight - menuRect.height - 8);
    projectContextMenu.style.left = `${Math.max(8, left)}px`;
    projectContextMenu.style.top = `${Math.max(8, top)}px`;
  }

  async function toggleProjectFridge(project, shouldFridge) {
    await Api.setProjectFridge(project.id, shouldFridge);
    await refreshData();
  }

  function renderProjects() {
    elements.projectsList.innerHTML = '';
    if (elements.fridgeProjectsList) {
      elements.fridgeProjectsList.innerHTML = '';
    }

    const projects = state.projects || [];
    const activeProjects = projects.filter(project => !project.is_fridge);
    const fridgeProjects = projects.filter(project => project.is_fridge);

    const renderProjectItem = (project, container) => {
      const item = document.createElement('div');
      item.className = `project-item${project.is_fridge ? ' project-item-fridge' : ''}`;
      item.innerHTML = `
        <span class="project-color" style="background:${project.color}"></span>
        <span class="project-name">${project.name}</span>
        <button class="project-action" type="button" title="Opções">⋯</button>
      `;

      const actionButton = item.querySelector('.project-action');

      item.addEventListener('click', (event) => {
        if (event.target.closest('.project-action')) return;
        const projectId = String(project.id);
        const shouldClear = projectId === '1' || state.filters.project === projectId;
        state.filters.project = shouldClear ? '' : projectId;
        elements.filterProject.value = shouldClear ? '' : projectId;
        renderKanban();
      });

      item.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        openProjectContextMenu(project, { x: event.clientX, y: event.clientY });
      });

      if (actionButton) {
        actionButton.addEventListener('click', (event) => {
          event.stopPropagation();
          const rect = actionButton.getBoundingClientRect();
          openProjectContextMenu(project, { x: rect.left, y: rect.bottom + 6 });
        });
      }

      container.appendChild(item);
    };

    activeProjects.forEach(project => renderProjectItem(project, elements.projectsList));

    if (elements.fridgeProjectsList) {
      if (fridgeProjects.length) {
        fridgeProjects.forEach(project => renderProjectItem(project, elements.fridgeProjectsList));
      } else {
        elements.fridgeProjectsList.innerHTML = '<div class="empty">Sem projetos na geladeira.</div>';
      }
    }

    const projectOptions = ['<option value="">Todos</option>'].concat(
      projects.map(project => `<option value="${project.id}">${project.name}</option>`)
    );
    elements.filterProject.innerHTML = projectOptions.join('');

    const taskProjectSource = activeProjects.length ? activeProjects : projects;
    const taskProjectOptions = taskProjectSource.map(project => `<option value="${project.id}">${project.name}</option>`);
    elements.taskProject.innerHTML = taskProjectOptions.join('');
  }

  function renderDashboard(metrics) {
    if (!metrics) return;
    elements.metrics.total.textContent = metrics.totals.all || 0;
    elements.metrics.completed.textContent = metrics.totals.completed_today || 0;
    elements.metrics.avgTime.textContent = `${metrics.avg_completion_hours || 0}h`;
    const completionRate = metrics.totals.all ? Math.round((metrics.totals.completed_today / metrics.totals.all) * 100) : 0;
    elements.metrics.rate.textContent = `${completionRate}%`;

    renderChart(elements.charts.status, metrics.by_status, 'status');
    renderChart(elements.charts.priority, metrics.by_priority, 'priority');
    renderActivity(metrics.recent_activity || []);
  }

  function renderChart(container, data, type) {
    if (!container) return;
    container.innerHTML = '';
    if (!data || !data.length) {
      container.innerHTML = '<div class="empty">Sem dados</div>';
      return;
    }

    data.forEach(item => {
      const bar = document.createElement('div');
      bar.className = 'chart-bar';
      const label = type === 'status' ? item.status : item.priority;
      const maxCount = Math.max(...data.map(entry => entry.count || 0), 1);
      const width = Math.round(((item.count || 0) / maxCount) * 100);
      bar.innerHTML = `
        <span class="chart-label">${label}</span>
        <div class="chart-progress">
          <div class="chart-fill" style="width:${width}%"></div>
        </div>
        <span class="chart-value">${item.count}</span>
      `;
      container.appendChild(bar);
    });
  }

  function renderActivity(activity) {
    elements.activityList.innerHTML = '';
    if (!activity.length) {
      elements.activityList.innerHTML = '<div class="empty">Nenhuma atividade registrada.</div>';
      return;
    }

    activity.forEach(item => {
      const row = document.createElement('div');
      row.className = 'activity-item';
      row.innerHTML = `
        <div class="activity-icon">•</div>
        <div class="activity-content">
          <div class="activity-text">
            <strong>${item.task_title || 'Sistema'}</strong> ${item.description || item.action}
          </div>
          <div class="activity-time">${formatDate(item.created_at)}</div>
        </div>
      `;
      elements.activityList.appendChild(row);
    });
  }

  function renderRandyView(tasks) {
    const randyTasks = tasks.filter(task => task.assigned_to === 'randy').map(normalizeTask);
    elements.randyStats.total.textContent = randyTasks.length;
    elements.randyStats.inProgress.textContent = randyTasks.filter(task => task.status === 'in_progress').length;
    elements.randyStats.done.textContent = randyTasks.filter(task => task.status === 'done').length;

    elements.randyTasks.innerHTML = '';
    if (!randyTasks.length) {
      elements.randyTasks.innerHTML = '<div class="empty">Nenhuma tarefa atribuída ao Randy.</div>';
      return;
    }

    randyTasks.forEach(task => {
      const card = document.createElement('div');
      card.className = `randy-task-card ${task.status === 'done' ? 'done' : ''}`;
      card.innerHTML = `
        <div class="randy-task-header">
          <div class="randy-task-title">${task.title}</div>
          <span class="randy-task-priority ${task.priority}">${task.priority}</span>
        </div>
        <div class="randy-task-meta">
          <span>Status: ${task.status}</span>
          <span>Randy: ${task.randy_status || 'pending'}</span>
        </div>
        <p>${task.description || 'Sem descrição.'}</p>
      `;
      card.addEventListener('click', () => openTaskModal(task));
      elements.randyTasks.appendChild(card);
    });
  }

  function updateRandyBadge() {
    const count = state.tasks.filter(task => task.assigned_to === 'randy').length;
    elements.randyBadge.textContent = count;
  }

  function getCurrentRandyTask() {
    const tasks = state.tasks.filter(task => task.assigned_to === 'randy');
    if (!tasks.length) return '';
    const inProgress = tasks.find(task => task.randy_status === 'in-progress') || tasks.find(task => task.status === 'in_progress');
    if (inProgress) return inProgress.title;
    const byPriority = { high: 1, medium: 2, low: 3 };
    const sorted = tasks.slice().sort((a, b) => (byPriority[a.priority] || 4) - (byPriority[b.priority] || 4));
    return sorted[0].title;
  }

  function setNotionSelectionFromTask(task) {
    if (!task || !task.notion_page_id) {
      clearNotionSelection();
      return;
    }
    const url = task.notion_link || buildNotionUrl(task.notion_page_id);
    state.notion.selected = {
      id: task.notion_page_id,
      title: task.title || 'Notion page',
      url,
      icon_type: 'emoji',
      icon: '📄',
      type: 'page'
    };
    renderNotionSelection();
  }

  function openTaskModal(task) {
    const isEdit = !!task && task.id;
    const draft = task || {};
    elements.modalTitle.textContent = isEdit ? 'Editar Tarefa' : 'Nova Tarefa';
    elements.btnDelete.style.display = isEdit ? 'inline-flex' : 'none';
    elements.commentsSection.style.display = isEdit ? 'block' : 'none';

    elements.taskId.value = isEdit ? task.id : '';
    elements.taskTitle.value = isEdit ? task.title : (draft.title || '');
    elements.taskDescription.value = isEdit ? task.description || '' : (draft.description || '');
    elements.taskStatus.value = isEdit ? task.status : draft.status || 'backlog';
    elements.taskPriority.value = isEdit ? task.priority || 'medium' : draft.priority || 'medium';
    elements.taskProject.value = isEdit ? task.project_id || 1 : draft.project_id || 1;
    elements.taskAssignee.value = isEdit ? task.assigned_to || '' : draft.assigned_to || '';
    const draftTags = Array.isArray(draft.tags) ? draft.tags : (draft.tags ? String(draft.tags).split(',') : []);
    elements.taskTags.value = isEdit ? (task.tags || []).join(', ') : draftTags.map(tag => tag.trim()).filter(Boolean).join(', ');
    if (elements.taskDueDate) {
      elements.taskDueDate.value = isEdit ? toDateInputValue(task.due_date) : toDateInputValue(draft.due_date);
    }
    setNotionSelectionFromTask(draft && draft.notion_page_id ? draft : null);
    const estimatedValue = isEdit ? task.estimated_hours : draft.estimated_hours;
    const actualValue = isEdit ? task.actual_hours : draft.actual_hours;
    elements.taskEstimated.value = (estimatedValue === 0 || estimatedValue) ? estimatedValue : '';
    elements.taskActual.value = (actualValue === 0 || actualValue) ? actualValue : '';
    if (elements.taskRandyStatus) {
      elements.taskRandyStatus.value = isEdit ? (task.randy_status || 'pending') : draft.randy_status || 'pending';
    }
    if (elements.taskQuickTitle) {
      elements.taskQuickTitle.value = '';
    }
    if (elements.templateSelect) {
      elements.templateSelect.value = '';
    }

    state.notion.hasAttempted = false;
    state.notion.online = null;
    updateNotionBadge();
    setNotionStatus('');

    updatePriorityIndicator(elements.taskPriority.value);

    if (isEdit) {
      loadComments(task.id);
    }

    state.currentTaskId = isEdit ? task.id : null;
    taskModal.open();
  }

  async function loadComments(taskId) {
    const comments = await Api.getComments(taskId);
    elements.commentsList.innerHTML = '';
    if (!comments.length) {
      elements.commentsList.innerHTML = '<div class="empty">Sem comentários ainda.</div>';
      return;
    }

    comments.forEach(comment => {
      const row = document.createElement('div');
      row.className = 'comment-item';
      row.innerHTML = `
        <div>
          <strong>${comment.author}</strong>
          <span>${comment.content}</span>
        </div>
        <time>${formatDate(comment.created_at)}</time>
      `;
      elements.commentsList.appendChild(row);
    });
  }

  async function saveTask() {
    const notionPageId = elements.taskNotionId && elements.taskNotionId.value.trim() ? elements.taskNotionId.value.trim() : null;
    const notionUrl = elements.taskNotionUrl && elements.taskNotionUrl.value.trim()
      ? elements.taskNotionUrl.value.trim()
      : (notionPageId ? buildNotionUrl(notionPageId) : null);

    const payload = {
      title: elements.taskTitle.value.trim(),
      description: elements.taskDescription.value.trim(),
      status: elements.taskStatus.value,
      priority: elements.taskPriority.value,
      project_id: parseInt(elements.taskProject.value, 10),
      assigned_to: elements.taskAssignee.value,
      tags: elements.taskTags.value ? elements.taskTags.value.split(',').map(tag => tag.trim()).filter(Boolean) : [],
      due_date: elements.taskDueDate ? (elements.taskDueDate.value || null) : null,
      notion_link: notionUrl,
      notion_page_id: notionPageId,
      estimated_hours: elements.taskEstimated.value ? parseFloat(elements.taskEstimated.value) : null,
      actual_hours: elements.taskActual.value ? parseFloat(elements.taskActual.value) : null,
      randy_status: elements.taskRandyStatus ? elements.taskRandyStatus.value : 'pending'
    };

    if (!payload.title) {
      alert('Título é obrigatório.');
      return;
    }

    if (state.currentTaskId) {
      await Api.updateTask(state.currentTaskId, payload);
    } else {
      await Api.createTask(payload);
    }

    await refreshData();
    taskModal.close();
  }

  async function quickAddTask() {
    if (!elements.taskQuickTitle) return;
    const title = elements.taskQuickTitle.value.trim();
    if (!title) {
      alert('Título é obrigatório.');
      return;
    }

    const projectId = elements.taskProject && elements.taskProject.value ? parseInt(elements.taskProject.value, 10) : 1;
    const payload = {
      title,
      status: 'backlog',
      priority: 'medium',
      project_id: Number.isNaN(projectId) ? 1 : projectId,
      assigned_to: '',
      tags: [],
      randy_status: 'pending'
    };

    await Api.createTask(payload);
    elements.taskQuickTitle.value = '';
    await refreshData();
    showNotification('Tarefa adicionada ao Backlog', 'success');
  }

  async function deleteTask() {
    if (!state.currentTaskId) return;
    const confirmDelete = confirm('Excluir esta tarefa?');
    if (!confirmDelete) return;
    await Api.deleteTask(state.currentTaskId);
    await refreshData();
    taskModal.close();
  }

  async function addComment() {
    if (!state.currentTaskId) return;
    const content = elements.newComment.value.trim();
    if (!content) return;
    await Api.addComment({ task_id: state.currentTaskId, author: 'ruben', content });
    elements.newComment.value = '';
    await loadComments(state.currentTaskId);
    await refreshMetrics();
  }

  async function saveProject() {
    const payload = {
      name: elements.projectName.value.trim(),
      description: elements.projectDescription.value.trim(),
      color: elements.projectColor.value || '#6366f1'
    };
    if (!payload.name) {
      alert('Nome do projeto é obrigatório.');
      return;
    }
    await Api.createProject(payload);
    elements.projectForm.reset();
    projectModal.close();
    await refreshData();
  }

  function handleDragStart(event, task) {
    state.dragTaskId = task.id;
    event.dataTransfer.setData('text/plain', task.id);
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    state.dragTaskId = null;
  }

  async function handleDrop(event) {
    event.preventDefault();
    const status = event.currentTarget.dataset.status;
    const content = event.currentTarget.querySelector('.column-content');
    if (content) content.classList.remove('drag-over');
    const taskId = event.dataTransfer.getData('text/plain') || state.dragTaskId;
    if (!taskId || !status) return;
    await Api.moveTask(taskId, status, 'ruben');
    await refreshData();
  }

  function handleDragOver(event) {
    event.preventDefault();
    const content = event.currentTarget.querySelector('.column-content');
    if (content) content.classList.add('drag-over');
  }

  function handleDragLeave(event) {
    const content = event.currentTarget.querySelector('.column-content');
    if (content) content.classList.remove('drag-over');
  }

  function bindDragAndDrop() {
    const dropZones = Array.from(document.querySelectorAll('.kanban-column'));
    dropZones.forEach(zone => {
      zone.addEventListener('dragover', handleDragOver);
      zone.addEventListener('drop', handleDrop);
      zone.addEventListener('dragleave', handleDragLeave);
    });
  }

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  function bindEvents() {
    if (elements.sidebarToggle) {
      elements.sidebarToggle.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
          elements.sidebar.classList.toggle('open');
        } else {
          elements.sidebar.classList.toggle('collapsed');
        }
      });
    }

    elements.navItems.forEach(item => {
      item.addEventListener('click', event => {
        event.preventDefault();
        const view = item.dataset.view;
        setView(view);
        if (window.innerWidth <= 1024) {
          elements.sidebar.classList.remove('open');
        }
      });
    });

    elements.btnFilter.addEventListener('click', () => {
      elements.filtersBar.classList.toggle('visible');
    });

    elements.btnClearFilters.addEventListener('click', () => {
      state.filters = { priority: '', project: '', assignee: '', search: '' };
      elements.filterPriority.value = '';
      elements.filterProject.value = '';
      elements.filterAssignee.value = '';
      elements.searchInput.value = '';
      renderKanban();
    });

    elements.searchInput.addEventListener('input', event => {
      state.filters.search = event.target.value;
      renderKanban();
    });

    elements.filterPriority.addEventListener('change', event => {
      state.filters.priority = event.target.value;
      renderKanban();
    });

    elements.filterProject.addEventListener('change', event => {
      state.filters.project = event.target.value;
      renderKanban();
    });

    elements.filterAssignee.addEventListener('change', event => {
      state.filters.assignee = event.target.value;
      renderKanban();
    });

    if (elements.taskPriority) {
      elements.taskPriority.addEventListener('change', event => {
        updatePriorityIndicator(event.target.value);
      });
    }

    if (elements.templateSelect) {
      elements.templateSelect.addEventListener('change', event => {
        const value = event.target.value;
        if (!value) return;
        const defaultTemplate = DEFAULT_TEMPLATES.find(t => t.id === value);
        if (defaultTemplate) {
          applyTemplateData(defaultTemplate.data);
          return;
        }
        if (value.startsWith('custom:')) {
          const id = value.split(':')[1];
          const custom = state.templates.custom.find(t => String(t.id) === String(id));
          if (custom) {
            applyTemplateData(custom.data);
          }
        }
      });
    }

    if (elements.btnSaveTemplate) {
      elements.btnSaveTemplate.addEventListener('click', () => {
        saveTemplateFromForm();
      });
    }

    if (elements.btnManageTemplates) {
      elements.btnManageTemplates.addEventListener('click', () => {
        openTemplateManager();
      });
    }

    if (elements.templateManagerList) {
      elements.templateManagerList.addEventListener('click', async event => {
        const actionButton = event.target.closest('button');
        if (!actionButton) return;
        const row = event.target.closest('.template-manager-item');
        if (!row) return;
        const templateId = row.dataset.templateId;
        const template = state.templates.custom.find(item => String(item.id) === String(templateId));
        if (!template) return;

        if (actionButton.classList.contains('template-rename')) {
          const name = prompt('Novo nome do template?', template.name);
          if (!name) return;
          await Api.updateTemplate(templateId, { name });
          await refreshTemplates();
          renderTemplateManagerList();
          showNotification('Template atualizado', 'success');
          return;
        }

        if (actionButton.classList.contains('template-delete')) {
          const confirmed = confirm(`Excluir o template "${template.name}"?`);
          if (!confirmed) return;
          await Api.deleteTemplate(templateId);
          await refreshTemplates();
          renderTemplateManagerList();
          if (elements.templateSelect && elements.templateSelect.value === `custom:${templateId}`) {
            elements.templateSelect.value = '';
          }
          showNotification('Template excluído', 'success');
        }
      });
    }

    if (elements.notionSearchInput) {
      elements.notionSearchInput.addEventListener('input', event => {
        const value = event.target.value.trim();
        if (notionSearchTimer) {
          clearTimeout(notionSearchTimer);
        }
        if (!value) {
          closeNotionResults();
          return;
        }
        notionSearchTimer = setTimeout(() => {
          searchNotion(value);
        }, 300);
      });

      elements.notionSearchInput.addEventListener('focus', async () => {
        if (state.notion.selected || elements.notionSearchInput.value.trim()) return;
        setNotionStatus('Carregando páginas recentes...');
        const results = await Api.listNotionPages();
        state.notion.results = results || [];
        setNotionConnectivity(!state.offline);
        if (state.offline) {
          setNotionStatus('Sem conexão com Notion.');
        } else {
          setNotionStatus(results && results.length ? '' : 'Nenhuma página encontrada.');
        }
        renderNotionResults(state.notion.results);
      });
    }

    if (elements.notionClear) {
      elements.notionClear.addEventListener('click', () => clearNotionSelection());
    }

    elements.btnNewTask.addEventListener('click', () => openTaskModal(null));

    document.querySelectorAll('.btn-add-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const status = btn.dataset.column || 'backlog';
        openTaskModal({ status });
      });
    });

    elements.btnSave.addEventListener('click', event => {
      event.preventDefault();
      saveTask();
    });

    if (elements.btnQuickAdd) {
      elements.btnQuickAdd.addEventListener('click', event => {
        event.preventDefault();
        quickAddTask();
      });
    }

    if (elements.taskQuickTitle) {
      elements.taskQuickTitle.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          quickAddTask();
        }
      });
    }

    elements.taskForm.addEventListener('submit', event => {
      event.preventDefault();
      saveTask();
    });

    elements.btnDelete.addEventListener('click', event => {
      event.preventDefault();
      deleteTask();
    });

    elements.btnAddComment.addEventListener('click', event => {
      event.preventDefault();
      addComment();
    });

    elements.btnAddProject.addEventListener('click', () => projectModal.open());
    elements.btnSaveProject.addEventListener('click', event => {
      event.preventDefault();
      saveProject();
    });

    elements.projectForm.addEventListener('submit', event => {
      event.preventDefault();
      saveProject();
    });

    document.addEventListener('keydown', event => {
      if (event.key.toLowerCase() !== 'n') return;
      if (isTypingTarget(event.target)) return;
      if (taskModal && taskModal.modal && taskModal.modal.classList.contains('active')) return;
      event.preventDefault();
      openTaskModal(null);
    });

    document.addEventListener('click', event => {
      if (!elements.notionSearchResults) return;
      if (event.target.closest('.notion-group')) return;
      closeNotionResults();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) {
        elements.sidebar.classList.remove('open');
      }
    });

    bindDragAndDrop();
  }

  function setView(view) {
    state.view = view || 'kanban';
    elements.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.view === state.view);
    });
    Object.keys(elements.views).forEach(key => {
      elements.views[key].classList.toggle('active', key === state.view);
    });

    if (state.view === 'dashboard') {
      elements.pageTitle.textContent = 'Dashboard';
    } else if (state.view === 'randy') {
      elements.pageTitle.textContent = 'Randy Tasks';
    } else {
      elements.pageTitle.textContent = 'Kanban Board';
    }
  }

  async function refreshData() {
    const [projects, tasks, metrics] = await Promise.all([
      Api.getProjects(),
      Api.getTasks(),
      Api.getDashboardMetrics()
    ]);
    state.projects = (projects || []).map(normalizeProject);
    state.tasks = (tasks || []).map(normalizeTask);

    renderProjects();
    renderKanban();
    renderDashboard(metrics);
    renderRandyView(state.tasks);
    updateRandyBadge();
    updateStatusBar();
  }

  async function refreshMetrics() {
    const metrics = await Api.getDashboardMetrics();
    renderDashboard(metrics);
  }

  async function refreshHeartbeat() {
    await Api.pingHealth();
  }

  function init() {
    bindEvents();
    setupMobileFAB();
    setupPullToRefresh();
    setupOfflineDetection();
    setView('kanban');
    refreshTemplates();
    refreshData();
    refreshHeartbeat();
    setInterval(refreshData, 15000);
    setInterval(refreshHeartbeat, 5000);
  }

  // Mobile Floating Action Button
  function setupMobileFAB() {
    if (window.innerWidth <= 768) {
      const fab = document.createElement('button');
      fab.className = 'fab-mobile';
      fab.innerHTML = '+';
      fab.title = 'Nova Tarefa';
      fab.addEventListener('click', () => openTaskModal());
      document.body.appendChild(fab);
    }
  }

  // Pull to Refresh for Mobile
  function setupPullToRefresh() {
    let touchStartY = 0;
    let touchEndY = 0;
    const minSwipeDistance = 100;
    
    document.addEventListener('touchstart', (e) => {
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
      touchEndY = e.changedTouches[0].screenY;
      handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
      const swipeDistance = touchEndY - touchStartY;
      const isAtTop = window.scrollY === 0;
      
      if (swipeDistance > minSwipeDistance && isAtTop) {
        showRefreshIndicator();
        refreshData().then(() => hideRefreshIndicator());
      }
    }
  }

  function showRefreshIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'refresh-indicator';
    indicator.innerHTML = '🔄 Atualizando...';
    indicator.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: var(--accent-primary);
      color: white;
      text-align: center;
      padding: 12px;
      z-index: 9999;
      font-size: 14px;
      font-weight: 500;
    `;
    document.body.appendChild(indicator);
  }

  function hideRefreshIndicator() {
    const indicator = document.getElementById('refresh-indicator');
    if (indicator) {
      indicator.style.opacity = '0';
      indicator.style.transition = 'opacity 0.3s';
      setTimeout(() => indicator.remove(), 300);
    }
  }

  // Offline Detection
  function setupOfflineDetection() {
    window.addEventListener('online', () => {
      state.offline = false;
      showNotification('🟢 Conexão restaurada', 'success');
      refreshData();
    });
    
    window.addEventListener('offline', () => {
      state.offline = true;
      showNotification('🔴 Sem conexão - Modo offline', 'warning');
    });
  }

  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? 'var(--accent-success)' : type === 'warning' ? 'var(--accent-warning)' : 'var(--accent-info)'};
      color: white;
      padding: 12px 24px;
      border-radius: var(--radius-md);
      z-index: 10000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideUp 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  init();
})();
