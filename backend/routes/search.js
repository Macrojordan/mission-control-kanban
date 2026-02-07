const express = require('express');
const router = express.Router();
const { allQuery, isConnected } = require('../database');
const fs = require('fs');
const path = require('path');
const os = require('os');

const WORKSPACE = path.join(os.homedir(), '.openclaw', 'workspace');

function getSnippet(content, query, maxLen = 150) {
  const lower = content.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return content.substring(0, maxLen);
  const start = Math.max(0, idx - 60);
  const end = Math.min(content.length, idx + query.length + 90);
  let snippet = (start > 0 ? '...' : '') + content.substring(start, end) + (end < content.length ? '...' : '');
  // Highlight match
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  snippet = snippet.replace(re, '<mark>$1</mark>');
  return snippet;
}

function searchInFile(filePath, query, type, basePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lower = content.toLowerCase();
    const qLower = query.toLowerCase();
    if (!lower.includes(qLower)) return null;

    const relativePath = path.relative(WORKSPACE, filePath);
    const fileName = path.basename(filePath, '.md');
    // Try to extract a title from first # heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    const title = headingMatch ? headingMatch[1] : fileName;

    // Count occurrences for ranking
    let count = 0;
    let pos = 0;
    while ((pos = lower.indexOf(qLower, pos)) !== -1) { count++; pos += qLower.length; }

    // Check title match (boost)
    const titleMatch = title.toLowerCase().includes(qLower);

    const stat = fs.statSync(filePath);

    return {
      type,
      title,
      snippet: getSnippet(content, query),
      path: relativePath,
      date: stat.mtime.toISOString(),
      score: count + (titleMatch ? 10 : 0)
    };
  } catch {
    return null;
  }
}

function walkDir(dir, ext = '.md') {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        results.push(...walkDir(full, ext));
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        results.push(full);
      }
    }
  } catch { /* ignore */ }
  return results;
}

router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json([]);
    }

    const results = [];

    // 1. Search tasks in DB
    if (isConnected()) {
      try {
        const tasks = await allQuery(`
          SELECT t.id, t.title, t.description, t.status, t.priority, t.updated_at,
                 p.name as project_name
          FROM tasks t
          LEFT JOIN projects p ON t.project_id = p.id
          WHERE t.title ILIKE $1 OR t.description ILIKE $1
          ORDER BY t.updated_at DESC
          LIMIT 20
        `, [`%${q}%`]);

        for (const task of tasks) {
          const haystack = `${task.title} ${task.description || ''}`;
          const titleMatch = task.title.toLowerCase().includes(q.toLowerCase());
          results.push({
            type: 'task',
            title: task.title,
            snippet: getSnippet(task.description || task.title, q),
            id: task.id,
            status: task.status,
            priority: task.priority,
            project: task.project_name,
            date: task.updated_at,
            score: (titleMatch ? 15 : 0) + 5
          });
        }
      } catch (err) {
        console.error('Task search error:', err.message);
      }
    }

    // 2. Search memory files
    const memoryDir = path.join(WORKSPACE, 'memory');
    const memoryFiles = walkDir(memoryDir);
    for (const file of memoryFiles) {
      const result = searchInFile(file, q, 'memory', WORKSPACE);
      if (result) results.push(result);
    }

    // 3. Search second-brain files
    const brainDir = path.join(WORKSPACE, 'second-brain');
    const brainFiles = walkDir(brainDir);
    for (const file of brainFiles) {
      const result = searchInFile(file, q, 'document', WORKSPACE);
      if (result) results.push(result);
    }

    // 4. Search root docs
    const rootDocs = ['MEMORY.md', 'AGENTS.md', 'TOOLS.md'];
    for (const doc of rootDocs) {
      const filePath = path.join(WORKSPACE, doc);
      const result = searchInFile(filePath, q, 'document', WORKSPACE);
      if (result) results.push(result);
    }

    // Sort by score descending
    results.sort((a, b) => (b.score || 0) - (a.score || 0));

    res.json(results.slice(0, 50));
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get file content for preview
router.get('/file', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'Path required' });

    const fullPath = path.join(WORKSPACE, filePath);
    // Security: ensure path is within workspace
    if (!fullPath.startsWith(WORKSPACE)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({ content, path: filePath });
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

module.exports = router;
