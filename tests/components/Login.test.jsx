import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "../../pages/login";
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
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      resend: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: { role: "donor" }, error: null }),
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

describe("LoginPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: null,
    });
    supabase.auth.resend.mockResolvedValue({ error: null });
    supabase.maybeSingle.mockResolvedValue({
      data: { role: "donor" },
      error: null,
    });
    mockRouter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders login form with email and password fields", () => {
    render(<LoginPage />);

    const email = screen.getByLabelText("Email Address");
    const password = screen.getByLabelText("Password");
    expect(email).toBeInTheDocument();
    expect(email).toHaveAttribute("type", "email");
    expect(password).toBeInTheDocument();
    expect(password).toHaveAttribute("type", "password");
  });

  it("renders brand heading", () => {
    render(<LoginPage />);

    expect(
      screen.getAllByText("Architectural Intelligence.").length,
    ).toBeGreaterThan(0);
  });

  it('renders "Login" heading', () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("allows typing email and password", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoginPage />);

    const email = screen.getByLabelText("Email Address");
    const password = screen.getByLabelText("Password");

    await user.type(email, "test@example.com");
    await user.type(password, "password123");

    // Re-query fresh DOM references after React re-renders
    expect(screen.getByLabelText("Email Address")).toHaveValue(
      "test@example.com",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("password123");
  });

  it("calls supabase.auth.signInWithPassword on form submit", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoginPage />);

    const email = screen.getByLabelText("Email Address");
    const password = screen.getByLabelText("Password");

    await user.type(email, "test@example.com");
    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
  });

  it("shows error message on failed login", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: "Invalid login credentials" },
    });

    render(<LoginPage />);

    const email = screen.getByLabelText("Email Address");
    const password = screen.getByLabelText("Password");

    await user.type(email, "test@example.com");
    await user.type(password, "wrongpassword");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid login credentials")).toBeInTheDocument();
    });
  });

  it('shows "Logging in..." text while loading', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let resolveLogin;
    supabase.auth.signInWithPassword.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );

    render(<LoginPage />);

    const email = screen.getByLabelText("Email Address");
    const password = screen.getByLabelText("Password");

    await user.type(email, "test@example.com");
    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /logging in/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled();

    resolveLogin({ data: {}, error: null });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /login/i }),
      ).toBeInTheDocument();
    });
  });

  it('redirects to "/" on successful login', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mockRouter();
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: null,
    });

    render(<LoginPage />);

    const email = screen.getByLabelText("Email Address");
    const password = screen.getByLabelText("Password");

    await user.type(email, "test@example.com");
    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/");
    });
  });

  it("honors ?redirect= before the role-based dashboard (precedence)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const router = mockRouter({ query: { redirect: "/create" } });
    // Even a creator with a resolvable session is redirected to the explicit
    // ?redirect= target — the dashboard routing never runs.
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: { user: { id: "u1" } } },
      error: null,
    });
    supabase.maybeSingle.mockResolvedValue({
      data: { role: "creator" },
      error: null,
    });

    render(<LoginPage />);

    const email = screen.getByLabelText("Email Address");
    const password = screen.getByLabelText("Password");

    await user.type(email, "test@example.com");
    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/create");
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  describe("role-based redirect after login", () => {
    it("redirects a creator to /creator/dashboard", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const router = mockRouter();
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: { user: { id: "u1" } } },
        error: null,
      });
      supabase.maybeSingle.mockResolvedValue({
        data: { role: "creator" },
        error: null,
      });

      render(<LoginPage />);

      await user.type(
        screen.getByLabelText("Email Address"),
        "creator@example.com",
      );
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: /login/i }));

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith("/creator/dashboard");
      });
    });

    it("redirects an investor (donor) to /investor/dashboard", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const router = mockRouter();
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: { user: { id: "u2" } } },
        error: null,
      });
      supabase.maybeSingle.mockResolvedValue({
        data: { role: "donor" },
        error: null,
      });

      render(<LoginPage />);

      await user.type(
        screen.getByLabelText("Email Address"),
        "investor@example.com",
      );
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: /login/i }));

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith("/investor/dashboard");
      });
    });

    it("redirects a platform admin to /admin/dashboard", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const router = mockRouter();
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: { user: { id: "u3" } } },
        error: null,
      });
      supabase.maybeSingle.mockResolvedValue({
        data: { role: "platform_admin" },
        error: null,
      });

      render(<LoginPage />);

      await user.type(
        screen.getByLabelText("Email Address"),
        "admin@example.com",
      );
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: /login/i }));

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith("/admin/dashboard");
      });
    });
  });

  it("blocks unverified accounts and offers to resend the verification email", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });

    render(<LoginPage />);

    const email = screen.getByLabelText("Email Address");
    const password = screen.getByLabelText("Password");

    await user.type(email, "test@example.com");
    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/has not been verified yet/i),
      ).toBeInTheDocument();
    });

    const resendButton = screen.getByRole("button", {
      name: /resend verification email/i,
    });
    expect(resendButton).toBeInTheDocument();

    await user.click(resendButton);
    await waitFor(() => {
      expect(supabase.auth.resend).toHaveBeenCalledWith({
        type: "signup",
        email: "test@example.com",
      });
    });
    expect(screen.getByText(/verification email sent/i)).toBeInTheDocument();
  });

  it('renders a "Forgot password?" link', () => {
    render(<LoginPage />);

    const link = screen.getByRole("link", { name: /forgot password/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("links to signup page", () => {
    render(<LoginPage />);

    const signupLink = screen.getByRole("link", { name: /sign up/i });
    expect(signupLink).toBeInTheDocument();
    expect(signupLink).toHaveAttribute("href", "/signup");
  });

  it("renders Footer", () => {
    render(<LoginPage />);

    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("displays the login subheading text", () => {
    render(<LoginPage />);

    expect(
      screen.getByText(
        "Secure access to the world's most sophisticated crowdfunding ecosystem.",
      ),
    ).toBeInTheDocument();
  });
});
