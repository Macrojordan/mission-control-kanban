const express = require('express');
const router = express.Router();
const { allQuery, getQuery, runQuery } = require('../database');

// Endpoint especial para Randy ver suas tarefas
router.get('/tasks', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT t.*, p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.assigned_to = 'randy'
    `;
    const params = [];

    if (status) {
      sql += ` AND t.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY 
      CASE t.priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
      END,
      t.created_at DESC
    `;

    const tasks = await allQuery(sql, params);
    
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

    res.json({
      assigned_to: 'randy',
      total: tasks.length,
      tasks: tasks
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Randy marca tarefa como completa
router.post('/tasks/:id/complete', async (req, res) => {
  try {
    const task = await getQuery('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    await runQuery(`
      UPDATE tasks 
      SET status = 'done', randy_status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND assigned_to = 'randy'
    `, [req.params.id]);

    await runQuery(`
      INSERT INTO activity_log (task_id, action, description, performed_by)
      VALUES (?, 'completed', 'Tarefa completada por Randy', 'randy')
    `, [req.params.id]);

    res.json({ message: 'Tarefa marcada como completa', task_id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Randy atualiza progresso de uma tarefa
router.post('/tasks/:id/progress', async (req, res) => {
  try {
    const { status, actual_hours, comment, randy_status } = req.body;
    
    const task = await getQuery('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    const updates = ['updated_at = CURRENT_TIMESTAMP'];
    const values = [];

    if (status) {
      updates.push('status = ?');
      values.push(status);
      // Set completed_at when task is marked as done
      if (status === 'done') {
        updates.push('completed_at = ?');
        values.push(new Date().toISOString());
        updates.push("randy_status = 'completed'");
      }
    }
    if (actual_hours !== undefined) {
      updates.push('actual_hours = ?');
      values.push(actual_hours);
    }
    if (randy_status !== undefined) {
      updates.push('randy_status = ?');
      values.push(randy_status);
    }
    values.push(req.params.id);

    await runQuery(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values);

    if (comment) {
      await runQuery(`
        INSERT INTO comments (task_id, author, content)
        VALUES (?, 'randy', ?)
      `, [req.params.id, comment]);
    }

    await runQuery(`
      INSERT INTO activity_log (task_id, action, description, performed_by)
      VALUES (?, 'progress_update', ?, 'randy')
    `, [req.params.id, comment || 'Progresso atualizado']);

    res.json({ message: 'Progresso atualizado', task_id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Notificações para Randy
router.get('/notifications', async (req, res) => {
  try {
    const { unread_only } = req.query;
    let sql = 'SELECT * FROM randy_notifications WHERE 1=1';
    const params = [];

    if (unread_only === 'true') {
      sql += ' AND read = 0';
    }

    sql += ' ORDER BY created_at DESC LIMIT 50';

    const notifications = await allQuery(sql, params);
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Marcar notificação como lida
router.post('/notifications/:id/read', async (req, res) => {
  try {
    await runQuery(`
      UPDATE randy_notifications SET read = 1 WHERE id = ?
    `, [req.params.id]);
    res.json({ message: 'Notificação marcada como lida' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Estatísticas do Randy
router.get('/stats', async (req, res) => {
  try {
    const totalTasks = await getQuery(`
      SELECT COUNT(*) as count FROM tasks WHERE assigned_to = 'randy'
    `);
    
    const completedTasks = await getQuery(`
      SELECT COUNT(*) as count FROM tasks WHERE assigned_to = 'randy' AND status = 'done'
    `);
    
    const inProgressTasks = await getQuery(`
      SELECT COUNT(*) as count FROM tasks WHERE assigned_to = 'randy' AND status = 'in_progress'
    `);

    const avgCompletionTime = await getQuery(`
      SELECT AVG(
        (julianday(completed_at) - julianday(created_at)) * 24
      ) as avg_hours 
      FROM tasks 
      WHERE assigned_to = 'randy' AND status = 'done' AND completed_at IS NOT NULL
    `);

    const byPriority = await allQuery(`
      SELECT priority, COUNT(*) as count 
      FROM tasks 
      WHERE assigned_to = 'randy' AND status != 'done'
      GROUP BY priority
    `);

    res.json({
      total: totalTasks.count,
      completed: completedTasks.count,
      in_progress: inProgressTasks.count,
      completion_rate: totalTasks.count > 0 ? Math.round((completedTasks.count / totalTasks.count) * 100) : 0,
      avg_completion_hours: Math.round(avgCompletionTime.avg_hours || 0),
      by_priority: byPriority
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
