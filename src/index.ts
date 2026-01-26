import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { HttpGraphQLClient } from "./utils/graphql-client";
import { IntrospectionHandler } from "./handlers/introspection";
import { QueryExecutionHandler } from "./handlers/query-execution";
import { MCPConfig } from "./types/config";

// Default configuration - will be replaced by environment configuration in later tasks
const defaultConfig: MCPConfig = {
  endpoint: process.env.ENDPOINT || "http://localhost:8000/graphql",
  headers: {},
  allowMutations: process.env.ALLOW_MUTATIONS === "true",
  name: process.env.NAME || "django-graphql-mcp-server",
};

const server = new Server({
  name: defaultConfig.name,
  version: "1.0.0",
});

// Initialize GraphQL client and handlers
const graphqlClient = new HttpGraphQLClient(
  defaultConfig.endpoint,
  defaultConfig.headers,
);
const introspectionHandler = new IntrospectionHandler(graphqlClient);
const queryExecutionHandler = new QueryExecutionHandler(
  graphqlClient,
  defaultConfig.allowMutations,
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "introspect_graphql_schema",
        description:
          "Fetch the complete GraphQL schema from your Django backend",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "execute_graphql_query",
        description:
          "Execute GraphQL queries/mutations against your Django backend",
        inputSchema: {
          type: "object",
          properties: {
            query_string: {
              type: "string",
              description: "Valid GraphQL query or mutation",
            },
            variables: {
              type: "object",
              description: "Query variables (optional)",
            },
          },
          required: ["query_string"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "introspect_graphql_schema":
        const introspectionResult = await introspectionHandler.handle();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(introspectionResult, null, 2),
            },
          ],
        };

      case "execute_graphql_query":
        if (!args || typeof args !== "object") {
          throw new Error("Invalid arguments for execute_graphql_query");
        }

        const queryResult = await queryExecutionHandler.handle(
          args as {
            query_string: string;
            variables?: Record<string, any>;
          },
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(queryResult, null, 2),
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log server startup (to stderr to avoid interfering with stdio transport)
  console.error(`Django GraphQL MCP Server started`);
  console.error(`Endpoint: ${defaultConfig.endpoint}`);
  console.error(`Mutations allowed: ${defaultConfig.allowMutations}`);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
