(function() {
  const API_BASE = '/api';
  const DEFAULT_TIMEOUT = 30000; // 30s for Render cold start
  const STORAGE_KEYS = {
    tasks: 'mc_tasks',
    projects: 'mc_projects',
    comments: 'mc_comments',
    activity: 'mc_activity',
    meta: 'mc_meta'
  };

  const status = {
    offline: false,
    handler: null
  };

  function setStatus(offline) {
    status.offline = offline;
    if (typeof status.handler === 'function') {
      status.handler(offline);
    }
  }

  function setStatusHandler(fn) {
    status.handler = fn;
  }

  function getNowIso() {
    return new Date().toISOString();
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getMeta() {
    return readJson(STORAGE_KEYS.meta, {
      lastTaskId: 0,
      lastProjectId: 0
    });
  }

  function setMeta(meta) {
    writeJson(STORAGE_KEYS.meta, meta);
  }

  const storage = {
    getTasks() {
      return readJson(STORAGE_KEYS.tasks, []);
    },
    setTasks(tasks) {
      writeJson(STORAGE_KEYS.tasks, tasks);
    },
    getProjects() {
      return readJson(STORAGE_KEYS.projects, []);
    },
    setProjects(projects) {
      writeJson(STORAGE_KEYS.projects, projects);
    },
    getComments() {
      return readJson(STORAGE_KEYS.comments, []);
    },
    setComments(comments) {
      writeJson(STORAGE_KEYS.comments, comments);
    },
    getActivity() {
      return readJson(STORAGE_KEYS.activity, []);
    },
    setActivity(activity) {
      writeJson(STORAGE_KEYS.activity, activity);
    },
    ensureDefaultProject() {
      const projects = this.getProjects();
      if (!projects.find(p => p.id === 1)) {
        const now = getNowIso();
        projects.unshift({
          id: 1,
          name: 'Geral',
          description: 'Projeto padrão para tarefas diversas',
          color: '#6366f1',
          is_fridge: false,
          created_at: now,
          updated_at: now
        });
        this.setProjects(projects);
        const meta = getMeta();
        if (meta.lastProjectId < 1) {
          meta.lastProjectId = 1;
          setMeta(meta);
        }
      }
    },
    nextTaskId() {
      const meta = getMeta();
      meta.lastTaskId += 1;
      setMeta(meta);
      return meta.lastTaskId;
    },
    nextProjectId() {
      const meta = getMeta();
      meta.lastProjectId += 1;
      setMeta(meta);
      return meta.lastProjectId;
    }
  };

  storage.ensureDefaultProject();

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);

    try {
      const response = await fetch(path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setStatus(false);
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function logActivityLocal(taskId, action, description, performedBy) {
    const activity = storage.getActivity();
    activity.unshift({
      id: activity.length + 1,
      task_id: taskId,
      action,
      description,
      performed_by: performedBy || 'sistema',
      created_at: getNowIso()
    });
    storage.setActivity(activity.slice(0, 200));
  }

  function taskFromLocal(task) {
    const normalizedRandy = (task.randy_status || 'pending').replace('_', '-');
    return {
      ...task,
      tags: Array.isArray(task.tags) ? task.tags : task.tags ? task.tags.split(',').map(t => t.trim()) : [],
      randy_status: normalizedRandy
    };
  }

  function listTasksLocal(query) {
    let tasks = storage.getTasks().map(taskFromLocal);
    if (query) {
      if (query.status) tasks = tasks.filter(t => t.status === query.status);
      if (query.project_id) tasks = tasks.filter(t => String(t.project_id) === String(query.project_id));
      if (query.priority) tasks = tasks.filter(t => t.priority === query.priority);
      if (query.assigned_to) tasks = tasks.filter(t => (t.assigned_to || '') === query.assigned_to);
      if (query.search) {
        const term = query.search.toLowerCase();
        tasks = tasks.filter(t => (t.title || '').toLowerCase().includes(term) || (t.description || '').toLowerCase().includes(term));
      }
      if (query.tag) {
        tasks = tasks.filter(t => (t.tags || []).includes(query.tag));
      }
    }
    return tasks;
  }

  function listProjectsLocal() {
    return storage.getProjects().map(project => ({
      ...project,
      is_fridge: !!project.is_fridge
    }));
  }

  function listCommentsLocal(taskId) {
    return storage.getComments().filter(c => String(c.task_id) === String(taskId));
  }

  function dashboardLocal() {
    const tasks = storage.getTasks();
    const byStatus = {};
    const byPriority = {};
    const byProject = {};
    const projects = storage.getProjects();
    let completedToday = 0;
    let avgTotal = 0;
    let avgCount = 0;

    tasks.forEach(task => {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
      if (task.status !== 'done') {
        byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
      }
      byProject[task.project_id] = (byProject[task.project_id] || 0) + 1;

      if (task.status === 'done' && task.completed_at) {
        const completedDate = new Date(task.completed_at).toDateString();
        if (completedDate === new Date().toDateString()) {
          completedToday += 1;
        }
        const duration = (new Date(task.completed_at) - new Date(task.created_at)) / 36e5;
        if (!Number.isNaN(duration)) {
          avgTotal += duration;
          avgCount += 1;
        }
      }
    });

    const recentActivity = storage.getActivity().slice(0, 20).map(item => {
      const task = tasks.find(t => String(t.id) === String(item.task_id));
      return {
        ...item,
        task_title: task ? task.title : null
      };
    });

    return {
      totals: {
        all: tasks.length,
        completed_today: completedToday,
        created_this_week: tasks.filter(t => {
          const created = new Date(t.created_at);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return created >= weekAgo;
        }).length
      },
      by_status: Object.keys(byStatus).map(status => ({ status, count: byStatus[status] })),
      by_priority: Object.keys(byPriority).map(priority => ({ priority, count: byPriority[priority] })),
      by_project: projects.map(project => ({
        name: project.name,
        color: project.color,
        count: byProject[project.id] || 0
      })),
      avg_completion_hours: Math.round(avgCount ? avgTotal / avgCount : 0),
      recent_activity: recentActivity
    };
  }

  function randyTasksLocal(query) {
    const tasks = listTasksLocal({ assigned_to: 'randy' }).filter(task => {
      if (query && query.status) return task.status === query.status;
      return true;
    });
    return { assigned_to: 'randy', total: tasks.length, tasks };
  }

  function randyStatsLocal() {
    const tasks = listTasksLocal({ assigned_to: 'randy' });
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const avgHours = tasks
      .filter(t => t.status === 'done' && t.completed_at)
      .reduce((acc, task) => {
        const duration = (new Date(task.completed_at) - new Date(task.created_at)) / 36e5;
        return acc + (Number.isNaN(duration) ? 0 : duration);
      }, 0);
    const avgCount = tasks.filter(t => t.status === 'done' && t.completed_at).length;

    const byPriorityMap = {};
    tasks.filter(t => t.status !== 'done').forEach(task => {
      byPriorityMap[task.priority] = (byPriorityMap[task.priority] || 0) + 1;
    });

    return {
      total,
      completed,
      in_progress: inProgress,
      completion_rate: total ? Math.round((completed / total) * 100) : 0,
      avg_completion_hours: Math.round(avgCount ? avgHours / avgCount : 0),
      by_priority: Object.keys(byPriorityMap).map(priority => ({ priority, count: byPriorityMap[priority] }))
    };
  }

  async function safeCall(apiCall, fallback) {
    try {
      const data = await apiCall();
      setStatus(false);
      return data;
    } catch (err) {
      setStatus(true);
      return fallback(err);
    }
  }

  const Api = {
    setStatusHandler,
    async pingHealth() {
      return safeCall(
        () => request('/health', { method: 'GET', timeout: 2000 }),
        () => ({ status: 'offline', timestamp: getNowIso() })
      );
    },
    async getTasks(query = {}) {
      const queryString = new URLSearchParams(query).toString();
      const url = `${API_BASE}/tasks${queryString ? `?${queryString}` : ''}`;
      return safeCall(
        async () => {
          const data = await request(url);
          storage.setTasks(data);
          return data;
        },
        () => listTasksLocal(query)
      );
    },
    async getTask(id) {
      return safeCall(
        async () => request(`${API_BASE}/tasks/${id}`),
        () => {
          const task = storage.getTasks().find(t => String(t.id) === String(id));
          if (!task) return null;
          return { ...taskFromLocal(task), comments: listCommentsLocal(id), attachments: [], history: storage.getActivity().filter(a => String(a.task_id) === String(id)) };
        }
      );
    },
    async createTask(payload) {
      return safeCall(
        async () => {
          const data = await request(`${API_BASE}/tasks`, { method: 'POST', body: JSON.stringify(payload) });
          const tasks = storage.getTasks();
          tasks.unshift(data);
          storage.setTasks(tasks);
          return data;
        },
        () => {
          const now = getNowIso();
          const tasks = storage.getTasks();
          const id = storage.nextTaskId();
          const task = {
            id,
            title: payload.title,
            description: payload.description || '',
            status: payload.status || 'backlog',
            priority: payload.priority || 'medium',
            project_id: payload.project_id || 1,
            assigned_to: payload.assigned_to || '',
            tags: payload.tags || [],
            created_at: now,
            updated_at: now,
            completed_at: payload.status === 'done' ? now : null,
            estimated_hours: payload.estimated_hours || null,
            actual_hours: payload.actual_hours || null,
            randy_status: payload.randy_status || 'pending'
          };
          tasks.unshift(task);
          storage.setTasks(tasks);
          logActivityLocal(id, 'created', `Tarefa criada: ${task.title}`, payload.assigned_to || 'sistema');
          return task;
        }
      );
    },
    async updateTask(id, payload) {
      return safeCall(
        async () => {
          const data = await request(`${API_BASE}/tasks/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
          const tasks = storage.getTasks();
          const idx = tasks.findIndex(t => String(t.id) === String(id));
          if (idx >= 0) tasks[idx] = { ...tasks[idx], ...data };
          storage.setTasks(tasks);
          return data;
        },
        () => {
          const tasks = storage.getTasks();
          const idx = tasks.findIndex(t => String(t.id) === String(id));
          if (idx === -1) return null;
          const now = getNowIso();
          const updated = { ...tasks[idx], ...payload, updated_at: now };
          if (payload.status === 'done') {
            updated.completed_at = now;
          }
          tasks[idx] = updated;
          storage.setTasks(tasks);
          logActivityLocal(id, 'updated', `Tarefa atualizada: ${updated.title}`, payload.updated_by || 'sistema');
          return updated;
        }
      );
    },
    async moveTask(id, status, movedBy) {
      return safeCall(
        async () => request(`${API_BASE}/tasks/${id}/move`, { method: 'PATCH', body: JSON.stringify({ status, moved_by: movedBy || 'sistema' }) }),
        () => {
          const tasks = storage.getTasks();
          const idx = tasks.findIndex(t => String(t.id) === String(id));
          if (idx === -1) return null;
          const now = getNowIso();
          tasks[idx].status = status;
          tasks[idx].updated_at = now;
          if (status === 'done') {
            tasks[idx].completed_at = now;
          }
          storage.setTasks(tasks);
          logActivityLocal(id, 'moved', `Tarefa movida para ${status}`, movedBy || 'sistema');
          return tasks[idx];
        }
      );
    },
    async deleteTask(id, deletedBy) {
      return safeCall(
        async () => request(`${API_BASE}/tasks/${id}`, { method: 'DELETE', body: JSON.stringify({ deleted_by: deletedBy || 'sistema' }) }),
        () => {
          const tasks = storage.getTasks();
          const idx = tasks.findIndex(t => String(t.id) === String(id));
          if (idx === -1) return { message: 'Tarefa não encontrada' };
          const [removed] = tasks.splice(idx, 1);
          storage.setTasks(tasks);
          logActivityLocal(id, 'deleted', `Tarefa deletada: ${removed.title}`, deletedBy || 'sistema');
          return { message: 'Tarefa deletada com sucesso' };
        }
      );
    },
    async getProjects() {
      return safeCall(
        async () => {
          const data = await request(`${API_BASE}/projects`);
          storage.setProjects(data);
          return data;
        },
        () => listProjectsLocal()
      );
    },
    async createProject(payload) {
      return safeCall(
        async () => {
          const data = await request(`${API_BASE}/projects`, { method: 'POST', body: JSON.stringify(payload) });
          const projects = storage.getProjects();
          projects.unshift(data);
          storage.setProjects(projects);
          return data;
        },
        () => {
          const projects = storage.getProjects();
          const now = getNowIso();
          const project = {
            id: storage.nextProjectId(),
            name: payload.name,
            description: payload.description || '',
            color: payload.color || '#6366f1',
            is_fridge: !!payload.is_fridge,
            created_at: now,
            updated_at: now,
            task_count: 0
          };
          projects.unshift(project);
          storage.setProjects(projects);
          return project;
        }
      );
    },
    async updateProject(id, payload) {
      return safeCall(
        async () => request(`${API_BASE}/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
        () => {
          const projects = storage.getProjects();
          const idx = projects.findIndex(p => String(p.id) === String(id));
          if (idx === -1) return null;
          projects[idx] = { ...projects[idx], ...payload, updated_at: getNowIso() };
          storage.setProjects(projects);
          return projects[idx];
        }
      );
    },
    async setProjectFridge(id, isFridge) {
      return safeCall(
        async () => request(`${API_BASE}/projects/${id}/fridge`, { method: 'PUT', body: JSON.stringify({ is_fridge: !!isFridge }) }),
        () => {
          const projects = storage.getProjects();
          const idx = projects.findIndex(p => String(p.id) === String(id));
          if (idx === -1) return null;
          projects[idx] = { ...projects[idx], is_fridge: !!isFridge, updated_at: getNowIso() };
          storage.setProjects(projects);
          return projects[idx];
        }
      );
    },
    async deleteProject(id) {
      return safeCall(
        async () => request(`${API_BASE}/projects/${id}`, { method: 'DELETE' }),
        () => {
          const projects = storage.getProjects();
          const idx = projects.findIndex(p => String(p.id) === String(id));
          if (idx >= 0) projects.splice(idx, 1);
          storage.setProjects(projects);
          return { message: 'Projeto deletado com sucesso' };
        }
      );
    },
    async getComments(taskId) {
      return safeCall(
        async () => request(`${API_BASE}/comments/task/${taskId}`),
        () => listCommentsLocal(taskId)
      );
    },
    async addComment(payload) {
      return safeCall(
        async () => request(`${API_BASE}/comments`, { method: 'POST', body: JSON.stringify(payload) }),
        () => {
          const comments = storage.getComments();
          const comment = {
            id: comments.length + 1,
            task_id: payload.task_id,
            author: payload.author || 'sistema',
            content: payload.content,
            created_at: getNowIso()
          };
          comments.push(comment);
          storage.setComments(comments);
          logActivityLocal(payload.task_id, 'commented', `Comentário adicionado`, payload.author || 'sistema');
          return comment;
        }
      );
    },
    async deleteComment(id) {
      return safeCall(
        async () => request(`${API_BASE}/comments/${id}`, { method: 'DELETE' }),
        () => {
          const comments = storage.getComments();
          const idx = comments.findIndex(c => String(c.id) === String(id));
          if (idx >= 0) comments.splice(idx, 1);
          storage.setComments(comments);
          return { message: 'Comentário deletado' };
        }
      );
    },
    async getDashboardMetrics() {
      return safeCall(
        async () => request(`${API_BASE}/dashboard/metrics`),
        () => dashboardLocal()
      );
    },
    async getRandyTasks(query = {}) {
      const queryString = new URLSearchParams(query).toString();
      const url = `${API_BASE}/randy/tasks${queryString ? `?${queryString}` : ''}`;
      return safeCall(
        async () => request(url),
        () => randyTasksLocal(query)
      );
    },
    async getRandyStats() {
      return safeCall(
        async () => request(`${API_BASE}/randy/stats`),
        () => randyStatsLocal()
      );
    }
  };

  window.MissionControl = window.MissionControl || {};
  window.MissionControl.Api = Api;
})();
