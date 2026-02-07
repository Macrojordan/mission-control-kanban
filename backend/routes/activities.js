const express = require('express');
const router = express.Router();
const { allQuery, isConnected } = require('../database');

// GET /api/activities?limit=50&offset=0
router.get('/', async (req, res) => {
  if (!isConnected()) {
    return res.json([]);
  }

  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    const activities = await allQuery(`
      SELECT a.*, t.title as task_title
      FROM activity_log a
      LEFT JOIN tasks t ON a.task_id = t.id
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
