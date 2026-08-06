import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GetStarted from "../../pages/get-started";
import { useRole } from "../../context/RoleContext";
import { useRouter } from "next/router";
import { ROLES } from "../../lib/roles";

vi.mock("../../components/Footer", () => ({
  default: () => <div data-testid="footer" />,
}));

vi.mock("../../context/RoleContext", () => ({
  useRole: vi.fn(),
}));

function mockUseRole(overrides = {}) {
  vi.mocked(useRole).mockReturnValue({
    user: null,
    profile: null,
    role: ROLES.INVESTOR,
    isAdmin: false,
    isCreator: false,
    isDonor: true,
    isInvestor: true,
    loading: false,
    refreshRole: vi.fn(),
    ...overrides,
  });
}

function mockRouter() {
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
  };
  vi.mocked(useRouter).mockReturnValue(router);
  return router;
}

describe("GetStarted role-selection page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter();
  });

  describe("guest", () => {
    it("shows both role cards (I'm an Investor and I'm a Creator)", () => {
      mockUseRole({ user: null });
      render(<GetStarted />);

      expect(screen.getByRole("heading", { name: "I'm an Investor" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "I'm a Creator" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Continue as Investor/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Continue as Creator/i })).toBeInTheDocument();
    });

    it("does not redirect a guest to a role home", () => {
      const router = mockRouter();
      mockUseRole({ user: null });
      render(<GetStarted />);

      expect(router.replace).not.toHaveBeenCalled();
    });

    it("renders the onboarding heading, subtitle, and Log In link", () => {
      mockUseRole({ user: null });
      render(<GetStarted />);

      expect(
        screen.getByRole("heading", { name: "Choose how you want to join Fundora" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Pick the path that fits your goals/i),
      ).toBeInTheDocument();

      const loginLink = screen.getByRole("link", { name: /log in/i });
      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute("href", "/login");
    });

    it("shows the Investor and Creator emoji icons on the cards", () => {
      mockUseRole({ user: null });
      render(<GetStarted />);

      // Emoji tiles are decorative (aria-hidden), so opt in to hidden elements.
      expect(screen.getByText("📈", { hidden: true })).toBeInTheDocument();
      expect(screen.getByText("🚀", { hidden: true })).toBeInTheDocument();
    });

    it("routes the investor path to /signup?role=donor", async () => {
      const user = userEvent.setup();
      const router = mockRouter();
      mockUseRole({ user: null });
      render(<GetStarted />);

      await user.click(screen.getByRole("button", { name: /Continue as Investor/i }));
      expect(router.push).toHaveBeenCalledWith("/signup?role=donor");
    });

    it("routes the creator path to /signup?role=creator", async () => {
      const user = userEvent.setup();
      const router = mockRouter();
      mockUseRole({ user: null });
      render(<GetStarted />);

      await user.click(screen.getByRole("button", { name: /Continue as Creator/i }));
      expect(router.push).toHaveBeenCalledWith("/signup?role=creator");
    });
  });

  describe("authenticated", () => {
    it("redirects an investor to /investor/dashboard", () => {
      const router = mockRouter();
      mockUseRole({ user: { id: "u1" }, role: ROLES.INVESTOR });
      render(<GetStarted />);

      expect(router.replace).toHaveBeenCalledWith("/investor/dashboard");
    });

    it("redirects a creator to /creator/dashboard", () => {
      const router = mockRouter();
      mockUseRole({ user: { id: "u2" }, role: ROLES.CREATOR });
      render(<GetStarted />);

      expect(router.replace).toHaveBeenCalledWith("/creator/dashboard");
    });

    it("redirects a platform admin to /admin/dashboard", () => {
      const router = mockRouter();
      mockUseRole({ user: { id: "u3" }, role: ROLES.ADMIN });
      render(<GetStarted />);

      expect(router.replace).toHaveBeenCalledWith("/admin/dashboard");
    });

    it("does not render role-selection cards to a signed-in user", () => {
      mockUseRole({ user: { id: "u1" }, role: ROLES.INVESTOR });
      render(<GetStarted />);

      expect(screen.queryByRole("heading", { name: "I'm an Investor" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "I'm a Creator" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Continue as Investor/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Continue as Creator/i })).not.toBeInTheDocument();
    });
  });

  describe("loading", () => {
    it("shows a loading state and does not redirect", () => {
      const router = mockRouter();
      mockUseRole({ user: null, loading: true });
      render(<GetStarted />);

      expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
      expect(router.replace).not.toHaveBeenCalled();
      expect(screen.queryByRole("heading", { name: "I'm an Investor" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Continue as Investor/i })).not.toBeInTheDocument();
    });
  });
});
