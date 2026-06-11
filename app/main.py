import os
import asyncio
import json
import logging
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
            result = await process_transaction(tx)
            
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
            # Keep connection alive, listen for any messages from client
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        
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

class SettingsUpdate(BaseModel):
    budget_daily: Optional[float] = None
    tier_amber: Optional[float] = None
    tier_red: Optional[float] = None

@app.post("/api/settings")
def update_settings(settings: SettingsUpdate):
    if settings.budget_daily is not None:
        config.BUDGET_USD_PER_HOUR = settings.budget_daily
    if settings.tier_amber is not None:
        config.BUDGET_ECONOMY_THRESHOLD = settings.tier_amber
    
    return {"status": "success", "message": "Settings updated"}

# Serve the Vanilla JS Dashboard
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_root():
    return RedirectResponse(url="/static/index.html")
