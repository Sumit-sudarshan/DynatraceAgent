# FinSentinel — Project Remaining Tasks

This file tracks the remaining tasks to finalize **FinSentinel** for production deployment and hackathon evaluation.

---

## 📋 Task Checklist

### 1. Backend-to-Frontend Integration (UI Connections)
- [x] **Address Field Name Mappings**: Align remaining mock property references on the frontend (e.g., `tx.merchantCategory` in `transactions.js`/`review.js`) with the updated 8-column schema (`merchant_name`, `device_fingerprint`, `card_network`).
- [x] **Dynamic Secure WebSocket Connection**: Update WebSocket initializers in `dashboard.js`, `transactions.js`, and `review.js` to dynamically choose `wss://` when loaded over `https://` (essential for secure GCP Cloud Run hosting).
- [x] **Verify REST API Integration**: Confirm `/api/transactions`, `/api/stats`, and `/health` endpoints load and render correctly across all HTML views.

### 2. Dual-Mode Execution Framework (Mock vs. Real Mode)
- [x] **Perfect Mock Mode (`MOCK_MODE=true`)**:
  - Run the entire multi-agent loop (Intake, Investigator, Decision) locally with zero external API credentials.
  - Maintain synthetic latency and telemetry feedback to mirror a real cloud runtime.
- [x] **Stabilize Real Mode (`MOCK_MODE=false`)**:
  - Ensure the application reads environment variables from `.env` seamlessly.
  - Verify initialization of Google GenAI SDK using `GEMINI_API_KEY` or Vertex AI credentials.
  - Verify real OpenTelemetry (OTel) exports trace spans to the Dynatrace endpoint (`DT_ENDPOINT`).
  - Verify the Dynatrace MCP Server subprocess initializes and executes real DQL metrics queries.

### 3. High-Fidelity Simulation System (No Keys Demo)
- [x] **Simulate Live Stream**: Process the first 100 entries of `train_transaction.csv` using the 8 specified columns to keep the simulation visually authentic.
- [x] **Demonstrate Self-Healing**: Refine the artificial false positive rate spike (occurring between transaction #10 and #20) to trigger the self-healing alert and show routing tier escalation in action on the dashboard.

### 4. Google Cloud Platform (GCP) Deployment
- [x] **Prepare Container Configuration**: Update the project `Dockerfile` to verify it installs Python dependencies, Node.js (needed for running MCP via `npx`), and mounts necessary environments.
- [x] **Cloud Run Deployment**:
  - Push the Docker image to Google Artifact Registry.
  - Deploy to Google Cloud Run with appropriate environment variables and scaling constraints.
- [x] **IAM Role Mapping**: Assign `Vertex AI User` roles to the Cloud Run service account so it has GCP-native access to Gemini when `USE_VERTEX_AI=true`.

### 5. Judge's Evaluation Documentation
- [ ] **Write README.md**: Create a step-by-step walkthrough detailing:
  - System architecture with Mermaid diagrams.
  - Quickstart guide to launch in Mock Mode.
  - Production guide to switch to Real Mode (creating a `.env` file, adding Gemini/Vertex API keys, and setting up Dynatrace tokens).
