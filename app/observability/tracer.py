import os
import time
import logging
from functools import wraps
from typing import Any, Callable

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SimpleSpanProcessor

logger = logging.getLogger(__name__)

_provider = None

def setup_telemetry():
    """Configure OTel to send traces to Dynatrace via OTLP. 
    Called lazily after load_dotenv() has run."""
    global _provider
    
    dt_endpoint = os.getenv("DT_ENDPOINT", "")
    dt_api_token = os.getenv("DT_API_TOKEN", "")
    
    resource = Resource(attributes={
        SERVICE_NAME: "finsentinel-agent"
    })
    
    _provider = TracerProvider(resource=resource)
    
    if dt_endpoint and "paste_your" not in dt_endpoint:
        # Real Dynatrace export via OTLP/HTTP
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        
        # Dynatrace OTLP ingest endpoint: {tenant_url}/api/v2/otlp/v1/traces
        otlp_url = f"{dt_endpoint.rstrip('/')}/api/v2/otlp/v1/traces"
        otlp_exporter = OTLPSpanExporter(
            endpoint=otlp_url,
            headers={"Authorization": f"Api-Token {dt_api_token}"}
        )
        _provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
        logger.info(f"OTel: Exporting traces to Dynatrace at {otlp_url}")
    else:
        # No-op in dev mode — don't flood console with span JSON
        logger.info("OTel: No Dynatrace endpoint configured. Traces are recorded in-memory only.")
        
    trace.set_tracer_provider(_provider)

def shutdown_telemetry():
    """Flush and shut down the OTel provider cleanly."""
    global _provider
    if _provider:
        _provider.shutdown()
        logger.info("OTel: Telemetry provider shut down.")

def get_tracer():
    """Get (or lazily initialize) the OTel tracer."""
    global _provider
    if _provider is None:
        setup_telemetry()
    return trace.get_tracer("finsentinel.tracer")

def trace_agent_call(agent_name: str, model_used: str):
    """
    Decorator to wrap Agent calls. Automatically tracks latency, model, 
    and injects FinSentinel specific OTel attributes.
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            tracer = get_tracer()
            with tracer.start_as_current_span(f"{agent_name}.{func.__name__}") as span:
                start_time = time.time()
                
                # Attach static attributes
                span.set_attribute("finsentinel.agent_name", agent_name)
                span.set_attribute("finsentinel.model_used", model_used)
                
                try:
                    # Execute the agent logic
                    result = await func(*args, **kwargs)
                    
                    # Attach dynamic attributes if present in result
                    if isinstance(result, dict):
                        for key in ["transaction_id", "risk_score", "decision", "fraud_category"]:
                            if key in result:
                                span.set_attribute(f"finsentinel.{key}", result[key])
                                
                    span.set_status(trace.StatusCode.OK)
                    return result
                except Exception as e:
                    span.set_status(trace.StatusCode.ERROR, str(e))
                    span.record_exception(e)
                    raise
                finally:
                    duration = time.time() - start_time
                    span.set_attribute("finsentinel.latency_seconds", duration)
                    
        @wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            tracer = get_tracer()
            with tracer.start_as_current_span(f"{agent_name}.{func.__name__}") as span:
                start_time = time.time()
                
                span.set_attribute("finsentinel.agent_name", agent_name)
                span.set_attribute("finsentinel.model_used", model_used)
                
                try:
                    result = func(*args, **kwargs)
                    if isinstance(result, dict):
                        for key in ["transaction_id", "risk_score", "decision", "fraud_category"]:
                            if key in result:
                                span.set_attribute(f"finsentinel.{key}", result[key])
                                
                    span.set_status(trace.StatusCode.OK)
                    return result
                except Exception as e:
                    span.set_status(trace.StatusCode.ERROR, str(e))
                    span.record_exception(e)
                    raise
                finally:
                    duration = time.time() - start_time
                    span.set_attribute("finsentinel.latency_seconds", duration)
                    
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator
