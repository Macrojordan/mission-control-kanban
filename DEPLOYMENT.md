# Mission Control — Deployment Info

**Status:** ✅ LIVE  
**URL:** https://entirely-archives-motherboard-originally.trycloudflare.com  
**Last Updated:** 2026-02-05 12:15 BRT

## How It's Running

**Backend:** PM2 process manager (keeps it alive forever)  
**Tunnel:** Cloudflare Quick Tunnel (public URL)  
**Local Port:** localhost:3000

## Commands

```bash
# Check status
npx pm2 status

# View logs
npx pm2 logs mission-control

# Restart if needed
npx pm2 restart mission-control

# Stop
npx pm2 stop mission-control
```

## ⚠️ Important Notes

1. **This URL is temporary** — Cloudflare quick tunnels change on restart
2. **For a permanent URL** — Need to set up a named tunnel with Cloudflare account
3. **PM2 auto-start** — Need to run `npx pm2 startup` to survive WSL restarts

## What's Working
- ✅ Kanban board (create, move, edit tasks)
- ✅ Task priorities (low/medium/high/urgent)
- ✅ Randy status tracking
- ✅ File attachments
- ✅ Comments
- ✅ Projects

## Next Improvements
- [ ] Set up persistent Cloudflare tunnel (custom domain)
- [ ] Configure PM2 auto-start on boot
- [ ] Railway/Render deployment for true 24/7 uptime
