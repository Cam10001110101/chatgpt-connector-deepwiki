import { DeepWikiSearch } from "./deepwiki-data";

// Initialize the DeepWiki search functionality
const deepWikiSearch = new DeepWikiSearch();

// Helper function to truncate text
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  // Try to truncate at a word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

// Handle MCP requests via SSE
async function handleMCPRequest(request: Request): Promise<Response> {
  try {
    const body = await request.json() as any;
    console.log("MCP Request:", JSON.stringify(body, null, 2));
    
    const { method, params, id } = body;
    
    let result: any;
    
    switch (method) {
      case "initialize":
        result = {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "DeepWiki MCP Server",
            version: "1.0.0"
          }
        };
        break;
        
      case "tools/list":
        result = {
          tools: [
            {
              name: "search",
              description: "Searches for resources using the provided query string and returns matching results.",
              inputSchema: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "Search query."
                  }
                },
                required: ["query"],
                additionalProperties: false
              }
            },
            {
              name: "fetch",
              description: "Retrieves detailed content for a specific resource identified by the given ID.",
              inputSchema: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    description: "ID of the resource to fetch."
                  }
                },
                required: ["id"],
                additionalProperties: false
              }
            }
          ]
        };
        break;
        
      case "tools/call":
        const { name, arguments: args } = params;
        
        if (name === "search") {
          const { query } = args;
          console.log(`DeepWiki search query: ${query}`);
          
          // Extract version from query if present
          let version: string | undefined;
          const versionMatch = query.match(/(\d{4}-\d{2}-\d{2})/);
          if (versionMatch) {
            version = versionMatch[1];
          }

          // Search documents
          const documents = deepWikiSearch.search(query, version);
          
          // Convert to MCP search result format
          const results = documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            text: truncateText(doc.content, 500), // Truncate for search results
            url: doc.url || `https://deepwiki.mcpcentral.io/docs/${doc.id}`
          }));

          console.log(`DeepWiki found ${results.length} results for query: ${query}`);

          result = {
            content: [{ 
              type: "text", 
              text: JSON.stringify({ results }, null, 2)
            }],
          };
        } else if (name === "fetch") {
          const { id } = args;
          console.log(`DeepWiki fetch request for ID: ${id}`);
          
          const document = deepWikiSearch.getDocument(id);
          
          if (!document) {
            result = {
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  id,
                  title: "Error",
                  text: `Document with ID ${id} not found`,
                  url: null,
                  metadata: { error: "true" }
                }, null, 2)
              }],
            };
          } else {
            // Return document in MCP content format with ChatGPT-compatible structure
            const docResult = {
              id: document.id,
              title: document.title,
              text: document.content,
              url: document.url || `https://deepwiki.mcpcentral.io/docs/${document.id}`,
              metadata: {
                version: document.metadata.version,
                category: document.metadata.category,
                tags: document.metadata.tags.join(", "),
                last_updated: document.metadata.version // Use version as last updated
              }
            };

            console.log(`DeepWiki successfully fetched document: ${document.title}`);

            result = {
              content: [{ 
                type: "text", 
                text: JSON.stringify(docResult, null, 2)
              }],
            };
          }
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }
        break;
        
      default:
        throw new Error(`Unknown method: ${method}`);
    }
    
    const response = {
      jsonrpc: "2.0",
      id,
      result
    };
    
    console.log("MCP Response:", JSON.stringify(response, null, 2));
    
    // Return as SSE format
    const sseData = `data: ${JSON.stringify(response)}\n\n`;
    
    return new Response(sseData, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
    
  } catch (error) {
    console.error("MCP request error:", error);
    
    const errorResponse = {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : String(error)
      }
    };
    
    const sseData = `data: ${JSON.stringify(errorResponse)}\n\n`;
    
    return new Response(sseData, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }
}

// Export the server for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle SSE endpoint for MCP
    if (url.pathname === '/sse' && request.method === 'POST') {
      return handleMCPRequest(request);
    }
    
    // Handle root path with basic info
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        name: "DeepWiki MCP Server",
        version: "1.0.0",
        description: "MCP server providing access to Model Context Protocol documentation and specifications",
        endpoints: {
          sse: "/sse"
        },
        capabilities: {
          tools: ["search", "fetch"],
          resources: false,
          prompts: false
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
    
    // Handle OPTIONS requests for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

console.log("DeepWiki MCP Server initialized successfully");
