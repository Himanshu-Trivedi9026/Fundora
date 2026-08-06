import { vi } from "vitest";

// Mock supabaseClient
const mockInsert = vi.fn().mockReturnThis();
const mockUpdate = vi.fn().mockReturnThis();
const mockDelete = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSingle = vi.fn().mockResolvedValue({ data: { id: "proj-1" }, error: null });

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    })),
  },
}));

import { updateProject, deleteProject } from "@/lib/projects";

// NOTE: createProject was removed — publishing now goes through the single
// verified-only path POST /api/projects (withVerified). Coverage for the
// publish route lives in tests/api/projects.test.js.

describe("lib/projects.js — project CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnThis();
    mockUpdate.mockReturnThis();
    mockDelete.mockReturnThis();
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockSingle.mockResolvedValue({ data: { id: "proj-1" }, error: null });
  });

  // ---- updateProject ----
  it("updates a project by id", async () => {
    const result = await updateProject("proj-1", { title: "Updated" });
    expect(result.id).toBe("proj-1");
    expect(mockEq).toHaveBeenCalledWith("id", "proj-1");
    expect(mockUpdate).toHaveBeenCalledWith({ title: "Updated" });
  });

  it("throws on database error during update", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "update failed" } });
    await expect(updateProject("proj-1", { title: "X" })).rejects.toThrow();
  });

  // ---- deleteProject ----
  it("deletes a project by id", async () => {
    mockEq.mockResolvedValueOnce({ error: null });
    const result = await deleteProject("proj-1");
    expect(result).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith("id", "proj-1");
  });

  it("throws on database error during delete", async () => {
    mockEq.mockResolvedValueOnce({ error: { message: "delete failed" } });
    await expect(deleteProject("proj-1")).rejects.toThrow();
  });
});
