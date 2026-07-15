import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "../../pages/login";

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
    },
  },
}));

import { supabase } from "../../lib/supabaseClient";

// Helper to get inputs by type since labels lack `for` attributes
function getFormInputs() {
  const form = document.querySelector("form");
  return {
    email: form.querySelector('input[type="email"]'),
    password: form.querySelector('input[type="password"]'),
  };
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    delete window.location;
    window.location = { href: "" };
  });

  afterEach(() => {
    window.location = { href: "" };
  });

  it("renders login form with email and password fields", () => {
    render(<LoginPage />);

    const { email, password } = getFormInputs();
    expect(email).toBeInTheDocument();
    expect(email).toHaveAttribute("type", "email");
    expect(password).toBeInTheDocument();
    expect(password).toHaveAttribute("type", "password");
  });

  it("renders Fundora brand name", () => {
    render(<LoginPage />);

    expect(screen.getAllByText("Fundora").length).toBeGreaterThan(0);
  });

  it('renders "Login" heading', () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("allows typing email and password", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const { email, password } = getFormInputs();

    await user.type(email, "test@example.com");
    await user.type(password, "password123");

    expect(email).toHaveValue("test@example.com");
    expect(password).toHaveValue("password123");
  });

  it("calls supabase.auth.signInWithPassword on form submit", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const { email, password } = getFormInputs();

    await user.type(email, "test@example.com");
    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
  });

  it("shows error message on failed login", async () => {
    const user = userEvent.setup();
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: "Invalid login credentials" },
    });

    render(<LoginPage />);

    const { email, password } = getFormInputs();

    await user.type(email, "test@example.com");
    await user.type(password, "wrongpassword");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid login credentials")).toBeInTheDocument();
    });
  });

  it('shows "Logging in..." text while loading', async () => {
    const user = userEvent.setup();
    let resolveLogin;
    supabase.auth.signInWithPassword.mockImplementation(
      () => new Promise((resolve) => { resolveLogin = resolve; })
    );

    render(<LoginPage />);

    const { email, password } = getFormInputs();

    await user.type(email, "test@example.com");
    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /logging in/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled();

    resolveLogin({ data: {}, error: null });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
    });
  });

  it('redirects to "/" on successful login', async () => {
    const user = userEvent.setup();
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });

    render(<LoginPage />);

    const { email, password } = getFormInputs();

    await user.type(email, "test@example.com");
    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(window.location.href).toBe("/");
    });
  });

  it("links to signup page", () => {
    render(<LoginPage />);

    const signupLink = screen.getByRole("link", { name: /sign up/i });
    expect(signupLink).toBeInTheDocument();
    expect(signupLink).toHaveAttribute("href", "/signup");
  });

  it("renders Navbar and Footer", () => {
    render(<LoginPage />);

    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("displays the login subheading text", () => {
    render(<LoginPage />);

    expect(screen.getByText("Fund ideas. Fuel innovation. Empower creators.")).toBeInTheDocument();
  });
});
