const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || 'agentboss2026';

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
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

// Static files (now protected)
app.use(cors());
app.use(express.static(path.join(__dirname, '../frontend')));
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

// Inicializar banco de dados
initDatabase();

// Rotas
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/randy', require('./routes/randy'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Health check (needs auth now)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mission Control rodando em http://0.0.0.0:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🤖 API Randy: http://localhost:${PORT}/api/randy`);
  console.log(`🔒 Password protected`);
});

module.exports = app;