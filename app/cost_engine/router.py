import logging
from app.config import BUDGET_ECONOMY_THRESHOLD, BUDGET_PREMIUM_THRESHOLD, FP_RATE_HEALING_THRESHOLD
from .budget_controller import budget_controller

logger = logging.getLogger(__name__)

class Router:
    """Cost-Aware Model Router. Decides which model tier to use based on budget and accuracy metrics."""
    
    TIER_ECONOMY = "economy"   # Flash only
    TIER_STANDARD = "standard" # Flash triage -> Pro investigation
    TIER_PREMIUM = "premium"   # Pro for all steps
    
    def __init__(self):
        # In a real app, this would be fetched from Dynatrace MCP
        self.current_false_positive_rate = 0.05 # Mocked 5%
        
    def get_routing_tier(self) -> str:
        utilization = budget_controller.get_utilization_percentage()
        
        # Routing Decision Matrix
        if utilization > BUDGET_ECONOMY_THRESHOLD:
            # Budget tight: force cheap models
            tier = self.TIER_ECONOMY
        elif utilization < BUDGET_PREMIUM_THRESHOLD or self.current_false_positive_rate > FP_RATE_HEALING_THRESHOLD:
            # Lots of budget OR high FP rate (need better reasoning)
            tier = self.TIER_PREMIUM
        else:
            # Normal operations
            tier = self.TIER_STANDARD
            
        logger.info(f"Router selected tier: {tier.upper()} (Budget: {utilization:.1f}% | FP Rate: {self.current_false_positive_rate*100:.1f}%)")
        return tier

# Singleton instance
router = Router()
