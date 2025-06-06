import os
from openai import OpenAI  # type: ignore
from dotenv import load_dotenv

# Load environment variables from .env file in the root directory
load_dotenv()

client = OpenAI()

# Get server URL from environment variable
server_url = os.getenv("SERVER_URL_MCP")
if not server_url:
    raise ValueError("SERVER_URL_MCP environment variable is not set. Please check your .env file.")

# Get access token for authentication (if available)
access_token = os.getenv("DEEPWIKI_ACCESS_TOKEN")

# Build the tool configuration
tool_config = {
    "type": "mcp",
    "server_label": "deepwiki",
    "server_url": server_url,
    "require_approval": "never",
}

resp = client.responses.create(
    model="gpt-4.1",
    tools=[tool_config],
    input=(
        "What transport protocols are supported in the 2025-03-26 version of the MCP spec? What transport protocols are supported in the 2025-06-18 version of the MCP spec?"
    ),
)

print(resp.output_text)
