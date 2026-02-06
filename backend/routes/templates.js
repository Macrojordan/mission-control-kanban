const express = require('express');
const router = express.Router();
const { allQuery, getQuery, runQuery, isConnected } = require('../database');

router.get('/', async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const templates = await allQuery('SELECT * FROM templates ORDER BY created_at DESC');
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const { name, data } = req.body;
    if (!name || !data) {
      return res.status(400).json({ error: 'Name and data are required' });
    }

    const result = await runQuery(`
      INSERT INTO templates (name, data)
      VALUES ($1, $2)
      RETURNING *
    `, [name, JSON.stringify(data)]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const { name, data } = req.body;
    const current = await getQuery('SELECT * FROM templates WHERE id = $1', [req.params.id]);
    if (!current) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) { updates.push(`name = $${paramIndex++}`); values.push(name); }
    if (data !== undefined) { updates.push(`data = $${paramIndex++}`); values.push(JSON.stringify(data)); }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    const result = await runQuery(`
      UPDATE templates SET ${updates.join(', ')} WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const current = await getQuery('SELECT id FROM templates WHERE id = $1', [req.params.id]);
    if (!current) {
      return res.status(404).json({ error: 'Template not found' });
    }
    await runQuery('DELETE FROM templates WHERE id = $1', [req.params.id]);
    res.json({ message: 'Template deleted' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
