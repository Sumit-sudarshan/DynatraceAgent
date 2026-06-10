# FinSentinel — Cost-Aware, Self-Healing Fraud Detection Agent
## Track: Dynatrace | Google Cloud Rapid Agent Hackathon

**Deadline:** June 11, 2026 @ 2:00pm PDT
**Prize:** $5,000 (1st) | $3,000 (2nd) | $2,000 (3rd)
**Judges:** Sean O'Dell (Principal PMM, DevEx @ Dynatrace), Jeff Blankenburg (Principal DevAdv @ Dynatrace), Google Cloud Partner Engineers (Khushan Adatiya, Rich Deken, Jess Ambriz, Jon Pawlowski, Saurabh Kumar, George Keller, Merlin Yamssi)
**Required Stack:** Gemini 3 + Google Cloud Agent Builder + Dynatrace MCP Server

---

## Judging Criteria (from Devpost)

| # | Criterion | Question | Weight |
|---|---|---|---|
| 1 | **Technological Implementation** | Does the interaction with Google Cloud and Partner services demonstrate quality software development? | 25% |
| 2 | **Design** | Is the user experience and design of the project well thought out? | 25% |
| 3 | **Potential Impact** | How big of an impact could the project have on target communities? | 25% |
| 4 | **Quality of the Idea** | How creative and unique is the project? | 25% |

---

## The Core Idea

**Problem Statement:**
Financial fraud costs $485B+ globally per year. Banks are deploying AI to detect fraud — but they face three critical blockers:
1. **Black-Box Liability:** In regulated industries (banking, insurance, payments), every AI decision that blocks a transaction must be explainable and auditable. A black-box agent is a regulatory liability.
2. **Concept Drift:** Static machine learning models silently degrade over time as fraudsters adapt their behaviors. The system needs to self-heal and adapt dynamically, rather than waiting for scheduled retraining.
3. **Runaway AI Costs:** An agentic multi-step investigation using LLMs can cost $0.05–$0.50 per transaction. At millions of transactions per day, naive agentic systems cost more than the fraud they prevent.

**Solution: FinSentinel**
A Gemini-powered multi-agent fraud detection system that is:
- **Fully Observable** — every reasoning step, tool call, and decision is traced via OpenTelemetry → Dynatrace
- **Self-Monitoring** — the agent queries its OWN performance via Dynatrace MCP Server (latency, accuracy, error rate)
- **Cost-Aware** — a dynamic cost engine uses Dynatrace metrics to route transactions through cheap vs. expensive models, auto-adjusting thresholds to stay under budget
- **Self-Healing** — when Dynatrace MCP reports degraded performance, the agent switches operating modes automatically

**Elevator Pitch:**
> "Banks are deploying AI agents to fight fraud, but they can't see inside those agents, and they can't control the costs. FinSentinel gives you both — an AI agent that catches fraud, controls its own operating costs via smart model routing, and proves it's working correctly through Dynatrace observability. Because in finance, an unobservable, budget-busting AI is a liability, not an asset."

---

## Scoring Self-Assessment

| Criterion | Score | Justification |
|---|---|---|
| **Technological Implementation** | 10/10 | 3-agent pipeline via ADK + Agent Builder, OTel instrumentation on every decision, Dynatrace MCP server for self-monitoring + cost tracking + compliance audit + auto-alerting, cost-aware model routing with dynamic threshold adjustment |
| **Design** | 10/10 | Real-time dark-themed dashboard with live fraud feed, step-by-step reasoning chain viewer, interactive geo-anomaly map, agent health panel powered by Dynatrace MCP, cost efficiency chart, responsive design |
| **Potential Impact** | 10/10 | $485B fraud problem, every bank needs explainable AI, regulatory compliance is non-negotiable, cost control solves the #1 enterprise adoption blocker |
| **Quality of the Idea** | 10/10 | Novel triple intersection: fraud detection + full AI observability + cost-aware self-tuning. No one else is building agents that monitor themselves AND control their own costs via the observability platform |

**Total: 100/100**

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      FRAUD ANALYST / OPERATOR                       │
│           (views live investigations, overrides decisions)           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                  FINSENTINEL WEB DASHBOARD                          │
│         (Vite + React + Tailwind + shadcn/ui + Tremor)              │
│                                                                     │
│  ┌──────────────────┐ ┌──────────────────┐ ┌────────────────────┐  │
│  │ LIVE FRAUD FEED  │ │ INVESTIGATION    │ │ AGENT HEALTH +     │  │
│  │ • Real-time tx   │ │ DETAIL           │ │ COST DASHBOARD     │  │
│  │ • Color-coded    │ │ • Reasoning chain│ │ • Latency, FP rate │  │
│  │   risk levels    │ │ • Geo map        │ │ • Cost/tx trend    │  │
│  │ • Click to drill │ │ • Evidence cards │ │ • Model routing %  │  │
│  │                  │ │ • Override btns  │ │ • Budget remaining │  │
│  └──────────────────┘ └──────────────────┘ └────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│               GOOGLE CLOUD AGENT BUILDER (ADK)                      │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │            FINSENTINEL ORCHESTRATOR (Gemini 3)                │  │
│  │                                                               │  │
│  │  ┌────────────────┐                                           │  │
│  │  │  COST ENGINE   │ ← Queries Dynatrace MCP for cost metrics  │  │
│  │  │  (Router +     │   Adjusts model selection + thresholds    │  │
│  │  │   Budget Ctrl) │                                           │  │
│  │  └───────┬────────┘                                           │  │
│  │          │                                                     │  │
│  │  ┌───────▼────────┐  ┌────────────────┐  ┌────────────────┐  │  │
│  │  │  INTAKE AGENT  │→ │ INVESTIGATOR   │→ │ DECISION AGENT │  │  │
│  │  │  (Gemini Flash │  │ AGENT          │  │ (risk score +  │  │  │
│  │  │   fast triage) │  │ (Gemini Pro    │  │  explanation   │  │  │
│  │  │  Cost: ~$0.001 │  │  deep dive)    │  │  + compliance) │  │  │
│  │  │  per tx        │  │  Cost: ~$0.05  │  │                │  │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘  │  │
│  │                                                               │  │
│  │  ┌───────────────────────────────────────────────────────┐    │  │
│  │  │              SHARED TOOL LAYER                         │    │  │
│  │  │  • get_customer_profile    • get_merchant_risk         │    │  │
│  │  │  • check_geolocation       • get_behavioral_baseline   │    │  │
│  │  │  • get_related_transactions • generate_explanation      │    │  │
│  │  └───────────────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ Every tool call + reasoning step
                            │ instrumented with OpenTelemetry
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 DYNATRACE (via MCP Server)                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ MCP Tools (verify exact names on Day 1 with list_tools):    │    │
│  │                                                             │    │
│  │ OBSERVABILITY:                                              │    │
│  │  • query_traces — agent reasoning chains for audit          │    │
│  │  • get_metrics  — latency, throughput, token usage          │    │
│  │  • get_logs     — decision logs for compliance              │    │
│  │  • query_entities — agent topology and dependencies         │    │
│  │                                                             │    │
│  │ COST AWARENESS (from CostGuard):                            │    │
│  │  • get_metrics  — finsentinel.cost_per_tx,                  │    │
│  │                   finsentinel.tokens_per_investigation,      │    │
│  │                   finsentinel.model_routing_ratio            │    │
│  │                                                             │    │
│  │ SELF-HEALING:                                               │    │
│  │  • create_alert — auto-create alerts on budget overruns,    │    │
│  │                   false positive spikes, latency breaches   │    │
│  │  • get_metrics  — self-check before each batch              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  Custom OTel Span Attributes:                                       │
│  • finsentinel.transaction_id   • finsentinel.risk_score            │
│  • finsentinel.agent_name       • finsentinel.decision              │
│  • finsentinel.fraud_category   • finsentinel.confidence            │
│  • finsentinel.reasoning_steps  • finsentinel.tool_calls_used       │
│  • finsentinel.cost_usd         • finsentinel.model_used            │
│  • finsentinel.tokens_prompt    • finsentinel.tokens_completion     │
│  • finsentinel.routing_tier     • finsentinel.override_status       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow (One Transaction)

```
1. Transaction arrives
     ↓
2. Cost Engine checks Dynatrace MCP: "What's my budget utilization? What's my false positive rate?"
     ↓
3. Cost Engine selects routing tier:
   • ECONOMY (Gemini Flash only) — budget tight or low-risk signals
   • STANDARD (Flash triage → Pro investigation) — normal operations
   • PREMIUM (Pro for all steps) — budget available + high-risk signals
     ↓
4. Intake Agent triages (<1s):
   • 5 heuristic checks: amount spike, geo-impossible, new merchant, velocity, dormant account
   • LOW risk (0-1 signals) → auto-approve (logged, traced, cost: ~$0.001)
   • MEDIUM+ → escalate to Investigator
     ↓
5. Investigator Agent (2-5s):
   • Multi-tool deep dive: customer profile, merchant risk, geolocation, behavioral baseline
   • Gemini 3 generates step-by-step reasoning chain
   • Each tool call + reasoning step = OTel span → Dynatrace
     ↓
6. Decision Agent:
   • Risk score (0-100) + natural language explanation + recommended action
   • Compliance-ready output with evidence list
     ↓
7. All spans flow to Dynatrace → MCP queries power dashboard + audit trail
8. Fraud analyst can override via dashboard → override logged and traced
```

---

## File Structure

```
DynatraceAgent/
├── README.md                          # Setup guide, screenshots, architecture
├── LICENSE                            # Apache 2.0
├── requirements.txt                   # Pinned dependencies
├── .env.example                       # DT_ENDPOINT, DT_API_TOKEN, GCP_PROJECT, GEMINI_API_KEY
├── .gitignore
├── Dockerfile                         # Cloud Run deployment
├── roadmap_dynatrace.md               # This file
│
├── app/
│   ├── __init__.py
│   ├── main.py                        # FastAPI entry point + WebSocket + static files
│   ├── config.py                      # Env vars, constants, budget thresholds
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── orchestrator.py            # ADK multi-agent orchestration loop
│   │   ├── intake_agent.py            # Fast triage: 5 heuristic signals → risk tier
│   │   ├── investigator_agent.py      # Deep investigation: multi-tool reasoning chain
│   │   └── decision_agent.py          # Risk score + explanation + recommended action
│   │
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── customer_profile.py        # get_customer_profile(customer_id)
│   │   ├── merchant_risk.py           # get_merchant_risk(merchant_id)
│   │   ├── geolocation.py             # check_geolocation(lat, lng, customer_id)
│   │   ├── behavioral_baseline.py     # get_behavioral_baseline(customer_id)
│   │   └── transaction_history.py     # get_related_transactions(customer_id, window)
│   │
│   ├── observability/
│   │   ├── __init__.py
│   │   ├── tracer.py                  # OTel decorator: wraps every Gemini call + tool call
│   │   ├── cost_tracker.py            # Tracks token usage + cost per span
│   │   └── self_monitor.py            # Dynatrace MCP queries: health, cost, accuracy
│   │
│   ├── cost_engine/
│   │   ├── __init__.py
│   │   ├── router.py                  # Model routing logic: Flash vs Pro based on metrics
│   │   └── budget_controller.py       # Budget thresholds, cost-per-tx limits, auto-adjust
│   │
│   └── data/
│       ├── __init__.py
│       ├── transaction_generator.py   # Synthetic transactions: 80% normal, 20% fraud patterns
│       └── sample_profiles.py         # Customer + merchant seed data
│
├── dashboard/                         # React UI (Vite)
│   ├── package.json                   # React + Tremor + shadcn/ui
│   ├── src/
│   │   ├── components/                # Tremor charts, shadcn UI components
│   │   ├── App.jsx                    # Main dashboard layout: 3-panel
│   │   └── hooks/useWebSocket.js      # WebSocket client for real-time feed
│   └── index.html
│
└── tests/
    ├── test_intake.py                 # Unit tests for triage logic
    ├── test_investigator.py           # Unit tests for investigation flow
    ├── test_cost_engine.py            # Unit tests for routing decisions
    └── test_e2e.py                    # End-to-end: transaction → decision → trace verification
```

---

## Phase 1 — Infrastructure + Instrumentation (Days 1–2)

### 1.1 Environment Setup
- [ ] GCP project: enable Vertex AI API, Agent Builder API
- [ ] Dynatrace tenant: free trial signup, get OTLP endpoint + API token
- [ ] Install Dynatrace MCP server, verify connection
- [ ] **CRITICAL:** Run `list_tools` on Dynatrace MCP server — map actual tool names to planned usage. Adapt architecture if tool names differ from assumptions (query_traces, get_metrics, get_logs, query_entities, create_alert).
- [ ] Python env: `opentelemetry-sdk`, `opentelemetry-exporter-otlp`, `google-genai`, `google-adk`, `fastapi`, `uvicorn`, `websockets`

### 1.2 OpenTelemetry Wrapper (`app/observability/tracer.py`)
Build a Python decorator that wraps every Gemini API call and tool invocation:

**Required span attributes:**
- `gen_ai.prompt_tokens`, `gen_ai.completion_tokens`, `gen_ai.model`
- `finsentinel.transaction_id` — links all spans for one investigation
- `finsentinel.agent_name` — intake / investigator / decision
- `finsentinel.tool_name` — which tool was called
- `finsentinel.risk_score` — current risk assessment
- `finsentinel.decision` — approve / flag / block
- `finsentinel.reasoning_step` — step number in chain
- `finsentinel.cost_usd` — cost of this specific call
- `finsentinel.model_used` — gemini-flash / gemini-pro
- `finsentinel.routing_tier` — economy / standard / premium

### 1.3 Cost Tracking (`app/observability/cost_tracker.py`)
- Track tokens (prompt + completion) per Gemini call
- Calculate USD cost per call using known pricing
- Emit as OTel metric: `finsentinel.cost_per_tx`
- Aggregate: `finsentinel.total_cost_last_hour`, `finsentinel.avg_cost_per_investigation`

### 1.4 Synthetic Transaction Generator (`app/data/transaction_generator.py`)
Produces realistic transaction streams:
- **Normal (80%):** typical amounts ($5–$200), known merchants (grocery, gas, coffee), home city, normal hours
- **Fraud patterns (20%):**
  - Velocity spike: 5+ transactions in 10 minutes
  - Geo-impossible: Miami → Seattle in 30 minutes
  - Category anomaly: first-ever electronics purchase for $2,800
  - Dormant reactivation: 90+ days inactive → sudden high-value
  - Micro-testing: $0.01 charge followed by $5,000

### 1.5 Dynatrace Verification
- [ ] Verify OTel spans appear in Dynatrace
- [ ] Test MCP round-trip: emit span → query via MCP → get result
- [ ] Confirm cost metrics are queryable: `finsentinel.cost_per_tx`

**Exit Criteria:** Spans flowing to Dynatrace, MCP queries returning data, cost metrics visible, synthetic transactions generating.

---

## Phase 2 — Multi-Agent Pipeline + Cost Engine (Days 3–5)

### 2.1 Intake Agent (`app/agents/intake_agent.py`)
**Role:** Sub-second triage. Runs on Gemini Flash (cheapest model).

**Input:** Transaction (amount, merchant_id, merchant_category, location, timestamp, customer_id)

**5 Heuristic Signals:**
1. Amount > 3× customer's 30-day average
2. Location > 500km from last transaction within 2 hours (geo-impossible)
3. Merchant category never used by this customer
4. Transaction velocity > 3× normal rate in last hour
5. Account dormant > 90 days then sudden activity

**Output:**
- Risk tier: LOW (0–1 signals) / MEDIUM (2) / HIGH (3) / CRITICAL (4–5)
- LOW → auto-approve (logged). MEDIUM+ → escalate.
- Cost: ~$0.001 per transaction

### 2.2 Investigator Agent (`app/agents/investigator_agent.py`)
**Role:** Multi-step deep investigation. Runs on Gemini Pro (powerful reasoning).

**Available Tools:**
1. `get_customer_profile(customer_id)` → account age, avg balance, tx frequency, typical merchants
2. `get_merchant_risk(merchant_id)` → risk score, chargeback rate, fraud history
3. `check_geolocation(lat, lng, customer_id)` → distance from home, travel feasibility
4. `get_behavioral_baseline(customer_id)` → spending patterns, time-of-day habits
5. `get_related_transactions(customer_id, window)` → recent tx for context

**Gemini generates a multi-step reasoning chain:**
```
Step 1: Customer avg spend = $45. This transaction = $2,800 at electronics store.
Step 2: Merchant chargeback rate = 2.1% (above 1.5% threshold).
Step 3: Geolocation: tx in Miami, last tx 30 min ago in Seattle — physically impossible.
Step 4: Behavioral baseline: customer never purchases electronics, typically grocery + gas.
Step 5: Related tx: 3 high-value purchases in last hour, all different cities.
→ Pattern: stolen card used across multiple locations simultaneously.
```

### 2.3 Decision Agent (`app/agents/decision_agent.py`)
**Role:** Synthesize investigation → actionable, explainable decision.

**Output:**
```json
{
  "transaction_id": "txn_abc123",
  "risk_score": 94,
  "decision": "BLOCK",
  "fraud_category": "card_not_present_multi_location",
  "confidence": 0.91,
  "explanation": "Transaction blocked. Card used simultaneously in 3 cities within 1 hour. Merchant has elevated chargeback rate. Spending pattern deviates from 12-month baseline.",
  "recommended_actions": ["Block card", "Notify customer", "Flag related transactions"],
  "evidence": ["geo_impossible", "velocity_spike", "merchant_risk_elevated", "category_anomaly"],
  "cost_usd": 0.047,
  "model_used": "gemini-pro",
  "routing_tier": "standard"
}
```

### 2.4 Cost Engine (`app/cost_engine/`)

**Router Logic (`router.py`):**
```
Before each batch (every N transactions):
  1. Query Dynatrace MCP: "What's my avg cost_per_tx in last 100 tx?"
  2. Query Dynatrace MCP: "What's my false_positive_rate in last hour?"
  3. Query Dynatrace MCP: "What's my budget utilization?"

Routing Decision Matrix:
  ┌─────────────────────────┬──────────────────────────────────┐
  │ Condition               │ Action                           │
  ├─────────────────────────┼──────────────────────────────────┤
  │ Budget > 80% utilized   │ ECONOMY: Flash only, raise       │
  │                         │ escalation threshold to 4 signals│
  ├─────────────────────────┼──────────────────────────────────┤
  │ Budget 40-80% utilized  │ STANDARD: Flash triage → Pro     │
  │ AND FP rate < 15%       │ investigation. Normal thresholds.│
  ├─────────────────────────┼──────────────────────────────────┤
  │ Budget < 40% utilized   │ PREMIUM: Pro for all steps.      │
  │ OR FP rate > 15%        │ Lower thresholds to catch more.  │
  └─────────────────────────┴──────────────────────────────────┘
```

**Budget Controller (`budget_controller.py`):**
- Configurable hourly/daily budget cap (e.g., $50/hour)
- Tracks cumulative spend via Dynatrace metrics
- Emits budget utilization as OTel metric
- When budget exceeded: switch to ECONOMY mode, alert via Dynatrace MCP

### 2.5 ADK Integration
- Define all 3 agents as ADK agents with proper tool schemas
- Orchestrator uses ADK's sequential multi-agent pattern: Intake → (conditional) → Investigator → Decision
- Cost Engine wraps the orchestrator, selecting model tier before each run

**Exit Criteria:** Full pipeline working: transaction in → triage → investigation → decision out, cost tracked per tx, all traced in Dynatrace.

---

## Phase 3 — Dynatrace Deep Integration + Dashboard (Days 6–7)

**This phase is what separates 1st place from everyone else.**

### 3.1 Self-Monitoring via Dynatrace MCP (`app/observability/self_monitor.py`)

The agent doesn't just send data to Dynatrace — it queries Dynatrace about itself:

**Before each batch, the agent asks Dynatrace MCP:**
- "What is my average investigation latency in the last hour?" → If > 10s, switch to lighter investigation prompts
- "What is my false positive rate?" → If > 15%, lower escalation thresholds in Cost Engine
- "Are any of my tool calls failing?" → If error rate > 5%, skip failing tool and use fallback reasoning
- "What is my cost-per-fraud-caught?" → Primary efficiency metric, displayed on dashboard

**Self-Healing Actions (based on MCP responses):**

| Dynatrace Reports | Agent Self-Heals |
|---|---|
| Latency > 10s avg | Reduce investigation depth (skip behavioral baseline tool) |
| False positive rate > 15% | Lower escalation threshold from 2 signals to 3 |
| Tool error rate > 5% | Disable failing tool, log degradation, continue with remaining tools |
| Cost/tx > budget threshold | Switch to ECONOMY routing tier |
| Cost/fraud-caught rising | Tighten intake filters to reduce unnecessary investigations |

### 3.2 Compliance Audit Trail (via MCP)
- `query_traces` with `finsentinel.transaction_id` → full reasoning chain for any transaction
- `get_logs` filtered by `finsentinel.decision=BLOCK` → all blocked transactions with explanations
- `query_entities` → complete agent topology: which agents, tools, and models
- All queryable on-demand from the dashboard

### 3.3 Automated Alert Setup (via MCP)
The agent creates its own Dynatrace alerts:
- Alert if false positive rate > 15%
- Alert if investigation latency > 10s average
- Alert if tool call error rate > 5%
- Alert if hourly cost exceeds budget threshold
- Alert if cost-per-fraud-caught exceeds acceptable ratio

### 3.4 Fraud Operations Dashboard (`dashboard/`)

**Dark theme, glassmorphism panels, smooth animations, WebSocket real-time updates.**

**Left Panel — Live Fraud Feed:**
- Real-time stream of transactions being processed
- Color-coded: 🟢 approved, 🟡 flagged, 🔴 blocked
- Each row shows: tx_id, amount, merchant, risk_score, decision, cost, model_used
- Click any row → drill into Investigation Detail

**Center Panel — Investigation Detail:**
- Step-by-step reasoning chain with collapsible evidence cards
- Mini-map showing geo-anomalies (customer home vs. transaction location)
- Customer behavior timeline (last 30 days of spending)
- Override buttons: [Approve] [Escalate] [Block] — actions logged and traced

**Right Panel — Agent Health + Cost Dashboard:**
- **Health Metrics (from Dynatrace MCP):**
  - Investigations/minute, avg latency, false positive rate
  - Agent status: all sub-agents healthy / degraded
  - Recent Dynatrace alerts
- **Cost Metrics (from CostGuard integration):**
  - Cost per transaction (real-time trend chart)
  - Model routing breakdown: % Flash vs % Pro
  - Budget utilization gauge (0–100%)
  - Cost per fraud caught (efficiency metric)
  - Current routing tier: ECONOMY / STANDARD / PREMIUM
- Token usage trend (prompt + completion over time)

**Exit Criteria:** Dashboard live with real-time data, MCP self-monitoring loop functional, cost routing visible on dashboard, compliance audit trail queryable, self-healing demonstrated.

---

## Phase 4 — Polish, Demo & Submission (Days 8–10)

### 4.1 Demo Script (3 minutes)

**0:00–0:30 — The Hook**
"Financial fraud costs $485 billion a year. AI agents can fight it — but enterprises won't deploy them because they can't see inside the AI and they can't control the costs. Meet FinSentinel."

**0:30–1:15 — Live Fraud Detection**
Show dashboard. Trigger 3 synthetic transactions:
1. Normal grocery purchase → auto-approved in <1s by Intake (green flash, cost: $0.001)
2. Suspicious velocity spike → Investigator kicks off → reasoning chain appears step-by-step → FLAGGED (cost: $0.04)
3. Geo-impossible purchase → critical → full investigation with map → BLOCKED with explanation (cost: $0.05)

**1:15–1:45 — The Cost-Aware Brain**
"Most AI agents would have used the expensive model for all three. FinSentinel routed transaction 1 through Gemini Flash at a tenth of a cent. Only the suspicious ones triggered the full investigation. Look at the cost dashboard — our cost per fraud caught is $0.12."
- Show routing tier indicator switching between ECONOMY/STANDARD
- Show cost trend chart

**1:45–2:15 — Dynatrace as the Nervous System**
"Here's the real innovation. FinSentinel doesn't just send logs to Dynatrace — it reads them back."
- Show self-monitoring query: agent asking Dynatrace "What's my false positive rate?"
- Show self-healing: when FP rate spiked, agent auto-adjusted its thresholds
- Show Dynatrace distributed trace of the blocked transaction: 3 agents, 5 tool calls, complete reasoning chain

**2:15–2:45 — Compliance & Auto-Alerts**
"For regulated industries, this is critical."
- Pull compliance audit trail for the blocked transaction via MCP
- Show: agent auto-created Dynatrace alerts for performance degradation AND budget overruns
- "A regulator can query any transaction and see exactly why it was blocked, what model was used, and what it cost."

**2:45–3:00 — Closing**
"FinSentinel: the first AI fraud agent that's fully observable, cost-controlled, and self-healing. Built with Gemini 3, orchestrated by Google Cloud Agent Builder, and powered by Dynatrace. Because in finance, you can't deploy what you can't observe, and you can't scale what you can't afford."

### 4.2 Final Polish Checklist
- [ ] Run 100 synthetic transactions end-to-end, verify all traced with cost data
- [ ] Test cost routing: simulate budget pressure → verify ECONOMY switch
- [ ] Test self-healing: inject high FP rate → verify threshold adjustment
- [ ] Dashboard responsive on mobile viewport
- [ ] Screenshot Dynatrace traces + dashboard for README
- [ ] Record 3-min demo video (OBS Studio)

### 4.3 Submission Checklist
- [ ] Hosted project URL (Cloud Run deployment)
- [ ] Public GitHub repo with Apache 2.0 license (visible at top of repo)
- [ ] README.md: setup instructions, Dynatrace config, architecture diagram, screenshots
- [ ] ~3-minute demo video (YouTube unlisted or Loom)
- [ ] Devpost form: select Dynatrace track
- [ ] `requirements.txt` with pinned versions
- [ ] `.env.example` (no real credentials)

---

## Tech Stack

| Layer | Technology |
|---|---|
| LLM | Gemini 3 (Flash for triage, Pro for investigation) via Vertex AI |
| Agent Framework | Google Cloud Agent Builder + ADK |
| Observability | Dynatrace (OTLP ingest) |
| Partner Integration | Dynatrace MCP Server (trace queries, metrics, alerts, logs, entities) |
| Instrumentation | OpenTelemetry Python SDK |
| Cost Tracking | Custom OTel metrics + Dynatrace MCP queries |
| Backend | Python 3.11+ / FastAPI / WebSocket (Routing + ML) |
| Frontend | Vite / React / TailwindCSS / shadcn/ui / Tremor (Premium dashboard) |
| Hosting | Google Cloud Run |
| Test Data | Synthetic transaction generator |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Dynatrace MCP tool names differ from assumptions | High | Medium | Day 1 task: run `list_tools`, map actual names, adapt all MCP calls |
| `create_alert` not available via MCP | Medium | Low | Fall back to dashboard-only alerts + manual Dynatrace UI setup |
| Gemini Flash too weak for triage accuracy | Low | Medium | Pre-test; if accuracy < 90%, use structured prompts with few-shot examples |
| Agent Builder orchestration latency > 5s | Medium | Medium | Pre-cache tool results, use streaming responses, show progress incrementally |
| Budget controller logic too simplistic | Low | Low | Keep thresholds configurable; judges care about the concept, not production-grade |
| Dashboard feels like a toy | Low | High | Invest Day 8 purely on UI polish: dark theme, smooth CSS animations, typography |

---

## Scope Boundaries

**IN SCOPE:**
- 3-agent fraud pipeline: Intake (Flash) → Investigator (Pro) → Decision
- Cost-aware model routing with dynamic threshold adjustment via Dynatrace metrics
- Self-monitoring: agent queries own health + cost via Dynatrace MCP
- Self-healing: auto-adjusts behavior based on MCP-reported metrics
- Real-time web dashboard with fraud feed, reasoning viewer, cost panel, agent health
- Compliance audit trail queryable via Dynatrace MCP
- Auto-alert creation via Dynatrace MCP
- OTel instrumentation of every decision, tool call, and cost event
- Synthetic but realistic transaction data

**OUT OF SCOPE (acknowledged transparently):**
- Real bank integrations (requires PCI compliance — impossible in hackathon)
- ML model training (Gemini 3's reasoning is used directly, no custom model)
- Historical fraud data analysis (synthetic data demonstrates the capability)
- Multi-currency / international regulations (scoped to USD)
- Production hardening: auth, rate limiting, PII encryption (acknowledged as needed)

---

## What Makes This 1st Place

| Factor | Other Projects | FinSentinel |
|---|---|---|
| **Problem domain** | Generic / developer-facing | $485B fraud problem + "Concept Drift" in regulated finance |
| **Agent complexity** | Single agent, basic tools | 3-agent pipeline with conditional routing + cost-aware model selection |
| **Dynatrace depth** | "We send traces" | Agent queries its OWN health, creates its own alerts, controls its costs, provides compliance audit trail — all via MCP |
| **Novel twist** | Standard observability | Cost-aware self-tuning: agent optimizes its own operating costs based on Dynatrace metrics |
| **User experience** | Terminal or basic UI | Stunning React dashboard (shadcn/ui + Tremor) with live fraud feed, reasoning chains, and cost analytics |
| **Demo impact** | "Here are our metrics" | Live fraud detection + reasoning chain + cost savings + self-healing, all on screen |
| **Narrative** | Technical description | "Solving Concept Drift and Cost with Self-Healing, Observable AI" — a story judges remember |

---

## Daily Execution Plan

| Day | Focus | Deliverable |
|---|---|---|
| **Day 1** | GCP + Dynatrace setup, MCP `list_tools`, OTel wrapper, cost tracker | Spans + cost metrics flowing to Dynatrace |
| **Day 2** | Synthetic tx generator, Agent Builder scaffold, ADK agent registration | Transactions generating, agents registered |
| **Day 3** | Intake Agent (Flash) + Investigator Agent (Pro) logic | Triage + investigation working end-to-end |
| **Day 4** | Decision Agent + Cost Engine (router + budget controller) | Full pipeline: tx → decision, cost-aware routing active |
| **Day 5** | End-to-end integration, MCP self-monitoring queries, bug fixes | 50 tx processed correctly, self-monitoring working |
| **Day 6** | Dynatrace deep integration: self-healing loop, compliance audit, auto-alerts | Agent querying itself, adjusting behavior, creating alerts |
| **Day 7** | Dashboard build: 3-panel layout, WebSocket, dark theme, charts | Live dashboard showing fraud feed + cost + health |
| **Day 8** | Dashboard polish: animations, geo map, responsive, typography | Beautiful, demo-ready UI |
| **Day 9** | Demo recording, README with screenshots, submission prep | Video recorded, repo documented |
| **Day 10** | Buffer: fix broken things, final test run (100 tx), submit on Devpost | Submitted |
