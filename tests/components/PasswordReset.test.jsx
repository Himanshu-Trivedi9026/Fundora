import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForgotPasswordPage from "../../pages/forgot-password";
import ResetPasswordPage from "../../pages/reset-password";
import { useRouter } from "next/router";

vi.mock("../../components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("../../components/Footer", () => ({
  default: () => <div data-testid="footer" />,
}));

vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "recovery-user" } } },
        error: null,
      }),
    },
  },
}));

import { supabase } from "../../lib/supabaseClient";

function mockRouter(overrides = {}) {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    query: {},
    asPath: "/",
    pathname: "/",
    basePath: "",
    locale: "en",
    locales: ["en"],
    events: { on: vi.fn(), off: vi.fn() },
    ...overrides,
  };
  vi.mocked(useRouter).mockReturnValue(router);
  return router;
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    mockRouter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the email field", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
  });

  it("calls resetPasswordForEmail with a recovery redirect target", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email Address"), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        "test@example.com",
        {
          redirectTo: expect.stringMatching(/\/auth\/callback\?type=recovery/),
        },
      );
    });
  });

  it("shows a confirmation after the email is sent", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email Address"), "test@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/reset link is on its way/i)).toBeInTheDocument();
    });
  });

  it("shows an error when the email lookup fails", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    supabase.auth.resetPasswordForEmail.mockResolvedValue({
      error: { message: "Email not found" },
    });

    render(<ForgotPasswordPage />);

    await user.type(
      screen.getByLabelText("Email Address"),
      "nobody@example.com",
    );
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText("Email not found")).toBeInTheDocument();
    });
  });
});

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "recovery-user" } } },
      error: null,
    });
    supabase.auth.updateUser.mockResolvedValue({ error: null });
    mockRouter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls updateUser with the new password on submit", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("New Password"), "newpass123");
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "newpass123",
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: "newpass123",
      });
    });
  });

  it("shows a success message after the password is updated", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("New Password"), "newpass123");
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "newpass123",
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/has been updated successfully/i),
      ).toBeInTheDocument();
    });
  });

  it("rejects mismatched passwords", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("New Password"), "newpass123");
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "different1",
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("handles an invalid/expired recovery token (no session)", async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: /request a new reset link/i }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("handles an updateUser session error as an expired token", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    supabase.auth.updateUser.mockResolvedValue({
      error: { message: "Auth session missing" },
    });

    render(<ResetPasswordPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("New Password"), "newpass123");
    await user.type(
      screen.getByLabelText("Confirm New Password"),
      "newpass123",
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    });
  });
});
