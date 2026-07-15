import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignupPage from "../../pages/signup";

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

// Helper to get inputs by type since labels lack `for` attributes
function getFormInputs() {
  const form = document.querySelector("form");
  return {
    fullName: form.querySelector('input[type="text"]'),
    email: form.querySelector('input[type="email"]'),
    password: form.querySelector('input[type="password"]'),
  };
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.signUp.mockResolvedValue({ data: {}, error: null });
  });

  it("renders signup form with full name, email, and password fields", () => {
    render(<SignupPage />);

    const { fullName, email, password } = getFormInputs();
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
    const user = userEvent.setup();
    render(<SignupPage />);

    const { fullName, email, password } = getFormInputs();

    await user.type(fullName, "John Doe");
    await user.type(email, "john@example.com");
    await user.type(password, "securepass123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "john@example.com",
      password: "securepass123",
      options: { data: { full_name: "John Doe" } },
    });
  });

  it("shows success message after signup", async () => {
    const user = userEvent.setup();
    supabase.auth.signUp.mockResolvedValue({ data: {}, error: null });

    render(<SignupPage />);

    const { fullName, email, password } = getFormInputs();

    await user.type(fullName, "Jane Doe");
    await user.type(email, "jane@example.com");
    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText("Account created! Please verify your email before logging in.")).toBeInTheDocument();
    });
  });

  it("shows error message on failed signup", async () => {
    const user = userEvent.setup();
    supabase.auth.signUp.mockResolvedValue({
      data: null,
      error: { message: "User already registered" },
    });

    render(<SignupPage />);

    const { fullName, email, password } = getFormInputs();

    await user.type(fullName, "Jane Doe");
    await user.type(email, "jane@example.com");
    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText("User already registered")).toBeInTheDocument();
    });
  });

  it('shows "Creating..." text while loading', async () => {
    const user = userEvent.setup();
    let resolveSignUp;
    supabase.auth.signUp.mockImplementation(
      () => new Promise((resolve) => { resolveSignUp = resolve; })
    );

    render(<SignupPage />);

    const { fullName, email, password } = getFormInputs();

    await user.type(fullName, "Jane Doe");
    await user.type(email, "jane@example.com");
    await user.type(password, "password123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /creating/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();

    resolveSignUp({ data: {}, error: null });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
    });
  });

  it("links to login page", () => {
    render(<SignupPage />);

    const loginLink = screen.getByRole("link", { name: /log in/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
  });

  it("renders Fundora brand name", () => {
    render(<SignupPage />);

    expect(screen.getAllByText("Fundora").length).toBeGreaterThan(0);
  });

  it("renders Navbar and Footer", () => {
    render(<SignupPage />);

    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("does not show error or success messages initially", () => {
    render(<SignupPage />);

    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/account created/i)).not.toBeInTheDocument();
  });

  it("does not show success message when signup fails", async () => {
    const user = userEvent.setup();
    supabase.auth.signUp.mockResolvedValue({
      data: null,
      error: { message: "Password too short" },
    });

    render(<SignupPage />);

    const { fullName, email, password } = getFormInputs();

    await user.type(fullName, "Jane Doe");
    await user.type(email, "jane@example.com");
    await user.type(password, "123");
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText("Password too short")).toBeInTheDocument();
    });
    expect(screen.queryByText(/account created/i)).not.toBeInTheDocument();
  });

  it("all fields are required", () => {
    render(<SignupPage />);

    const { fullName, email, password } = getFormInputs();

    expect(fullName).toBeRequired();
    expect(email).toBeRequired();
    expect(password).toBeRequired();
  });
});
