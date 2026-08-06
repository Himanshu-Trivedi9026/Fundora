// Tests — Base Connector Classes

import {
  BaseConnector,
  SlackConnector,
  TeamsConnector,
  DiscordConnector,
  GoogleWorkspaceConnector,
  GitHubConnector,
  JiraConnector,
  NotionConnector,
} from "../../../lib/connectors/baseConnector.js";

describe("Base Connector", () => {
  it("throws on unimplemented methods", async () => {
    const conn = new BaseConnector();
    await expect(conn.connect()).rejects.toThrow("connect() must be implemented");
    await expect(conn.disconnect()).rejects.toThrow("disconnect() must be implemented");
    await expect(conn.sendMessage("c", "m")).rejects.toThrow("sendMessage() must be implemented");
  });

  it("returns status", async () => {
    const conn = new BaseConnector();
    const status = await conn.getStatus();
    expect(status.connected).toBe(false);
    expect(status.name).toBe("base");
  });
});

describe("SlackConnector", () => {
  it("connects with token", async () => {
    const conn = new SlackConnector({ credentials: { token: "xoxb-test" } });
    const result = await conn.connect();
    expect(result.success).toBe(true);
    expect(result.data.connected).toBe(true);
  });

  it("validates credentials", async () => {
    const conn = new SlackConnector({ credentials: { token: "xoxb-test" } });
    const result = await conn.validateCredentials();
    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
  });

  it("fails to send when not connected", async () => {
    const conn = new SlackConnector();
    const result = await conn.sendMessage("general", "hello");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Not connected");
  });

  it("handles webhook", async () => {
    const conn = new SlackConnector({ credentials: { token: "xoxb-test" } });
    const result = await conn.handleWebhook({ event: { type: "message" } });
    expect(result.success).toBe(true);
  });
});

describe("TeamsConnector", () => {
  it("connects with webhook URL", async () => {
    const conn = new TeamsConnector({ webhookUrl: "https://outlook.office.com/webhook/test" });
    await conn.connect();
    expect(conn.connected).toBe(true);
  });

  it("fails to connect without webhook URL", async () => {
    const conn = new TeamsConnector();
    await conn.connect();
    expect(conn.connected).toBe(false);
  });
});

describe("DiscordConnector", () => {
  it("connects with token", async () => {
    const conn = new DiscordConnector({ credentials: { token: "discord-test" } });
    await conn.connect();
    expect(conn.connected).toBe(true);
  });
});

describe("GoogleWorkspaceConnector", () => {
  it("connects with credentials", async () => {
    const conn = new GoogleWorkspaceConnector({
      credentials: { clientEmail: "test@test.com", privateKey: "key-123" },
    });
    await conn.connect();
    expect(conn.connected).toBe(true);
  });
});

describe("GitHubConnector", () => {
  it("connects with token", async () => {
    const conn = new GitHubConnector({ credentials: { token: "ghp_test" } });
    await conn.connect();
    expect(conn.connected).toBe(true);
  });

  it("sends a message", async () => {
    const conn = new GitHubConnector({ credentials: { token: "ghp_test" } });
    await conn.connect();
    const result = await conn.sendMessage("org/repo", "Test issue");
    expect(result.success).toBe(true);
    expect(result.data.repo).toBe("org/repo");
  });
});

describe("JiraConnector", () => {
  it("connects with base URL and token", async () => {
    const conn = new JiraConnector({
      config: { baseUrl: "https://test.atlassian.net" },
      credentials: { email: "test@test.com", token: "jira-test" },
    });
    await conn.connect();
    expect(conn.connected).toBe(true);
  });
});

describe("NotionConnector", () => {
  it("connects with token", async () => {
    const conn = new NotionConnector({ credentials: { token: "ntn_test" } });
    await conn.connect();
    expect(conn.connected).toBe(true);
  });

  it("sends a message", async () => {
    const conn = new NotionConnector({ credentials: { token: "ntn_test" } });
    await conn.connect();
    const result = await conn.sendMessage("db-123", "Test page");
    expect(result.success).toBe(true);
    expect(result.data.databaseId).toBe("db-123");
  });
});
