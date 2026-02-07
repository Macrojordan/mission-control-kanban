# Mission Control Workflow Enhancement Task

## Goal
Enhance Mission Control kanban to support full workflow: **Backlog → To Do → In Progress → Review → Done**

## Current State
- Database has only: `todo`, `doing`, `done`
- Need to add: `backlog`, `review`

## Database Changes

1. **Alter task status options** - Update the `status` column to accept new values
   - Valid statuses: `backlog`, `todo`, `doing`, `review`, `done`
   - No schema migration needed if using VARCHAR (just allow new values)

2. **Update backend validation** - Allow new status values in `/api/tasks` routes

## Frontend Changes

### 1. Add Kanban Columns (index.html)
Add two new columns in the kanban board:
- **BACKLOG** (far left, before To Do) - gray/muted styling
- **REVIEW** (between In Progress and Done) - yellow/amber styling

### 2. Update CSS (styles.css)
- `.column-backlog` - Gray/muted theme for ideas/future
- `.column-review` - Yellow/amber theme for awaiting approval

### 3. Update JavaScript (kanban.js + app.js)
- Add `backlog` and `review` to column definitions
- Update drag-and-drop to recognize new columns
- Update task counts/stats

## Task Reclassification

After adding columns, move these tasks via API:

### Move to BACKLOG (ideas, future work)
```
PATCH /api/tasks/21/move  {"status": "backlog"}  # Agent Boss Breakfast - LinkedIn Live Series
PATCH /api/tasks/7/move   {"status": "backlog"}  # Post SaaSpocalypse LinkedIn Content
PATCH /api/tasks/12/move  {"status": "backlog"}  # Define Pricing Model
PATCH /api/tasks/11/move  {"status": "backlog"}  # Finalize Mission & Methodology
PATCH /api/tasks/19/move  {"status": "backlog"}  # Review Implementation Backlog Ideas
PATCH /api/tasks/18/move  {"status": "backlog"}  # Test Claude Opus 4.6 vs 4.5
```

### Move to REVIEW (Randy completed, awaiting Ruben)
```
PATCH /api/tasks/2/move   {"status": "review"}   # 33-Slide Deck Outline
PATCH /api/tasks/1/move   {"status": "review"}   # AI Training Strategy Framework
PATCH /api/tasks/15/move  {"status": "review"}   # Mission Control PostgreSQL Setup
PATCH /api/tasks/6/move   {"status": "review"}   # SaaSpocalypse Insurance Package
PATCH /api/tasks/20/move  {"status": "review"}   # X/Twitter Daily Curation System
PATCH /api/tasks/17/move  {"status": "review"}   # Bird CLI Setup
PATCH /api/tasks/16/move  {"status": "review"}   # Claude Opus 4.6 Analysis
```

### Keep in DONE (confirmed complete)
```
Task 14: Fix Cron Job Telegram Delivery - CONFIRMED WORKING
```

## API Details
- **Base URL:** https://mission-control-ikke.onrender.com
- **Auth Header:** `Authorization: Bearer agentboss2026`

## Expected Result
Kanban board with 5 columns:
| Backlog | To Do | In Progress | Review | Done |
|---------|-------|-------------|--------|------|
| Ideas   | Ready | Working     | Awaiting | Complete |

## Files to Modify
1. `backend/routes/tasks.js` - Accept new statuses
2. `frontend/index.html` - Add column HTML
3. `frontend/css/styles.css` - Add column styling
4. `frontend/js/kanban.js` - Add column logic
5. `frontend/js/app.js` - Update any status references
