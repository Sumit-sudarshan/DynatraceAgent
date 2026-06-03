import logging
from typing import Dict, Any
from .intake_agent import run_intake_triage
from .investigator_agent import run_investigation
from .decision_agent import run_decision
from app.cost_engine.router import router

logger = logging.getLogger(__name__)

async def process_transaction(transaction: Dict[str, Any]) -> Dict[str, Any]:
    """
    The Orchestrator loop:
    1. Ask Cost Engine for Routing Tier
    2. Intake Agent (Triage)
    3. Investigator Agent (Deep Dive if needed/budget allows)
    4. Decision Agent (Final ruling)
    """
    logger.info(f"Processing Txn {transaction['transaction_id']}")
    
    # 1. Cost Engine determines routing
    tier = router.get_routing_tier()
    transaction["routing_tier"] = tier
    
    # 2. Intake Triage
    triage_result = await run_intake_triage(transaction)
    
    # 3. Investigation Logic
    investigation_result = {}
    
    if tier == router.TIER_ECONOMY:
        # In Economy mode, we skip the expensive deep dive unless it's CRITICAL
        if triage_result["signals_detected"] >= 4:
            logger.info("ECONOMY OVERRIDE: Critical signals detected, escalating.")
            investigation_result = await run_investigation(transaction)
        else:
            logger.info("ECONOMY: Skipping deep investigation to save budget.")
            investigation_result = {
                "risk_score": 10 if triage_result["risk_tier"] == "LOW" else 65,
                "fraud_category": "heuristics_only",
                "reasoning_chain": [f"Evaluated using Intake Heuristics only. Signals: {triage_result['signals_detected']}"]
            }
    else:
        # Standard or Premium: always escalate if not LOW
        if triage_result["escalate"]:
            logger.info("Escalating to Investigator Agent...")
            investigation_result = await run_investigation(transaction)
        else:
            investigation_result = {
                "risk_score": 5,
                "fraud_category": "none",
                "reasoning_chain": ["Triage determined LOW risk. Auto-approved."]
            }
            
    # 4. Final Decision Synthesis
    final_decision = await run_decision(transaction, investigation_result, tier)
    return final_decision
