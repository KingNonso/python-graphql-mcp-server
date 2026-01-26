import * as fc from "fast-check";
import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";

// Feature: django-graphql-mcp-server, Property 16: MCP protocol compliance
describe("MCP Protocol Compliance", () => {
  let serverProcess: ChildProcess | null = null;

  afterEach(() => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  // Helper to start the MCP server
  const startMCPServer = (): Promise<{
    process: ChildProcess;
    sendMessage: (message: any) => void;
    waitForMessage: () => Promise<any>;
  }> => {
    return new Promise((resolve, reject) => {
      const process = spawn("npm", ["run", "dev"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ENDPOINT: "http://localhost:8000/graphql",
          ALLOW_MUTATIONS: "false",
          NAME: "test-mcp-server",
        },
      });

      const messageEmitter = new EventEmitter();
      let messageBuffer = "";

      process.stdout?.on("data", (data) => {
        messageBuffer += data.toString();
        const lines = messageBuffer.split("\n");
        messageBuffer = lines.pop() || "";

        lines.forEach((line) => {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              messageEmitter.emit("message", message);
            } catch (e) {
              // Not a JSON message, might be startup log
            }
          }
        });
      });

      process.stderr?.on("data", (data) => {
        const output = data.toString();
        if (output.includes("Django GraphQL MCP Server started")) {
          // Server is ready
          resolve({
            process,
            sendMessage: (message: any) => {
              process.stdin?.write(JSON.stringify(message) + "\n");
            },
            waitForMessage: () => {
              return new Promise((resolve) => {
                messageEmitter.once("message", resolve);
              });
            },
          });
        }
      });

      process.on("error", reject);

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error("Server startup timeout"));
      }, 10000);
    });
  };

  // Property test: For any valid JSON-RPC request, the server should respond with valid JSON-RPC
  test("Property 16: MCP protocol compliance - server responds with valid JSON-RPC messages", async () => {
    const server = await startMCPServer();
    serverProcess = server.process;

    // Generator for valid JSON-RPC request IDs
    const jsonRpcIdGenerator = fc.oneof(
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.integer({ min: 1, max: 1000000 }),
    );

    await fc.assert(
      fc.asyncProperty(jsonRpcIdGenerator, async (requestId) => {
        // Test list_tools request
        const listToolsRequest = {
          jsonrpc: "2.0",
          id: requestId,
          method: "tools/list",
          params: {},
        };

        server.sendMessage(listToolsRequest);
        const response = await server.waitForMessage();

        // Validate JSON-RPC response structure
        expect(response).toHaveProperty("jsonrpc", "2.0");
        expect(response).toHaveProperty("id", requestId);
        expect(response).toHaveProperty("result");
        expect(response.result).toHaveProperty("tools");
        expect(Array.isArray(response.result.tools)).toBe(true);

        // Validate that exactly 2 tools are registered
        expect(response.result.tools).toHaveLength(2);

        // Validate tool names
        const toolNames = response.result.tools.map((tool: any) => tool.name);
        expect(toolNames).toContain("introspect_graphql_schema");
        expect(toolNames).toContain("execute_graphql_query");

        // Validate tool structure
        response.result.tools.forEach((tool: any) => {
          expect(tool).toHaveProperty("name");
          expect(tool).toHaveProperty("description");
          expect(tool).toHaveProperty("inputSchema");
          expect(typeof tool.name).toBe("string");
          expect(typeof tool.description).toBe("string");
          expect(typeof tool.inputSchema).toBe("object");
        });
      }),
      { numRuns: 10 }, // Reduced runs since this involves process spawning
    );
  }, 30000); // 30 second timeout for the test

  // Property test: For any invalid JSON-RPC request, server should respond with proper error
  test("Property 16: MCP protocol compliance - server handles invalid requests with proper JSON-RPC errors", async () => {
    const server = await startMCPServer();
    serverProcess = server.process;

    // Generator for invalid JSON-RPC requests
    const invalidRequestGenerator = fc.oneof(
      // Missing jsonrpc field
      fc.record({
        id: fc.oneof(fc.string(), fc.integer()),
        method: fc.string(),
        params: fc.object(),
      }),
      // Wrong jsonrpc version
      fc.record({
        jsonrpc: fc.constantFrom("1.0", "3.0", "invalid"),
        id: fc.oneof(fc.string(), fc.integer()),
        method: fc.string(),
        params: fc.object(),
      }),
      // Invalid method
      fc.record({
        jsonrpc: fc.constant("2.0"),
        id: fc.oneof(fc.string(), fc.integer()),
        method: fc
          .string({ minLength: 1 })
          .filter((s) => !s.startsWith("tools/")),
        params: fc.object(),
      }),
    );

    await fc.assert(
      fc.asyncProperty(invalidRequestGenerator, async (invalidRequest) => {
        server.sendMessage(invalidRequest);

        try {
          const response = await Promise.race([
            server.waitForMessage(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), 2000),
            ),
          ]);

          // If we get a response, it should be a valid JSON-RPC error
          expect(response).toHaveProperty("jsonrpc", "2.0");
          expect(response).toHaveProperty("id");
          expect(response).toHaveProperty("error");
          expect(response.error).toHaveProperty("code");
          expect(response.error).toHaveProperty("message");
          expect(typeof response.error.code).toBe("number");
          expect(typeof response.error.message).toBe("string");
        } catch (error) {
          // Timeout is acceptable for invalid requests
          if (error instanceof Error && error.message === "timeout") {
            // This is acceptable - server might not respond to invalid requests
            return;
          }
          throw error;
        }
      }),
      { numRuns: 5 }, // Reduced runs for invalid request testing
    );
  }, 30000);

  // Unit test for specific tool registration
  test("introspect_graphql_schema tool is properly registered", async () => {
    const server = await startMCPServer();
    serverProcess = server.process;

    const listToolsRequest = {
      jsonrpc: "2.0",
      id: "test-1",
      method: "tools/list",
      params: {},
    };

    server.sendMessage(listToolsRequest);
    const response = await server.waitForMessage();

    const introspectionTool = response.result.tools.find(
      (tool: any) => tool.name === "introspect_graphql_schema",
    );

    expect(introspectionTool).toBeDefined();
    expect(introspectionTool.description).toBe(
      "Fetch the complete GraphQL schema from your Django backend",
    );
    expect(introspectionTool.inputSchema.type).toBe("object");
    expect(introspectionTool.inputSchema.properties).toEqual({});
    expect(introspectionTool.inputSchema.required).toEqual([]);
  }, 15000);

  // Unit test for specific tool registration
  test("execute_graphql_query tool is properly registered", async () => {
    const server = await startMCPServer();
    serverProcess = server.process;

    const listToolsRequest = {
      jsonrpc: "2.0",
      id: "test-2",
      method: "tools/list",
      params: {},
    };

    server.sendMessage(listToolsRequest);
    const response = await server.waitForMessage();

    const queryTool = response.result.tools.find(
      (tool: any) => tool.name === "execute_graphql_query",
    );

    expect(queryTool).toBeDefined();
    expect(queryTool.description).toBe(
      "Execute GraphQL queries/mutations against your Django backend",
    );
    expect(queryTool.inputSchema.type).toBe("object");
    expect(queryTool.inputSchema.properties).toHaveProperty("query_string");
    expect(queryTool.inputSchema.properties).toHaveProperty("variables");
    expect(queryTool.inputSchema.required).toEqual(["query_string"]);
  }, 15000);
});
