import { render, waitFor } from "@testing-library/react";
import Callback from "../../pages/auth/callback";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

function mockRouter(query = {}) {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    isReady: true,
    query,
    asPath: "/auth/callback",
    pathname: "/auth/callback",
    basePath: "",
    locale: "en",
    locales: ["en"],
    events: { on: vi.fn(), off: vi.fn() },
  };
  vi.mocked(useRouter).mockReturnValue(router);
  return router;
}

function mockSession(userId = "u1", email = "test@example.com") {
  supabase.auth.exchangeCodeForSession.mockResolvedValue({
    data: {
      session: {
        user: {
          id: userId,
          email,
          user_metadata: { full_name: "Test User" },
        },
      },
    },
    error: null,
  });
}

describe("Auth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults for the success paths (no session, no existing profile).
    supabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    supabase.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("persists role=creator on the profile INSERT", async () => {
    const router = mockRouter({ code: "abc", next: "/", role: "creator" });
    mockSession();
    render(<Callback />);

    await waitFor(() => {
      expect(supabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({ role: "creator" }),
      );
    });
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("defaults to role=donor when no role is provided", async () => {
    const router = mockRouter({ code: "abc", next: "/" });
    mockSession();
    render(<Callback />);

    await waitFor(() => {
      expect(supabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({ role: "donor" }),
      );
    });
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("blocks self-elevation: platform_admin falls back to donor", async () => {
    const router = mockRouter({
      code: "abc",
      next: "/",
      role: "platform_admin",
    });
    mockSession();
    render(<Callback />);

    await waitFor(() => {
      expect(supabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({ role: "donor" }),
      );
    });
    const inserted = supabase.insert.mock.calls[0][0];
    expect(inserted.role).not.toBe("platform_admin");
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("does not INSERT when the profile already exists", async () => {
    const router = mockRouter({ code: "abc", next: "/", role: "creator" });
    mockSession();
    supabase.maybeSingle.mockResolvedValue({ data: { id: "u1" }, error: null });
    render(<Callback />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/");
    });
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it("routes password recovery to /reset-password without INSERT", async () => {
    const router = mockRouter({ type: "recovery", code: "abc" });
    render(<Callback />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/reset-password");
    });
    expect(supabase.insert).not.toHaveBeenCalled();
  });
});
