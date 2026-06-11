import logging
from opentelemetry import trace
import app.config as config

logger = logging.getLogger(__name__)

class BudgetController:
    """Tracks budget utilization and triggers cost-saving modes when exceeded."""
    
    def __init__(self):
        self.current_spend = 0.0
        
    def record_spend(self, amount: float):
        self.current_spend += amount
        self.emit_telemetry()
        
    def get_utilization_percentage(self) -> float:
        if config.BUDGET_USD_PER_HOUR <= 0:
            return 100.0
        return (self.current_spend / config.BUDGET_USD_PER_HOUR) * 100.0
        
    def is_budget_exceeded(self) -> bool:
        return self.current_spend >= config.BUDGET_USD_PER_HOUR

    def emit_telemetry(self):
        """Emit current budget metrics to Dynatrace via OpenTelemetry."""
        current_span = trace.get_current_span()
        utilization = self.get_utilization_percentage()
        if current_span and current_span.is_recording():
            current_span.set_attribute("finsentinel.budget_utilization_pct", utilization)
            current_span.set_attribute("finsentinel.budget_spend_usd", self.current_spend)
        
        if utilization >= 90.0:
            logger.warning(f"BUDGET ALERT: Utilization at {utilization:.1f}% (${self.current_spend:.2f} / ${config.BUDGET_USD_PER_HOUR:.2f})")

# Singleton instance
budget_controller = BudgetController()
