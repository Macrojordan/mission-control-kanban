(function() {
  const Api = window.MissionControl.Api;
  const ModalManager = window.MissionControl.ModalManager;
  const Kanban = window.MissionControl.Kanban;

  const state = {
    tasks: [],
    projects: [],
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
    taskProject: document.getElementById('taskProject'),
    taskAssignee: document.getElementById('taskAssignee'),
    taskTags: document.getElementById('taskTags'),
    taskEstimated: document.getElementById('taskEstimated'),
    taskActual: document.getElementById('taskActual'),
    taskRandyStatus: document.getElementById('taskRandyStatus'),
    modalTitle: document.getElementById('modalTitle'),
    btnSave: document.getElementById('btnSave'),
    btnDelete: document.getElementById('btnDelete'),
    btnCancel: document.getElementById('btnCancel'),
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

  function applyFilters(tasks) {
    return tasks.filter(task => {
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
        content.appendChild(card);
      });

      count.textContent = tasks.length;
    });
  }

  function renderProjects() {
    elements.projectsList.innerHTML = '';
    const projects = state.projects;

    projects.forEach(project => {
      const item = document.createElement('div');
      item.className = 'project-item';
      item.innerHTML = `
        <span class="project-color" style="background:${project.color}"></span>
        <span class="project-name">${project.name}</span>
      `;
      item.addEventListener('click', () => {
        state.filters.project = String(project.id);
        elements.filterProject.value = String(project.id);
        renderKanban();
      });
      elements.projectsList.appendChild(item);
    });

    const projectOptions = ['<option value="">Todos</option>'].concat(
      projects.map(project => `<option value="${project.id}">${project.name}</option>`)
    );
    elements.filterProject.innerHTML = projectOptions.join('');

    const taskProjectOptions = projects.map(project => `<option value="${project.id}">${project.name}</option>`);
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

  function openTaskModal(task) {
    const isEdit = !!task && task.id;
    elements.modalTitle.textContent = isEdit ? 'Editar Tarefa' : 'Nova Tarefa';
    elements.btnDelete.style.display = isEdit ? 'inline-flex' : 'none';
    elements.commentsSection.style.display = isEdit ? 'block' : 'none';

    elements.taskId.value = isEdit ? task.id : '';
    elements.taskTitle.value = isEdit ? task.title : '';
    elements.taskDescription.value = isEdit ? task.description || '' : '';
    elements.taskStatus.value = isEdit ? task.status : (task && task.status) || 'backlog';
    elements.taskPriority.value = isEdit ? task.priority || 'medium' : 'medium';
    elements.taskProject.value = isEdit ? task.project_id || 1 : 1;
    elements.taskAssignee.value = isEdit ? task.assigned_to || '' : '';
    elements.taskTags.value = isEdit ? (task.tags || []).join(', ') : '';
    elements.taskEstimated.value = isEdit && task.estimated_hours ? task.estimated_hours : '';
    elements.taskActual.value = isEdit && task.actual_hours ? task.actual_hours : '';
    if (elements.taskRandyStatus) {
      elements.taskRandyStatus.value = isEdit ? (task.randy_status || 'pending') : 'pending';
    }

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
    const payload = {
      title: elements.taskTitle.value.trim(),
      description: elements.taskDescription.value.trim(),
      status: elements.taskStatus.value,
      priority: elements.taskPriority.value,
      project_id: parseInt(elements.taskProject.value, 10),
      assigned_to: elements.taskAssignee.value,
      tags: elements.taskTags.value ? elements.taskTags.value.split(',').map(tag => tag.trim()).filter(Boolean) : [],
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

  function bindEvents() {
    if (elements.sidebarToggle) {
      elements.sidebarToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('collapsed');
      });
    }

    elements.navItems.forEach(item => {
      item.addEventListener('click', event => {
        event.preventDefault();
        const view = item.dataset.view;
        setView(view);
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
    state.projects = projects || [];
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
    setView('kanban');
    refreshData();
    refreshHeartbeat();
    setInterval(refreshData, 15000);
    setInterval(refreshHeartbeat, 5000);
  }

  init();
})();
