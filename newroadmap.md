# FinSentinel — Complete Hackathon Roadmap

> **Deadline: June 11, 2026 @ 2:00 PM PDT (June 12, 2:30 AM IST)**
> **Track: Dynatrace (Financial Services — Fraud Detection)**
> **Prize Pool: 1st $5,000 / 2nd $3,000 / 3rd $2,000**

---

## 🗺️ Platforms You Need (3 Total)

| # | Platform | Sign Up URL | What You Get | Status |
|---|----------|------------|--------------|--------|
| 1 | **Google Cloud Console** | https://console.cloud.google.com/ | Gemini API, Cloud Run, Agent Builder | ✅ Already have (project: `finsentinel-fraud-agent`) |
| 2 | **Dynatrace** | https://www.dynatrace.com/signup/ | Free trial. Observability, metrics, traces, MCP server | ✅ Already have (env: `zzu50796`) |
| 3 | **Devpost** | https://rapid-agent.devpost.com/ | Submit your project | ⬜ Need to join hackathon + submit |

**That's it. Only 3 platforms.**

---

## 🔑 API Keys You Need (Summary)

| Key | Where to Get It | Env Variable | Status |
|-----|----------------|-------------|--------|
| Gemini API Key | Google AI Studio → https://aistudio.google.com/apikey | `GEMINI_API_KEY` | ✅ Have it, verified working |
| GCP Project ID | Google Cloud Console → project selector | `GCP_PROJECT_ID` | ✅ Have it |
| Dynatrace Environment URL | Your DT tenant URL | `DT_ENVIRONMENT` | ✅ Fixed |
| Dynatrace API Token | Dynatrace → Settings → Access Tokens | `DT_API_TOKEN` | ✅ Done — scopes: metrics.ingest, openTelemetryTrace.ingest, DataExport |

---

## 🛠 Phase 1: Core Frameworks & Environment

### What the hackathon says:
- Use **Google Cloud Console** as your mission control
- Build with **Gemini** (via Agent Builder OR Developer SDK)
- Optionally use the **Agent Starter Pack** template

### What we're using:
- **Developer SDK path** → `google-genai` Python library (already installed)
- **Gemini 2.0 Flash** for fast triage, **Gemini 2.0 Pro** for deep investigation
- **FastAPI** as our backend (custom, not Agent Builder managed)

### What you need to do:

**Step 1.1 — Verify Google Cloud project**
1. Go to https://console.cloud.google.com/
2. Make sure project `finsentinel-fraud-agent` is selected
3. Enable these APIs (if not already):
   - Vertex AI API
   - Cloud Run API (for Phase 5 deployment)

**Step 1.2 — Verify Gemini API key**
- Already done ✅ — Key is in `.env` and verified working

**Step 1.3 — Check Google Cloud credits**
- If you haven't already, request $100 credits: https://forms.gle/xfv9vQzfRfNCCVbG7
- Or use the free trial: https://cloud.google.com/free

### ✅ Phase 1 Status: DONE
Your Gemini key works, SDK is installed, project exists.

---

## 🔗 Phase 2: Action Mechanisms & Data Connectivity

### What the hackathon says:
- Give your agent **tools** to do things
- Give your agent **knowledge** to know things
- Can use Agent Builder Extensions or custom tools

### What we have:
- 5 custom tools in `app/tools/mock_tools.py`:
  1. `get_customer_profile()` — account age, balance, risk tier
  2. `get_merchant_risk()` — chargeback rate, fraud flags
  3. `check_geolocation()` — physical feasibility check
  4. `get_behavioral_baseline()` — 12-month spending patterns
  5. `get_related_transactions()` — velocity detection

### What you need to do:

**Step 2.1 — Tools are already built** ✅
- Our tools work in mock mode and provide evidence to the Gemini agents
- When `MOCK_MODE=false`, agents call real Gemini with tool evidence

**Step 2.2 — No external data store needed**
- We use synthetic transaction generation, not real customer data
- Agent Builder Data Stores are optional — our use case doesn't need PDFs/BigQuery

### ✅ Phase 2 Status: DONE
Tools exist and are wired into the agent pipeline.

---

## 🧰 Phase 3: Partner Integration — DYNATRACE ⚠️ CRITICAL

### What the hackathon says:
From the Dynatrace resources page:
> "Instrument your agent with OpenTelemetry and ship traces, metrics, and logs to Dynatrace.
> Track token spend, tool calls, latency, and errors across Vertex AI, Gemini, and your coding agents."

### What Dynatrace provides:
1. **Dynatrace for Agent Platform** — traces, prompt flows, token usage
2. **Dynatrace for Gemini Enterprise** — one-click from GCP Marketplace
3. **AI Coding Agent Monitoring** — observability for AI agents
4. **Instrumentation Examples** — GitHub repo with OTel configs
5. **Dynatrace MCP Server** — `@dynatrace-oss/dynatrace-mcp-server` npm package

### What you need to do:

#### Step 3.1 — Fix Dynatrace Environment URL ✅ DONE
Fixed in `.env`.

#### Step 3.2 — Fix Dynatrace API Token Scopes ✅ DONE
New token created with scopes: `metrics.ingest`, `openTelemetryTrace.ingest`, `DataExport`. Pasted into `.env`.

#### Step 3.3 — Wire OpenTelemetry to Dynatrace ✅ DONE
`tracer.py` now exports to: `https://zzu50796.live.dynatrace.com/api/v2/otlp/v1/traces`
With auth header: `Api-Token {your_token}`

#### Step 3.4 — Integrate Dynatrace MCP Server ✅ DONE
The MCP server (`@dynatrace-oss/dynatrace-mcp-server`) is now integrated:
- `app/tools/mcp_client.py` — Python MCP client (JSON-RPC over stdio)
- `self_monitor.py` — tries MCP first, falls back to direct API
- Needs `DT_ENVIRONMENT` and `DT_PLATFORM_TOKEN` in `.env`

**To create the Platform Token:**
1. Go to https://myaccount.dynatrace.com/platformTokens
2. Create token → name: `finsentinel-mcp`
3. Scopes: `davis-copilot:nl2dql:execute`, `storage:buckets:read`
4. Paste into `.env` as `DT_PLATFORM_TOKEN`

#### Step 3.5 — Check GitHub Examples
Read through the instrumentation examples:
https://github.com/dynatrace-oss/dynatrace-ai-agent-instrumentation-examples/tree/main/ai-coding-agents

These have ready-to-use OTel exporter configs and dashboard templates.

### ✅ Phase 3 Status: DONE — CODE COMPLETE
- ✅ Dynatrace account exists
- ✅ API token with correct scopes — DONE
- ✅ DT_ENDPOINT fixed — DONE
- ✅ OTel tracer.py wired to correct endpoint — DONE
- ✅ MCP server integrated (`mcp_client.py` + `self_monitor.py`)
- ⬜ Need to create Platform Token (DT_PLATFORM_TOKEN) and paste in .env

---

## 🧠 Phase 4: Reasoning, State & Logic Hosting

### What the hackathon says:
- **Agent Runtime** — deploy Python agents (LangChain/LlamaIndex)
- **Secret Manager** — store API keys securely

### What we have:
- 3-agent pipeline: Intake → Investigator → Decision
- Cost-aware routing: Economy/Standard/Premium tiers
- Budget controller tracking spend
- Self-healing concept (FP rate monitoring)
- OTel tracing on every agent call

### What you need to do:

**Step 4.1 — Our agent pipeline is built** ✅
```
Transaction → Intake Agent (Flash) → Investigator Agent (Pro) → Decision Agent → Result
                                          ↑
                              Cost Router determines tier
                                          ↑
                              Self-Monitor checks Dynatrace MCP
```

**Step 4.2 — Secret Manager (Optional but nice)**
- Currently using `.env` file for secrets
- For Cloud Run deployment, can use GCP Secret Manager
- Not strictly required for hackathon demo

**Step 4.3 — Agent Runtime (Not using)**
- We're NOT using Vertex AI Agent Runtime
- Our agents run directly via FastAPI + uvicorn
- This is fine — the hackathon allows custom backends

### ✅ Phase 4 Status: DONE
Agent logic, routing, and orchestration are complete.

---

## 🚀 Phase 5: Deployment & Safety

### What the hackathon says:
- Deploy via **Cloud Run** (custom backend)
- Add **Safety Settings** to Gemini calls
- Make it accessible via web interface

### What you need to do:

**Step 5.1 — Dockerfile is ready** ✅
Already have `Dockerfile` that runs `uvicorn app.main:app`

**Step 5.2 — Deploy to Cloud Run**
```bash
# Build and push Docker image
gcloud builds submit --tag gcr.io/finsentinel-fraud-agent/finsentinel

# Deploy to Cloud Run
gcloud run deploy finsentinel \
  --image gcr.io/finsentinel-fraud-agent/finsentinel \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars MOCK_MODE=true,GEMINI_API_KEY=xxx,DT_API_TOKEN=xxx,...
```

**Step 5.3 — Add Gemini Safety Settings**
Add safety settings to all Gemini API calls to filter harmful content.

**Step 5.4 — Write README.md** ❌ MUST DO
Currently just `# DynatraceAgent`. Needs:
- Project name & description
- Architecture diagram
- Setup instructions
- Demo screenshots/video
- What Dynatrace integration does
- What Google Cloud services are used

### ⚠️ Phase 5 Status: NOT STARTED
- ✅ Dockerfile ready
- ❌ Not deployed to Cloud Run
- ❌ No safety settings
- ❌ README is empty

---

## 📋 Priority Action Plan (What to Do Next)

### TODAY — Immediate (P0)

| # | Task | Time Est. |
|---|------|-----------|
| ~~1~~ | ~~Fix `.env` — fix `DT_ENDPOINT`~~ | ✅ DONE |
| ~~2~~ | ~~Fix `.env.example` — remove any leaked keys~~ | ✅ DONE |
| ~~3~~ | ~~Login to Dynatrace, fix API token scopes~~ | ✅ DONE |
| ~~4~~ | ~~Fix `tracer.py` — use correct OTLP endpoint URL~~ | ✅ DONE |
| 5 | Install Node.js v22+ (needed for Dynatrace MCP server) | 5 min |
| 6 | Integrate Dynatrace MCP server into `self_monitor.py` | 1-2 hrs |

### TOMORROW — Important (P1)

| # | Task | Time Est. |
|---|------|-----------|
| ~~7~~ | ~~Add Gemini safety settings to all agent calls~~ | ✅ DONE |
| ~~8~~ | ~~Add JSON parsing safety (try/except on Gemini responses)~~ | ✅ DONE |
| 9 | Test full pipeline with `MOCK_MODE=false` (uses real Gemini, real Dynatrace) | 30 min |
| 10 | Deploy to Cloud Run | 1 hr |
| 11 | Write README.md with architecture, setup, screenshots | 1 hr |

### BEFORE SUBMISSION — Polish (P2)

| # | Task | Time Est. |
|---|------|-----------|
| 12 | Record demo video | 30 min |
| 13 | Take dashboard screenshots | 15 min |
| 14 | Submit on Devpost | 30 min |

---

## 🏗️ Architecture (What Judges Will See)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FinSentinel Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   Transaction Stream                                              │
│        │                                                          │
│        ▼                                                          │
│   ┌─────────────┐    ┌──────────────────┐    ┌───────────────┐   │
│   │ Intake Agent │───▶│Investigator Agent│───▶│Decision Agent │   │
│   │(Gemini Flash)│    │  (Gemini Pro)    │    │ (Gemini Pro)  │   │
│   └──────┬──────┘    └────────┬─────────┘    └───────┬───────┘   │
│          │                    │                       │           │
│          ▼                    ▼                       ▼           │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │              Cost-Aware Router Engine                     │   │
│   │    Economy ←──── Budget Controller ────→ Premium          │   │
│   └──────────────────────┬───────────────────────────────────┘   │
│                          │                                        │
│                          ▼                                        │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │           OpenTelemetry (Traces, Metrics, Logs)          │   │
│   │                     │                                     │   │
│   │                     ▼                                     │   │
│   │            Dynatrace Platform                             │   │
│   │    ┌─────────────────────────────────┐                    │   │
│   │    │  Dynatrace MCP Server           │                    │   │
│   │    │  - Query FP rate metrics        │                    │   │
│   │    │  - Agent health monitoring      │──→ Self-Healing    │   │
│   │    │  - Token spend tracking         │   Loop             │   │
│   │    └─────────────────────────────────┘                    │   │
│   └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │         Vanilla JS Dashboard (WebSocket Live Feed)        │   │
│   │   - Real-time transaction feed                            │   │
│   │   - Chart.js cost/decision charts                         │   │
│   │   - Self-healing status display                           │   │
│   └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│                    Deployed on Cloud Run                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📚 Reference Links (from Hackathon)

### Google Cloud
- Console: https://console.cloud.google.com/
- Agent Builder: https://cloud.google.com/products/agent-builder
- SDK for Python: https://cloud.google.com/python/docs/reference/aiplatform/latest
- Agent Starter Pack: https://github.com/GoogleCloudPlatform/agent-starter-pack
- Cloud Run: https://cloud.google.com/run/docs/quickstarts
- Safety Settings: https://cloud.google.com/vertex-ai/docs/generative-ai/learn/responsible-ai
- Secret Manager: https://cloud.google.com/secret-manager

### Dynatrace
- Sign Up: https://www.dynatrace.com/signup/
- Agent Platform Integration: https://www.dynatrace.com/hub/detail/vertex-ai/
- Gemini Enterprise (Marketplace): https://console.cloud.google.com/marketplace/product/dynatrace-marketplace-prod/dynatrace-for-gemini-enterprise
- AI Coding Agent Monitoring: https://www.dynatrace.com/news/blog/dynatrace-expands-ai-coding-agent-monitoring/
- Instrumentation Examples (GitHub): https://github.com/dynatrace-oss/dynatrace-ai-agent-instrumentation-examples
- OTel Pipeline (Bindplane): https://bindplane.com/google
- **MCP Server npm package**: `@dynatrace-oss/dynatrace-mcp-server`

### Hackathon
- Main page: https://rapid-agent.devpost.com/
- Resources: https://rapid-agent.devpost.com/resources
- Dynatrace Track: https://rapid-agent.devpost.com/details/dynatrace-resources
- FAQ: https://rapid-agent.devpost.com/details/faq
- Discord: https://discord.gg/7Dqk5ebCD4
- Discussions: https://rapid-agent.devpost.com/forum_topics
