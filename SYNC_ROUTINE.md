# 🔄 Backlog ↔ Mission Control Sync Routine

*Standard operating procedure for keeping BACKLOG.md and Mission Control in sync.*

---

## 📋 Sync Protocol

### When BACKLOG.md Changes

**Trigger:** Any addition, modification, or completion of tasks in BACKLOG.md

**Action:** Automatically sync to Mission Control

```bash
# 1. Update local Mission Control (localhost:3000)
cd ~/.openclaw/workspace/mission-control
./sync-backlog.sh

# 2. Update Render deployment (if needed)
./populate-backlog.sh render
```

### Sync Rules

| BACKLOG Change | Mission Control Action |
|----------------|------------------------|
| New task added | Create new task in MC |
| Task completed | Move to "Done" column |
| Priority changed | Update priority field |
| Task deleted | Archive (don't delete, mark as cancelled) |

---

## 🎯 Column Mapping

| BACKLOG Status | MC Kanban Column |
|----------------|------------------|
| 🆕 Not Started | **Backlog** |
| 🔄 In Progress | **Doing** |
| ⏸️ Blocked | **Review** |
| ✅ Complete | **Done** |
| 🗑️ Deprioritized | **Done** (with label) |

---

## 🚀 Manual Sync Commands

### Sync to Local (WSL2)
```bash
cd ~/.openclaw/workspace/mission-control
./sync-backlog.sh local
```

### Sync to Render (Production)
```bash
cd ~/.openclaw/workspace/mission-control
./sync-backlog.sh render
```

### Full Reset + Populate (Render)
```bash
# WARNING: This deletes all tasks and recreates from BACKLOG.md
curl -s https://mission-control-ikke.onrender.com/api/tasks -H "Authorization: Bearer agentboss2026" | \
  jq -r '.[].id' | \
  xargs -I {} curl -s -X DELETE "https://mission-control-ikke.onrender.com/api/tasks/{}" -H "Authorization: Bearer agentboss2026"

./populate-backlog.sh render
```

---

## 📊 What Gets Synced

### Projects
- Lince Partners (Blue)
- Maison Aura (Pink)
- AgentBoss (Green)

### Task Fields
| Field | Source | Notes |
|-------|--------|-------|
| Title | BACKLOG.md | Task name |
| Description | BACKLOG.md + context | Full details |
| Status | Status column | Maps to kanban column |
| Priority | Priority emoji/label | high/medium/low |
| Project | Section header | Auto-assigned |
| Assigned To | "randy" | Default for all |
| Tags | Derived from task type | Auto-generated |
| Estimated Hours | Size column | SMALL=1, MEDIUM=4, BIG=8 |
| Randy Status | Based on status | pending/in-progress/completed |

---

## 🔄 Automated Sync (Future)

**TODO:** Set up GitHub Action or cron job to:
1. Watch BACKLOG.md for changes
2. Auto-sync to Mission Control
3. Comment on commit with sync status

---

## 📁 Files

| File | Purpose |
|------|---------|
| `BACKLOG.md` | Source of truth (human-readable) |
| `populate-backlog.sh` | One-time population script |
| `sync-backlog.sh` | Incremental sync (to be built) |
| `mission-control/data/mission_control.db` | SQLite database |

---

## 🎨 Branding Guidelines

### Randy Marsh Imagery
- **Logo:** `assets/randy-2.jpg` (round avatar)
- **Nav Icon:** `assets/randy-3.jpg` (small round)
- **User Avatar:** `assets/randy-1.jpg` (with border)
- **Login Page:** `assets/randy-2.jpg` (bouncing animation)

*No more lobsters. Randy Marsh with crab claws ONLY.* 🦀

---

## 🐛 Troubleshooting

### Tasks Not Appearing
1. Check authentication: `curl -H "Authorization: Bearer agentboss2026" URL`
2. Check Render is awake: Visit URL in browser first
3. Check project IDs match

### Duplicate Tasks
- Delete all tasks via API, then re-run populate script
- Or use "Reset" procedure above

### Sync Conflicts
- BACKLOG.md always wins
- If task exists in MC but not BACKLOG → Archive it

---

*Last updated: 2026-02-05*  
*Next review: After first automated sync*