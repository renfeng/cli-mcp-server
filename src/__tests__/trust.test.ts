import { describe, it, expect } from "vitest";
import { checkTrust } from "../trust.js";
import type { KiroSettings } from "../trust.js";

describe("checkTrust", () => {
  it("should allow when trustedCommands has wildcard *", () => {
    const settings: KiroSettings = {
      trustedCommands: ["*"],
      commandDenylist: [],
      terminalCommandTimeout: undefined,
    };
    const result = checkTrust("mvn", ["clean", "install"], settings);
    expect(result.allowed).toBe(true);
  });

  it("should allow when command matches a specific pattern", () => {
    const settings: KiroSettings = {
      trustedCommands: ["mvn *", "git *"],
      commandDenylist: [],
      terminalCommandTimeout: undefined,
    };
    expect(checkTrust("mvn", ["clean"], settings).allowed).toBe(true);
    expect(checkTrust("git", ["status"], settings).allowed).toBe(true);
    expect(checkTrust("docker", ["ps"], settings).allowed).toBe(false);
  });

  it("should deny when command matches denylist", () => {
    const settings: KiroSettings = {
      trustedCommands: ["*"],
      commandDenylist: ["--no-verify"],
      terminalCommandTimeout: undefined,
    };
    const result = checkTrust("git", ["push", "--no-verify"], settings);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("--no-verify");
  });

  it("should deny even if trusted when denylist matches", () => {
    const settings: KiroSettings = {
      trustedCommands: ["git *"],
      commandDenylist: ["--force"],
      terminalCommandTimeout: undefined,
    };
    const result = checkTrust("git", ["push", "--force"], settings);
    expect(result.allowed).toBe(false);
  });

  it("should deny when no trusted commands configured", () => {
    const settings: KiroSettings = {
      trustedCommands: [],
      commandDenylist: [],
      terminalCommandTimeout: undefined,
    };
    const result = checkTrust("mvn", ["clean"], settings);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("No trusted commands");
  });

  it("should match comment-prefixed commands like # *", () => {
    const settings: KiroSettings = {
      trustedCommands: ["# *"],
      commandDenylist: [],
      terminalCommandTimeout: undefined,
    };
    // "# *" matches commands starting with "# " (comment-first convention)
    const result = checkTrust("#", ["install", "deps"], settings);
    expect(result.allowed).toBe(true);
  });

  it("should handle npm run * pattern", () => {
    const settings: KiroSettings = {
      trustedCommands: ["npm run *"],
      commandDenylist: [],
      terminalCommandTimeout: undefined,
    };
    expect(checkTrust("npm", ["run", "build"], settings).allowed).toBe(true);
    expect(checkTrust("npm", ["install"], settings).allowed).toBe(false);
  });
});
