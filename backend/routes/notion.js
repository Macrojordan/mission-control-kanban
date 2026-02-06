const express = require('express');
const { Client } = require('@notionhq/client');

const router = express.Router();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const notion = NOTION_TOKEN ? new Client({ auth: NOTION_TOKEN }) : null;

function extractPlainText(richText = []) {
  return richText.map(item => item.plain_text || '').join('').trim();
}

function extractTitle(item) {
  if (!item) return '';
  if (item.object === 'database') {
    return extractPlainText(item.title || []);
  }
  if (item.object === 'page') {
    const props = item.properties || {};
    const titleProp = Object.values(props).find(prop => prop && prop.type === 'title');
    if (titleProp && Array.isArray(titleProp.title)) {
      return extractPlainText(titleProp.title);
    }
  }
  return '';
}

function extractIcon(item) {
  if (!item || !item.icon) return { type: 'none', value: '' };
  if (item.icon.type === 'emoji') {
    return { type: 'emoji', value: item.icon.emoji };
  }
  if (item.icon.type === 'external') {
    return { type: 'external', value: item.icon.external?.url || '' };
  }
  if (item.icon.type === 'file') {
    return { type: 'file', value: item.icon.file?.url || '' };
  }
  return { type: 'none', value: '' };
}

function mapNotionResult(item) {
  const title = extractTitle(item);
  const icon = extractIcon(item);
  return {
    id: item.id,
    type: item.object,
    title,
    url: item.url || '',
    icon_type: icon.type,
    icon: icon.value
  };
}

function ensureNotion(req, res, next) {
  if (!notion) {
    return res.status(503).json({ error: 'Notion token not configured' });
  }
  return next();
}

router.get('/search', ensureNotion, async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.json([]);
  }

  try {
    const response = await notion.search({
      query,
      page_size: 20,
      sort: { direction: 'descending', timestamp: 'last_edited_time' }
    });
    const results = (response.results || [])
      .map(mapNotionResult)
      .filter(item => item.title);
    res.json(results);
  } catch (error) {
    console.error('Notion search failed:', error.message);
    res.status(502).json({ error: 'Notion search failed' });
  }
});

router.get('/pages', ensureNotion, async (req, res) => {
  try {
    const response = await notion.search({
      page_size: 50,
      sort: { direction: 'descending', timestamp: 'last_edited_time' }
    });
    const results = (response.results || [])
      .map(mapNotionResult)
      .filter(item => item.title);
    res.json(results);
  } catch (error) {
    console.error('Notion pages failed:', error.message);
    res.status(502).json({ error: 'Notion pages failed' });
  }
});

module.exports = router;
