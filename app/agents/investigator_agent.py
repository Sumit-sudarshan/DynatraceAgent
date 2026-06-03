import json
import logging
from typing import Dict, Any
from app.config import MOCK_MODE, GEMINI_API_KEY, MODEL_PRO
from app.observability.tracer import trace_agent_call
from app.observability.cost_tracker import cost_tracker
from app.tools import mock_tools

logger = logging.getLogger(__name__)

INVESTIGATOR_SYSTEM_PROMPT = """You are a fraud investigator agent. You have access to these tools and their results:
- Customer Profile: account age, balance, typical merchants, risk tier
- Merchant Risk: risk score, chargeback rate, known fraud flag
- Geolocation Check: whether the transaction location is physically possible
- Behavioral Baseline: spending habits, anomaly score
- Related Transactions: recent transactions from this customer

Given the transaction and all tool outputs below, produce a detailed investigation.

Respond ONLY with valid JSON:
{
    "transaction_id": "...",
    "reasoning_chain": ["step 1...", "step 2..."],
    "fraud_category": "none|velocity_testing|card_not_present_geo|high_risk_merchant|account_takeover",
    "risk_score": <0-100>,
    "evidence": {"profile_risk": "...", "merchant_known_fraud": true/false, "geo_feasible": true/false}
}"""

@trace_agent_call(agent_name="investigator", model_used="gemini-pro")
async def run_investigation(transaction: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deep multi-tool investigation on Gemini Pro.
    Only triggered if Intake Agent escalates.
    """
    # Track the higher cost of Gemini Pro
    cost_tracker.record_transaction_cost(
        transaction["transaction_id"], 
        "gemini-pro", 
        prompt_tokens=850, 
        completion_tokens=300
    )
    
    cust_id = transaction.get("customer_id", "")
    merch_id = transaction.get("merchant_id", "")
    
    # Always run tools (mock or real) to gather evidence
    profile = mock_tools.get_customer_profile(cust_id)
    merchant = mock_tools.get_merchant_risk(merch_id)
    geo = mock_tools.check_geolocation(
        transaction.get("latitude", 0), 
        transaction.get("longitude", 0), 
        cust_id
    )
    baseline = mock_tools.get_behavioral_baseline(cust_id)
    related = mock_tools.get_related_transactions(cust_id)
    
    if MOCK_MODE:
        import asyncio
        await asyncio.sleep(1.2)
        # Simulate reasoning based on collected tool evidence
        reasoning_chain = []
        fraud_category = "unknown"
        risk_score = 50
        
        if not geo["feasible"]:
            reasoning_chain.append(f"Geo-impossible detected: {geo['distance_from_home_km']}km from home.")
            fraud_category = "card_not_present_geo"
            risk_score = 95
            
        elif len(related) > 0:
            reasoning_chain.append(f"Velocity spike: {len(related)} related transactions in short window.")
            fraud_category = "velocity_testing"
            risk_score = 88
            
        elif merchant["risk_score"] > 50:
            reasoning_chain.append(f"High risk merchant: {merchant['chargeback_rate']}% chargeback rate.")
            fraud_category = "high_risk_merchant"
            risk_score = 75
            
        else:
            reasoning_chain.append("Investigation complete. Transaction appears consistent with baseline.")
            risk_score = 15
            fraud_category = "none"
            
        return {
            "transaction_id": transaction["transaction_id"],
            "reasoning_chain": reasoning_chain,
            "fraud_category": fraud_category,
            "risk_score": risk_score,
            "evidence": {
                "profile_risk": profile["risk_tier"],
                "merchant_known_fraud": merchant["known_fraud"],
                "geo_feasible": geo["feasible"]
            }
        }
    else:
        # Real Gemini Pro call with tool evidence context
        import re
        from app.agents.gemini_helper import call_gemini_with_retry
        
        tool_context = {
            "transaction": transaction,
            "customer_profile": profile,
            "merchant_risk": merchant,
            "geolocation_check": geo,
            "behavioral_baseline": baseline,
            "related_transactions": related
        }
        
        raw_text = await call_gemini_with_retry(
            model=MODEL_PRO,
            contents=f"{INVESTIGATOR_SYSTEM_PROMPT}\n\nTool Outputs:\n{json.dumps(tool_context, indent=2)}"
        )
        
        # Safe JSON parsing
        raw_text = raw_text.strip()
        json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', raw_text, re.DOTALL)
        if json_match:
            raw_text = json_match.group(1)
        
        try:
            result = json.loads(raw_text)
        except json.JSONDecodeError:
            logger.error(f"Investigator: Failed to parse Gemini response: {raw_text[:200]}")
            result = {
                "reasoning_chain": ["Error: Could not parse Gemini response"],
                "fraud_category": "unknown",
                "risk_score": 50,
                "evidence": {"profile_risk": "unknown", "merchant_known_fraud": False, "geo_feasible": True}
            }
        
        result["transaction_id"] = transaction["transaction_id"]
        return result
