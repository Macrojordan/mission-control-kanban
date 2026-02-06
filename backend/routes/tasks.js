const express = require('express');
const router = express.Router();
const { allQuery, getQuery, runQuery, isConnected } = require('../database');
const { logActivity, notifyRandy } = require('../middleware/notifications');

const VALID_STATUSES = new Set(['backlog', 'todo', 'in_progress', 'review', 'done']);

// Listar todas as tarefas
router.get('/', async (req, res) => {
  // Return empty array if database not connected (frontend will use localStorage)
  if (!isConnected()) {
    return res.json([]);
  }

  try {
    const { status, project_id, priority, assigned_to, search, tag } = req.query;
    let sql = `
      SELECT t.*, p.name as project_name, p.color as project_color
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND t.status = $${paramIndex++}`;
      params.push(status);
    }
    if (project_id) {
      sql += ` AND t.project_id = $${paramIndex++}`;
      params.push(project_id);
    }
    if (priority) {
      sql += ` AND t.priority = $${paramIndex++}`;
      params.push(priority);
    }
    if (assigned_to) {
      sql += ` AND t.assigned_to = $${paramIndex++}`;
      params.push(assigned_to);
    }
    if (tag) {
      sql += ` AND t.tags ILIKE $${paramIndex++}`;
      params.push(`%${tag}%`);
    }
    if (search) {
      sql += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ` ORDER BY t.created_at DESC`;

    const tasks = await allQuery(sql, params);
    
    // Parse tags JSON
    tasks.forEach(task => {
      if (task.tags) {
        try {
          task.tags = JSON.parse(task.tags);
        } catch {
          task.tags = task.tags.split(',').map(t => t.trim());
        }
      } else {
        task.tags = [];
      }
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter uma tarefa específica
router.get('/:id', async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const task = await getQuery(`
      SELECT t.*, p.name as project_name, p.color as project_color
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = $1
    `, [req.params.id]);

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    // Parse tags
    if (task.tags) {
      try {
        task.tags = JSON.parse(task.tags);
      } catch {
        task.tags = task.tags.split(',').map(t => t.trim());
      }
    } else {
      task.tags = [];
    }

    // Buscar comentários
    const comments = await allQuery(`
      SELECT * FROM comments WHERE task_id = $1 ORDER BY created_at ASC
    `, [req.params.id]);

    // Buscar anexos
    const attachments = await allQuery(`
      SELECT * FROM attachments WHERE task_id = $1 ORDER BY created_at DESC
    `, [req.params.id]);

    // Buscar histórico
    const history = await allQuery(`
      SELECT * FROM activity_log WHERE task_id = $1 ORDER BY created_at DESC
    `, [req.params.id]);

    res.json({ ...task, comments, attachments, history });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Criar nova tarefa
router.post('/', async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database not connected - use localStorage mode' });
  }

  try {
    const { title, description, status, priority, project_id, assigned_to, tags, estimated_hours, actual_hours, randy_status, due_date, notion_link, notion_page_id } = req.body;
    const resolvedStatus = status || 'backlog';
    if (!VALID_STATUSES.has(resolvedStatus)) {
      return res.status(400).json({ error: `Status inválido: ${resolvedStatus}` });
    }
    
    const result = await runQuery(`
      INSERT INTO tasks (title, description, status, priority, randy_status, project_id, assigned_to, tags, estimated_hours, actual_hours, due_date, notion_link, notion_page_id, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      title,
      description,
      resolvedStatus,
      priority || 'medium',
      randy_status || 'pending',
      project_id || 1,
      assigned_to,
      tags ? JSON.stringify(tags) : '[]',
      estimated_hours,
      actual_hours,
      due_date || null,
      notion_link || null,
      notion_page_id || null,
      resolvedStatus === 'done' ? new Date().toISOString() : null
    ]);

    const task = result.rows[0];
    
    await logActivity(task.id, 'created', `Tarefa criada: ${title}`, assigned_to || 'sistema');
    
    if (assigned_to === 'randy') {
      await notifyRandy(task.id, 'new_task', `Nova tarefa atribuída a você: ${title}`);
    }

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Atualizar tarefa
router.put('/:id', async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const { title, description, status, priority, project_id, assigned_to, tags, estimated_hours, actual_hours, randy_status, due_date, notion_link, notion_page_id } = req.body;
    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: `Status inválido: ${status}` });
    }
    
    // Buscar tarefa atual
    const currentTask = await getQuery('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!currentTask) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (title !== undefined) { updates.push(`title = $${paramIndex++}`); values.push(title); }
    if (description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(description); }
    if (status !== undefined) { 
      updates.push(`status = $${paramIndex++}`); 
      values.push(status);
      
      // Log de mudança de status
      if (status !== currentTask.status) {
        await logActivity(req.params.id, 'status_changed', 
          `Status alterado de "${currentTask.status}" para "${status}"`, 
          req.body.updated_by || 'sistema'
        );
        
        // Se foi movido para done
        if (status === 'done') {
          updates.push(`completed_at = $${paramIndex++}`);
          values.push(new Date().toISOString());
        }
      }
    }
    if (priority !== undefined) { updates.push(`priority = $${paramIndex++}`); values.push(priority); }
    if (randy_status !== undefined) { updates.push(`randy_status = $${paramIndex++}`); values.push(randy_status); }
    if (project_id !== undefined) { updates.push(`project_id = $${paramIndex++}`); values.push(project_id); }
    if (assigned_to !== undefined) { 
      updates.push(`assigned_to = $${paramIndex++}`); 
      values.push(assigned_to);
      
      if (assigned_to !== currentTask.assigned_to && assigned_to === 'randy') {
        await notifyRandy(req.params.id, 'assigned', `Tarefa atribuída a você: ${currentTask.title}`);
      }
    }
    if (tags !== undefined) { updates.push(`tags = $${paramIndex++}`); values.push(JSON.stringify(tags)); }
    if (estimated_hours !== undefined) { updates.push(`estimated_hours = $${paramIndex++}`); values.push(estimated_hours); }
    if (actual_hours !== undefined) { updates.push(`actual_hours = $${paramIndex++}`); values.push(actual_hours); }
    if (due_date !== undefined) { updates.push(`due_date = $${paramIndex++}`); values.push(due_date); }
    if (notion_link !== undefined) { updates.push(`notion_link = $${paramIndex++}`); values.push(notion_link); }
    if (notion_page_id !== undefined) { updates.push(`notion_page_id = $${paramIndex++}`); values.push(notion_page_id); }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.params.id);

    const result = await runQuery(`
      UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mover tarefa (drag & drop)
router.patch('/:id/move', async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const { status, position } = req.body;
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: `Status inválido: ${status}` });
    }

    const updates = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [status];
    let paramIndex = 2;

    if (status === 'done') {
      updates.push(`completed_at = $${paramIndex++}`);
      values.push(new Date().toISOString());
      updates.push(`randy_status = 'completed'`);
    }

    values.push(req.params.id);

    const result = await runQuery(`
      UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    const task = result.rows[0];
    
    await logActivity(req.params.id, 'moved', `Tarefa movida para ${status}`, req.body.moved_by || 'sistema');

    // Notificar Randy se a tarefa dele foi movida para done
    if (task.assigned_to === 'randy' && status === 'done') {
      await notifyRandy(req.params.id, 'completed', `Tarefa completada: ${task.title}`);
    }

    res.json(task);
  } catch (error) {
    console.error('Error moving task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deletar tarefa
router.delete('/:id', async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const task = await getQuery('SELECT title FROM tasks WHERE id = $1', [req.params.id]);
    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    await runQuery('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    await logActivity(req.params.id, 'deleted', `Tarefa deletada: ${task.title}`, req.body.deleted_by || 'sistema');
    
    res.json({ message: 'Tarefa deletada com sucesso' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
