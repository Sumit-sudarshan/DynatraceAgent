"""
Dynatrace MCP Client — Spawns @dynatrace-oss/dynatrace-mcp-server as a subprocess
and communicates via JSON-RPC (MCP protocol) over stdio.

This is how our self-healing loop queries Dynatrace for real metrics.
"""
import os
import json
import asyncio
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class DynatraceMCPClient:
    """Client that communicates with the Dynatrace MCP server via stdio."""
    
    def __init__(self):
        self.process: Optional[asyncio.subprocess.Process] = None
        self._request_id = 0
        self._initialized = False
        self._available_tools: List[Dict] = []
    
    async def start(self) -> bool:
        """Start the Dynatrace MCP server subprocess."""
        dt_environment = os.getenv("DT_ENVIRONMENT", "")
        dt_platform_token = os.getenv("DT_PLATFORM_TOKEN", "")
        
        if not dt_environment:
            logger.warning("MCP: DT_ENVIRONMENT not set. Cannot start MCP server.")
            return False
        
        if not dt_platform_token:
            logger.warning("MCP: DT_PLATFORM_TOKEN not set. Cannot start MCP server.")
            return False
        
        try:
            env = os.environ.copy()
            env["DT_ENVIRONMENT"] = dt_environment
            env["DT_PLATFORM_TOKEN"] = dt_platform_token
            
            # On Windows, npx needs shell to resolve from PATH
            import sys
            cmd_args = ["npx", "-y", "@dynatrace-oss/dynatrace-mcp-server@latest"]
            
            if sys.platform == "win32":
                self.process = await asyncio.create_subprocess_shell(
                    " ".join(cmd_args),
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=env,
                )
            else:
                self.process = await asyncio.create_subprocess_exec(
                    *cmd_args,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=env,
                )
            
            # Initialize the MCP session
            init_result = await self._send_request("initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "finsentinel-agent",
                    "version": "1.0.0"
                }
            })
            
            if init_result is not None:
                # Send initialized notification
                await self._send_notification("notifications/initialized", {})
                self._initialized = True
                logger.info("MCP: Dynatrace MCP server started and initialized successfully.")
                
                # List available tools
                tools_result = await self._send_request("tools/list", {})
                if tools_result and "tools" in tools_result:
                    self._available_tools = tools_result["tools"]
                    tool_names = [t["name"] for t in self._available_tools]
                    logger.info(f"MCP: Available tools: {tool_names}")
                
                return True
            else:
                logger.error("MCP: Failed to initialize MCP server.")
                await self.stop()
                return False
                
        except FileNotFoundError:
            logger.error("MCP: 'npx' not found. Is Node.js installed?")
            return False
        except Exception as e:
            logger.error(f"MCP: Failed to start MCP server: {e}")
            return False
    
    async def stop(self):
        """Stop the MCP server subprocess."""
        if self.process:
            try:
                self.process.terminate()
                await asyncio.wait_for(self.process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                self.process.kill()
            except Exception:
                pass
            self.process = None
            self._initialized = False
            logger.info("MCP: Server stopped.")
    
    async def _send_request(self, method: str, params: Dict) -> Optional[Dict]:
        """Send a JSON-RPC request and wait for the response."""
        if not self.process or self.process.stdin is None or self.process.stdout is None:
            return None
        
        self._request_id += 1
        request = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method,
            "params": params
        }
        
        message = json.dumps(request)
        # MCP uses Content-Length header framing
        content = f"Content-Length: {len(message.encode())}\r\n\r\n{message}"
        
        try:
            self.process.stdin.write(content.encode())
            await self.process.stdin.drain()
            
            # Read response with Content-Length framing
            response = await asyncio.wait_for(
                self._read_response(), timeout=30.0
            )
            
            if response and "result" in response:
                return response["result"]
            elif response and "error" in response:
                logger.error(f"MCP error: {response['error']}")
                return None
            return None
            
        except asyncio.TimeoutError:
            logger.error(f"MCP: Timeout waiting for response to {method}")
            return None
        except Exception as e:
            logger.error(f"MCP: Error sending request {method}: {e}")
            return None
    
    async def _send_notification(self, method: str, params: Dict):
        """Send a JSON-RPC notification (no response expected)."""
        if not self.process or self.process.stdin is None:
            return
        
        notification = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        }
        
        message = json.dumps(notification)
        content = f"Content-Length: {len(message.encode())}\r\n\r\n{message}"
        
        try:
            self.process.stdin.write(content.encode())
            await self.process.stdin.drain()
        except Exception as e:
            logger.error(f"MCP: Error sending notification {method}: {e}")
    
    async def _read_response(self) -> Optional[Dict]:
        """Read a JSON-RPC response with Content-Length framing."""
        if not self.process or self.process.stdout is None:
            return None
        
        try:
            # Read headers until we get an empty line
            content_length = 0
            while True:
                line = await self.process.stdout.readline()
                line_str = line.decode().strip()
                
                if not line_str:
                    break
                    
                if line_str.lower().startswith("content-length:"):
                    content_length = int(line_str.split(":")[1].strip())
            
            if content_length > 0:
                body = await self.process.stdout.readexactly(content_length)
                return json.loads(body.decode())
            
            return None
            
        except Exception as e:
            logger.error(f"MCP: Error reading response: {e}")
            return None
    
    async def call_tool(self, tool_name: str, arguments: Dict) -> Optional[Any]:
        """Call a tool on the MCP server."""
        if not self._initialized:
            logger.warning("MCP: Server not initialized.")
            return None
        
        result = await self._send_request("tools/call", {
            "name": tool_name,
            "arguments": arguments
        })
        
        if result and "content" in result:
            # MCP returns content as a list of content blocks
            contents = result["content"]
            text_parts = [c.get("text", "") for c in contents if c.get("type") == "text"]
            return "\n".join(text_parts)
        
        return result
    
    async def execute_dql_query(self, query: str) -> Optional[str]:
        """Execute a DQL query via the MCP server.
        
        This uses the Dynatrace MCP server's DQL tool to query
        metrics, traces, logs, and other data from Dynatrace.
        """
        # The MCP server typically has a tool like "execute-dql-query" or similar
        # Try common tool names
        for tool_name in ["execute-dql-query", "executeDqlQuery", "query_dynatrace"]:
            if any(t["name"] == tool_name for t in self._available_tools):
                return await self.call_tool(tool_name, {"query": query})
        
        # Fallback: try the first available tool that seems related to queries
        for tool in self._available_tools:
            if "query" in tool["name"].lower() or "dql" in tool["name"].lower():
                return await self.call_tool(tool["name"], {"query": query})
        
        logger.warning(f"MCP: No DQL query tool found. Available: {[t['name'] for t in self._available_tools]}")
        return None
    
    async def get_problems(self) -> Optional[str]:
        """Get active problems/alerts from Dynatrace via MCP."""
        for tool_name in ["get-problems", "getProblems", "list_problems"]:
            if any(t["name"] == tool_name for t in self._available_tools):
                return await self.call_tool(tool_name, {})
        
        logger.warning("MCP: No problems tool found.")
        return None
    
    def is_connected(self) -> bool:
        """Check if the MCP server is running and initialized."""
        return (
            self._initialized 
            and self.process is not None 
            and self.process.returncode is None
        )
    
    def get_available_tools(self) -> List[str]:
        """Return names of available MCP tools."""
        return [t["name"] for t in self._available_tools]


# Singleton
mcp_client = DynatraceMCPClient()
