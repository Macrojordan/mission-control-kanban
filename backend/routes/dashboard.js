const express = require('express');
const router = express.Router();
const { allQuery, getQuery, isConnected } = require('../database');

// Dashboard metrics
router.get('/metrics', async (req, res) => {
  if (!isConnected()) {
    return res.json({
      totals: { all: 0, completed_today: 0, created_this_week: 0 },
      by_status: [],
      by_priority: [],
      by_project: [],
      avg_completion_hours: 0,
      recent_activity: []
    });
  }

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
      GROUP BY p.id, p.name, p.color
    `);

    // Tempo médio de conclusão - PostgreSQL syntax
    const avgTime = await getQuery(`
      SELECT AVG(
        EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600
      ) as avg_hours 
      FROM tasks 
      WHERE status = 'done' AND completed_at IS NOT NULL
    `);

    // Tarefas concluídas hoje - PostgreSQL syntax
    const completedToday = await getQuery(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE status = 'done' 
      AND DATE(completed_at) = CURRENT_DATE
    `);

    // Tarefas criadas esta semana - PostgreSQL syntax
    const createdThisWeek = await getQuery(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
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
        all: parseInt(totalTasks.count),
        completed_today: parseInt(completedToday.count),
        created_this_week: parseInt(createdThisWeek.count)
      },
      by_status: byStatus,
      by_priority: byPriority,
      by_project: byProject,
      avg_completion_hours: Math.round(avgTime.avg_hours || 0),
      recent_activity: recentActivity
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Burndown chart data
router.get('/burndown', async (req, res) => {
  if (!isConnected()) {
    return res.json({ days: 14, data: [] });
  }

  try {
    const { days = 14 } = req.query;
    const daysInt = parseInt(days);
    
    // PostgreSQL generate_series for date ranges
    const data = await allQuery(`
      SELECT 
        d.date::date as date,
        COUNT(CASE WHEN t.status = 'done' AND DATE(t.completed_at) <= d.date THEN 1 END) as completed,
        COUNT(CASE WHEN DATE(t.created_at) <= d.date AND (t.status != 'done' OR DATE(t.completed_at) > d.date) THEN 1 END) as remaining
      FROM generate_series(
        CURRENT_DATE - ($1 || ' days')::interval,
        CURRENT_DATE,
        '1 day'::interval
      ) AS d(date)
      LEFT JOIN tasks t ON DATE(t.created_at) <= d.date
      GROUP BY d.date
      ORDER BY d.date
    `, [daysInt]);

    res.json({ days: daysInt, data });
  } catch (error) {
    console.error('Error fetching burndown:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
