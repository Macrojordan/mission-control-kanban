const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { initDatabase, pool, isConnected, testConnection } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || 'agentboss2026';

// Trust proxy (needed for Render)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Password protection middleware
function checkPassword(req, res, next) {
  // Skip auth for login page and auth endpoints
  if (req.path === '/login' || req.path === '/login.html' || 
      req.path === '/auth/verify' || req.path.startsWith('/auth/')) {
    return next();
  }

  const authCookie = req.headers.cookie?.match(/auth=([^;]+)/)?.[1];
  const authHeader = req.headers.authorization?.replace('Bearer ', '');
  
  if (authCookie === 'authenticated' || authHeader === APP_PASSWORD) {
    return next();
  }

  // API requests return 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Static file requests and page requests redirect to login
  res.sendFile(path.join(__dirname, 'login.html'));
}

// Apply password protection BEFORE static files
app.use(checkPassword);

// CORS
app.use(cors());

// Static files (now protected)
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Auth endpoints
app.post('/auth/verify', (req, res) => {
  const { password } = req.body;
  if (password === APP_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Database status middleware - adds db status to requests
app.use('/api', (req, res, next) => {
  req.dbConnected = isConnected();
  next();
});

// Routes
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/projects', require('./routes/projects')); // includes fridge toggle/filter
app.use('/api/comments', require('./routes/comments'));
app.use('/api/randy', require('./routes/randy'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/notion', require('./routes/notion'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/search', require('./routes/search'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/sync', require('./routes/sync'));

// Main route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Health check - now with DB connectivity test
app.get('/health', async (req, res) => {
  try {
    // Test database connectivity
    const dbOk = await testConnection();
    if (dbOk) {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        database: 'connected'
      });
    } else {
      res.status(503).json({ 
        status: 'degraded', 
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        message: 'Database not connected - frontend will use localStorage'
      });
    }
  } catch (err) {
    res.status(503).json({ 
      status: 'error', 
      timestamp: new Date().toISOString(),
      database: 'error',
      error: err.message
    });
  }
});

// API health check
app.get('/api/health', async (req, res) => {
  try {
    const dbOk = await testConnection();
    if (dbOk) {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        database: 'connected'
      });
    } else {
      res.status(503).json({ 
        status: 'degraded', 
        timestamp: new Date().toISOString(),
        database: 'disconnected'
      });
    }
  } catch (err) {
    res.status(503).json({ 
      status: 'error', 
      error: err.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    if (isConnected()) {
      console.log('✅ Database connected');
    } else {
      console.log('⚠️  Database not connected - server will run in degraded mode');
    }
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    console.log('⚠️  Starting server without database - frontend will use localStorage');
  }
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Mission Control running at http://0.0.0.0:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🤖 API Randy: http://localhost:${PORT}/api/randy`);
    console.log(`🔒 Password protected`);
  });
}

startServer();

module.exports = app;
