# GitHub MCP Server with OAuth

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that provides GitHub repository search and content retrieval capabilities through secure OAuth authentication.

## Overview

This MCP server integrates with GitHub to provide:
- **Repository search**: Search through your GitHub repositories
- **File content retrieval**: Fetch and read file contents from repositories
- **OAuth authentication**: Secure access using GitHub OAuth

The server is deployed on [Cloudflare Workers](https://developers.cloudflare.com/workers/) and uses the [`workers-oauth-provider` library](https://github.com/cloudflare/workers-oauth-provider) to handle OAuth flows.

## Features

### MCP Tools

1. **`search`** - Search GitHub repositories and files
   - Searches repositories owned by the authenticated user
   - Returns repository information and matching files
   - Compatible with ChatGPT's MCP search requirements

2. **`fetch`** - Retrieve detailed content
   - Fetch repository details including README
   - Retrieve file contents from repositories
   - Compatible with ChatGPT's MCP fetch requirements

## Project Structure

- `mcp-server-deepwiki-gpt/` - Main MCP server implementation
  - `src/` - TypeScript source code
  - `wrangler.jsonc` - Cloudflare Worker configuration
- `test/` - Python test client for DeepWiki MCP testing

## Getting Started

### Prerequisites
- Node.js and npm installed
- Cloudflare account
- GitHub account for OAuth

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/chatgpt-connector-deepwiki.git
   cd chatgpt-connector-deepwiki/mcp-server-deepwiki-gpt
   npm install
   ```

2. Copy the configuration templates:
   ```bash
   cp wrangler.jsonc.example wrangler.jsonc
   cp .dev.vars.example .dev.vars
   ```

3. Create a KV namespace for OAuth storage:
   ```bash
   wrangler kv:namespace create "OAUTH_KV"
   ```
   Copy the generated namespace ID and update it in `wrangler.jsonc`.

## Production Deployment

### 1. GitHub OAuth App Setup

Create a new [GitHub OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) with these settings:
- **Application name**: Your MCP Server (or any name you prefer)
- **Homepage URL**: `https://your-worker-name.your-subdomain.workers.dev`
- **Authorization callback URL**: `https://your-worker-name.your-subdomain.workers.dev/callback`

Save your Client ID and generate a Client Secret.

### 2. Configure Cloudflare Secrets
```bash
wrangler secret put GITHUB_CLIENT_ID
# Enter your GitHub OAuth App Client ID

wrangler secret put GITHUB_CLIENT_SECRET
# Enter your GitHub OAuth App Client Secret

wrangler secret put COOKIE_ENCRYPTION_KEY
# Enter a random string (e.g., generate with: openssl rand -hex 32)
```

### 3. Update Configuration

Edit `wrangler.jsonc`:
- Set your `name` (this becomes your worker subdomain)
- Ensure the KV namespace ID is correct
- Set your Cloudflare account ID

### 4. Deploy
```bash
wrangler deploy
```

Your MCP server will be available at:
`https://your-worker-name.your-subdomain.workers.dev/sse`

### 5. Test Your Deployment

Use [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector):
```bash
npx @modelcontextprotocol/inspector@latest
```
Enter your server URL and complete the OAuth flow to test the tools.

## Access Control

All authenticated GitHub users can access:
- `search` - Search repositories and files
- `fetch` - Retrieve content

The server only provides GitHub repository search and content retrieval functionality. No additional access controls are needed.

## Connecting MCP Clients

### Claude Desktop

1. Open Claude Desktop
2. Navigate to Settings → Developer → Edit Config
3. Add your server configuration:

```json
{
  "mcpServers": {
    "github-mcp": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-worker-name.your-subdomain.workers.dev/sse"
      ]
    }
  }
}
```

4. Save and restart Claude Desktop
5. Complete OAuth authentication when prompted
6. Look for the tools under the 🔨 icon

### Other MCP Clients

For clients like Cursor or Windsurf, use the command:
```
npx mcp-remote https://your-worker-name.your-subdomain.workers.dev/sse
```

## Local Development

### 1. Create a Development OAuth App

Create a separate GitHub OAuth App for local testing:
- **Homepage URL**: `http://localhost:8788`
- **Authorization callback URL**: `http://localhost:8788/callback`

### 2. Configure Local Environment

Create `.dev.vars` in the project root:
```
GITHUB_CLIENT_ID=your_dev_client_id
GITHUB_CLIENT_SECRET=your_dev_client_secret
COOKIE_ENCRYPTION_KEY=any_random_string_for_dev
```

### 3. Run Locally
```bash
wrangler dev
```

Your local server will be available at `http://localhost:8788/sse`

## Test Directory

The `test/` directory contains Python client examples for testing MCP servers with OpenAI:

```bash
# Install dependencies using uv
uv sync

# Test the public DeepWiki MCP server (no authentication)
uv run python test/client-test.py

# Test your authenticated GitHub MCP server
uv run python test/github-mcp-test.py

# Compare both server types
uv run python test/compare-servers.py

# Test with authentication support
uv run python test/client-test-authenticated.py
```

**Configuration**: Copy `.env.example` to `.env` and fill in your actual values:
- `OPENAI_API_KEY`: Your OpenAI API key
- `GITHUB_MCP_SERVER_URL`: Your deployed Cloudflare Worker URL
- `GITHUB_ACCESS_TOKEN`: Your GitHub Personal Access Token

**Note**: The key difference between public and authenticated MCP servers is the addition of authentication headers in the tool configuration.

## Troubleshooting

### Common Issues

1. **OAuth errors**: Ensure your GitHub OAuth App URLs exactly match your worker URLs
2. **KV namespace errors**: Verify the namespace ID in `wrangler.jsonc` matches the created namespace
3. **Tool visibility**: Tools may take a moment to appear in Claude Desktop after authentication

### Debug Tips

- Check Cloudflare Worker logs: `wrangler tail`
- Verify OAuth app settings in GitHub
- Test with MCP Inspector before connecting to Claude

## Architecture

### OAuth Flow
1. MCP client requests connection to `/sse`
2. Server redirects to GitHub OAuth
3. User authorizes the app
4. GitHub redirects back with auth code
5. Server exchanges code for access token
6. Token is encrypted and stored in KV
7. SSE connection established with auth context

### Tool Implementation
- Tools are defined in `src/index.ts`
- Each tool uses the GitHub Octokit API
- Responses follow MCP content format
- User context available via `this.props`

## Documentation

- [Model Context Protocol](https://modelcontextprotocol.io/introduction)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps)
- [OpenAI MCP Integration](https://platform.openai.com/docs/guides/tools-remote-mcp)

## License

This project is provided as-is for reference and educational purposes.
