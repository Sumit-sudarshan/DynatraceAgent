import asyncio
import sys
import os
import logging

# Ensure project root is in path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from app.data.transaction_generator import TransactionGenerator
from app.agents.orchestrator import process_transaction

logging.basicConfig(level=logging.INFO)

async def run_e2e_test():
    generator = TransactionGenerator()
    print("--- Starting End-to-End Pipeline Test ---")
    print(f"--- MOCK_MODE = {os.getenv('MOCK_MODE', 'true')} ---\n")
    
    tx_normal = generator.generate_normal_transaction()
    tx_velocity = generator.generate_fraud_velocity_spike()
    tx_geo = generator.generate_fraud_geo_impossible()
    
    test_suite = [
        ("Normal Transaction", tx_normal),
        ("Velocity Spike Fraud", tx_velocity),
        ("Geo-Impossible Fraud", tx_geo)
    ]
    
    for i, (label, tx) in enumerate(test_suite):
        print(f"\n[{i+1}/3] {label}: {tx['transaction_id']}")
        result = await process_transaction(tx)
        
        print(f"  --> Decision:  {result['decision']}")
        print(f"  --> Risk Score: {result['risk_score']}")
        print(f"  --> Category:  {result['fraud_category']}")
        print(f"  --> Tier:      {result['routing_tier']}")
        print(f"  --> Reason:    {result['explanation']}")
    
    print("\n--- All tests passed ---")

if __name__ == "__main__":
    asyncio.run(run_e2e_test())
