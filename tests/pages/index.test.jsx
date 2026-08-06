import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Home, { getStaticProps } from "../../pages/index";
import { loadLandingPageData, EMPTY_STATS } from "../../lib/landing/landingData";
import { supabaseServer } from "../../lib/supabaseServer";

// Keep the real supabaseClient mock from tests/setup.js (components subscribe
// to realtime with it) but stub the ISR server client and the page data loader.
vi.mock("../../lib/supabaseServer", () => ({
  supabaseServer: {},
}));

vi.mock("../../lib/landing/landingData", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    loadLandingPageData: vi.fn(),
  };
});

// Hero CTAs render client-side from RoleContext; stub a signed-out user so the
// guest "Start Your Journey" CTA shows and no role data is ever fetched.
vi.mock("../../context/RoleContext", () => ({
  useRole: () => ({
    user: null,
    profile: null,
    role: "donor",
    isAdmin: false,
    isCreator: false,
    isDonor: true,
    isInvestor: true,
    loading: false,
    refreshRole: vi.fn(),
  }),
}));

vi.mock("next/image", () => ({
  // Test-only mock: next/image's optimizer is unavailable under jsdom.
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props) => <img {...props} />,
}));

// jsdom lacks IntersectionObserver; framer-motion's whileInView / useInView
// need it. Fire as intersecting so animations run to their visible state.
class FakeIntersectionObserver {
  constructor(cb) {
    this.cb = cb;
  }
  observe(el) {
    this.cb([{ isIntersecting: true, target: el }]);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

describe("pages/index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.IntersectionObserver = FakeIntersectionObserver;
  });

  describe("getStaticProps (ISR)", () => {
    it("returns public stats + trending with revalidate: 60", async () => {
      const initialStats = { ...EMPTY_STATS, totalRaised: 100000 };
      const initialTrending = { projects: [{ id: "p1", title: "Alpha" }], creatorMap: {} };
      vi.mocked(loadLandingPageData).mockResolvedValueOnce({
        initialStats,
        initialTrending,
      });

      const result = await getStaticProps();

      // Reads through the public server client, not any session data.
      expect(loadLandingPageData).toHaveBeenCalledWith(supabaseServer);
      expect(result).toEqual({
        props: { initialStats, initialTrending },
        revalidate: 60,
      });
    });
  });

  describe("render", () => {
    it("renders hero, stats, and trending sections", async () => {
      render(
        <Home
          initialStats={{ ...EMPTY_STATS, totalRaised: 100000, totalBackers: 4 }}
          initialTrending={{
            projects: [
              {
                id: "p1",
                title: "ISR Campaign",
                goal: 100000,
                pledged: 50000,
                categories: ["AI"],
                owner_id: "u1",
                short: "A server-rendered campaign.",
              },
            ],
            creatorMap: { u1: "Alice Founder" },
          }}
        />,
      );

      // Hero renders server-side with the guest CTA (no client role fetch).
      expect(screen.getByRole("heading", { name: /Fundora/i })).toBeInTheDocument();

      // Stats render from the ISR payload — no ₹0 flash, real values.
      expect(screen.getByText("Capital Raised")).toBeInTheDocument();

      // Trending renders the server-rendered campaign immediately.
      await waitFor(() => {
        expect(screen.getByText("ISR Campaign")).toBeInTheDocument();
      });

      // Below-the-fold lazy sections hydrate into the same markup.
      await waitFor(() => {
        expect(screen.getByText("The Intelligent Ecosystem")).toBeInTheDocument();
      });
    });
  });
});
