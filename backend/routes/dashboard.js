const express = require('express');
const router = express.Router();
const { allQuery, getQuery } = require('../database');

// Dashboard metrics
router.get('/metrics', async (req, res) => {
  try {
    // Total de tarefas
    const totalTasks = await getQuery('SELECT COUNT(*) as count FROM tasks');
    
    // Por status
    const byStatus = await allQuery(`
      SELECT status, COUNT(*) as count 
      FROM tasks 
      GROUP BY status
    `);

    // Por prioridade
    const byPriority = await allQuery(`
      SELECT priority, COUNT(*) as count 
      FROM tasks 
      WHERE status != 'done'
      GROUP BY priority
    `);

    // Por projeto
    const byProject = await allQuery(`
      SELECT p.name, p.color, COUNT(t.id) as count
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      GROUP BY p.id
    `);

    // Tempo médio de conclusão
    const avgTime = await getQuery(`
      SELECT AVG(
        (julianday(completed_at) - julianday(created_at)) * 24
      ) as avg_hours 
      FROM tasks 
      WHERE status = 'done' AND completed_at IS NOT NULL
    `);

    // Tarefas concluídas hoje
    const completedToday = await getQuery(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE status = 'done' 
      AND date(completed_at) = date('now')
    `);

    // Tarefas criadas esta semana
    const createdThisWeek = await getQuery(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE date(created_at) >= date('now', '-7 days')
    `);

    // Atividades recentes
    const recentActivity = await allQuery(`
      SELECT al.*, t.title as task_title
      FROM activity_log al
      LEFT JOIN tasks t ON al.task_id = t.id
      ORDER BY al.created_at DESC
      LIMIT 20
    `);

    res.json({
      totals: {
        all: totalTasks.count,
        completed_today: completedToday.count,
        created_this_week: createdThisWeek.count
      },
      by_status: byStatus,
      by_priority: byPriority,
      by_project: byProject,
      avg_completion_hours: Math.round(avgTime.avg_hours || 0),
      recent_activity: recentActivity
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Burndown chart data
router.get('/burndown', async (req, res) => {
  try {
    const { days = 14 } = req.query;
    
    const data = await allQuery(`
      WITH RECURSIVE dates(date) AS (
        SELECT date('now', '-${days} days')
        UNION ALL
        SELECT date(date, '+1 day')
        FROM dates
        WHERE date < date('now')
      )
      SELECT 
        dates.date,
        COUNT(CASE WHEN t.status = 'done' AND date(t.completed_at) <= dates.date THEN 1 END) as completed,
        COUNT(CASE WHEN date(t.created_at) <= dates.date AND (t.status != 'done' OR date(t.completed_at) > dates.date) THEN 1 END) as remaining
      FROM dates
      LEFT JOIN tasks t ON date(t.created_at) <= dates.date
      GROUP BY dates.date
      ORDER BY dates.date
    `);

    res.json({ days: parseInt(days), data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
