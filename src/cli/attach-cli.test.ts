import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAttachSpawnInvocation, writeClaudeMcpConfig } from "./attach-cli.js";

const MCP_CONFIG = {
  mcpServers: {
    openclaw: {
      type: "http",
      url: "http://127.0.0.1:54321/mcp",
      headers: {
        Authorization: "Bearer ${OPENCLAW_MCP_TOKEN}",
        "x-session-key": "${OPENCLAW_MCP_SESSION_KEY}",
      },
    },
  },
};

describe("writeClaudeMcpConfig", () => {
  it("writes the gateway mcpConfig verbatim to a .mcp.json (placeholders preserved for Claude env substitution)", () => {
    const { path, cleanup } = writeClaudeMcpConfig(MCP_CONFIG);
    try {
      expect(path.endsWith(".mcp.json")).toBe(true);
      expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(MCP_CONFIG);
    } finally {
      cleanup();
    }
  });

  it("cleanup removes the temp config", () => {
    const { path, cleanup } = writeClaudeMcpConfig(MCP_CONFIG);
    cleanup();
    expect(() => readFileSync(path, "utf8")).toThrow();
  });
});

describe("resolveAttachSpawnInvocation", () => {
  it("resolves the standard Windows claude.cmd shim to its Node entrypoint", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "openclaw-attach-windows-"));
    const packageDir = path.join(dir, "node_modules", "@anthropic-ai", "claude-code");
    const entrypoint = path.join(packageDir, "cli.js");
    try {
      mkdirSync(packageDir, { recursive: true });
      writeFileSync(path.join(dir, "claude.cmd"), "@echo off\r\n", "utf8");
      writeFileSync(
        path.join(packageDir, "package.json"),
        JSON.stringify({ bin: { claude: "cli.js" } }),
        "utf8",
      );
      writeFileSync(entrypoint, "", "utf8");

      expect(
        resolveAttachSpawnInvocation({
          bin: "claude",
          args: ["--strict-mcp-config"],
          platform: "win32",
          env: { PATH: dir, PATHEXT: ".CMD;.EXE" },
          execPath: "C:\\node\\node.exe",
        }),
      ).toMatchObject({
        command: "C:\\node\\node.exe",
        argv: [entrypoint, "--strict-mcp-config"],
        resolution: "node-entrypoint",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
