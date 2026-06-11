import json
import logging
from typing import Dict, Any
from app.config import MOCK_MODE, GEMINI_API_KEY, MODEL_FLASH
from app.observability.tracer import trace_agent_call
from app.observability.cost_tracker import cost_tracker

logger = logging.getLogger(__name__)

INTAKE_SYSTEM_PROMPT = """You are a fraud triage agent. Given a transaction, evaluate these 5 heuristic signals:
1. High Amount Anomaly (>$300)
2. Velocity Anomaly (multiple rapid transactions)
3. Geographic Impossibility (location inconsistent with customer history)
4. New/Unusual Merchant Category
5. Dormant Account Reactivation

Respond ONLY with valid JSON:
{"transaction_id": "...", "risk_tier": "LOW|MEDIUM|HIGH", "escalate": true/false, "signals_detected": <count>}"""

@trace_agent_call(agent_name="intake", model_used="gemini-flash")
async def run_intake_triage(transaction: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sub-second triage on Gemini Flash.
    Evaluates heuristic signals to quickly approve mundane transactions.
    """
    cost_tracker.record_transaction_cost(
        transaction["transaction_id"], 
        "gemini-flash", 
        prompt_tokens=150, 
        completion_tokens=20
    )
    
    if MOCK_MODE:
        import asyncio
        await asyncio.sleep(0.3)
        signals = 0
        
        # 1. High Amount Anomaly
        if transaction.get("amount", 0) > 300:
            signals += 1
            
        # 2. Velocity Anomaly
        if "velocity" in transaction.get("customer_id", ""):
            signals += 2
            
        # 3. Geo Anomaly
        if "travel" in transaction.get("customer_id", ""):
            signals += 2
            
        # Risk tiering
        tier = "LOW"
        escalate = False
        
        if signals == 0:
            tier = "LOW"
        elif signals == 1:
            tier = "MEDIUM"
            escalate = True
        else:
            tier = "HIGH"
            escalate = True
            
        return {
            "transaction_id": transaction["transaction_id"],
            "risk_tier": tier,
            "escalate": escalate,
            "signals_detected": signals
        }
    else:
        # Real Gemini Flash call with retry
        import re
        from app.agents.gemini_helper import call_gemini_with_retry
        
        raw_text, prompt_tokens, completion_tokens = await call_gemini_with_retry(
            model=MODEL_FLASH,
            contents=f"{INTAKE_SYSTEM_PROMPT}\n\nTransaction:\n{json.dumps(transaction)}"
        )
        cost_tracker.record_transaction_cost(
            transaction["transaction_id"], MODEL_FLASH,
            prompt_tokens=prompt_tokens, completion_tokens=completion_tokens
        )
        
        # Safe JSON parsing — handle markdown-wrapped responses
        raw_text = raw_text.strip()
        json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', raw_text, re.DOTALL)
        if json_match:
            raw_text = json_match.group(1)
        
        try:
            result = json.loads(raw_text)
        except json.JSONDecodeError:
            logger.error(f"Intake: Failed to parse Gemini response: {raw_text[:200]}")
            result = {"risk_tier": "MEDIUM", "escalate": True, "signals_detected": 1}
        
        result["transaction_id"] = transaction["transaction_id"]
        return result
