<div align="center">

# 🛡️ FinSentinel

### Agentic Real-Time Fraud Operations Platform

**Powered by Gemini 2.5 Flash · Google Vertex AI · Dynatrace · Cloud Run**

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Cloud_Run-4285F4?style=for-the-badge)](https://finsentinel-466382469557.us-central1.run.app)
[![Video Demo](https://img.shields.io/badge/🎥_Watch_Video-YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/Pl-Tdk4Z4JI)
[![GitHub](https://img.shields.io/badge/GitHub-Source_Code-181717?style=for-the-badge&logo=github)](https://github.com/Sumit-sudarshan/DynatraceAgent)
[![Vertex AI](https://img.shields.io/badge/Gemini_2.5_Flash-Vertex_AI-FF6F00?style=for-the-badge&logo=google-cloud)](https://cloud.google.com/vertex-ai)
[![Dynatrace](https://img.shields.io/badge/Dynatrace-Observability-1496FF?style=for-the-badge)](https://www.dynatrace.com)

> *A production-grade, multi-agent AI system that autonomously detects, investigates, and remediates financial fraud in real-time — governed by cost-aware adaptive routing and enterprise-grade observability.*

</div>

---

## 🎯 The Problem

Financial fraud costs the global economy **$485 billion annually**. Traditional rule-based systems miss novel attack patterns. Human analysts are overwhelmed. Legacy ML models can't explain their reasoning to compliance teams.

**FinSentinel solves this with Agentic AI** — a coordinated pipeline of specialized Gemini agents that autonomously think, reason, and act on every transaction in real-time.

---

## ✨ What Makes This Different

| Feature | Traditional Systems | FinSentinel |
|---|---|---|
| Detection | Static rules | Gemini 2.5 Flash reasoning |
| Explainability | Black box | LLM-reported feature attributions |
| Cost control | None | Real-time adaptive model routing |
| Self-healing | Manual ops | Dynatrace MCP automated remediation |
| Token costs | Estimated | Real API usage metadata |
| Settings | Config files | Live backend API, no restart needed |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Incoming Transaction                          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Cost-Aware Router  │  ← BudgetController
                    │  (Budget: $5 cap)   │    tracks real spend
                    └──────┬──────┬───────┘
                           │      │
              Budget OK    │      │  Budget > 80%
                           │      │
         ┌─────────────────▼─┐  ┌─▼──────────────────┐
         │   FULL PIPELINE   │  │   ECONOMY MODE     │
         │                   │  │                    │
         │ ┌───────────────┐ │  │ ┌────────────────┐ │
         │ │ Intake Agent  │ │  │ │  Flash Only    │ │
         │ │ Gemini 2.5    │ │  │ │  Heuristics    │ │
         │ │ Flash (Triage)│ │  │ └────────────────┘ │
         │ └───────┬───────┘ │  └────────────────────┘
         │         │         │
         │ ┌───────▼───────┐ │
         │ │  Investigator │ │
         │ │  Agent        │ │
         │ │  (Forensics)  │ │
         │ └───────┬───────┘ │
         │         │         │
         │ ┌───────▼───────┐ │
         │ │ Decision Agent│ │
         │ │ APPROVE/FLAG/ │ │
         │ │ BLOCK +       │ │
         │ │ Feature Weights│ │
         │ └───────┬───────┘ │
         └─────────┼─────────┘
                   │
       ┌───────────▼───────────┐
       │   WebSocket Broadcast │
       └───────────┬───────────┘
                   │
    ┌──────────────▼──────────────┐
    │   Real-Time Dashboard (SPA) │
    │   • Live transaction stream │
    │   • LLM Feature Attribution │
    │   • Budget burn tracker     │
    │   • Forensic detail view    │
    └─────────────────────────────┘
                   │
                   │ OpenTelemetry
                   ▼
         ┌─────────────────┐
         │   Dynatrace     │◄── Self-Healing Monitor
         │   Observability │    Auto-remediates on
         └─────────────────┘    detected anomalies
```

---

## 🤖 The Three-Agent Pipeline

### 1. 🔍 Intake Agent — Rapid Triage
- Runs on every transaction using **Gemini 2.5 Flash**
- Performs first-pass statistical analysis in milliseconds
- Outputs: `risk_tier` (LOW/MEDIUM/HIGH), `escalate` flag, `signals_detected` count
- Low-risk transactions are approved immediately without burning budget on deeper analysis

### 2. 🔬 Investigator Agent — Deep Forensics
- Only activated for MEDIUM/HIGH risk transactions (cost-efficient by design)
- Uses **Gemini 2.5 Flash** for contextual reasoning across:
  - Transaction velocity patterns
  - Geospatial impossibility detection (e.g., New York → Moscow in 2 minutes)
  - Device fingerprint anomalies
  - Historical customer behaviour baseline
- Builds a `reasoning_chain` array of evidence nodes

### 3. ⚖️ Decision Agent — Final Ruling
- Synthesizes triage + investigation into a final **APPROVE / FLAG / BLOCK** decision
- Returns **LLM Feature Attributions** — self-reported impact weights (0.0–1.0) per feature, rendered in the dashboard as real-time bar charts
- Recommended remediation actions (block card, SMS verification, manual review)

---

## 💰 Cost-Aware Adaptive Routing (FinOps)

This is where FinSentinel becomes enterprise-grade. The system is built to **never exceed budget** while maximizing detection accuracy.

```
Budget Utilization    Routing Tier         Behaviour
────────────────────────────────────────────────────────
0% – 40%             🟢 Premium           Full 3-agent pipeline
40% – 80%            🟡 Standard          Flash triage → Pro investigation
80% – 100%           🔴 Economy           Flash only + ML heuristics
```

**Real token tracking**: Cost is calculated from `response.usage_metadata.prompt_token_count` and `candidates_token_count` — actual Vertex AI billing data, not estimates.

**Live configuration**: The routing thresholds and budget cap are configurable via `POST /api/settings` without restarting the service.

---

## 🔭 Dynatrace Observability & Self-Healing

FinSentinel is fully instrumented with **OpenTelemetry** and streams live telemetry to Dynatrace:

- **Custom Metrics**: `finsentinel.budget_utilization_pct`, `finsentinel.budget_spend_usd`
- **Distributed Traces**: Every agent call (intake → investigator → decision) is a traced span
- **Self-Healing Loop**: A background monitor polls the Dynatrace MCP server for open problems and automatically falls back to secondary infrastructure if anomalies are detected
- **Dynatrace MCP Integration**: The agents query Dynatrace as a tool, using the Model Context Protocol to fetch real-time platform health data

---

## 🚀 Live Deployment

| Resource | URL |
|---|---|
| **Live Application** | https://finsentinel-466382469557.us-central1.run.app |
| **Health Check API** | https://finsentinel-466382469557.us-central1.run.app/health |
| **Stats API** | https://finsentinel-466382469557.us-central1.run.app/api/stats |
| **Transactions API** | https://finsentinel-466382469557.us-central1.run.app/api/transactions |
| **GitHub Repository** | https://github.com/Sumit-sudarshan/DynatraceAgent |

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **AI Model** | Google Gemini 2.5 Flash (Vertex AI) |
| **Backend** | Python 3.11, FastAPI, WebSockets |
| **Frontend** | HTML5, Vanilla JS, CSS3 |
| **Observability** | Dynatrace, OpenTelemetry SDK |
| **Infrastructure** | Google Cloud Run, Artifact Registry |
| **CI/CD** | Google Cloud Build |

---

## ⚙️ Local Development

### Prerequisites
- Python 3.11+
- Google Cloud SDK (`gcloud`)
- Dynatrace environment (optional, for observability)

### Setup

```bash
# 1. Clone
git clone https://github.com/Sumit-sudarshan/DynatraceAgent.git
cd DynatraceAgent

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your credentials (see below)

# 4. Run
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 5. Open dashboard
open http://localhost:8000
```

### Environment Variables

```env
# Core
MOCK_MODE=false
GCP_PROJECT_ID=your-gcp-project-id
USE_VERTEX_AI=true
ENVIRONMENT=production

# Models (Vertex AI)
MODEL_FLASH=gemini-2.5-flash
MODEL_PRO=gemini-2.5-flash

# Budget
BUDGET_USD_PER_HOUR=5.0

# Dynatrace (optional)
DT_ENDPOINT=https://your-env.live.dynatrace.com
DT_API_TOKEN=your_dt_api_token
DT_ENVIRONMENT=https://your-env.apps.dynatrace.com
DT_PLATFORM_TOKEN=your_dt_platform_token
```

### Cloud Run Deployment

```bash
# Build and push container
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/YOUR_PROJECT/finsentinel-repo/finsentinel:latest .

# Deploy to Cloud Run
gcloud run deploy finsentinel \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT/finsentinel-repo/finsentinel:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health + budget utilization |
| `GET` | `/api/stats` | Aggregate fraud statistics |
| `GET` | `/api/transactions` | Last 50 processed transactions |
| `POST` | `/api/settings` | Live update budget/thresholds |
| `WS` | `/ws/transactions` | Real-time transaction stream |

### Settings API Example
```json
POST /api/settings
{
  "budget_daily": 10.0,
  "tier_amber": 60.0,
  "tier_red": 85.0
}
```

---

## 🏆 Hackathon Highlights

This project was built for the **Google Rapid Cloud Agent Hackathon**, demonstrating:

1. **Genuine Agentic AI** — Three specialized Gemini agents that autonomously coordinate, not a single prompted model
2. **Real Vertex AI Integration** — Live calls to Gemini 2.5 Flash with actual billing-grade token tracking via `response.usage_metadata`
3. **Enterprise FinOps** — Budget-aware model routing that degrades gracefully, demonstrating production readiness
4. **Honest Explainability** — LLM self-reports its feature weights; no fabricated SHAP math
5. **Dynatrace MCP** — Agents use Dynatrace as an external tool via Model Context Protocol for real-time platform intelligence
6. **Live Settings Backend** — Configuration changes take effect instantly via `POST /api/settings` without redeploy

---

<div align="center">

**Built with 🔥 for the Google Rapid Cloud Agent Hackathon**

*FinSentinel — Where Agentic AI meets Enterprise Fraud Operations*

</div>