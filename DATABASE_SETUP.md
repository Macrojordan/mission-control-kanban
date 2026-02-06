# Mission Control - PostgreSQL Setup Guide

## The Problem
SQLite doesn't work well on Render's ephemeral filesystem. The solution is to use PostgreSQL.

## Solution Options

### Option 1: Render PostgreSQL (Free Tier) - RECOMMENDED

1. Go to https://dashboard.render.com/
2. Click "New" → "PostgreSQL"
3. Create a new database:
   - Name: `mission-control-db`
   - Database: `mission_control`
   - User: `mission_control`
   - Plan: Free
4. Once created, copy the "Internal Database URL"
5. Go to your Mission Control web service
6. Add Environment Variable:
   - Key: `DATABASE_URL`
   - Value: (paste the Internal Database URL)
7. Redeploy the service

### Option 2: Render Blueprint (Automatic)

The `render.yaml` file in this repo defines both the web service and database.

1. Go to https://dashboard.render.com/blueprints
2. Click "New Blueprint Instance"
3. Connect your GitHub repo
4. Render will automatically create both the database and web service
5. The DATABASE_URL will be set automatically

### Option 3: Supabase (Alternative)

1. Go to https://supabase.com/
2. Create a new project
3. Go to Settings → Database
4. Copy the connection string
5. Add to Render as DATABASE_URL environment variable

### Option 4: Neon (Alternative)

1. Go to https://neon.tech/
2. Create a new project
3. Copy the connection string
4. Add to Render as DATABASE_URL environment variable

## Verification

After setting up the database:

```bash
# Check health (should show "database: connected")
curl https://mission-control-ikke.onrender.com/health

# Check API
curl -H "Authorization: Bearer agentboss2026" \
  https://mission-control-ikke.onrender.com/api/projects
```

## Fallback Mode

If the database is not connected, the app will:
- Return empty arrays for API calls
- Frontend will use localStorage for data persistence
- All features work, but data is browser-local only

This is useful for testing but NOT for production use.

## Populating Initial Data

Once the database is connected, run:

```bash
./populate-render.sh
```

This will create the default projects and tasks.
