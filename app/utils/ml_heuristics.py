import random

def calculate_risk_and_confidence(transaction: dict, investigation: dict = None) -> tuple[int, float, str]:
    """
    Heuristic ML Matrix for calculating fraud risk and model confidence.
    Returns: (risk_score (0-100), confidence (0.0-1.0), top_reason)
    """
    amount = transaction.get("amount", 0)
    customer_id = transaction.get("customer_id", "")
    merchant_name = transaction.get("merchant_name", "").lower()
    
    # Base risk with some natural variance
    risk = random.uniform(1.0, 10.0)
    reasons = []

    # 1. Amount feature weight
    if amount > 1000:
        risk += random.uniform(30.0, 40.0)
        reasons.append("High Amount")
    elif amount > 300:
        risk += random.uniform(10.0, 20.0)
        reasons.append("Elevated Amount")
        
    # 2. Velocity feature weight (Mocked via customer_id keyword)
    if "velocity" in customer_id:
        risk += random.uniform(40.0, 55.0)
        reasons.append("Velocity Anomaly")
        
    # 3. Geo/Travel feature weight
    if "travel" in customer_id:
        risk += random.uniform(35.0, 50.0)
        reasons.append("Geo Impossibility")
        
    # 4. Merchant Risk feature weight
    high_risk_merchants = ["crypto", "luxury", "electronics", "casino", "betting"]
    if any(m in merchant_name for m in high_risk_merchants):
        risk += random.uniform(20.0, 30.0)
        reasons.append("High Risk Merchant Category")
        
    # Combine with investigation signals if present
    if investigation:
        inv_risk = investigation.get("risk_score", 0)
        # Weight the investigation score heavily if it's high
        if inv_risk > 50:
            risk = (risk * 0.4) + (inv_risk * 0.6) + random.uniform(-5.0, 5.0)
            reasons.append("Investigator Flagged")

    # Bound risk 0-99 (reserving 100)
    risk_score = min(99, max(0, int(risk)))
    
    # Calculate confidence based on margin from decision boundary (50)
    # Add a tiny bit of random noise to confidence as well
    margin = abs(risk_score - 50) / 50.0  # 0.0 to 1.0
    confidence = 0.45 + (margin * 0.50) + random.uniform(0.0, 0.04)  
    
    top_reason = reasons[0] if reasons else "Normal Pattern"
    
    return risk_score, round(confidence, 2), top_reason
