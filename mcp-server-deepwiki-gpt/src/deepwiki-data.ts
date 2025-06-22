// DeepWiki documentation data and search functionality
// This implements the core DeepWiki MCP server functionality

export interface DeepWikiDocument {
  id: string;
  title: string;
  content: string;
  url?: string;
  metadata: {
    version: string;
    category: string;
    tags: string[];
  };
}

export class DeepWikiSearch {
  private documents: DeepWikiDocument[] = [];

  constructor() {
    this.initializeDocuments();
  }

  private initializeDocuments() {
    // Core MCP Protocol Documentation
    this.documents = [
      {
        id: "mcp-overview",
        title: "Model Context Protocol (MCP) Overview",
        content: `The Model Context Protocol (MCP) is an open protocol that enables secure connections between host applications (like Claude Desktop, IDEs, or other AI tools) and external data sources and tools. MCP allows AI assistants to securely access real-time information and perform actions on behalf of users.

Key Features:
- Secure, controlled access to external resources
- Standardized protocol for AI-tool integration
- Support for tools, resources, and prompts
- Built-in authentication and authorization
- Transport-agnostic design (supports stdio, SSE, WebSocket)

MCP consists of three main components:
1. **Hosts**: Applications that want to access external resources (e.g., Claude Desktop)
2. **Clients**: Protocol clients that connect to servers on behalf of hosts
3. **Servers**: Programs that expose specific capabilities to clients

The protocol enables AI assistants to:
- Read files and data from external sources
- Execute tools and commands
- Access real-time information
- Interact with APIs and databases
- Provide dynamic prompts and templates`,
        url: "https://modelcontextprotocol.io/introduction",
        metadata: {
          version: "2024-11-25",
          category: "core",
          tags: ["overview", "introduction", "protocol", "architecture"]
        }
      },
      {
        id: "mcp-architecture",
        title: "MCP Architecture and Components",
        content: `MCP follows a client-server architecture where:

**Hosts and Clients**
- Hosts are applications like Claude Desktop that want to access external capabilities
- Clients implement the MCP protocol to communicate with servers
- One host can connect to multiple servers through separate client instances

**Servers**
- Servers expose capabilities like tools, resources, and prompts
- Each server is a separate process that implements the MCP protocol
- Servers can be written in any language that supports the protocol

**Transport Layer**
- MCP supports multiple transport mechanisms:
  - Standard I/O (stdio): For local processes
  - Server-Sent Events (SSE): For web-based servers
  - WebSocket: For real-time bidirectional communication

**Security Model**
- Servers run in isolated processes
- Hosts control which servers to trust and connect to
- Built-in authentication and authorization mechanisms
- Capability-based security model

**Protocol Messages**
- JSON-RPC 2.0 based messaging
- Request/response and notification patterns
- Standardized error handling
- Capability negotiation during initialization`,
        url: "https://modelcontextprotocol.io/docs/concepts/architecture",
        metadata: {
          version: "2024-11-25",
          category: "architecture",
          tags: ["architecture", "components", "security", "transport"]
        }
      },
      {
        id: "mcp-tools",
        title: "MCP Tools",
        content: `Tools in MCP allow AI assistants to perform actions and execute functions. Tools are exposed by servers and can be called by clients with specific parameters.

**Tool Definition**
Tools are defined with:
- Name: Unique identifier for the tool
- Description: Human-readable description of what the tool does
- Input schema: JSON Schema defining the expected parameters
- Handler function: Implementation that executes when the tool is called

**Tool Categories**
Common tool categories include:
- File operations (read, write, search)
- API interactions (REST calls, database queries)
- System operations (command execution, process management)
- Data processing (transformation, analysis)
- External service integration

**Tool Implementation Example**
\`\`\`typescript
server.tool(
  "search_files",
  "Search for files matching a pattern",
  {
    pattern: z.string().describe("Search pattern"),
    directory: z.string().optional().describe("Directory to search in")
  },
  async ({ pattern, directory = "." }) => {
    // Implementation here
    return {
      content: [{ type: "text", text: "Search results..." }]
    };
  }
);
\`\`\`

**Best Practices**
- Provide clear, descriptive tool names and descriptions
- Use comprehensive input schemas with proper validation
- Handle errors gracefully and return meaningful error messages
- Implement proper security checks and input sanitization
- Return structured, parseable results`,
        url: "https://modelcontextprotocol.io/docs/concepts/tools",
        metadata: {
          version: "2024-11-25",
          category: "tools",
          tags: ["tools", "functions", "implementation", "examples"]
        }
      },
      {
        id: "mcp-resources",
        title: "MCP Resources",
        content: `Resources in MCP represent data sources that can be read by AI assistants. Unlike tools which perform actions, resources provide access to information.

**Resource Types**
- Files: Local or remote files
- Databases: Query results from databases
- APIs: Data from external APIs
- Live data: Real-time information streams
- Generated content: Dynamically created data

**Resource Definition**
Resources are defined with:
- URI: Unique identifier for the resource
- Name: Human-readable name
- Description: What the resource contains
- MIME type: Content type of the resource
- Metadata: Additional information about the resource

**Resource Implementation**
\`\`\`typescript
server.resource(
  "file://logs/{date}",
  "Application logs for a specific date",
  "text/plain",
  async (uri) => {
    const date = extractDateFromUri(uri);
    const logs = await readLogFile(date);
    return {
      contents: [{
        uri,
        mimeType: "text/plain",
        text: logs
      }]
    };
  }
);
\`\`\`

**Resource Discovery**
- Servers can list available resources
- Resources can be templated with parameters
- Clients can subscribe to resource changes
- Support for resource metadata and annotations

**Use Cases**
- Configuration files
- Log files and monitoring data
- Documentation and help content
- Database schemas and data
- API responses and cached data`,
        url: "https://modelcontextprotocol.io/docs/concepts/resources",
        metadata: {
          version: "2024-11-25",
          category: "resources",
          tags: ["resources", "data", "files", "apis"]
        }
      },
      {
        id: "mcp-prompts",
        title: "MCP Prompts",
        content: `Prompts in MCP allow servers to provide reusable prompt templates that can be used by AI assistants. This enables sharing of effective prompts and prompt engineering best practices.

**Prompt Structure**
Prompts consist of:
- Name: Unique identifier
- Description: What the prompt is for
- Arguments: Parameters that can be passed to the prompt
- Messages: The actual prompt content with placeholders

**Prompt Types**
- System prompts: Set the AI's behavior and context
- User prompts: Simulate user input
- Assistant prompts: Provide example responses
- Tool prompts: Guide tool usage

**Prompt Implementation**
\`\`\`typescript
server.prompt(
  "code_review",
  "Perform a code review on the provided code",
  {
    code: z.string().describe("Code to review"),
    language: z.string().describe("Programming language")
  },
  async ({ code, language }) => {
    return {
      messages: [
        {
          role: "system",
          content: {
            type: "text",
            text: \`You are an expert code reviewer. Review the following \${language} code for:\n- Code quality\n- Best practices\n- Potential bugs\n- Performance issues\`
          }
        },
        {
          role: "user",
          content: {
            type: "text",
            text: \`Please review this \${language} code:\n\n\${code}\`
          }
        }
      ]
    };
  }
);
\`\`\`

**Benefits**
- Standardized prompt templates
- Reusable prompt engineering
- Consistent AI behavior across applications
- Easy sharing of effective prompts
- Parameterized prompt generation`,
        url: "https://modelcontextprotocol.io/docs/concepts/prompts",
        metadata: {
          version: "2024-11-25",
          category: "prompts",
          tags: ["prompts", "templates", "ai", "examples"]
        }
      },
      {
        id: "mcp-server-sdk",
        title: "MCP Server SDK",
        content: `The MCP Server SDK provides libraries and tools for building MCP servers in various programming languages.

**Supported Languages**
- TypeScript/JavaScript: @modelcontextprotocol/sdk
- Python: mcp (Python package)
- More languages coming soon

**TypeScript SDK**
\`\`\`bash
npm install @modelcontextprotocol/sdk
\`\`\`

**Basic Server Setup**
\`\`\`typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "my-mcp-server",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// Add tools, resources, prompts here

const transport = new StdioServerTransport();
await server.connect(transport);
\`\`\`

**Python SDK**
\`\`\`bash
pip install mcp
\`\`\`

\`\`\`python
from mcp.server import Server
from mcp.server.stdio import stdio_server

app = Server("my-mcp-server")

@app.tool()
def my_tool(arg: str) -> str:
    return f"Hello {arg}"

if __name__ == "__main__":
    stdio_server(app)
\`\`\`

**Key Features**
- Type-safe APIs
- Built-in transport handling
- Automatic protocol compliance
- Error handling and validation
- Development tools and debugging`,
        url: "https://modelcontextprotocol.io/docs/tools/sdks",
        metadata: {
          version: "2024-11-25",
          category: "sdk",
          tags: ["sdk", "development", "typescript", "python"]
        }
      },
      {
        id: "mcp-client-integration",
        title: "MCP Client Integration",
        content: `Integrating MCP clients allows applications to connect to and use MCP servers.

**Client SDK**
The client SDK provides tools for connecting to MCP servers:

\`\`\`typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "my-mcp-server",
  args: []
});

const client = new Client({
  name: "my-client",
  version: "1.0.0"
}, {
  capabilities: {}
});

await client.connect(transport);

// List available tools
const tools = await client.listTools();

// Call a tool
const result = await client.callTool({
  name: "search_files",
  arguments: { pattern: "*.ts" }
});
\`\`\`

**Transport Options**
- **Stdio**: For local command-line servers
- **SSE**: For web-based servers
- **WebSocket**: For real-time servers

**Error Handling**
\`\`\`typescript
try {
  const result = await client.callTool({
    name: "my_tool",
    arguments: { param: "value" }
  });
} catch (error) {
  if (error instanceof McpError) {
    console.error("MCP Error:", error.code, error.message);
  }
}
\`\`\`

**Best Practices**
- Always handle connection errors
- Implement proper cleanup on disconnect
- Use appropriate transport for your use case
- Validate server capabilities before use
- Implement retry logic for network transports`,
        url: "https://modelcontextprotocol.io/docs/tools/clients",
        metadata: {
          version: "2024-11-25",
          category: "client",
          tags: ["client", "integration", "transport", "connection"]
        }
      },
      {
        id: "mcp-security",
        title: "MCP Security Model",
        content: `MCP implements a comprehensive security model to ensure safe interaction between hosts, clients, and servers.

**Isolation**
- Servers run in separate processes
- No direct memory access between components
- Process-level isolation prevents interference

**Authentication**
- Optional authentication mechanisms
- Support for API keys, tokens, and certificates
- Configurable per-server authentication

**Authorization**
- Capability-based access control
- Servers declare their capabilities
- Hosts control which capabilities to allow

**Input Validation**
- JSON Schema validation for all inputs
- Type checking and sanitization
- Protection against injection attacks

**Transport Security**
- TLS support for network transports
- Encrypted communication channels
- Certificate validation

**Best Practices**
- Run servers with minimal privileges
- Validate all inputs thoroughly
- Use secure transport mechanisms
- Implement proper error handling
- Regular security audits and updates
- Principle of least privilege
- Secure credential storage

**Threat Model**
MCP protects against:
- Malicious server code execution
- Data exfiltration
- Privilege escalation
- Network-based attacks
- Input validation bypasses

**Configuration Security**
- Secure server configuration
- Environment variable protection
- Credential management
- Access control lists`,
        url: "https://modelcontextprotocol.io/docs/concepts/security",
        metadata: {
          version: "2024-11-25",
          category: "security",
          tags: ["security", "authentication", "authorization", "isolation"]
        }
      },
      {
        id: "mcp-examples",
        title: "MCP Implementation Examples",
        content: `Practical examples of MCP server implementations for common use cases.

**File System Server**
\`\`\`typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";
import * as fs from "fs/promises";

const server = new Server({
  name: "filesystem-server",
  version: "1.0.0"
});

server.tool(
  "read_file",
  "Read contents of a file",
  {
    path: z.string().describe("File path to read")
  },
  async ({ path }) => {
    try {
      const content = await fs.readFile(path, "utf-8");
      return {
        content: [{ type: "text", text: content }]
      };
    } catch (error) {
      throw new Error(\`Failed to read file: \${error.message}\`);
    }
  }
);
\`\`\`

**Database Server**
\`\`\`typescript
server.tool(
  "query_database",
  "Execute SQL query",
  {
    query: z.string().describe("SQL query to execute"),
    params: z.array(z.any()).optional().describe("Query parameters")
  },
  async ({ query, params = [] }) => {
    const result = await db.query(query, params);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
);
\`\`\`

**API Integration Server**
\`\`\`typescript
server.tool(
  "fetch_weather",
  "Get weather information",
  {
    location: z.string().describe("Location to get weather for")
  },
  async ({ location }) => {
    const response = await fetch(
      \`https://api.weather.com/v1/current?location=\${location}\`
    );
    const data = await response.json();
    return {
      content: [{
        type: "text",
        text: \`Weather in \${location}: \${data.temperature}°F, \${data.conditions}\`
      }]
    };
  }
);
\`\`\`

**Resource Example**
\`\`\`typescript
server.resource(
  "config://app.json",
  "Application configuration",
  "application/json",
  async () => {
    const config = await loadConfig();
    return {
      contents: [{
        uri: "config://app.json",
        mimeType: "application/json",
        text: JSON.stringify(config, null, 2)
      }]
    };
  }
);
\`\`\``,
        url: "https://modelcontextprotocol.io/docs/examples",
        metadata: {
          version: "2024-11-25",
          category: "examples",
          tags: ["examples", "implementation", "filesystem", "database", "api"]
        }
      },
      {
        id: "mcp-deployment",
        title: "MCP Server Deployment",
        content: `Guidelines for deploying MCP servers in production environments.

**Local Deployment**
For stdio-based servers:
\`\`\`json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["path/to/server.js"]
    }
  }
}
\`\`\`

**Web Deployment**
For SSE-based servers:
- Deploy to cloud platforms (Vercel, Netlify, AWS)
- Configure CORS headers
- Implement proper error handling
- Use environment variables for configuration

**Docker Deployment**
\`\`\`dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
\`\`\`

**Environment Configuration**
\`\`\`bash
# .env file
DATABASE_URL=postgresql://user:pass@localhost/db
API_KEY=your-api-key
LOG_LEVEL=info
\`\`\`

**Monitoring and Logging**
- Implement structured logging
- Monitor server health and performance
- Set up error tracking and alerting
- Use metrics for capacity planning

**Scaling Considerations**
- Stateless server design
- Connection pooling for databases
- Caching strategies
- Load balancing for multiple instances

**Security in Production**
- Use HTTPS for web deployments
- Implement rate limiting
- Secure credential management
- Regular security updates
- Network security and firewalls`,
        url: "https://modelcontextprotocol.io/docs/deployment",
        metadata: {
          version: "2024-11-25",
          category: "deployment",
          tags: ["deployment", "production", "docker", "scaling", "monitoring"]
        }
      }
    ];
  }

  search(query: string, version?: string): DeepWikiDocument[] {
    const searchTerms = query.toLowerCase().split(/\s+/);
    
    let results = this.documents.filter(doc => {
      // Version filtering
      if (version && doc.metadata.version !== version) {
        return false;
      }
      
      // Text search in title, content, and tags
      const searchText = `${doc.title} ${doc.content} ${doc.metadata.tags.join(' ')}`.toLowerCase();
      
      return searchTerms.some(term => 
        searchText.includes(term) ||
        doc.metadata.category.includes(term)
      );
    });

    // Sort by relevance (simple scoring based on term matches)
    results.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a, searchTerms);
      const scoreB = this.calculateRelevanceScore(b, searchTerms);
      return scoreB - scoreA;
    });

    return results.slice(0, 10); // Return top 10 results
  }

  getDocument(id: string): DeepWikiDocument | null {
    return this.documents.find(doc => doc.id === id) || null;
  }

  private calculateRelevanceScore(doc: DeepWikiDocument, searchTerms: string[]): number {
    let score = 0;
    const title = doc.title.toLowerCase();
    const content = doc.content.toLowerCase();
    const tags = doc.metadata.tags.join(' ').toLowerCase();
    
    searchTerms.forEach(term => {
      // Title matches are worth more
      if (title.includes(term)) score += 10;
      
      // Tag matches are worth more than content
      if (tags.includes(term)) score += 5;
      
      // Content matches
      const contentMatches = (content.match(new RegExp(term, 'g')) || []).length;
      score += contentMatches;
    });
    
    return score;
  }

  getAllDocuments(): DeepWikiDocument[] {
    return [...this.documents];
  }

  getCategories(): string[] {
    return [...new Set(this.documents.map(doc => doc.metadata.category))];
  }

  getDocumentsByCategory(category: string): DeepWikiDocument[] {
    return this.documents.filter(doc => doc.metadata.category === category);
  }
}
