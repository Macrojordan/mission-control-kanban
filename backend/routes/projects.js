const express = require('express');
const router = express.Router();
const { allQuery, getQuery, runQuery } = require('../database');

// Listar todos os projetos
router.get('/', async (req, res) => {
  try {
    const projects = await allQuery(`
      SELECT p.*, COUNT(t.id) as task_count
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obter projeto específico com tarefas
router.get('/:id', async (req, res) => {
  try {
    const project = await getQuery('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    const tasks = await allQuery(`
      SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC
    `, [req.params.id]);

    res.json({ ...project, tasks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar projeto
router.post('/', async (req, res) => {
  try {
    const { name, description, color } = req.body;
    
    const result = await runQuery(`
      INSERT INTO projects (name, description, color)
      VALUES (?, ?, ?)
    `, [name, description, color || '#6366f1']);

    const project = await getQuery('SELECT * FROM projects WHERE id = ?', [result.id]);
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar projeto
router.put('/:id', async (req, res) => {
  try {
    const { name, description, color } = req.body;
    
    await runQuery(`
      UPDATE projects SET name = ?, description = ?, color = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, description, color, req.params.id]);

    const project = await getQuery('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar projeto
router.delete('/:id', async (req, res) => {
  try {
    await runQuery('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ message: 'Projeto deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
