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

import { createProject, updateProject, deleteProject } from "@/lib/projects";

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

  // ---- createProject ----
  it("creates a project with correct fields", async () => {
    const data = {
      title: "My Project",
      short: "Short desc",
      description: "Full description",
      goal: 10000,
      deadline: "2026-12-31",
      prototypeUrl: "https://example.com",
      owner_id: "user-1",
    };

    const result = await createProject(data);
    expect(result.id).toBe("proj-1");
  });

  it("throws on database error during create", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "insert failed" } });
    await expect(
      createProject({ title: "Test", short: "s", description: "d", goal: 1000, deadline: "2026-01-01", prototypeUrl: "", owner_id: "u1" })
    ).rejects.toThrow();
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
