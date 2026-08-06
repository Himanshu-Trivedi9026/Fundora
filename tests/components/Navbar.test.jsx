import { render, screen, fireEvent } from "@testing-library/react";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../context/RoleContext";
import { useRouter } from "next/router";
import { ROLES } from "../../lib/roles";

// --- Hoisted mocks (safe inside vi.mock factory) ---
const m = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockNeq: vi.fn(),
  mockChannel: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockOn: vi.fn(),
  mockSubscribe: vi.fn(),
}));

vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: m.mockFrom,
    channel: m.mockChannel,
    removeChannel: m.mockRemoveChannel,
  },
}));

vi.mock("../../context/RoleContext", () => ({
  useRole: vi.fn(),
}));

vi.mock("next/image", () => ({
  // Test-only mock: next/image's optimizer is unavailable under jsdom.
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props) => <img {...props} />,
}));

function mockUseRoleValue(overrides = {}) {
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

describe("Navbar role-based navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter();
  });

  describe("Explore visibility (always)", () => {
    it.each([
      ["guest", { user: null, role: ROLES.INVESTOR }],
      ["investor", { user: { id: "u1" }, role: ROLES.INVESTOR }],
      ["creator", { user: { id: "u2" }, role: ROLES.CREATOR }],
    ])("%s always sees Explore", (_label, roleCtx) => {
      mockUseRoleValue(roleCtx);
      render(<Navbar />);

      expect(screen.getByRole("link", { name: "Explore" })).toBeInTheDocument();
    });
  });

  describe("Start a project visibility", () => {
    it("hides Start a project for guests", () => {
      mockUseRoleValue({ user: null, role: ROLES.INVESTOR });
      render(<Navbar />);

      expect(
        screen.queryByRole("link", { name: "Start a project" }),
      ).not.toBeInTheDocument();
    });

    it("hides Start a project for investors", () => {
      mockUseRoleValue({ user: { id: "u1" }, role: ROLES.INVESTOR });
      render(<Navbar />);

      expect(
        screen.queryByRole("link", { name: "Start a project" }),
      ).not.toBeInTheDocument();
    });

    it("shows Start a project for creators and links to the creation flow", () => {
      mockUseRoleValue({ user: { id: "u2" }, role: ROLES.CREATOR });
      render(<Navbar />);

      const startLink = screen.getByRole("link", { name: "Start a project" });
      expect(startLink).toBeInTheDocument();
      // next/link navigates via href — creators land in the creation flow.
      expect(startLink).toHaveAttribute("href", "/create");
    });

    it("hides Start a project while the role is loading (no wrong flash)", () => {
      mockUseRoleValue({ user: null, role: ROLES.INVESTOR, loading: true });
      render(<Navbar />);

      expect(
        screen.queryByRole("link", { name: "Start a project" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Analytics visibility (creator-area route)", () => {
    it("hides Analytics for investors", () => {
      mockUseRoleValue({ user: { id: "u1" }, role: ROLES.INVESTOR });
      render(<Navbar />);

      expect(
        screen.queryByRole("button", { name: "Analytics" }),
      ).not.toBeInTheDocument();
    });

    it("shows Analytics for creators", () => {
      mockUseRoleValue({ user: { id: "u2" }, role: ROLES.CREATOR });
      render(<Navbar />);

      expect(
        screen.getByRole("button", { name: "Analytics" }),
      ).toBeInTheDocument();
    });
  });

  describe("Creator account dropdown navigation", () => {
    /** Open the account dropdown and return the rendered menu links. */
    function openCreatorMenu() {
      mockUseRoleValue({
        user: { id: "u2", email: "creator@fundora.app" },
        role: ROLES.CREATOR,
      });
      render(<Navbar />);
      fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    }

    it("renders each role-specific item as its own distinct destination", () => {
      openCreatorMenu();

      const expected = {
        Dashboard: "/creator/dashboard",
        "My Campaigns": "/creator/projects",
        Analytics: "/creator/analytics",
        "AI Insights": "/creator/ai-assistant",
        Verification: "/creator/verification",
        Payouts: "/creator/payouts",
        Razorpay: "/creator/payments",
        Followers: "/followers",
      };

      for (const [label, href] of Object.entries(expected)) {
        const link = screen.getByRole("menuitem", { name: label });
        expect(link).toHaveAttribute("href", href);
      }
    });

    it("renders Settings, Delete Account and Logout with distinct targets", () => {
      openCreatorMenu();

      const settings = screen.getByRole("menuitem", { name: "Settings" });
      expect(settings).toHaveAttribute("href", "/edit-profile");

      const deleteAcct = screen.getByRole("menuitem", {
        name: "Delete Account",
      });
      expect(deleteAcct).toHaveAttribute("href", "/account/delete");

      // Logout is an action button (no href) — distinct from the navigation links.
      const logout = screen.getByRole("button", { name: "Logout" });
      expect(logout.tagName).toBe("BUTTON");
      expect(logout).not.toHaveAttribute("href");
    });

    it("does not route any creator menu item to the profile page", () => {
      openCreatorMenu();

      const profileHref = "/creator/profile";
      const menuLinks = screen
        .getAllByRole("menuitem")
        .filter((el) => el.tagName === "A");
      for (const link of menuLinks) {
        expect(link.getAttribute("href")).not.toBe(profileHref);
      }
    });
  });
});
