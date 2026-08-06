import { vi } from "vitest";

// Mock supabaseClient before importing auth
vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signUp: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: "new-user" } }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: { id: "signed-in-user" } },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "current-user" } },
        error: null,
      }),
    },
  },
}));

import {
  signUpEmail,
  signInEmail,
  signOutUser,
  getCurrentUser,
} from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

describe("lib/auth.js — client-side auth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signUpEmail calls supabase.auth.signUp with email and password", async () => {
    const result = await signUpEmail("test@example.com", "password123");
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.data.user.id).toBe("new-user");
  });

  it("signInEmail calls supabase.auth.signInWithPassword", async () => {
    const result = await signInEmail("test@example.com", "password123");
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.data.user.id).toBe("signed-in-user");
  });

  it("signOutUser calls supabase.auth.signOut", async () => {
    const result = await signOutUser();
    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(result.error).toBeNull();
  });

  it("getCurrentUser returns the current user", async () => {
    const user = await getCurrentUser();
    expect(supabase.auth.getUser).toHaveBeenCalled();
    expect(user.id).toBe("current-user");
  });

  it("getCurrentUser returns null when no user", async () => {
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});
