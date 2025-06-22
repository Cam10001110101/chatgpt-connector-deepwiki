#!/usr/bin/env python3
"""
Test script for the DeepWiki MCP Server
Tests the search and fetch functionality via SSE transport
"""

import asyncio
import json
import aiohttp
import sys
from typing import Dict, Any

class MCPTestClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = None
        self.request_id = 1
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def get_next_id(self) -> int:
        current_id = self.request_id
        self.request_id += 1
        return current_id
    
    async def send_mcp_request(self, method: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Send an MCP request via SSE"""
        if params is None:
            params = {}
        
        request_data = {
            "jsonrpc": "2.0",
            "id": self.get_next_id(),
            "method": method,
            "params": params
        }
        
        try:
            async with self.session.post(
                f"{self.base_url}/sse",
                json=request_data,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream"
                }
            ) as response:
                if response.status != 200:
                    print(f"HTTP Error: {response.status}")
                    text = await response.text()
                    print(f"Response: {text}")
                    return {"error": f"HTTP {response.status}"}
                
                # Read the SSE response
                content = await response.text()
                print(f"Raw SSE Response: {content}")
                
                # Parse SSE format
                lines = content.strip().split('\n')
                for line in lines:
                    if line.startswith('data: '):
                        data_str = line[6:]  # Remove 'data: ' prefix
                        try:
                            return json.loads(data_str)
                        except json.JSONDecodeError as e:
                            print(f"JSON decode error: {e}")
                            print(f"Data string: {data_str}")
                            return {"error": "Invalid JSON response"}
                
                return {"error": "No data found in SSE response"}
                
        except Exception as e:
            print(f"Request error: {e}")
            return {"error": str(e)}
    
    async def test_initialize(self):
        """Test MCP initialization"""
        print("Testing MCP initialization...")
        response = await self.send_mcp_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {}
            },
            "clientInfo": {
                "name": "test-client",
                "version": "1.0.0"
            }
        })
        print(f"Initialize response: {json.dumps(response, indent=2)}")
        return response
    
    async def test_list_tools(self):
        """Test listing available tools"""
        print("\nTesting tools/list...")
        response = await self.send_mcp_request("tools/list")
        print(f"Tools list response: {json.dumps(response, indent=2)}")
        return response
    
    async def test_search_tool(self, query: str):
        """Test the search tool"""
        print(f"\nTesting search tool with query: '{query}'...")
        response = await self.send_mcp_request("tools/call", {
            "name": "search",
            "arguments": {
                "query": query
            }
        })
        print(f"Search response: {json.dumps(response, indent=2)}")
        return response
    
    async def test_fetch_tool(self, doc_id: str):
        """Test the fetch tool"""
        print(f"\nTesting fetch tool with ID: '{doc_id}'...")
        response = await self.send_mcp_request("tools/call", {
            "name": "fetch",
            "arguments": {
                "id": doc_id
            }
        })
        print(f"Fetch response: {json.dumps(response, indent=2)}")
        return response

async def main():
    base_url = "http://localhost:8788"
    
    async with MCPTestClient(base_url) as client:
        # Test initialization
        init_response = await client.test_initialize()
        if "error" in init_response:
            print("Initialization failed, continuing with tool tests...")
        
        # Test listing tools
        tools_response = await client.test_list_tools()
        
        # Test search functionality
        search_response = await client.test_search_tool("MCP protocol")
        
        # If search returned results, test fetch with the first result
        if "result" in search_response and "content" in search_response["result"]:
            try:
                content_text = search_response["result"]["content"][0]["text"]
                search_results = json.loads(content_text)
                if "results" in search_results and len(search_results["results"]) > 0:
                    first_result_id = search_results["results"][0]["id"]
                    await client.test_fetch_tool(first_result_id)
                else:
                    print("No search results found to test fetch with")
            except (json.JSONDecodeError, KeyError, IndexError) as e:
                print(f"Could not parse search results for fetch test: {e}")
        
        # Test fetch with a known document ID
        await client.test_fetch_tool("mcp-overview")

if __name__ == "__main__":
    asyncio.run(main())
