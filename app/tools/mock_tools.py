import random
from typing import Dict, Any, List

def get_customer_profile(customer_id: str) -> Dict[str, Any]:
    """Mock tool: Retrieves customer account details."""
    return {
        "customer_id": customer_id,
        "account_age_days": random.randint(10, 3650),
        "avg_monthly_balance": round(random.uniform(100, 10000), 2),
        "typical_merchants": ["grocery", "gas", "coffee"],
        "risk_tier": "low" if "travel" not in customer_id else "high"
    }

def get_merchant_risk(merchant_id: str) -> Dict[str, Any]:
    """Mock tool: Retrieves merchant risk assessment."""
    if "luxury" in merchant_id or "digital" in merchant_id:
        return {"merchant_id": merchant_id, "risk_score": 85, "chargeback_rate": 2.5, "known_fraud": True}
    return {"merchant_id": merchant_id, "risk_score": 15, "chargeback_rate": 0.2, "known_fraud": False}

def check_geolocation(lat: float, lng: float, customer_id: str) -> Dict[str, Any]:
    """Mock tool: Checks if the transaction location is physically possible."""
    # For synthetic fraud that explicitly names "Moscow" or implies travel
    if "travel" in customer_id:
        return {"feasible": False, "distance_from_home_km": 8500, "last_tx_time_hours_ago": 0.5}
    return {"feasible": True, "distance_from_home_km": 15, "last_tx_time_hours_ago": 24}

def get_behavioral_baseline(customer_id: str) -> Dict[str, Any]:
    """Mock tool: Retrieves 12-month spending habits."""
    return {
        "avg_tx_amount": 45.00,
        "max_tx_amount_12m": 350.00,
        "preferred_time": "daytime",
        "anomaly_score": random.uniform(0.1, 0.9)
    }

def get_related_transactions(customer_id: str, window_hours: int = 1) -> List[Dict[str, Any]]:
    """Mock tool: Gets recent transactions to detect velocity spikes."""
    if "velocity" in customer_id:
        return [
            {"amount": 1.50, "merchant": "digital_goods", "time": "5 mins ago"},
            {"amount": 2.00, "merchant": "digital_goods", "time": "3 mins ago"},
            {"amount": 5.00, "merchant": "digital_goods", "time": "1 min ago"}
        ]
    return []
