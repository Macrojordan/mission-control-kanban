# Mission Control — Replit Deployment Guide

## Quick Start

1. **Create new Replit:**
   - Go to [replit.com](https://replit.com)
   - Click "Create" → "Import from GitHub"
   - Paste: `https://github.com/Macrojordan/mission-control`
   - Select **Node.js** template

2. **Configure Secrets** (in Replit's Secrets tab):
   ```
   APP_PASSWORD = agentboss2026
   NOTION_TOKEN = (your Notion integration token - optional)
   NOTION_DATABASE_ID = (your Notion database ID - optional)
   ```

3. **Deploy:**
   - Click the **Deploy** button
   - Wait for build to complete
   - Done! 🎉

## What's Different on Replit

| Feature | Local/Render | Replit |
|---------|--------------|--------|
| Database | SQLite/PostgreSQL | Replit PostgreSQL (auto-managed) |
| Deployment | Manual/Auto | One-click Deploy |
| URL | Render subdomain | Replit subdomain |
| Password | agentboss2026 | Set via Secrets |

## Database Migration (from Local/Render)

If you want to migrate existing data:

```bash
# From local WSL2:
cd ~/.openclaw/workspace/mission-control
sqlite3 data/mission_control.db .dump > export.sql

# Then convert SQL to PostgreSQL format and import in Replit
```

Or just start fresh — tasks can be re-imported from Notion.

## Troubleshooting

**Port already in use?**
- Replit automatically assigns `$PORT` — the app uses that

**Database connection failed?**
- Check Secrets tab for `DATABASE_URL`
- Replit should auto-provide this for PostgreSQL

**CSS/JS not loading?**
- Check browser console for 404s
- May need to rebuild frontend assets

## Access

- **URL:** `https://mission-control-<username>.replit.app`
- **Password:** Whatever you set in `APP_PASSWORD` secret (default: `agentboss2026`)

---

Last updated: 2026-02-13
