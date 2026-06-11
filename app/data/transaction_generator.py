import time
import random
import os
import csv
from typing import Dict, Any, Generator

class TransactionGenerator:
    """Generates synthetic transactions using sample data from train_transaction.csv."""
    
    def __init__(self):
        self.transactions = []
        self._load_csv_data()
        
        # Fallbacks just in case CSV is empty/missing
        self.merchants = ["Amazon", "Starbucks", "Uber", "Best Buy", "Target", "Walmart", "Delta Airlines"]
        self.devices = ["iPhone 15 Pro", "Samsung Galaxy S24", "MacBook Pro", "Windows PC", "iPad Air"]
        self.channels = ["Online Purchase", "In-Store POS", "Mobile App", "ATM Terminal"]
        self.cities = ["New York, US", "Chicago, US", "San Francisco, US", "Austin, US", "Miami, US", "Seattle, US"]

    def _load_csv_data(self):
        csv_path = os.path.join(os.path.dirname(__file__), "..", "..", "train_transaction.csv")
        try:
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                count = 0
                for row in reader:
                    if count >= 100:
                        break
                    
                    # Parse basics
                    txn_id = f"txn_{row.get('TransactionID', '0000')}"
                    amount = float(row.get('TransactionAmt', 0.0))
                    
                    # Method & Network
                    method = row.get('card6', 'credit').title() + " Card"
                    if method.strip() == " Card": method = "Credit Card"
                    
                    network = row.get('card4', 'visa').title()
                    if not network: network = "Visa"
                    masked_num = f"•••• {random.randint(1000, 9999)}"
                    card_details = f"{network} ({masked_num})"
                    
                    # Customer ID
                    email = row.get('P_emaildomain', '')
                    if email:
                        cust_id = f"cust_{email.split('.')[0]}_{random.randint(10, 99)}"
                    else:
                        cust_id = f"cust_{random.randint(1000, 9999)}"
                    
                    self.transactions.append({
                        "transaction_id": txn_id,
                        "amount": amount,
                        "customer_id": cust_id,
                        "merchant_name": random.choice(["Amazon", "Starbucks", "Uber", "Best Buy", "Target"]),
                        "location": random.choice(["New York, US", "Chicago, US", "San Francisco, US", "Austin, US", "Miami, US", "Seattle, US"]),
                        "transaction_method": random.choice(["Online Purchase", "In-Store POS", "Mobile App"]),
                        "device_fingerprint": f"Device: {random.choice(['iPhone 15 Pro', 'MacBook Pro', 'Windows PC'])}, IP: {random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}",
                        "card_network": card_details,
                        "latitude": random.uniform(25.0, 48.0),
                        "longitude": random.uniform(-125.0, -70.0),
                        "is_synthetic_fraud": False,
                        "timestamp": time.time()
                    })
                    count += 1
        except Exception as e:
            print(f"Warning: Could not load CSV data ({e}). Using full synthetic mode.")

    def _get_base_transaction(self) -> Dict[str, Any]:
        if self.transactions:
            base = random.choice(self.transactions).copy()
            base["timestamp"] = time.time()
            return base
        else:
            # Complete fallback (8 columns)
            return {
                "transaction_id": f"txn_{random.randint(10000000, 99999999)}",
                "amount": round(random.uniform(5.0, 150.0), 2),
                "customer_id": f"cust_{random.randint(1000, 9999)}",
                "merchant_name": random.choice(self.merchants),
                "location": random.choice(self.cities),
                "transaction_method": random.choice(self.channels),
                "device_fingerprint": f"Device: {random.choice(self.devices)}, IP: 198.51.100.{random.randint(1,255)}",
                "card_network": f"Visa (•••• {random.randint(1000, 9999)})",
                "latitude": random.uniform(25.0, 48.0),
                "longitude": random.uniform(-125.0, -70.0),
                "is_synthetic_fraud": False,
                "timestamp": time.time()
            }
            
    def generate_normal_transaction(self) -> Dict[str, Any]:
        tx = self._get_base_transaction()
        return tx
        
    def generate_fraud_velocity_spike(self) -> Dict[str, Any]:
        tx = self._get_base_transaction()
        tx["customer_id"] = "cust_9999_velocity"
        tx["amount"] = round(random.uniform(1.0, 10.0), 2)
        tx["merchant_name"] = "Digital Games Inc."
        tx["is_synthetic_fraud"] = True
        tx["fraud_type"] = "velocity_spike"
        return tx
        
    def generate_fraud_geo_impossible(self) -> Dict[str, Any]:
        tx = self._get_base_transaction()
        tx["customer_id"] = f"cust_{random.randint(1000, 9999)}_travel"
        tx["amount"] = round(random.uniform(500.0, 2500.0), 2)
        tx["merchant_name"] = "Luxury Electronics Moscow"
        tx["location"] = "Moscow, RU"
        # Moscow coordinates
        tx["latitude"] = 55.7558
        tx["longitude"] = 37.6173
        tx["device_fingerprint"] = f"Device: Unknown Android, IP: 95.108.14.{random.randint(1,255)}"
        tx["is_synthetic_fraud"] = True
        tx["fraud_type"] = "geo_impossible"
        return tx

    def stream_transactions(self, delay_seconds: float = 1.0) -> Generator[Dict[str, Any], None, None]:
        while True:
            roll = random.random()
            if roll < 0.8:
                tx = self.generate_normal_transaction()
            elif roll < 0.9:
                tx = self.generate_fraud_velocity_spike()
            else:
                tx = self.generate_fraud_geo_impossible()
                
            yield tx
            time.sleep(delay_seconds)

if __name__ == "__main__":
    generator = TransactionGenerator()
    print("Starting synthetic transaction generator...")
    for i, tx in enumerate(generator.stream_transactions(0.5)):
        print(f"[{'FRAUD' if tx['is_synthetic_fraud'] else 'NORMAL'}] Txn {tx['transaction_id']}: ${tx['amount']} at {tx['merchant_name']} ({tx['location']})")
        if i >= 10:
            break
