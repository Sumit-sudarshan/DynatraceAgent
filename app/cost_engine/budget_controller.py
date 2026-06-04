import logging
from opentelemetry import trace
from app.config import BUDGET_USD_PER_HOUR

logger = logging.getLogger(__name__)

class BudgetController:
    """Tracks budget utilization and triggers cost-saving modes when exceeded."""
    
    def __init__(self):
        self.hourly_budget = BUDGET_USD_PER_HOUR
        self.current_spend = 0.0
        
    def record_spend(self, amount: float):
        self.current_spend += amount
        self.emit_telemetry()
        
    def get_utilization_percentage(self) -> float:
        if self.hourly_budget <= 0:
            return 100.0
        return (self.current_spend / self.hourly_budget) * 100.0
        
    def is_budget_exceeded(self) -> bool:
        return self.current_spend >= self.hourly_budget

    def emit_telemetry(self):
        """Emit current budget metrics to Dynatrace via OpenTelemetry."""
        current_span = trace.get_current_span()
        utilization = self.get_utilization_percentage()
        if current_span and current_span.is_recording():
            current_span.set_attribute("finsentinel.budget_utilization_pct", utilization)
            current_span.set_attribute("finsentinel.budget_spend_usd", self.current_spend)
        
        if utilization >= 90.0:
            logger.warning(f"BUDGET ALERT: Utilization at {utilization:.1f}% (${self.current_spend:.2f} / ${self.hourly_budget:.2f})")

# Singleton instance
budget_controller = BudgetController()
