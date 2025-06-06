import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { Octokit } from "octokit";
import { fetchUpstreamAuthToken, getUpstreamAuthorizeUrl, Props } from "./utils";
import { env } from "cloudflare:workers";
import { clientIdAlreadyApproved, parseRedirectApproval, renderApprovalDialog } from "./workers-oauth-utils";

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();

app.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  const { clientId } = oauthReqInfo;
  if (!clientId) {
    return c.text("Invalid request", 400);
  }

  if (await clientIdAlreadyApproved(c.req.raw, oauthReqInfo.clientId, env.COOKIE_ENCRYPTION_KEY)) {
    return redirectToGithub(c.req.raw, oauthReqInfo);
  }

  return renderApprovalDialog(c.req.raw, {
    client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
    server: {
      name: "DeepWiki GPT MCP Server",
      logo: "https://avatars.githubusercontent.com/u/314135?s=200&v=4",
      description: "MCP Server for DeepWiki integration with ChatGPT using GitHub authentication.", // optional
    },
    state: { oauthReqInfo }, // arbitrary data that flows through the form submission below
  });
});

app.post("/authorize", async (c) => {
  // Validates form submission, extracts state, and generates Set-Cookie headers to skip approval dialog next time
  const { state, headers } = await parseRedirectApproval(c.req.raw, env.COOKIE_ENCRYPTION_KEY);
  if (!state.oauthReqInfo) {
    return c.text("Invalid request", 400);
  }

  return redirectToGithub(c.req.raw, state.oauthReqInfo, headers);
});

async function redirectToGithub(request: Request, oauthReqInfo: AuthRequest, headers: Record<string, string> = {}) {
  return new Response(null, {
    status: 302,
    headers: {
      ...headers,
      location: getUpstreamAuthorizeUrl({
        upstream_url: "https://github.com/login/oauth/authorize",
        scope: "read:user",
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: new URL("/callback", request.url).href,
        state: btoa(JSON.stringify(oauthReqInfo)),
      }),
    },
  });
}

/**
 * OAuth Callback Endpoint
 *
 * This route handles the callback from GitHub after user authentication.
 * It exchanges the temporary code for an access token, then stores some
 * user metadata & the auth token as part of the 'props' on the token passed
 * down to the client. It ends by redirecting the client back to _its_ callback URL
 */
app.get("/callback", async (c) => {
  try {
    const state = c.req.query("state");
    const code = c.req.query("code");
    
    if (!state) {
      console.error("Missing state parameter");
      return c.text("Missing state parameter", 400);
    }
    
    if (!code) {
      console.error("Missing code parameter");
      return c.text("Missing code parameter", 400);
    }

    // Try to decode the state parameter
    let oauthReqInfo: AuthRequest;
    try {
      const decodedState = atob(state);
      oauthReqInfo = JSON.parse(decodedState) as AuthRequest;
    } catch (error) {
      console.error("Failed to decode state parameter:", error);
      console.error("State value:", state);
      
      // Try URL decoding first, then base64 decoding
      try {
        const urlDecodedState = decodeURIComponent(state);
        const decodedState = atob(urlDecodedState);
        oauthReqInfo = JSON.parse(decodedState) as AuthRequest;
      } catch (secondError) {
        console.error("Failed to decode state parameter after URL decode:", secondError);
        return c.text("Invalid state parameter format", 400);
      }
    }
    
    if (!oauthReqInfo.clientId) {
      console.error("Missing clientId in oauthReqInfo:", oauthReqInfo);
      return c.text("Invalid state: missing clientId", 400);
    }

    // Exchange the code for an access token
    const [accessToken, errResponse] = await fetchUpstreamAuthToken({
      upstream_url: "https://github.com/login/oauth/access_token",
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code: code,
      redirect_uri: new URL("/callback", c.req.url).href,
    });
    if (errResponse) {
      console.error("Failed to fetch access token");
      return errResponse;
    }

    // Fetch the user info from GitHub
    const user = await new Octokit({ auth: accessToken }).rest.users.getAuthenticated();
    const { login, name, email } = user.data;

    // Return back to the MCP client a new token
    const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
      request: oauthReqInfo,
      userId: login,
      metadata: {
        label: name,
      },
      scope: oauthReqInfo.scope,
      // This will be available on this.props inside DeepWikiGptMCP
      props: {
        login,
        name,
        email,
        accessToken,
      } as Props,
    });

    return Response.redirect(redirectTo);
  } catch (error) {
    console.error("Callback error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.text(`Callback error: ${errorMessage}`, 500);
  }
});

// Add a debug endpoint to test GitHub OAuth configuration
app.get("/debug/oauth-config", async (c) => {
  const baseUrl = new URL(c.req.url).origin;
  const redirectUri = new URL("/callback", baseUrl).href;
  
  return c.json({
    githubClientId: c.env.GITHUB_CLIENT_ID ? "✅ Set" : "❌ Missing",
    githubClientSecret: c.env.GITHUB_CLIENT_SECRET ? "✅ Set" : "❌ Missing",
    redirectUri: redirectUri,
    message: `Make sure this redirect URI is registered in your GitHub OAuth app: ${redirectUri}`
  });
});

export { app as GitHubHandler };
