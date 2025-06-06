import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Octokit } from "octokit";
import { GitHubHandler } from "./github-handler";

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = {
  login: string;
  name: string;
  email: string;
  accessToken: string;
};


export class DeepWikiGptMCP extends McpAgent<Env, {}, Props> {
  server = new McpServer({
    name: "DeepWiki GPT MCP Server",
    version: "1.0.0",
  });

  async init() {
    const octokit = new Octokit({ auth: this.props.accessToken });

    // Required "search" tool for ChatGPT connectors 
    // Searches for resources using the provided query string and returns matching results
    this.server.tool(
      "search",
      "Searches for resources using the provided query string and returns matching results.",
      { 
        query: z.string().describe("Search query.")
      },
      async ({ query }) => {
        try {
          // Use GitHub search API to find repositories and files
          const searchResults = await octokit.rest.search.repos({
            q: `user:${this.props.login} ${query}`,
            sort: 'updated',
            per_page: 20
          });

          const results = [];
          
          for (const repo of searchResults.data.items.slice(0, 10)) {
            // Add repository as a result
            results.push({
              id: `repo:${repo.full_name}`,
              title: repo.full_name,
              text: `${repo.description || 'No description'} - Language: ${repo.language || 'Unknown'}, Stars: ${repo.stargazers_count}`,
              url: repo.html_url
            });

            // Search for files within the repository that match the query
            try {
              const fileSearch = await octokit.rest.search.code({
                q: `${query} repo:${repo.full_name}`,
                per_page: 5
              });

              for (const file of fileSearch.data.items) {
                results.push({
                  id: `file:${repo.full_name}:${file.path}`,
                  title: `${file.path} (${repo.full_name})`,
                  text: file.path,
                  url: file.html_url
                });
              }
            } catch (fileSearchError) {
              // File search might fail for various reasons, continue with repo-level results
            }
          }

          // Return results in MCP content format with ChatGPT-compatible structure
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify({ results }, null, 2)
            }],
          };
        } catch (error) {
          // Return empty results on error in MCP format
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify({ results: [] }, null, 2)
            }],
          };
        }
      }
    );

    // Required "fetch" tool for ChatGPT connectors
    // Retrieves detailed content for a specific resource identified by the given ID
    this.server.tool(
      "fetch",
      "Retrieves detailed content for a specific resource identified by the given ID.",
      {
        id: z.string().describe("ID of the resource to fetch.")
      },
      async ({ id }) => {
        try {
          if (id.startsWith('repo:')) {
            // Fetch repository details
            const repoName = id.substring(5); // Remove 'repo:' prefix
            const [owner, repo] = repoName.split('/');
            
            const [repoInfo, readme, contents] = await Promise.allSettled([
              octokit.rest.repos.get({ owner, repo }),
              octokit.rest.repos.getReadme({ owner, repo }),
              octokit.rest.repos.getContent({ owner, repo, path: '' })
            ]);

            let text = '';
            let metadata = {};

            if (repoInfo.status === 'fulfilled') {
              const repoData = repoInfo.value.data;
              metadata = {
                language: repoData.language || 'Unknown',
                stars: repoData.stargazers_count.toString(),
                forks: repoData.forks_count.toString(),
                created: repoData.created_at,
                updated: repoData.updated_at
              };
              
              text += `Repository: ${repoData.full_name}\n`;
              text += `Description: ${repoData.description || 'No description'}\n`;
              text += `Language: ${repoData.language || 'Unknown'}\n`;
              text += `Stars: ${repoData.stargazers_count}\n`;
              text += `Created: ${repoData.created_at}\n\n`;
            }

            if (readme.status === 'fulfilled' && 'content' in readme.value.data) {
              const readmeContent = Buffer.from(readme.value.data.content, 'base64').toString('utf-8');
              text += `README:\n${readmeContent}\n\n`;
            }

            if (contents.status === 'fulfilled' && Array.isArray(contents.value.data)) {
              text += `Files:\n`;
              for (const item of contents.value.data.slice(0, 20)) {
                text += `- ${item.name} (${item.type})\n`;
              }
            }

            // Return object in MCP content format with ChatGPT-compatible structure
            return {
              content: [{ 
                type: "text", 
                text: JSON.stringify({
                  id,
                  title: repoName,
                  text: text.substring(0, 8000),
                  url: `https://github.com/${repoName}`,
                  metadata
                }, null, 2)
              }],
            };

          } else if (id.startsWith('file:')) {
            // Fetch file content
            const parts = id.substring(5).split(':'); // Remove 'file:' prefix
            const repoName = `${parts[0]}/${parts[1]}`;
            const filePath = parts.slice(2).join(':');
            const [owner, repo] = repoName.split('/');

            const fileContent = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: filePath
            });

            if (!Array.isArray(fileContent.data) && 'content' in fileContent.data) {
              const content = Buffer.from(fileContent.data.content, 'base64').toString('utf-8');
              
              // Return object in MCP content format with ChatGPT-compatible structure
              return {
                content: [{ 
                  type: "text", 
                  text: JSON.stringify({
                    id,
                    title: `${filePath} (${repoName})`,
                    text: content,
                    url: `https://github.com/${repoName}/blob/main/${filePath}`,
                    metadata: {
                      size: fileContent.data.size?.toString() || '0',
                      path: filePath,
                      repository: repoName
                    }
                  }, null, 2)
                }],
              };
            } else {
              throw new Error(`${filePath} is a directory or binary file`);
            }
          } else {
            throw new Error(`Unknown resource ID format: ${id}`);
          }
        } catch (error) {
          // Return error object in MCP content format
          return {
            content: [{ 
              type: "text", 
              text: JSON.stringify({
                id,
                title: "Error",
                text: `Error fetching resource: ${error instanceof Error ? error.message : String(error)}`,
                url: null,
                metadata: { error: "true" }
              }, null, 2)
            }],
          };
        }
      }
    );

  }
}

export default new OAuthProvider({
  apiRoute: "/sse",
  apiHandler: DeepWikiGptMCP.mount("/sse") as any,
  defaultHandler: GitHubHandler as any,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
