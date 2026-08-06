import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignupPage from "../../pages/signup";
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
      signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
}));

import { supabase } from "../../lib/supabaseClient";

function mockRouter(query = {}) {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    query,
    asPath: "/signup",
    pathname: "/signup",
    basePath: "",
    locale: "en",
    locales: ["en"],
    events: { on: vi.fn(), off: vi.fn() },
  };
  vi.mocked(useRouter).mockReturnValue(router);
  return router;
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    mockRouter();
    supabase.auth.signUp.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders signup form with full name, email, and password fields", () => {
    render(<SignupPage />);

    const fullName = screen.getByLabelText("Full Name");
    const email = screen.getByLabelText("Email Address");
    const password = screen.getByLabelText("Password");
    expect(fullName).toBeInTheDocument();
    expect(fullName).toHaveAttribute("type", "text");
    expect(email).toBeInTheDocument();
    expect(email).toHaveAttribute("type", "email");
    expect(password).toBeInTheDocument();
    expect(password).toHaveAttribute("type", "password");
  });

  it('renders "Create Account" heading', () => {
    render(<SignupPage />);

    expect(screen.getByRole("heading", { name: "Create Account" })).toBeInTheDocument();
  });

  it("calls supabase.auth.signUp on form submit with correct data", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SignupPage />);

    const fullName = screen.getByLabelText("Full Name");
    const email = screen.getByLabelText("Email Address");
    const password = screen.getByLabelText("Password");

    await user.type(fullName, "John Doe");
    await user.type(email, "john@example.com");
    await user.type(password, "securepass123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "john@example.com",
      password: "securepass123",
      options: {
        emailRedirectTo: expect.stringMatching(/\/auth\/callback\?next=\//),
        data: { full_name: "John Doe" },
      },
    });
  });

  it("shows success message after signup for a brand-new account", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    supabase.auth.signUp.mockResolvedValue({
      data: {
        user: { identities: [{ id: "identity-1" }], email_confirmed_at: null },
      },
      error: null,
    });

    render(<SignupPage />);

    const fullName = screen.getByLabelText("Full Name");
    const email = screen.getByLabelText("Email Address");
    const password = screen.getByLabelText("Password");

    await user.type(fullName, "Jane Doe");
    await user.type(email, "jane@example.com");
    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Account created! Please verify your email before logging in/i)).toBeInTheDocument();
    });
  });

  it("shows a friendly message for an already-registered verified account", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    supabase.auth.signUp.mockResolvedValue({
      data: {
        user: { identities: [], email_confirmed_at: "2026-01-01T00:00:00Z" },
      },
      error: null,
    });

    render(<SignupPage />);

    await user.type(screen.getByLabelText("Full Name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email Address"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/already exists.*log in instead/i)).toBeInTheDocument();
    });
  });

  it("shows a resend notice for an existing unverified account", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { identities: [], email_confirmed_at: null } },
      error: null,
    });

    render(<SignupPage />);

    await user.type(screen.getByLabelText("Full Name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email Address"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/verification email has been sent to this address/i)).toBeInTheDocument();
    });
  });

  it("shows error message on failed signup", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    supabase.auth.signUp.mockResolvedValue({
      data: null,
      error: { message: "User already registered" },
    });

    render(<SignupPage />);

    const fullName = screen.getByLabelText("Full Name");
    const email = screen.getByLabelText("Email Address");
    const password = screen.getByLabelText("Password");

    await user.type(fullName, "Jane Doe");
    await user.type(email, "jane@example.com");
    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText("User already registered")).toBeInTheDocument();
    });
  });

  it('shows "Creating..." text while loading', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let resolveSignUp;
    supabase.auth.signUp.mockImplementation(
      () => new Promise((resolve) => { resolveSignUp = resolve; })
    );

    render(<SignupPage />);

    const fullName = screen.getByLabelText("Full Name");
    const email = screen.getByLabelText("Email Address");
    const password = screen.getByLabelText("Password");

    await user.type(fullName, "Jane Doe");
    await user.type(email, "jane@example.com");
    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /creating/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();

    resolveSignUp({ data: {}, error: null });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
    });
  });

  it("links to login page", () => {
    render(<SignupPage />);

    const loginLink = screen.getByRole("link", { name: /log in/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
  });

  it("renders brand heading", () => {
    render(<SignupPage />);

    expect(screen.getAllByText("Establish your venture").length).toBeGreaterThan(0);
  });

  it("renders Footer", () => {
    render(<SignupPage />);

    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("does not show error or success messages initially", () => {
    render(<SignupPage />);

    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/account created/i)).not.toBeInTheDocument();
  });

  it("does not show success message when signup fails", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    supabase.auth.signUp.mockResolvedValue({
      data: null,
      error: { message: "Password too short" },
    });

    render(<SignupPage />);

    const fullName = screen.getByLabelText("Full Name");
    const email = screen.getByLabelText("Email Address");
    const password = screen.getByLabelText("Password");

    await user.type(fullName, "Jane Doe");
    await user.type(email, "jane@example.com");
    await user.type(password, "123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText("Password too short")).toBeInTheDocument();
    });
    expect(screen.queryByText(/account created/i)).not.toBeInTheDocument();
  });

  it("all fields are present and editable", () => {
    render(<SignupPage />);

    const fullName = screen.getByLabelText("Full Name");
    const email = screen.getByLabelText("Email Address");
    const password = screen.getByLabelText("Password");

    expect(fullName).toBeInTheDocument();
    expect(email).toBeInTheDocument();
    expect(password).toBeInTheDocument();
  });

  describe("role-first onboarding (role from URL)", () => {
    async function fillAndSubmit(user) {
      await user.type(screen.getByLabelText("Full Name"), "Jane Doe");
      await user.type(screen.getByLabelText("Email Address"), "jane@example.com");
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: /create account/i }));
    }

    function lastRedirectTo() {
      return supabase.auth.signUp.mock.calls[0][0].options.emailRedirectTo;
    }

    it("carries ?role=creator into the verification link", async () => {
      mockRouter({ role: "creator" });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SignupPage />);
      await fillAndSubmit(user);

      expect(lastRedirectTo()).toContain("role=creator");
    });

    it("defaults to ?role=donor when no role is provided", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SignupPage />);
      await fillAndSubmit(user);

      expect(lastRedirectTo()).toContain("role=donor");
    });

    it("blocks self-elevation: ?role=platform_admin falls back to donor", async () => {
      mockRouter({ role: "platform_admin" });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SignupPage />);
      await fillAndSubmit(user);

      expect(lastRedirectTo()).toContain("role=donor");
      expect(lastRedirectTo()).not.toContain("platform_admin");
    });

    it("renders no role selector — the role is not editable", () => {
      const { container } = render(<SignupPage />);

      // Only the name/email/password inputs exist — no role dropdown or picker.
      expect(container.querySelectorAll("input").length).toBe(3);
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("shows a read-only joining badge reflecting the URL role", () => {
      mockRouter({ role: "creator" });
      render(<SignupPage />);

      // The badge's role label is its own <span>, so match the paragraph's
      // combined text content rather than a single regex against one node.
      const badge = screen.getByText((_, element) =>
        element?.tagName === "P" && element.textContent.includes("joining as"),
      );
      expect(badge.textContent.replace(/\s+/g, " ").trim()).toBe(
        "You're joining as Creator",
      );
    });

    it("shows Investor in the badge when the role defaults to donor", () => {
      render(<SignupPage />);

      const badge = screen.getByText((_, element) =>
        element?.tagName === "P" && element.textContent.includes("joining as"),
      );
      expect(badge.textContent.replace(/\s+/g, " ").trim()).toBe(
        "You're joining as Investor",
      );
    });
  });
});
