const express = require('express');
const router = express.Router();
const { allQuery, runQuery } = require('../database');

// Listar comentários de uma tarefa
router.get('/task/:taskId', async (req, res) => {
  try {
    const comments = await allQuery(`
      SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC
    `, [req.params.taskId]);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicionar comentário
router.post('/', async (req, res) => {
  try {
    const { task_id, author, content } = req.body;
    
    const result = await runQuery(`
      INSERT INTO comments (task_id, author, content)
      VALUES (?, ?, ?)
    `, [task_id, author, content]);

    const comment = await allQuery('SELECT * FROM comments WHERE id = ?', [result.id]);
    res.status(201).json(comment[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar comentário
router.delete('/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM comments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Comentário deletado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
