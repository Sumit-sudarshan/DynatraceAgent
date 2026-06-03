import json
import logging
from typing import Dict, Any
from app.config import MOCK_MODE, GEMINI_API_KEY, MODEL_PRO, MODEL_FLASH
from app.observability.tracer import trace_agent_call
from app.observability.cost_tracker import cost_tracker
from app.utils.ml_heuristics import calculate_risk_and_confidence

logger = logging.getLogger(__name__)

DECISION_SYSTEM_PROMPT = """You are a fraud decision agent. Given a transaction and its investigation results, make a final ruling.

Respond ONLY with valid JSON:
{
    "transaction_id": "...",
    "risk_score": <0-100>,
    "decision": "APPROVE|FLAG|BLOCK",
    "fraud_category": "none|velocity_testing|card_not_present_geo|high_risk_merchant|account_takeover",
    "confidence": <0.0-1.0>,
    "explanation": "...",
    "recommended_actions": ["action1", "action2"]
}"""

@trace_agent_call(agent_name="decision", model_used="gemini-pro")
async def run_decision(transaction: Dict[str, Any], investigation_result: Dict[str, Any], routing_tier: str) -> Dict[str, Any]:
    """
    Synthesizes triage and investigation data to make a final decision.
    """
    # Track final decision cost
    model_used = "gemini-pro" if routing_tier != "economy" else "gemini-flash"
    cost_tracker.record_transaction_cost(
        transaction["transaction_id"], 
        model_used, 
        prompt_tokens=400, 
        completion_tokens=100
    )
    
    # Calculate ML heuristic risk and confidence
    ml_risk, ml_conf, top_reason = calculate_risk_and_confidence(transaction, investigation_result)

    if MOCK_MODE:
        import asyncio
        await asyncio.sleep(0.8)
        risk_score = ml_risk
        
        if risk_score > 80:
            decision = "BLOCK"
            explanation = f"Transaction blocked due to high confidence fraud indicators: {top_reason}. " + " ".join(investigation_result.get("reasoning_chain", []))
            actions = ["Block card", "Notify customer"]
        elif risk_score > 60:
            decision = "FLAG"
            explanation = f"Transaction flagged for manual review due to elevated risk score: {top_reason}."
            actions = ["Send SMS verification"]
        else:
            decision = "APPROVE"
            explanation = "Transaction approved. No significant fraud indicators detected."
            actions = []
            
        return {
            "transaction_id": transaction["transaction_id"],
            "risk_score": risk_score,
            "decision": decision,
            "fraud_category": top_reason.lower().replace(" ", "_"),
            "confidence": ml_conf,
            "explanation": explanation,
            "recommended_actions": actions,
            "routing_tier": routing_tier
        }
    else:
        # Real Gemini call for final decision
        import re
        from app.agents.gemini_helper import call_gemini_with_retry
        
        context = {
            "transaction": transaction,
            "investigation": investigation_result,
            "routing_tier": routing_tier
        }
        
        model = MODEL_PRO if routing_tier != "economy" else MODEL_FLASH
        raw_text = await call_gemini_with_retry(
            model=model,
            contents=f"{DECISION_SYSTEM_PROMPT}\n\nContext:\n{json.dumps(context, indent=2)}"
        )
        
        # Safe JSON parsing
        raw_text = raw_text.strip()
        json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', raw_text, re.DOTALL)
        if json_match:
            raw_text = json_match.group(1)
        
        try:
            result = json.loads(raw_text)
            # Ensure the ML heuristic confidence and risk override if not provided or to enforce matrix
            result["risk_score"] = result.get("risk_score", ml_risk)
            result["confidence"] = result.get("confidence", ml_conf)
        except json.JSONDecodeError:
            logger.error(f"Decision: Failed to parse Gemini response: {raw_text[:200]}")
            result = {
                "risk_score": ml_risk,
                "decision": "BLOCK" if ml_risk > 80 else "FLAG" if ml_risk > 60 else "APPROVE",
                "fraud_category": top_reason.lower().replace(" ", "_"),
                "confidence": ml_conf,
                "explanation": "Fallback: Could not parse Gemini response. Used heuristic ML matrix.",
                "recommended_actions": ["Manual review required"]
            }
        
        result["transaction_id"] = transaction["transaction_id"]
        result["routing_tier"] = routing_tier
        return result
