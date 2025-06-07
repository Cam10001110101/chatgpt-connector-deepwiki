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

const ALLOWED_USERNAMES = new Set<string>([
  // Add GitHub usernames of users who should have access to the image generation tool
  // For example: 'yourusername', 'coworkerusername'
]);

export class DeepWikiGptMCP extends McpAgent<Env, {}, Props> {
  server = new McpServer({
    name: "DeepWiki GPT MCP Server",
    version: "1.0.0",
  });

  async init() {
    const octokit = new Octokit({ auth: this.props.accessToken });

    // Read repository wiki structure and files
    this.server.tool(
      "read_wiki_structure", 
      "Get the structure and key files of a GitHub repository for analysis",
      { 
        repoName: z.string().describe("GitHub repository: owner/repo (e.g. \"facebook/react\")") 
      }, 
      async ({ repoName }) => {
        try {
          const [owner, repo] = repoName.split('/');
          if (!owner || !repo) {
            throw new Error("Invalid repository format. Use 'owner/repo'");
          }

          // Get repository info
          const repoInfo = await octokit.rest.repos.get({ owner, repo });
          
          // Get repository contents (top-level)
          const contents = await octokit.rest.repos.getContent({ owner, repo, path: '' });
          
          // Get README if it exists
          let readmeContent = '';
          try {
            const readme = await octokit.rest.repos.getReadme({ owner, repo });
            if ('content' in readme.data) {
              readmeContent = Buffer.from(readme.data.content, 'base64').toString('utf-8');
            }
          } catch (e) {
            readmeContent = 'No README found';
          }

          // Format the response
          const structure = {
            repository: {
              name: repoInfo.data.full_name,
              description: repoInfo.data.description,
              language: repoInfo.data.language,
              stars: repoInfo.data.stargazers_count,
              forks: repoInfo.data.forks_count,
              created_at: repoInfo.data.created_at,
              updated_at: repoInfo.data.updated_at,
            },
            files: Array.isArray(contents.data) ? contents.data.map(item => ({
              name: item.name,
              type: item.type,
              size: item.size,
            })) : [],
            readme: readmeContent.substring(0, 4000) // Limit README length
          };

          return {
            content: [{ type: "text", text: JSON.stringify(structure, null, 2) }],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error reading repository: ${error instanceof Error ? error.message : String(error)}` }],
          };
        }
      }
    );

    // Ask questions about a repository
    this.server.tool(
      "ask_question",
      "Ask questions about a GitHub repository and get detailed answers based on the repository content",
      {
        repoName: z.string().describe("GitHub repository: owner/repo (e.g. \"facebook/react\")"),
        question: z.string().describe("The question to ask about the repository")
      },
      async ({ repoName, question }) => {
        try {
          const [owner, repo] = repoName.split('/');
          if (!owner || !repo) {
            throw new Error("Invalid repository format. Use 'owner/repo'");
          }

          // Get repository info and README for context
          const [repoInfo, readme] = await Promise.allSettled([
            octokit.rest.repos.get({ owner, repo }),
            octokit.rest.repos.getReadme({ owner, repo })
          ]);

          let context = `Repository: ${repoName}\n`;
          
          if (repoInfo.status === 'fulfilled') {
            const repo = repoInfo.value.data;
            context += `Description: ${repo.description || 'No description'}\n`;
            context += `Language: ${repo.language || 'Unknown'}\n`;
            context += `Stars: ${repo.stargazers_count}\n`;
            context += `Created: ${repo.created_at}\n`;
          }

          if (readme.status === 'fulfilled' && 'content' in readme.value.data) {
            const readmeContent = Buffer.from(readme.value.data.content, 'base64').toString('utf-8');
            context += `\nREADME:\n${readmeContent.substring(0, 3000)}...\n`;
          }

          // For now, provide a structured response based on available data
          // In a full DeepWiki implementation, this would use AI to analyze the codebase
          const response = `Based on the repository ${repoName}:

Question: ${question}

Context: ${context}

Note: This is a simplified implementation. For detailed code analysis and answers about specific implementation details, you would need to implement additional repository crawling and AI analysis capabilities.`;

          return {
            content: [{ type: "text", text: response }],
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error analyzing repository: ${error instanceof Error ? error.message : String(error)}` }],
          };
        }
      }
    );

    // Get specific file content from a repository
    this.server.tool(
      "read_file_content",
      "Read the content of a specific file from a GitHub repository",
      {
        repoName: z.string().describe("GitHub repository: owner/repo (e.g. \"facebook/react\")"),
        filePath: z.string().describe("Path to the file in the repository (e.g. 'src/index.js')")
      },
      async ({ repoName, filePath }) => {
        try {
          const [owner, repo] = repoName.split('/');
          if (!owner || !repo) {
            throw new Error("Invalid repository format. Use 'owner/repo'");
          }

          const fileContent = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: filePath
          });

          if (!Array.isArray(fileContent.data) && 'content' in fileContent.data) {
            const content = Buffer.from(fileContent.data.content, 'base64').toString('utf-8');
            return {
              content: [{ 
                type: "text", 
                text: `File: ${repoName}/${filePath}\n\n${content.substring(0, 8000)}${content.length > 8000 ? '...(truncated)' : ''}` 
              }],
            };
          } else {
            return {
              content: [{ type: "text", text: `${filePath} is a directory or binary file` }],
            };
          }
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error reading file: ${error instanceof Error ? error.message : String(error)}` }],
          };
        }
      }
    );

    // Get user info (keep this for authentication verification)
    this.server.tool("get_user_info", "Get authenticated GitHub user information", {}, async () => {
      try {
        const user = await octokit.rest.users.getAuthenticated();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                login: user.data.login,
                name: user.data.name,
                email: user.data.email,
                public_repos: user.data.public_repos,
                followers: user.data.followers,
                following: user.data.following
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting user info: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    });

    // Dynamically add tools based on the user's login. In this case, I want to limit
    // access to my Image Generation tool to just me
    if (ALLOWED_USERNAMES.has(this.props.login)) {
      this.server.tool(
        "generateImage",
        "Generate an image using the `flux-1-schnell` model. Works best with 8 steps.",
        {
          prompt: z.string().describe("A text description of the image you want to generate."),
          steps: z
            .number()
            .min(4)
            .max(8)
            .default(4)
            .describe(
              "The number of diffusion steps; higher values can improve quality but take longer. Must be between 4 and 8, inclusive.",
            ),
        },
        async ({ prompt, steps }) => {
          const response = await this.env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
            prompt,
            steps,
          });

          return {
            content: [{ type: "image", data: response.image!, mimeType: "image/jpeg" }],
          };
        },
      );
    }
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
