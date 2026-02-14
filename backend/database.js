const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Determine which database to use
const usePostgres = !!process.env.DATABASE_URL;

let pool = null;
let db = null;
let isConnected = false;
let connectionError = null;
let dbType = 'none';

if (usePostgres) {
  // PostgreSQL configuration
  dbType = 'postgresql';
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    isConnected = false;
  });
} else {
  // SQLite fallback for local/Replit development
  dbType = 'sqlite';
  const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '../data/mission_control.db');
  console.log(`Using SQLite database at: ${dbPath}`);
  
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('SQLite connection error:', err.message);
      connectionError = err;
    } else {
      console.log('Connected to SQLite database');
      isConnected = true;
    }
  });
}

async function testConnection() {
  if (dbType === 'postgresql') {
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
  } else if (dbType === 'sqlite') {
    return isConnected;
  }
  return false;
}

function isConnected() {
  return isConnected;
}

function getConnectionError() {
  return connectionError;
}

// SQLite helper functions
function sqliteQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function sqliteRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

async function initDatabase() {
  if (dbType === 'postgresql') {
    if (!pool) {
      console.log('⚠️  No PostgreSQL pool available');
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        await client.query(`
          CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'backlog',
            priority TEXT DEFAULT 'medium',
            project_id INTEGER REFERENCES projects(id),
            randy_status TEXT,
            tags JSONB DEFAULT '[]',
            estimated_hours INTEGER,
            actual_hours INTEGER,
            due_date DATE,
            notion_link TEXT,
            notion_page_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
          )
        `);
        
        await client.query(`
          CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        await client.query(`
          CREATE TABLE IF NOT EXISTS activities (
            id SERIAL PRIMARY KEY,
            type TEXT NOT NULL,
            description TEXT NOT NULL,
            task_id INTEGER,
            project_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        isConnected = true;
        console.log('✅ PostgreSQL database initialized');
        return true;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('❌ PostgreSQL init error:', err.message);
      isConnected = false;
      return false;
    }
  } else if (dbType === 'sqlite') {
    // SQLite table creation
    try {
      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          color TEXT DEFAULT '#6366f1',
          is_fridge INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'backlog',
          priority TEXT DEFAULT 'medium',
          project_id INTEGER,
          randy_status TEXT,
          tags TEXT DEFAULT '[]',
          estimated_hours INTEGER,
          actual_hours INTEGER,
          due_date DATE,
          notion_link TEXT,
          notion_page_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME
        )
      `);
      
      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id INTEGER,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await sqliteRun(`
        CREATE TABLE IF NOT EXISTS activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          description TEXT NOT NULL,
          task_id INTEGER,
          project_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('✅ SQLite database initialized');
      isConnected = true;
      return true;
    } catch (err) {
      console.error('❌ SQLite init error:', err.message);
      isConnected = false;
      return false;
    }
  }
}

// Database query helper that works with both PostgreSQL and SQLite
async function query(sql, params = []) {
  if (dbType === 'postgresql') {
    const result = await pool.query(sql, params);
    return result.rows;
  } else if (dbType === 'sqlite') {
    return sqliteQuery(sql, params);
  }
  throw new Error('No database connection');
}

async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results[0] || null;
}

async function run(sql, params = []) {
  if (dbType === 'postgresql') {
    const result = await pool.query(sql, params);
    return result;
  } else if (dbType === 'sqlite') {
    return sqliteRun(sql, params);
  }
  throw new Error('No database connection');
}

module.exports = {
  pool,
  db,
  dbType,
  initDatabase,
  testConnection,
  isConnected: () => isConnected,
  getConnectionError: () => connectionError,
  query,
  queryOne,
  run
};
