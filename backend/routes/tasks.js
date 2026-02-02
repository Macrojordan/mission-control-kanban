const express = require('express');
const router = express.Router();
const { allQuery, getQuery, runQuery } = require('../database');
const { logActivity, notifyRandy } = require('../middleware/notifications');

// Listar todas as tarefas
router.get('/', async (req, res) => {
  try {
    const { status, project_id, priority, assigned_to, search, tag } = req.query;
    let sql = `
      SELECT t.*, p.name as project_name, p.color as project_color
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND t.status = ?`;
      params.push(status);
    }
    if (project_id) {
      sql += ` AND t.project_id = ?`;
      params.push(project_id);
    }
    if (priority) {
      sql += ` AND t.priority = ?`;
      params.push(priority);
    }
    if (assigned_to) {
      sql += ` AND t.assigned_to = ?`;
      params.push(assigned_to);
    }
    if (tag) {
      sql += ` AND t.tags LIKE ?`;
      params.push(`%${tag}%`);
    }
    if (search) {
      sql += ` AND (t.title LIKE ? OR t.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
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
    res.status(500).json({ error: error.message });
  }
});

// Obter uma tarefa específica
router.get('/:id', async (req, res) => {
  try {
    const task = await getQuery(`
      SELECT t.*, p.name as project_name, p.color as project_color
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
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
      SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC
    `, [req.params.id]);

    // Buscar anexos
    const attachments = await allQuery(`
      SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at DESC
    `, [req.params.id]);

    // Buscar histórico
    const history = await allQuery(`
      SELECT * FROM activity_log WHERE task_id = ? ORDER BY created_at DESC
    `, [req.params.id]);

    res.json({ ...task, comments, attachments, history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar nova tarefa
router.post('/', async (req, res) => {
  try {
    const { title, description, status, priority, project_id, assigned_to, tags, estimated_hours } = req.body;
    
    const result = await runQuery(`
      INSERT INTO tasks (title, description, status, priority, project_id, assigned_to, tags, estimated_hours)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      description,
      status || 'backlog',
      priority || 'medium',
      project_id || 1,
      assigned_to,
      tags ? JSON.stringify(tags) : '[]',
      estimated_hours
    ]);

    await logActivity(result.id, 'created', `Tarefa criada: ${title}`, assigned_to || 'sistema');
    
    if (assigned_to === 'randy') {
      await notifyRandy(result.id, 'new_task', `Nova tarefa atribuída a você: ${title}`);
    }

    const task = await getQuery('SELECT * FROM tasks WHERE id = ?', [result.id]);
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar tarefa
router.put('/:id', async (req, res) => {
  try {
    const { title, description, status, priority, project_id, assigned_to, tags, estimated_hours, actual_hours } = req.body;
    
    // Buscar tarefa atual
    const currentTask = await getQuery('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!currentTask) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    const updates = [];
    const values = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (status !== undefined) { 
      updates.push('status = ?'); 
      values.push(status);
      
      // Log de mudança de status
      if (status !== currentTask.status) {
        await logActivity(req.params.id, 'status_changed', 
          `Status alterado de "${currentTask.status}" para "${status}"`, 
          req.body.updated_by || 'sistema'
        );
        
        // Se foi movido para done
        if (status === 'done') {
          updates.push('completed_at = ?');
          values.push(new Date().toISOString());
        }
      }
    }
    if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
    if (project_id !== undefined) { updates.push('project_id = ?'); values.push(project_id); }
    if (assigned_to !== undefined) { 
      updates.push('assigned_to = ?'); 
      values.push(assigned_to);
      
      if (assigned_to !== currentTask.assigned_to && assigned_to === 'randy') {
        await notifyRandy(req.params.id, 'assigned', `Tarefa atribuída a você: ${currentTask.title}`);
      }
    }
    if (tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(tags)); }
    if (estimated_hours !== undefined) { updates.push('estimated_hours = ?'); values.push(estimated_hours); }
    if (actual_hours !== undefined) { updates.push('actual_hours = ?'); values.push(actual_hours); }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    await runQuery(`
      UPDATE tasks SET ${updates.join(', ')} WHERE id = ?
    `, values);

    const task = await getQuery('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mover tarefa (drag & drop)
router.patch('/:id/move', async (req, res) => {
  try {
    const { status, position } = req.body;
    
    await runQuery(`
      UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [status, req.params.id]);

    const task = await getQuery('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    
    await logActivity(req.params.id, 'moved', `Tarefa movida para ${status}`, req.body.moved_by || 'sistema');

    // Notificar Randy se a tarefa dele foi movida para done
    if (task.assigned_to === 'randy' && status === 'done') {
      await notifyRandy(req.params.id, 'completed', `Tarefa completada: ${task.title}`);
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar tarefa
router.delete('/:id', async (req, res) => {
  try {
    const task = await getQuery('SELECT title FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    await runQuery('DELETE FROM tasks WHERE id = ?', [req.params.id]);
    await logActivity(req.params.id, 'deleted', `Tarefa deletada: ${task.title}`, req.body.deleted_by || 'sistema');
    
    res.json({ message: 'Tarefa deletada com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
