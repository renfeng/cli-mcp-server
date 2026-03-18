/**
 * Reads Kiro's trustedCommands and commandDenylist settings
 * and applies them to command execution requests.
 *
 * Resolution order (workspace overrides global):
 *   1. Global: ~/Library/Application Support/Kiro/User/settings.json (macOS)
 *              ~/.config/Kiro/User/settings.json (Linux)
 *              %APPDATA%/Kiro/User/settings.json (Windows)
 *   2. Workspace: .code-workspace "settings" object (multi-root)
 *              or .vscode/settings.json (single-folder)
 *
 * The workspace file path is passed via KIRO_WORKSPACE_FILE env var.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { platform, homedir } from "node:os";

export interface KiroSettings {
  trustedCommands: string[];
  commandDenylist: string[];
  terminalCommandTimeout: number | undefined;
}

function getGlobalSettingsPath(): string {
  switch (platform()) {
    case "darwin":
      return join(
        homedir(),
        "Library",
        "Application Support",
        "Kiro",
        "User",
        "settings.json",
      );
    case "linux":
      return join(homedir(), ".config", "Kiro", "User", "settings.json");
    case "win32":
      return join(
        process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
        "Kiro",
        "User",
        "settings.json",
      );
    default:
      return join(homedir(), ".config", "Kiro", "User", "settings.json");
  }
}

function readJsonFile(path: string): Record<string, unknown> {
  try {
    const content = readFileSync(path, "utf-8");
    // Strip JSON5/JSONC comments (// and /* */) before parsing
    const stripped = content
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    return JSON.parse(stripped);
  } catch {
    return {};
  }
}

function extractKiroSettings(obj: Record<string, unknown>): Partial<KiroSettings> {
  const result: Partial<KiroSettings> = {};
  if (Array.isArray(obj["kiroAgent.trustedCommands"])) {
    result.trustedCommands = obj["kiroAgent.trustedCommands"] as string[];
  }
  if (Array.isArray(obj["kiroAgent.commandDenylist"])) {
    result.commandDenylist = obj["kiroAgent.commandDenylist"] as string[];
  }
  if (typeof obj["kiroAgent.terminalCommandTimeout"] === "number") {
    result.terminalCommandTimeout = obj["kiroAgent.terminalCommandTimeout"] as number;
  }
  return result;
}

function readWorkspaceSettings(
  workspaceFile: string,
): Partial<KiroSettings> {
  const data = readJsonFile(workspaceFile);
  const settings = (data.settings || {}) as Record<string, unknown>;
  return extractKiroSettings(settings);
}

export function loadTrustSettings(): KiroSettings {
  // Global settings
  const globalPath = getGlobalSettingsPath();
  const globalData = readJsonFile(globalPath);
  const globalSettings = extractKiroSettings(globalData);

  // Workspace settings (override global)
  const workspaceFile = process.env.KIRO_WORKSPACE_FILE;
  const workspaceSettings = workspaceFile
    ? readWorkspaceSettings(workspaceFile)
    : {};

  return {
    trustedCommands:
      workspaceSettings.trustedCommands ??
      globalSettings.trustedCommands ??
      [],
    commandDenylist:
      workspaceSettings.commandDenylist ??
      globalSettings.commandDenylist ??
      [],
    terminalCommandTimeout:
      workspaceSettings.terminalCommandTimeout ??
      globalSettings.terminalCommandTimeout ??
      undefined,
  };
}

/**
 * Matches a command string against a wildcard pattern.
 * Kiro uses simple wildcard matching: `*` matches any sequence of characters.
 * e.g. "npm *" matches "npm run build", "npm install", etc.
 */
function wildcardMatch(pattern: string, text: string): boolean {
  const regex = new RegExp(
    "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$",
  );
  return regex.test(text);
}

/**
 * Check if a command is allowed based on Kiro's trust settings.
 *
 * Rules (matching Kiro's built-in behavior):
 * 1. If the full command string matches any commandDenylist pattern → DENIED
 * 2. If the full command string matches any trustedCommands pattern → ALLOWED
 * 3. Otherwise → DENIED (not trusted)
 */
export function checkTrust(
  command: string,
  args: string[],
  settings: KiroSettings,
): { allowed: boolean; reason: string } {
  const fullCommand = [command, ...args].join(" ");

  // Check denylist first (takes precedence over trusted)
  for (const pattern of settings.commandDenylist) {
    if (fullCommand.includes(pattern)) {
      return {
        allowed: false,
        reason: `Command denied: contains '${pattern}' (in Kiro commandDenylist)`,
      };
    }
  }

  // Check trusted commands
  if (settings.trustedCommands.length === 0) {
    return {
      allowed: false,
      reason:
        "No trusted commands configured. Add patterns to kiroAgent.trustedCommands in Kiro settings.",
    };
  }

  for (const pattern of settings.trustedCommands) {
    if (wildcardMatch(pattern, fullCommand)) {
      return { allowed: true, reason: "trusted" };
    }
    // Also match against just the command name (e.g. pattern "mvn *" matches command "mvn")
    if (wildcardMatch(pattern, command)) {
      return { allowed: true, reason: "trusted" };
    }
  }

  return {
    allowed: false,
    reason: `Command '${command}' is not in trustedCommands. Add '${command} *' to kiroAgent.trustedCommands in Kiro settings.`,
  };
}
