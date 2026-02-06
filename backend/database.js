const { Pool } = require('pg');

// Check if DATABASE_URL is set
const hasDatabaseUrl = !!process.env.DATABASE_URL;

let pool = null;
let isConnected = false;
let connectionError = null;

if (hasDatabaseUrl) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5, // Reduced for free tier
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000, // 5s timeout
  });

  pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    isConnected = false;
  });
} else {
  console.warn('⚠️  DATABASE_URL not set - database operations will fail gracefully');
  connectionError = new Error('DATABASE_URL not configured');
}

async function testConnection() {
  if (!pool) return false;
  try {
    await pool.query('SELECT 1');
    isConnected = true;
    connectionError = null;
    return true;
  } catch (err) {
    isConnected = false;
    connectionError = err;
    console.error('Database connection test failed:', err.message);
    return false;
  }
}

async function initDatabase() {
  if (!pool) {
    console.log('⚠️  No database pool available - skipping initialization');
    return false;
  }

  try {
    const client = await pool.connect();
    try {
      // Create tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          color TEXT DEFAULT '#6366f1',
          is_fridge BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS is_fridge BOOLEAN DEFAULT false
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'backlog',
          priority TEXT DEFAULT 'medium',
          randy_status TEXT DEFAULT 'pending',
          project_id INTEGER REFERENCES projects(id),
          assigned_to TEXT,
          tags TEXT,
          due_date DATE,
          notion_link TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          estimated_hours INTEGER,
          actual_hours INTEGER
        )
      `);

      await client.query(`
        ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS due_date DATE
      `);

      await client.query(`
        ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS notion_link TEXT
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS comments (
          id SERIAL PRIMARY KEY,
          task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          author TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS attachments (
          id SERIAL PRIMARY KEY,
          task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          mime_type TEXT,
          size INTEGER,
          uploaded_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS activity_log (
          id SERIAL PRIMARY KEY,
          task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          description TEXT,
          performed_by TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS randy_notifications (
          id SERIAL PRIMARY KEY,
          task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          message TEXT NOT NULL,
          read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert default project
      await client.query(`
        INSERT INTO projects (id, name, description, color, is_fridge)
        VALUES (1, 'Geral', 'Projeto padrão para tarefas diversas', '#6366f1', false)
        ON CONFLICT (id) DO NOTHING
      `);

      console.log('✅ PostgreSQL database initialized');
      isConnected = true;
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
    isConnected = false;
    connectionError = err;
    return false;
  }
}

async function runQuery(sql, params = []) {
  if (!pool) throw new Error('Database not connected');
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return { 
      id: result.rows[0]?.id,
      changes: result.rowCount,
      rows: result.rows
    };
  } finally {
    client.release();
  }
}

async function getQuery(sql, params = []) {
  if (!pool) throw new Error('Database not connected');
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

async function allQuery(sql, params = []) {
  if (!pool) throw new Error('Database not connected');
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (pool) {
    console.log('SIGTERM received, closing database pool...');
    await pool.end();
  }
});

process.on('SIGINT', async () => {
  if (pool) {
    console.log('SIGINT received, closing database pool...');
    await pool.end();
  }
});

module.exports = {
  pool,
  isConnected: () => isConnected,
  getConnectionError: () => connectionError,
  testConnection,
  initDatabase,
  runQuery,
  getQuery,
  allQuery
};
