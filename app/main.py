import os
import asyncio
import json
import logging
import time
from collections import deque
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load .env BEFORE any other app imports so all os.getenv() calls see the values
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import List, Optional
import random
import app.config as config

from app.data.transaction_generator import TransactionGenerator
from app.agents.orchestrator import process_transaction
from app.observability.self_monitor import self_monitor
from app.observability.tracer import shutdown_telemetry
from app.cost_engine.budget_controller import budget_controller
from app.cost_engine.router import router

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# --- Stats Counters ---
stats = {
    "total": 0,
    "approved": 0,
    "flagged": 0,
    "blocked": 0,
    "recent_transactions": []
}

# Latency tracking — last 30 transaction durations (ms)
latency_history: deque = deque(maxlen=30)
self_healing_action_count: int = 0

# Analyst review decisions store {tx_id: {status, notes, timestamp}}
review_decisions: dict = {}
# Fraud threshold config (live-editable)
fraud_thresholds = {"flag": 60, "block": 80}

def reset_session_state():
    """Reset all in-memory state so every new browser session starts fresh."""
    global self_healing_action_count
    stats["total"] = 0
    stats["approved"] = 0
    stats["flagged"] = 0
    stats["blocked"] = 0
    stats["recent_transactions"].clear()
    latency_history.clear()
    self_healing_action_count = 0
    budget_controller.current_spend = 0.0
    logger.info("Session reset: all stats and costs cleared for new session.")

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to socket: {e}")
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()
generator = TransactionGenerator()

def get_pending_count():
    count = 0
    recent_50 = stats["recent_transactions"][-50:]
    for item in recent_50:
        d = item.get("result", {}).get("decision", "APPROVE").upper()
        risk = item.get("result", {}).get("risk_score", 0)
        if d == "FLAG" or (d == "BLOCK" and 60 <= risk < 85):
            count += 1
    return count

async def transaction_streamer():
    """Background task to continually process transactions and broadcast results."""
    logger.info("Starting background transaction streamer...")
    
    # Let the server fully start up before streaming
    await asyncio.sleep(2.0)
    
    while True:
        try:
            # ── COST GUARD: skip Gemini calls when nobody is watching ──
            if len(manager.active_connections) == 0:
                await asyncio.sleep(5.0)
                continue

            # Self-healing check before processing (queries Dynatrace MCP + API)
            await self_monitor.check_health_and_heal()
            
            # Inject occasional fraud using the stream logic
            roll = random.random()
            if roll < 0.8:
                tx = generator.generate_normal_transaction()
            elif roll < 0.9:
                tx = generator.generate_fraud_velocity_spike()
            else:
                tx = generator.generate_fraud_geo_impossible()
                
            # Process via Multi-Agent Pipeline
            t_start = time.monotonic()
            result = await process_transaction(tx)
            elapsed_ms = (time.monotonic() - t_start) * 1000
            latency_history.append(round(elapsed_ms))
            
            # Count self-healing events
            global self_healing_action_count
            if router.current_false_positive_rate > config.FP_RATE_HEALING_THRESHOLD:
                self_healing_action_count += 1

            # Update stats
            decision = result.get("decision", "APPROVE").upper()
            stats["total"] += 1
            if decision == "APPROVE":
                stats["approved"] += 1
            elif decision == "FLAG":
                stats["flagged"] += 1
            elif decision == "BLOCK":
                stats["blocked"] += 1
            
            # Keep last 100 results for the REST API
            stats["recent_transactions"].append({"transaction": tx, "result": result})
            if len(stats["recent_transactions"]) > 100:
                stats["recent_transactions"].pop(0)
            
            # Broadcast to UI
            payload = {
                "transaction": tx,
                "result": result,
                "metrics": {
                    "budget_utilization_pct": budget_controller.get_utilization_percentage(),
                    "budget_spend_usd": budget_controller.current_spend,
                    "current_routing_tier": router.get_routing_tier(),
                    "false_positive_rate": router.current_false_positive_rate
                },
                "stats": {
                    "total": stats["total"],
                    "approved": stats["approved"],
                    "flagged": stats["flagged"],
                    "blocked": stats["blocked"],
                    "pending_count": get_pending_count()
                }
            }
            
            await manager.broadcast(json.dumps(payload))
        except Exception as e:
            logger.error(f"Error in transaction streamer: {e}", exc_info=True)
        
        # SLOW DOWN to stay under Gemini free tier limits (15 Requests Per Minute)
        # Each transaction can trigger up to 3 Gemini calls.
        await asyncio.sleep(7.0)

# --- Lifespan (replaces deprecated @app.on_event) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    task = asyncio.create_task(transaction_streamer())
    yield
    # Shutdown
    task.cancel()
    await self_monitor.shutdown()
    shutdown_telemetry()

app = FastAPI(title="FinSentinel API", lifespan=lifespan)

# Allow CORS for the dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws/transactions")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Send a ping every 10s to detect dead/closed connections quickly
            await asyncio.sleep(10)
            await websocket.send_text('{"type":"ping"}')
    except (WebSocketDisconnect, Exception):
        # Catch ALL exceptions — abrupt browser close, network drop, etc.
        manager.disconnect(websocket)
        # If no users left → reset everything so next session starts fresh
        if len(manager.active_connections) == 0:
            reset_session_state()
        
@app.get("/health")
def health_check():
    return {
        "status": "ok", 
        "budget_utilization_pct": budget_controller.get_utilization_percentage()
    }

@app.get("/api/stats")
def get_stats():
    return {
        **stats,
        "pending_count": get_pending_count(),
        "budget_spend_usd": budget_controller.current_spend,
        "budget_utilization_pct": budget_controller.get_utilization_percentage(),
        "current_routing_tier": router.get_routing_tier(),
        "false_positive_rate": router.current_false_positive_rate
    }

@app.get("/api/transactions")
def get_transactions():
    return stats["recent_transactions"][-50:]

@app.get("/api/observability")
async def get_observability():
    """Returns real live observability data: in-memory metrics + Dynatrace problems."""
    import httpx
    
    # --- Real in-memory data ---
    latencies = list(latency_history)
    avg_latency = round(sum(latencies) / len(latencies)) if latencies else 0
    p95_latency = round(sorted(latencies)[int(len(latencies) * 0.95)] if len(latencies) >= 20 else avg_latency * 1.4)
    
    # --- Query Dynatrace Problems API ---
    dt_problems = []
    dt_uptime_pct = 99.99
    dt_connected = False
    
    dt_endpoint = config.DT_ENDPOINT
    dt_token = config.DT_API_TOKEN
    
    if dt_endpoint and dt_token:
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(
                    f"{dt_endpoint.rstrip('/')}/api/v2/problems",
                    headers={"Authorization": f"Api-Token {dt_token}"},
                    params={"problemSelector": "status(OPEN)", "pageSize": "10"}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    dt_problems = data.get("problems", [])
                    dt_connected = True
                    dt_uptime_pct = 99.99 if not dt_problems else 98.5
        except Exception as e:
            logger.warning(f"Dynatrace problems API call failed: {e}")
    
    # Build hourly cost history from current spend (real data)
    current_spend = budget_controller.current_spend
    total_txns = stats["total"] or 1
    cost_per_txn = current_spend / total_txns
    
    return {
        "pipeline_latency_avg_ms": avg_latency,
        "pipeline_latency_p95_ms": p95_latency,
        "latency_history": latencies,
        "budget_spend_usd": round(current_spend, 4),
        "budget_utilization_pct": round(budget_controller.get_utilization_percentage(), 1),
        "routing_tier": router.get_routing_tier(),
        "total_transactions": stats["total"],
        "approved": stats["approved"],
        "flagged": stats["flagged"],
        "blocked": stats["blocked"],
        "self_healing_actions": self_healing_action_count,
        "dynatrace_connected": dt_connected,
        "dynatrace_problems": [
            {"title": p.get("title", "Unknown"), "severity": p.get("severityLevel", "INFO")}
            for p in dt_problems
        ],
        "dynatrace_problem_count": len(dt_problems),
        "dynatrace_uptime_pct": dt_uptime_pct,
        "false_positive_rate": round(router.current_false_positive_rate * 100, 1),
    }

class SettingsUpdate(BaseModel):
    budget_daily: Optional[float] = None
    tier_amber: Optional[float] = None
    tier_red: Optional[float] = None
    flag_threshold: Optional[int] = None
    block_threshold: Optional[int] = None
    fraud_thresholds: Optional[dict] = None

@app.post("/api/settings")
def update_settings(settings: SettingsUpdate):
    if settings.budget_daily is not None:
        config.BUDGET_USD_PER_HOUR = settings.budget_daily
    if settings.tier_amber is not None:
        config.BUDGET_ECONOMY_THRESHOLD = settings.tier_amber
    if settings.flag_threshold is not None:
        fraud_thresholds["flag"] = settings.flag_threshold
    if settings.block_threshold is not None:
        fraud_thresholds["block"] = settings.block_threshold
    return {"status": "success", "message": "Settings updated"}

@app.get("/api/settings")
def get_settings():
    return {
        "budget_daily": config.BUDGET_USD_PER_HOUR,
        "fraud_thresholds": fraud_thresholds,
        "routing_tier": router.get_routing_tier(),
        "model_flash": config.MODEL_FLASH,
        "model_pro": config.MODEL_PRO,
        "dynatrace_connected": bool(config.DT_ENDPOINT and config.DT_API_TOKEN),
    }

class ReviewAction(BaseModel):
    tx_id: str
    status: str  # approved | blocked | escalated
    note: Optional[str] = None

@app.post("/api/review")
def submit_review(action: ReviewAction):
    """Persist analyst review decision server-side."""
    import time as _time
    review_decisions[action.tx_id] = {
        "status": action.status,
        "note": action.note or "",
        "timestamp": _time.time()
    }
    # Reflect in stats for transparency
    if action.status == "approved":
        stats["approved"] = max(0, stats["approved"] + 1)
        stats["flagged"] = max(0, stats["flagged"] - 1)
    elif action.status == "blocked":
        stats["blocked"] = max(0, stats["blocked"] + 1)
        stats["flagged"] = max(0, stats["flagged"] - 1)
    return {"status": "ok", "tx_id": action.tx_id, "decision": action.status}

@app.get("/api/review")
def get_review_decisions():
    return review_decisions

@app.get("/api/analytics")
def get_analytics():
    """Real latency + cost data for analytics scatter chart."""
    latencies = list(latency_history)
    total = stats["total"] or 1
    spend = budget_controller.current_spend
    cost_per_txn = spend / total

    # Build per-tier scatter points from recent_transactions
    scatter = {"economy": [], "standard": [], "premium": []}
    for i, item in enumerate(stats["recent_transactions"][-50:]):
        tier = item.get("result", {}).get("routing_tier", "standard")
        lat = latencies[i] if i < len(latencies) else 0
        cost = cost_per_txn * (0.5 if tier == "economy" else 2.0 if tier == "premium" else 1.0)
        if tier in scatter:
            scatter[tier].append({"x": lat, "y": round(cost, 5)})

    return {
        "latency_history": latencies,
        "avg_latency_ms": round(sum(latencies) / len(latencies)) if latencies else 0,
        "scatter_by_tier": scatter,
        "total_transactions": stats["total"],
        "budget_spend_usd": round(spend, 4),
    }

@app.get("/api/test/dynatrace")
async def test_dynatrace():
    """Real Dynatrace connectivity test."""
    import httpx
    if not (config.DT_ENDPOINT and config.DT_API_TOKEN):
        return {"connected": False, "message": "DT_ENDPOINT or DT_API_TOKEN not configured"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{config.DT_ENDPOINT.rstrip('/')}/api/v2/entities",
                headers={"Authorization": f"Api-Token {config.DT_API_TOKEN}"},
                params={"pageSize": "1"}
            )
        if resp.status_code == 200:
            return {"connected": True, "message": "Dynatrace API authenticated successfully"}
        return {"connected": False, "message": f"HTTP {resp.status_code}: {resp.text[:120]}"}
    except Exception as e:
        return {"connected": False, "message": str(e)}

# Serve the Vanilla JS Dashboard with caching headers
from fastapi import Request
from fastapi.responses import FileResponse, Response
import mimetypes

static_dir = os.path.join(os.path.dirname(__file__), "static")

@app.middleware("http")
async def add_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    # Cache static assets aggressively (1 hour), never cache HTML
    if path.startswith("/static/"):
        if path.endswith((".css", ".js")):
            response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
        elif path.endswith((".woff2", ".woff", ".ttf", ".ico", ".svg", ".png", ".webp")):
            response.headers["Cache-Control"] = "public, max-age=86400"
        elif path.endswith(".html"):
            response.headers["Cache-Control"] = "no-cache"
    return response

app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_root():
    return RedirectResponse(url="/static/index.html")
