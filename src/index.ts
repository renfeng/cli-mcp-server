#!/usr/bin/env node

/**
 * cli-mcp-server
 *
 * A generic MCP server that exposes CLI tools over stdio.
 * Each configured CLI becomes a separate MCP tool.
 *
 * Configuration via environment variables:
 *   CLI_TOOLS=mvn,git,gradle   — comma-separated list of CLI commands to expose
 *   CLI_TIMEOUT=30000           — execution timeout in ms (default: 30s)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_TOOLS = ["mvn", "git"];
const DEFAULT_TIMEOUT = 30_000;

function getConfig() {
  const toolsEnv = process.env.CLI_TOOLS;
  const tools = toolsEnv
    ? toolsEnv.split(",").map((t) => t.trim()).filter(Boolean)
    : DEFAULT_TOOLS;
  const timeout = parseInt(process.env.CLI_TIMEOUT || "", 10) || DEFAULT_TIMEOUT;
  return { tools, timeout };
}

function buildToolDefinitions(cliNames: string[]) {
  return cliNames.map((cli) => ({
    name: cli,
    description: `Execute the '${cli}' command-line tool. Pass subcommands and flags as individual items in the 'args' array.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        args: {
          type: "array" as const,
          items: { type: "string" as const },
          description: `Arguments to pass to '${cli}'. Example: ["clean", "install", "-DskipTests"]`,
        },
        cwd: {
          type: "string" as const,
          description: "Working directory for the command. Defaults to the server's cwd.",
        },
        timeout: {
          type: "number" as const,
          description: "Timeout in milliseconds for this invocation. Overrides the global CLI_TIMEOUT.",
        },
      },
      required: ["args"],
    },
  }));
}

interface ToolCallArgs {
  args: string[];
  cwd?: string;
  timeout?: number;
}

async function executeCli(
  command: string,
  args: string[],
  cwd?: string,
  timeout?: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFileAsync(command, args, {
      cwd: cwd || process.cwd(),
      timeout: timeout,
      maxBuffer: 10 * 1024 * 1024, // 10 MB
      env: { ...process.env },
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      code?: number | string;
      killed?: boolean;
      signal?: string;
    };
    if (execError.killed || execError.signal === "SIGTERM") {
      return {
        stdout: execError.stdout || "",
        stderr: `Command timed out after ${timeout}ms\n${execError.stderr || ""}`,
        exitCode: 124,
      };
    }
    return {
      stdout: execError.stdout || "",
      stderr: execError.stderr || (error instanceof Error ? error.message : String(error)),
      exitCode: typeof execError.code === "number" ? execError.code : 1,
    };
  }
}

async function main(): Promise<void> {
  const config = getConfig();

  const server = new Server(
    { name: "cli-mcp-server", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  const toolDefs = buildToolDefinitions(config.tools);
  const allowedTools = new Set(config.tools);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefs,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;

    if (!allowedTools.has(name)) {
      return {
        content: [{ type: "text", text: `Error: Unknown tool '${name}'. Allowed: ${config.tools.join(", ")}` }],
        isError: true,
      };
    }

    const params = (rawArgs || {}) as unknown as ToolCallArgs;
    const args = params.args || [];
    const timeout = params.timeout || config.timeout;

    const result = await executeCli(name, args, params.cwd, timeout);

    const parts: string[] = [];
    if (result.stdout) parts.push(result.stdout);
    if (result.stderr) parts.push(`[stderr]\n${result.stderr}`);
    if (result.exitCode !== 0) parts.push(`[exit code: ${result.exitCode}]`);

    const text = parts.join("\n") || "(no output)";

    return {
      content: [{ type: "text", text }],
      isError: result.exitCode !== 0,
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal:", error.message || error);
  process.exit(1);
});
