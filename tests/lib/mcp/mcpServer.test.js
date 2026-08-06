// Tests — MCP Server

import {
  registerTool,
  getTool,
  listTools,
  executeTool,
  buildContext,
  getServerInfo,
} from "../../../lib/mcp/mcpServer.js";

// Mock supabaseAdmin
vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        or: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(),
              single: vi.fn(),
            })),
          })),
        })),
        eq: vi.fn(() => ({
          single: vi.fn(),
          order: vi.fn(() => ({
            limit: vi.fn(),
          })),
        })),
        order: vi.fn(() => ({
          limit: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({ single: vi.fn() })),
      })),
    })),
  },
}));

describe("MCP Server", () => {
  describe("registerTool / getTool", () => {
    it("registers and retrieves a tool", () => {
      const def = {
        description: "A test tool",
        inputSchema: {
          type: "object",
          properties: { foo: { type: "string" } },
        },
        handler: async () => ({ success: true, data: "ok" }),
      };
      registerTool("test_tool", def);
      const tool = getTool("test_tool");
      expect(tool).toBeDefined();
      expect(tool.description).toBe("A test tool");
    });

    it("returns null for unknown tool", () => {
      expect(getTool("nonexistent")).toBeNull();
    });
  });

  describe("listTools", () => {
    it("returns all registered tools with metadata", () => {
      const tools = listTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);

      const first = tools[0];
      expect(first).toHaveProperty("name");
      expect(first).toHaveProperty("description");
      expect(first).toHaveProperty("inputSchema");
      expect(first).toHaveProperty("requiresAuth");
    });
  });

  describe("executeTool", () => {
    it("executes a registered tool", async () => {
      const result = await executeTool("test_tool", { foo: "bar" });
      expect(result.success).toBe(true);
      expect(result.data).toBe("ok");
    });

    it("returns error for unknown tool", async () => {
      const result = await executeTool("unknown", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown tool");
    });
  });

  describe("buildContext", () => {
    it("builds context with user info", () => {
      const ctx = buildContext(
        { id: "user-1", role: "admin", organization_id: "org-1" },
        "org-1",
      );
      expect(ctx.user).toBeDefined();
      expect(ctx.user.id).toBe("user-1");
      expect(ctx.user.role).toBe("admin");
      expect(ctx.organizationId).toBe("org-1");
      expect(ctx.timestamp).toBeDefined();
    });

    it("builds context without user", () => {
      const ctx = buildContext(null, null);
      expect(ctx.user).toBeNull();
      expect(ctx.organizationId).toBeNull();
    });
  });

  describe("getServerInfo", () => {
    it("returns server metadata", () => {
      const info = getServerInfo();
      expect(info.name).toBe("fundora-mcp-server");
      expect(info.version).toBe("1.0.0");
      expect(info.protocol).toBe("model-context-protocol");
      expect(info.tools).toBeGreaterThan(0);
      expect(Array.isArray(info.toolsList)).toBe(true);
    });
  });
});
