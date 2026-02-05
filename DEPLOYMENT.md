# Mission Control — Deployment Info

**Status:** ✅ LIVE ON RENDER  
**Stable URL:** https://mission-control-ikke.onrender.com  
**Last Updated:** 2026-02-05

## How It's Running

**Platform:** Render.com (Free Tier)  
**Backend:** Node.js + Express + SQLite  
**Frontend:** Static files served by Express  
**Password Protection:** Enabled

## Access

- **URL:** https://mission-control-ikke.onrender.com
- **Password:** `agentboss2026`
- **No signup required** — just enter password

## Features Available

- ✅ Kanban board (Todo → Doing → Review → Done)
- ✅ Create, edit, move, delete tasks
- ✅ Task priorities (low/medium/high/urgent)
- ✅ Project organization
- ✅ Randy status tracking
- ✅ File attachments
- ✅ Comments on tasks
- ✅ Mobile responsive (FAB, pull-to-refresh)
- ✅ Password protection

## Sync with Local

The Render instance has its own database. To sync with local WSL2 instance:

1. Export local data: `sqlite3 data/mission_control.db .dump > backup.sql`
2. Import to Render: (requires SSH or database access)

**Or:** Start fresh on Render — the backlog tasks are in GitHub.

## What's Next

- [ ] Import backlog tasks from local DB
- [ ] Set up auto-deploy on git push
- [ ] Custom domain (missioncontrol.agentboss.ai)

## Local Development (WSL2)

Still running on localhost:3000 for development:
```bash
cd ~/.openclaw/workspace/mission-control/backend
npm start
```

Local URL: http://localhost:3000
