"""
Gemini API helper with retry logic for rate limiting (429 errors).
Supports two modes:
  1. Direct API key (free tier) — GEMINI_API_KEY
  2. Vertex AI (GCP billing) — USE_VERTEX_AI=true + GCP_PROJECT_ID

Shared by all agents.
"""
import asyncio
import logging
import re
import time
from app.config import GEMINI_API_KEY, GCP_PROJECT_ID

logger = logging.getLogger(__name__)

# Shared client (created once)
_client = None

def get_client():
    """Get or create the Gemini client. Supports both API key and Vertex AI modes."""
    global _client
    if _client is not None:
        return _client
    
    import os
    from google import genai
    
    use_vertex = os.getenv("USE_VERTEX_AI", "false").lower() == "true"
    
    if use_vertex and GCP_PROJECT_ID:
        # Vertex AI mode — uses GCP billing/credits instead of free tier
        _client = genai.Client(
            vertexai=True,
            project=GCP_PROJECT_ID,
            location=os.getenv("GCP_REGION", "us-central1"),
        )
        logger.info(f"Gemini: Using Vertex AI mode (project: {GCP_PROJECT_ID})")
    elif GEMINI_API_KEY:
        # Direct API key mode — uses free tier quotas
        _client = genai.Client(api_key=GEMINI_API_KEY)
        logger.info("Gemini: Using direct API key mode")
    else:
        raise RuntimeError("No Gemini credentials configured. Set GEMINI_API_KEY or USE_VERTEX_AI=true")
    
    return _client


# Safety settings for all calls
from google.genai import types

SAFETY_SETTINGS = [
    types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
    types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
    types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
    types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
]


async def call_gemini_with_retry(
    model: str,
    contents: str,
    max_retries: int = 3,
    base_delay: float = 2.0,
) -> str:
    """
    Call Gemini API with exponential backoff retry on 429 rate limits.
    Returns the raw response text.
    """
    client = get_client()
    
    for attempt in range(max_retries + 1):
        try:
            response = client.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    safety_settings=SAFETY_SETTINGS,
                    temperature=0.1,
                )
            )
            usage = response.usage_metadata
            prompt_tokens = getattr(usage, 'prompt_token_count', 0) or 0
            completion_tokens = getattr(usage, 'candidates_token_count', 0) or 0
            return response.text, prompt_tokens, completion_tokens
            
        except Exception as e:
            error_str = str(e)
            
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                if attempt < max_retries:
                    # Extract retry delay from error if available
                    delay = base_delay * (2 ** attempt)
                    
                    retry_match = re.search(r'retryDelay.*?(\d+)', error_str)
                    if retry_match:
                        suggested = int(retry_match.group(1))
                        delay = max(delay, suggested + 1)
                    
                    # Cap at 60 seconds
                    delay = min(delay, 60)
                    
                    logger.warning(
                        f"Gemini 429 rate limit (attempt {attempt + 1}/{max_retries + 1}). "
                        f"Retrying in {delay:.0f}s..."
                    )
                    await asyncio.sleep(delay)
                    continue
                else:
                    logger.error(f"Gemini 429: Max retries exhausted after {max_retries + 1} attempts.")
                    raise
            else:
                # Non-rate-limit error — don't retry
                raise
    
    raise RuntimeError("Unreachable")
