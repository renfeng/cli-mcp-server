---
name: "terminal"
displayName: "Terminal"
description: "Expose any command-line tool as an MCP tool over stdio. Configure which CLIs to allow (mvn, git, gradle, docker, etc.) and each becomes a tool the agent can call with args and cwd."
keywords: ["cli", "mvn", "maven", "git", "gradle", "docker", "kubectl", "npm", "cargo", "command", "shell", "terminal", "build", "deploy"]
---

# Terminal

A single MCP server that wraps any command-line tool as an MCP tool. Each CLI listed in `CLI_TOOLS` becomes a separate tool with the same schema: `args` (string array) and optional `cwd`.

## Configuration

The server is configured via environment variables in `mcp.json`:

| Variable | Default | Description |
|----------|---------|-------------|
| `CLI_TOOLS` | `mvn,git` | Comma-separated list of CLI commands to expose as MCP tools |
| `CLI_TIMEOUT` | `30000` | Default execution timeout in milliseconds |

To add more CLIs, edit the `CLI_TOOLS` env var. No code changes needed.

## Tools

Each configured CLI becomes a tool with this schema:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `args` | `string[]` | Yes | Arguments to pass to the CLI |
| `cwd` | `string` | No | Working directory (defaults to server's cwd) |
| `timeout` | `number` | No | Per-call timeout in ms (overrides `CLI_TIMEOUT`) |

### Default tools: `mvn` and `git`

#### mvn examples

```json
{ "args": ["clean", "install", "-DskipTests"] }
{ "args": ["dependency:tree", "-pl", "my-module"] }
{ "args": ["test", "-pl", "my-module", "-Dtest=MyTest"] }
{ "args": ["help:effective-pom"] }
```

#### git examples

```json
{ "args": ["status", "--short"] }
{ "args": ["log", "--oneline", "-10"] }
{ "args": ["diff", "--stat", "HEAD~3"] }
```

## Extending

Add any CLI that's on your PATH:

```json
"env": {
  "CLI_TOOLS": "mvn,git,gradle,docker,kubectl,npm"
}
```

Then add the new tool names to `autoApprove` if you want them auto-approved.

## Security

- Only CLIs explicitly listed in `CLI_TOOLS` can be executed
- Each CLI is a separate tool, enabling per-CLI auto-approve control
- `execFile` is used (not shell), preventing command injection via args
- Timeout prevents runaway processes

## Response Format

```
<stdout>
[stderr]
<stderr output>
[exit code: N]
```

Non-zero exit codes set `isError: true` in the MCP response.
