import logging
from opentelemetry import trace

logger = logging.getLogger(__name__)

# Known token pricing (estimated for Gemini models per 1k tokens)
PRICING = {
    "gemini-flash": {
        "prompt": 0.000125,     # $0.125 / 1M tokens
        "completion": 0.000375  # $0.375 / 1M tokens
    },
    "gemini-pro": {
        "prompt": 0.0025,       # $2.50 / 1M tokens
        "completion": 0.0075    # $7.50 / 1M tokens
    }
}

class CostTracker:
    def __init__(self):
        self.total_cost_usd = 0.0
        self.transactions_processed = 0
        
    def calculate_cost(self, model_name: str, prompt_tokens: int, completion_tokens: int) -> float:
        """Calculate the USD cost of a single LLM request."""
        # Map generic names to pricing tiers
        tier = "gemini-flash" if "flash" in model_name.lower() else "gemini-pro"
        rates = PRICING.get(tier, PRICING["gemini-flash"])
        
        cost = (prompt_tokens / 1000.0) * rates["prompt"] + (completion_tokens / 1000.0) * rates["completion"]
        return cost

    def record_transaction_cost(self, transaction_id: str, model_name: str, prompt_tokens: int, completion_tokens: int):
        """Record the cost and emit it to the current active OpenTelemetry span."""
        cost = self.calculate_cost(model_name, prompt_tokens, completion_tokens)
        self.total_cost_usd += cost
        self.transactions_processed += 1
        
        # Wire cost into the budget controller so routing tier reacts to spend
        from app.cost_engine.budget_controller import budget_controller
        budget_controller.record_spend(cost)
        
        # Emit to OTel
        current_span = trace.get_current_span()
        if current_span and current_span.is_recording():
            current_span.set_attribute("finsentinel.tokens_prompt", prompt_tokens)
            current_span.set_attribute("finsentinel.tokens_completion", completion_tokens)
            current_span.set_attribute("finsentinel.cost_usd", cost)
            
        logger.info(f"[COST] Txn: {transaction_id} | Model: {model_name} | Cost: ${cost:.5f}")
        return cost

# Singleton instance
cost_tracker = CostTracker()
