const express = require('express');
const router = express.Router();
const { allQuery, runQuery, isConnected } = require('../database');

// Listar comentários de uma tarefa
router.get('/task/:taskId', async (req, res) => {
  if (!isConnected()) {
    return res.json([]);
  }

  try {
    const comments = await allQuery(`
      SELECT * FROM comments WHERE task_id = $1 ORDER BY created_at ASC
    `, [req.params.taskId]);
    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Adicionar comentário
router.post('/', async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const { task_id, author, content } = req.body;
    
    const result = await runQuery(`
      INSERT INTO comments (task_id, author, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [task_id, author, content]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deletar comentário
router.delete('/:id', async (req, res) => {
  if (!isConnected()) {
    return res.status(503).json({ error: 'Database not connected' });
  }

  try {
    const result = await runQuery('DELETE FROM comments WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Comentário não encontrado' });
    }
    
    res.json({ message: 'Comentário deletado' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
