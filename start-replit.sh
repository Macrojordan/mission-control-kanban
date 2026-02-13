#!/bin/bash
# Startup script for Replit deployment

echo "🚀 Starting Mission Control on Replit..."

# Ensure we're in the right directory
cd "$(dirname "$0")"

# Check for DATABASE_URL (Replit provides this for PostgreSQL)
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not set. Checking for local PostgreSQL..."

  # Try to use local PostgreSQL
  if command -v pg_isready &> /dev/null; then
    if pg_isready -q; then
      export DATABASE_URL="postgresql://localhost:5432/mission_control"
      echo "✅ Using local PostgreSQL"
    else
      echo "❌ PostgreSQL not running. Attempting to start..."
      if [ -d "$REPL_HOME/.pg/data" ]; then
        pg_ctl -D "$REPL_HOME/.pg/data" -l "$REPL_HOME/.pg/logfile" start
        sleep 3
        export DATABASE_URL="postgresql://localhost:5432/mission_control"
      fi
    fi
  fi
fi

# Install backend dependencies
echo "📦 Installing dependencies..."
cd backend
npm install

# Run database migrations/init
echo "🗄️  Initializing database..."
node -e "
const { initDatabase } = require('./database');
initDatabase().then(() => {
  console.log('✅ Database ready');
  process.exit(0);
}).catch(err => {
  console.error('❌ Database error:', err.message);
  process.exit(1);
});
"

if [ $? -ne 0 ]; then
  echo "⚠️  Database init failed, but continuing..."
fi

# Set default password if not set
if [ -z "$APP_PASSWORD" ]; then
  export APP_PASSWORD="agentboss2026"
  echo "🔐 Using default password: agentboss2026"
fi

echo "✅ Mission Control starting on port ${PORT:-3000}..."

# Start the server
npm start
