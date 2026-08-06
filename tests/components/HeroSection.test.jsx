import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HeroSection from "../../components/landing/HeroSection";
import { useRole } from "../../context/RoleContext";
import { useRouter } from "next/router";
import { ROLES } from "../../lib/roles";

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

describe("HeroSection role-aware CTAs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter();
  });

  describe("guest", () => {
    it("shows Start Your Journey and Explore Projects", () => {
      mockUseRole({ user: null });
      render(<HeroSection />);

      expect(
        screen.getByRole("button", { name: "Start Your Journey" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Explore Projects" }),
      ).toBeInTheDocument();
    });

    it("does not show role-gated CTAs", () => {
      mockUseRole({ user: null });
      render(<HeroSection />);

      expect(
        screen.queryByRole("button", { name: "Start Project" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "My Dashboard" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Admin Dashboard" }),
      ).not.toBeInTheDocument();
    });

    it("navigates Start Your Journey to /get-started", async () => {
      const user = userEvent.setup();
      const router = mockRouter();
      mockUseRole({ user: null });
      render(<HeroSection />);

      await user.click(
        screen.getByRole("button", { name: "Start Your Journey" }),
      );
      expect(router.push).toHaveBeenCalledWith("/get-started");
    });

    it("navigates Explore Projects to /explore", async () => {
      const user = userEvent.setup();
      const router = mockRouter();
      mockUseRole({ user: null });
      render(<HeroSection />);

      await user.click(
        screen.getByRole("button", { name: "Explore Projects" }),
      );
      expect(router.push).toHaveBeenCalledWith("/explore");
    });
  });

  describe("investor (donor)", () => {
    it("shows Explore Projects and My Dashboard, hides Start Project", () => {
      mockUseRole({ user: { id: "u1" }, role: ROLES.INVESTOR });
      render(<HeroSection />);

      expect(
        screen.getByRole("button", { name: "Explore Projects" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "My Dashboard" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Start Project" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Start Your Journey" }),
      ).not.toBeInTheDocument();
    });

    it("navigates My Dashboard to /investor/dashboard", async () => {
      const user = userEvent.setup();
      const router = mockRouter();
      mockUseRole({ user: { id: "u1" }, role: ROLES.INVESTOR });
      render(<HeroSection />);

      await user.click(screen.getByRole("button", { name: "My Dashboard" }));
      expect(router.push).toHaveBeenCalledWith("/investor/dashboard");
    });
  });

  describe("creator", () => {
    it("shows Start Project and Explore Projects", () => {
      mockUseRole({ user: { id: "u2" }, role: ROLES.CREATOR });
      render(<HeroSection />);

      expect(
        screen.getByRole("button", { name: "Start Project" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Explore Projects" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "My Dashboard" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Admin Dashboard" }),
      ).not.toBeInTheDocument();
    });

    it("navigates Start Project to /create", async () => {
      const user = userEvent.setup();
      const router = mockRouter();
      mockUseRole({ user: { id: "u2" }, role: ROLES.CREATOR });
      render(<HeroSection />);

      await user.click(screen.getByRole("button", { name: "Start Project" }));
      expect(router.push).toHaveBeenCalledWith("/create");
    });
  });

  describe("platform admin", () => {
    it("shows Admin Dashboard and Explore Projects", () => {
      mockUseRole({ user: { id: "u3" }, role: ROLES.ADMIN });
      render(<HeroSection />);

      expect(
        screen.getByRole("button", { name: "Admin Dashboard" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Explore Projects" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Start Project" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "My Dashboard" }),
      ).not.toBeInTheDocument();
    });

    it("navigates Admin Dashboard to /admin/dashboard", async () => {
      const user = userEvent.setup();
      const router = mockRouter();
      mockUseRole({ user: { id: "u3" }, role: ROLES.ADMIN });
      render(<HeroSection />);

      await user.click(screen.getByRole("button", { name: "Admin Dashboard" }));
      expect(router.push).toHaveBeenCalledWith("/admin/dashboard");
    });
  });

  describe("loading", () => {
    it("renders no CTA buttons while the role is being resolved", () => {
      mockUseRole({ user: null, loading: true });
      render(<HeroSection />);

      expect(
        screen.queryByRole("button", { name: "Start Your Journey" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Start Project" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Explore Projects" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "My Dashboard" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Admin Dashboard" }),
      ).not.toBeInTheDocument();
    });
  });
});
