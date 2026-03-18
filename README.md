# terminal

An MCP server that wraps command-line tools as individual MCP tools over stdio. Configure which CLIs to expose, and each becomes a tool that accepts `args` and optional `cwd`.

## Quick Start

```bash
npx @renfeng/cli-mcp-server
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CLI_TOOLS` | `mvn,git` | Comma-separated list of CLI commands to expose |
| `CLI_TIMEOUT` | `30000` | Default execution timeout in milliseconds |

## MCP Configuration

Add to your `.kiro/settings/mcp.json` (or equivalent):

```json
{
  "mcpServers": {
    "cli": {
      "command": "npx",
      "args": ["-y", "@renfeng/cli-mcp-server"],
      "env": {
        "CLI_TOOLS": "mvn,git,gradle",
        "CLI_TIMEOUT": "60000"
      }
    }
  }
}
```

## How It Works

Each CLI listed in `CLI_TOOLS` becomes a separate MCP tool. For example, with `CLI_TOOLS=mvn,git`, the server exposes:

### Tool: `mvn`

```json
{
  "args": ["clean", "install", "-DskipTests"],
  "cwd": "/path/to/project"
}
```

### Tool: `git`

```json
{
  "args": ["log", "--oneline", "-10"],
  "cwd": "/path/to/repo"
}
```

## Tool Schema

Every exposed tool has the same schema:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `args` | `string[]` | Yes | Arguments to pass to the CLI |
| `cwd` | `string` | No | Working directory (defaults to server's cwd) |
| `timeout` | `number` | No | Per-call timeout in ms (overrides `CLI_TIMEOUT`) |

## Response Format

```
<stdout>
[stderr]
<stderr output>
[exit code: N]
```

Non-zero exit codes set `isError: true` in the MCP response.

## Examples

### Maven

```json
{ "args": ["dependency:tree", "-pl", "my-module"] }
{ "args": ["test", "-pl", "my-module", "-Dtest=MyTest"] }
{ "args": ["help:effective-pom"] }
```

### Git

```json
{ "args": ["status", "--short"] }
{ "args": ["diff", "--stat", "HEAD~3"] }
{ "args": ["log", "--oneline", "--graph", "-20"] }
```

### Gradle

```json
{ "args": ["build", "--info"] }
{ "args": ["dependencies", "--configuration", "runtimeClasspath"] }
```

## Extending

Add any CLI to `CLI_TOOLS`:

```
CLI_TOOLS=mvn,git,gradle,docker,kubectl,npm,cargo
```

No code changes needed. If the CLI is on your `PATH`, it works.

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
