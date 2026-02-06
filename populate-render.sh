#!/bin/bash
# Populate Mission Control with Backlog Tasks (RENDER-OPTIMIZED)
# Usage: ./populate-render.sh

set -e

BASE_URL="https://mission-control-ikke.onrender.com"
AUTH_HEADER="Authorization: Bearer agentboss2026"

echo "🚀 Populating Mission Control at $BASE_URL"
echo "⏳ Waiting for Render instance to wake up..."

# Wake up the instance with retry
for i in {1..5}; do
  if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" | grep -q "200\|401\|302"; then
    echo "✅ Instance is awake!"
    break
  fi
  echo "  Attempt $i/5... waiting 3s"
  sleep 3
done

echo ""
echo "📁 Creating projects..."

# Create Projects with error handling
LINCE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"name":"Lince Partners","color":"#3b82f6","description":"M&A boutique AI training client"}' || echo '{"error":"failed"}')

LINCE_ID=$(echo "$LINCE_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "  Lince Partners ID: ${LINCE_ID:-'ERROR - may already exist'}"

MAISON_RESPONSE=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"name":"Maison Aura","color":"#ec4899","description":"Esthetics clinic WhatsApp chatbot"}' || echo '{"error":"failed"}')

MAISON_ID=$(echo "$MAISON_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "  Maison Aura ID: ${MAISON_ID:-'ERROR - may already exist'}"

AGENTBOSS_RESPONSE=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"name":"AgentBoss","color":"#10b981","description":"AI consulting business infrastructure"}' || echo '{"error":"failed"}')

AGENTBOSS_ID=$(echo "$AGENTBOSS_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "  AgentBoss ID: ${AGENTBOSS_ID:-'ERROR - may already exist'}"

# If projects already exist, fetch their IDs
if [ -z "$LINCE_ID" ] || [ -z "$MAISON_ID" ] || [ -z "$AGENTBOSS_ID" ]; then
  echo ""
  echo "🔍 Fetching existing project IDs..."
  PROJECTS=$(curl -s -H "$AUTH_HEADER" "$BASE_URL/api/projects")
  LINCE_ID=$(echo "$PROJECTS" | grep -o '"id":[0-9]*,"name":"Lince Partners"' | grep -o '"id":[0-9]*' | cut -d: -f2)
  MAISON_ID=$(echo "$PROJECTS" | grep -o '"id":[0-9]*,"name":"Maison Aura"' | grep -o '"id":[0-9]*' | cut -d: -f2)
  AGENTBOSS_ID=$(echo "$PROJECTS" | grep -o '"id":[0-9]*,"name":"AgentBoss"' | grep -o '"id":[0-9]*' | cut -d: -f2)
  
  # Fallback to IDs 1,2,3 if we can't parse
  LINCE_ID=${LINCE_ID:-1}
  MAISON_ID=${MAISON_ID:-2}
  AGENTBOSS_ID=${AGENTBOSS_ID:-3}
  
  echo "  Using IDs: Lince=$LINCE_ID, Maison=$MAISON_ID, AgentBoss=$AGENTBOSS_ID"
fi

echo ""
echo "📝 Creating tasks..."

# Function to create task
create_task() {
  local title="$1"
  local payload="$2"
  
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/tasks" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "$payload" || echo '{"error":"failed"}')
  
  if echo "$RESPONSE" | grep -q '"id"'; then
    echo "  ✅ Created: $title"
  else
    echo "  ⚠️  Failed/Exists: $title"
  fi
}

# Lince Partners Tasks
create_task "AI Training Strategy Doc" "{\"title\":\"AI Training Strategy Doc\",\"description\":\"Comprehensive 26KB document covering: M&A workflow deep dive, 4-step Sector Coverage prompt system, 3 training approaches, 6 mind-blowing Copilot capabilities, implementation roadmap.\",\"status\":\"done\",\"priority\":\"high\",\"project_id\":$LINCE_ID,\"assigned_to\":\"randy\",\"tags\":\"strategy,documentation,ai-training\",\"estimated_hours\":6,\"randy_status\":\"completed\"}"

create_task "Create Training Slide Deck" "{\"title\":\"Create Training Slide Deck\",\"description\":\"Convert strategy doc into presentation format for 1-2 hour client training session. Include demos, hands-on exercises, and printable prompt cards.\",\"status\":\"todo\",\"priority\":\"medium\",\"project_id\":$LINCE_ID,\"assigned_to\":\"randy\",\"tags\":\"presentation,training,client-delivery\",\"estimated_hours\":4,\"randy_status\":\"pending\"}"

create_task "Research: M&A AI Use Cases" "{\"title\":\"Research: M&A AI Use Cases\",\"description\":\"Benchmark how other financial advisory firms use AI. Document sector coverage workflows, Copilot adoption patterns, competitive landscape.\",\"status\":\"todo\",\"priority\":\"low\",\"project_id\":$LINCE_ID,\"assigned_to\":\"randy\",\"tags\":\"research,benchmark,competitive-analysis\",\"estimated_hours\":4,\"randy_status\":\"pending\"}"

# Maison Aura Tasks
create_task "ChatBot Intelligence Update" "{\"title\":\"ChatBot Intelligence Update\",\"description\":\"Update system prompt to recommend Bronze MÉDIO as default (not Light). Map AVEC/Kommo integration points. Document metrics tracking for Aline revenue share.\",\"status\":\"todo\",\"priority\":\"high\",\"project_id\":$MAISON_ID,\"assigned_to\":\"randy\",\"tags\":\"chatbot,prompt-engineering,integration\",\"estimated_hours\":4,\"randy_status\":\"pending\"}"

create_task "AVEC/Kommo Integration" "{\"title\":\"AVEC/Kommo Integration Architecture\",\"description\":\"Full technical architecture for connecting ByteGPT with AVEC (salon management) and Kommo (CRM). API mapping, webhook setup, data flow diagrams.\",\"status\":\"todo\",\"priority\":\"medium\",\"project_id\":$MAISON_ID,\"assigned_to\":\"randy\",\"tags\":\"architecture,api,integration\",\"estimated_hours\":8,\"randy_status\":\"pending\"}"

# AgentBoss Tasks
create_task "X Curation System" "{\"title\":\"X Curation System Setup\",\"description\":\"Create directory structure, templates for daily X feed curation. Set up Second Brain integration. Bird CLI installed and ready.\",\"status\":\"done\",\"priority\":\"high\",\"project_id\":$AGENTBOSS_ID,\"assigned_to\":\"randy\",\"tags\":\"automation,curation,second-brain\",\"estimated_hours\":3,\"randy_status\":\"completed\"}"

create_task "Mission Control Fixes" "{\"title\":\"Mission Control Kanban Fixes\",\"description\":\"Fixed 4 issues: randy_status tracking, modular JS structure, completion timestamps, UI improvements. Deployed live.\",\"status\":\"done\",\"priority\":\"high\",\"project_id\":$AGENTBOSS_ID,\"assigned_to\":\"randy\",\"tags\":\"bugfix,deployment,kanban\",\"estimated_hours\":3,\"randy_status\":\"completed\"}"

create_task "Morning Brief v2" "{\"title\":\"Morning Brief Template v2\",\"description\":\"Updated based on user feedback: bullet format (no tables), next steps per project, prioritize X trends, bio data insights with surprises.\",\"status\":\"done\",\"priority\":\"medium\",\"project_id\":$AGENTBOSS_ID,\"assigned_to\":\"randy\",\"tags\":\"template,automation,daily-ops\",\"estimated_hours\":1,\"randy_status\":\"completed\"}"

create_task "AgentBoss Website" "{\"title\":\"AgentBoss Website / Landing Page\",\"description\":\"Design and build professional landing page for agentboss.ai. Include services, methodology, case studies, contact form.\",\"status\":\"todo\",\"priority\":\"medium\",\"project_id\":$AGENTBOSS_ID,\"assigned_to\":\"randy\",\"tags\":\"website,landing-page,marketing\",\"estimated_hours\":12,\"randy_status\":\"pending\"}"

create_task "Brave Search API" "{\"title\":\"Configure Brave Search API\",\"description\":\"Gateway-level Brave Search API configuration. Key exists but needs proper integration with web_search tool.\",\"status\":\"todo\",\"priority\":\"medium\",\"project_id\":$AGENTBOSS_ID,\"assigned_to\":\"randy\",\"tags\":\"api,config,search\",\"estimated_hours\":1,\"randy_status\":\"blocked\"}"

create_task "Daily X Curation" "{\"title\":\"Daily X Curation (Recurring)\",\"description\":\"Scan X Following feed for AI/tech news, M&A insights, AgentBoss opportunities. Generate implementation ideas. Write to Second Brain.\",\"status\":\"todo\",\"priority\":\"medium\",\"project_id\":$AGENTBOSS_ID,\"assigned_to\":\"randy\",\"tags\":\"recurring,curation,research\",\"estimated_hours\":2,\"randy_status\":\"pending\"}"

create_task "Client Proposal Templates" "{\"title\":\"Client Proposal Template Library\",\"description\":\"Create reusable templates for AgentBoss client proposals. Include pricing models, SOW formats, case study sections.\",\"status\":\"todo\",\"priority\":\"low\",\"project_id\":$AGENTBOSS_ID,\"assigned_to\":\"randy\",\"tags\":\"templates,sales,documentation\",\"estimated_hours\":3,\"randy_status\":\"pending\"}"

create_task "Fix Date Formatting" "{\"title\":\"Fix frontend date formatting\",\"description\":\"Fix date display issues in frontend. Test on staging before deploying to production.\",\"status\":\"todo\",\"priority\":\"medium\",\"project_id\":$AGENTBOSS_ID,\"assigned_to\":\"randy\",\"tags\":\"bugfix,frontend\",\"estimated_hours\":2,\"randy_status\":\"pending\"}"

create_task "PM2 Auto-start" "{\"title\":\"PM2 Auto-start on boot\",\"description\":\"Configure systemd user service for PM2 auto-start on WSL boot.\",\"status\":\"done\",\"priority\":\"medium\",\"project_id\":$AGENTBOSS_ID,\"assigned_to\":\"randy\",\"tags\":\"deployment,config\",\"estimated_hours\":1,\"randy_status\":\"completed\"}"

create_task "Mobile UI" "{\"title\":\"Mobile UI improvements\",\"description\":\"Add FAB, pull-to-refresh, offline detection, toast notifications. Optimize for mobile use.\",\"status\":\"done\",\"priority\":\"medium\",\"project_id\":$AGENTBOSS_ID,\"assigned_to\":\"randy\",\"tags\":\"ui,mobile,frontend\",\"estimated_hours\":3,\"randy_status\":\"completed\"}"

create_task "Render Deployment" "{\"title\":\"Render.com deployment\",\"description\":\"Deploy Mission Control to Render.com for stable public URL.\",\"status\":\"done\",\"priority\":\"high\",\"project_id\":$AGENTBOSS_ID,\"assigned_to\":\"randy\",\"tags\":\"deployment,hosting\",\"estimated_hours\":2,\"randy_status\":\"completed\"}"

echo ""
echo "✅ Done! Check your Mission Control at:"
echo "   https://mission-control-ikke.onrender.com"
