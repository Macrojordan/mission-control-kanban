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
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter projeto específico com tarefas
router.get('/:id', async (req, res) => {
  try {
    const project = await getQuery('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    const tasks = await allQuery(`
      SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC
    `, [req.params.id]);

    res.json({ ...project, tasks });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Criar projeto
router.post('/', async (req, res) => {
  try {
    const { name, description, color } = req.body;
    
    const result = await runQuery(`
      INSERT INTO projects (name, description, color)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name, description, color || '#6366f1']);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Atualizar projeto
router.put('/:id', async (req, res) => {
  try {
    const { name, description, color } = req.body;
    
    const result = await runQuery(`
      UPDATE projects SET name = $1, description = $2, color = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [name, description, color, req.params.id]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deletar projeto
router.delete('/:id', async (req, res) => {
  try {
    const result = await runQuery('DELETE FROM projects WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }
    
    res.json({ message: 'Projeto deletado com sucesso' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
