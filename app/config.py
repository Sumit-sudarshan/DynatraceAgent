"""
FinSentinel Configuration — Single source of truth for all settings.
All values are loaded from environment variables (set via .env file).
"""
import os

# --- Mode ---
MOCK_MODE = os.getenv("MOCK_MODE", "true").lower() == "true"

# --- Google Cloud / Gemini ---
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")  # paste_your_gemini_api_key_here

# --- Dynatrace ---
DT_ENDPOINT = os.getenv("DT_ENDPOINT", "")        # https://xxx.live.dynatrace.com (for OTel/metrics API)
DT_API_TOKEN = os.getenv("DT_API_TOKEN", "")       # API token for OTel ingest
DT_ENVIRONMENT = os.getenv("DT_ENVIRONMENT", "")   # https://xxx.apps.dynatrace.com (for MCP server)
DT_PLATFORM_TOKEN = os.getenv("DT_PLATFORM_TOKEN", "")  # Platform token for MCP server
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "")    # (unused — MCP runs as subprocess)

# --- Budget ---
BUDGET_USD_PER_HOUR = float(os.getenv("BUDGET_USD_PER_HOUR", "50.0"))

# --- Model Names ---
MODEL_FLASH = os.getenv("MODEL_FLASH", "gemini-1.5-flash-002")
MODEL_PRO = os.getenv("MODEL_PRO", "gemini-1.5-pro-002")

# --- Thresholds ---
BUDGET_ECONOMY_THRESHOLD = 80.0    # % utilization to trigger economy mode
BUDGET_PREMIUM_THRESHOLD = 40.0    # below this % → premium allowed
FP_RATE_HEALING_THRESHOLD = 0.15   # false positive rate to trigger self-healing

# --- Environment ---
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
