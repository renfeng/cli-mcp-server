# terminal

An MCP server that exposes a single `execute` tool for running any CLI command over stdio. Uses `execFile` (no shell) to prevent injection.

## Quick Start

```bash
npx @renfeng/terminal
```

## MCP Configuration

```json
{
  "mcpServers": {
    "terminal": {
      "command": "npx",
      "args": ["-y", "@renfeng/terminal@0.4"],
      "autoApprove": ["execute"]
    }
  }
}
```

Remove `execute` from `autoApprove` to require user confirmation for every call.

## Tool: `execute`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `command` | `string` | Yes | The CLI to run (e.g. `mvn`, `git`, `gradle`) |
| `args` | `string[]` | Yes | Arguments to pass |
| `cwd` | `string` | No | Working directory |
| `timeout` | `number` | No | Timeout in ms (default: 30000) |

### Examples

```json
{ "command": "mvn", "args": ["clean", "install", "-DskipTests"] }
{ "command": "git", "args": ["log", "--oneline", "-10"] }
{ "command": "gradle", "args": ["build", "--info"] }
{ "command": "docker", "args": ["ps"] }
{ "command": "kubectl", "args": ["get", "pods"] }
```

## Response Format

```
<stdout>
[stderr]
<stderr output>
[exit code: N]
```

Non-zero exit codes set `isError: true` in the MCP response.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLI_TIMEOUT` | `30000` | Default execution timeout in milliseconds |

## Security

- `execFile` runs commands directly — no shell interpretation, no injection via args
- Trust is managed by Kiro's `autoApprove` in `mcp.json`
- The server has no allowlist — Kiro is the gatekeeper

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
