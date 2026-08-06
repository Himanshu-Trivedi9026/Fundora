/**
 * Debug test — verify supabase chain mocking works correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("../../../lib/verification/secureLogger.js", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../../lib/ai/providerRegistry.js", () => ({
  getActiveModelProvider: vi.fn().mockReturnValue({
    createEmbedding: vi.fn().mockResolvedValue({
      data: { data: [{ embedding: [0.1], index: 0 }] },
      model: "test",
      usage: { total_tokens: 10 },
    }),
  }),
}));

import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";

describe("Debug Mock Chain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mockReturnValueOnce should override mockReturnThis for from()", () => {
    const myChain = { insert: vi.fn() };
    supabaseAdmin.from.mockReturnValueOnce(myChain);

    const result = supabaseAdmin.from("test");
    expect(result).toBe(myChain); // Should be the custom chain, not supabaseAdmin
  });

  it("mockReturnValueOnce should override mockReturnThis for insert()", () => {
    const myInsert = { select: vi.fn() };
    supabaseAdmin.insert.mockReturnValueOnce(myInsert);

    const result = supabaseAdmin.insert({});
    expect(result).toBe(myInsert);
  });

  it("full chain with mockReturnValueOnce", async () => {
    const myChain = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi
            .fn()
            .mockResolvedValue({ data: { id: "test-id" }, error: null }),
        }),
      }),
    };
    supabaseAdmin.from.mockReturnValueOnce(myChain);

    const r1 = supabaseAdmin.from("table");
    console.log("r1 === myChain:", r1 === myChain);
    console.log("r1 type:", typeof r1);
    console.log("r1 keys:", Object.keys(r1));

    const r2 = r1.insert({ data: 1 });
    const r3 = r2.select("id");
    const r4 = await r3.single();

    console.log("r4:", r4);
    expect(r4).toEqual({ data: { id: "test-id" }, error: null });
  });

  it("mockReturnValueOnce is consumed - second call reverts to default", () => {
    const myChain1 = { id: "chain1" };
    const myChain2 = { id: "chain2" };
    supabaseAdmin.from
      .mockReturnValueOnce(myChain1)
      .mockReturnValueOnce(myChain2);

    const r1 = supabaseAdmin.from("first");
    const r2 = supabaseAdmin.from("second");
    const r3 = supabaseAdmin.from("third"); // should be supabaseAdmin (mockReturnThis)

    expect(r1).toBe(myChain1);
    expect(r2).toBe(myChain2);
    expect(r3).toBe(supabaseAdmin); // mockReturnThis
  });
});
