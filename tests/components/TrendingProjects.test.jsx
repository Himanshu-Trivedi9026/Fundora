import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TrendingProjects from "../../components/landing/TrendingProjects";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/router";
import { useRole } from "../../context/RoleContext";
import { ROLES } from "../../lib/roles";
import { TRENDING_SELECT } from "../../lib/landing/trendingQuery";

// --- Hoisted mocks (safe inside vi.mock factory) ---
const m = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
  mockLimit: vi.fn(),
  mockProfileSelect: vi.fn(),
  mockIn: vi.fn(),
  mockChannel: vi.fn(),
  mockRemoveChannel: vi.fn(),
  mockOn: vi.fn(),
  mockSubscribe: vi.fn(),
}));

vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    from: m.mockFrom,
    channel: m.mockChannel,
    removeChannel: m.mockRemoveChannel,
  },
}));

vi.mock("next/image", () => ({
  // Test-only mock: next/image's optimizer is unavailable under jsdom.
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props) => <img {...props} />,
}));

vi.mock("../../context/RoleContext", () => ({
  useRole: vi.fn(),
}));

/** Default: a creator, so the empty-state "Start a campaign" CTA renders. */
function mockUseRoleValue(overrides = {}) {
  vi.mocked(useRole).mockReturnValue({
    user: { id: "u2" },
    profile: null,
    role: ROLES.CREATOR,
    isAdmin: false,
    isCreator: true,
    isDonor: false,
    isInvestor: false,
    loading: false,
    refreshRole: vi.fn(),
    ...overrides,
  });
}

/**
 * Mock the Supabase query builder so the component exercises the real
 * buildTrendingQuery ranking chain (projects) plus the batch creator-name
 * lookup (profiles). Every method returns the same chain so `.then(...)`
 * resolves with the given payload, matching how supabase-js awaits queries.
 */
function mockProjects(data, profiles = []) {
  m.mockFrom.mockImplementation((table) => {
    if (table === "profiles") {
      const q = {
        select: m.mockProfileSelect,
        in: m.mockIn,
        then: (resolve) => resolve({ data: profiles, error: null }),
      };
      m.mockProfileSelect.mockReturnValue(q);
      m.mockIn.mockReturnValue(q);
      return q;
    }
    const q = {
      select: m.mockSelect,
      eq: m.mockEq,
      order: m.mockOrder,
      limit: m.mockLimit,
      then: (resolve) => resolve({ data, error: null }),
    };
    m.mockSelect.mockReturnValue(q);
    m.mockEq.mockReturnValue(q);
    m.mockOrder.mockReturnValue(q);
    m.mockLimit.mockReturnValue(q);
    return q;
  });
}

function mockRealtime() {
  m.mockChannel.mockReturnValue({
    on: m.mockOn.mockReturnThis(),
    subscribe: m.mockSubscribe.mockReturnValue({ name: "landing-trending" }),
  });
}

// jsdom lacks IntersectionObserver; framer-motion's whileInView needs one.
function mockInView() {
  class FakeIO {
    constructor(cb) {
      this.cb = cb;
    }
    observe(el) {
      this.cb([{ isIntersecting: true, target: el }]);
    }
    unobserve() {}
    disconnect() {}
  }
  global.IntersectionObserver = FakeIO;
}

const future = (days) => new Date(Date.now() + days * 86400000).toISOString();

describe("TrendingProjects live campaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjects([]);
    mockRealtime();
    mockInView();
    mockUseRoleValue();
  });

  it("renders live project cards with every real field from Supabase", async () => {
    mockProjects(
      [
        {
          id: "p1",
          title: "Alpha Startup",
          pledged: 90000,
          goal: 100000,
          deadline: future(5),
          categories: ["AI", "SaaS"],
          owner_id: "u1",
          thumbnail: "/alpha.png",
          short: "Short A",
        },
        {
          id: "p2",
          title: "Beta CleanTech",
          pledged: 50000,
          goal: 200000,
          deadline: future(10),
          categories: ["Climate"],
          owner_id: "u2",
          thumbnail: null,
          short: "Short B",
        },
      ],
      [
        { id: "u1", full_name: "Alice Founder" },
        { id: "u2", full_name: "Bob Builder" },
      ],
    );

    render(<TrendingProjects />);

    await waitFor(() => {
      expect(screen.getByText("Alpha Startup")).toBeInTheDocument();
    });

    // Real title + description
    expect(screen.getByText("Beta CleanTech")).toBeInTheDocument();
    expect(screen.getByText("Short A")).toBeInTheDocument();

    // Real funding % and pledged/raised amounts
    expect(screen.getByText("90% Funded")).toBeInTheDocument();
    expect(screen.getByText("₹90,000")).toBeInTheDocument();
    expect(screen.getByText("₹50,000")).toBeInTheDocument();

    // Real goals
    expect(screen.getByText("₹1,00,000")).toBeInTheDocument();
    expect(screen.getByText("₹2,00,000")).toBeInTheDocument();

    // Real days remaining
    expect(screen.getByText("5 Days")).toBeInTheDocument();
    expect(screen.getByText("10 Days")).toBeInTheDocument();

    // Real category (from the categories[] column)
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Climate")).toBeInTheDocument();

    // Real creator names (batch-fetched from profiles)
    expect(screen.getByText("by Alice Founder")).toBeInTheDocument();
    expect(screen.getByText("by Bob Builder")).toBeInTheDocument();

    // AI scores derived from real data (Growth Catalyst)
    expect(screen.getByText("AI 92")).toBeInTheDocument();
    expect(screen.getByText("AI 73")).toBeInTheDocument();
  });

  it("filters to active campaigns, ranks by pledged then recency, and limits to 3", async () => {
    mockProjects([{ id: "p1", title: "Alpha", pledged: 10, goal: 100 }]);

    render(<TrendingProjects />);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("projects");
    });
    expect(m.mockSelect).toHaveBeenCalledWith(TRENDING_SELECT);
    expect(m.mockEq).toHaveBeenCalledWith("deleted", false);
    expect(m.mockOrder).toHaveBeenCalledWith("pledged", { ascending: false });
    expect(m.mockOrder).toHaveBeenCalledWith("updated_at", {
      ascending: false,
    });
    expect(m.mockLimit).toHaveBeenCalledWith(3);
  });

  it("batch-fetches creator names from profiles, deduped by owner id", async () => {
    mockProjects(
      [
        { id: "p1", title: "One", owner_id: "u1", goal: 100, pledged: 10 },
        { id: "p2", title: "Two", owner_id: "u1", goal: 100, pledged: 20 },
      ],
      [{ id: "u1", full_name: "Alice Founder" }],
    );

    render(<TrendingProjects />);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith("profiles");
    });
    expect(m.mockProfileSelect).toHaveBeenCalledWith("id, full_name");
    expect(m.mockIn).toHaveBeenCalledWith("id", ["u1"]);
    // Both cards belong to the same creator -> deduped fetch, name on each card
    expect(screen.getAllByText("by Alice Founder")).toHaveLength(2);
  });

  it("renders the icon tile fallback when a thumbnail is missing", async () => {
    mockProjects([
      {
        id: "p1",
        title: "No Image",
        owner_id: "u1",
        goal: 100,
        pledged: 10,
        thumbnail: null,
      },
    ]);

    render(<TrendingProjects />);

    await waitFor(() => {
      expect(screen.getByText("No Image")).toBeInTheDocument();
    });
    expect(screen.getByTestId("thumbnail-fallback")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("falls back to the icon tile when a thumbnail fails to load", async () => {
    mockProjects([
      {
        id: "p1",
        title: "Broken Image",
        owner_id: "u1",
        goal: 100,
        pledged: 10,
        thumbnail: "/broken.png",
      },
    ]);

    render(<TrendingProjects />);

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Broken Image" }),
      ).toBeInTheDocument();
    });
    fireEvent.error(screen.getByRole("img", { name: "Broken Image" }));

    expect(screen.getByTestId("thumbnail-fallback")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows a professional empty state instead of fake data when no projects exist", async () => {
    mockProjects([]);
    const router = { push: vi.fn() };
    vi.mocked(useRouter).mockReturnValue(router);

    render(<TrendingProjects />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "No campaigns launched yet" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Be the first to bring your idea to life on Fundora/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("thumbnail-fallback")).not.toBeInTheDocument();

    // Creators see the create-flow CTA and it opens the creation flow.
    await userEvent.click(
      screen.getByRole("button", { name: /start a campaign/i }),
    );
    expect(router.push).toHaveBeenCalledWith("/create");
  });

  it("hides the create-flow CTA from non-creators in the empty state", async () => {
    mockProjects([]);
    mockUseRoleValue({
      user: { id: "u1" },
      role: ROLES.INVESTOR,
      isCreator: false,
    });

    render(<TrendingProjects />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "No campaigns launched yet" }),
      ).toBeInTheDocument();
    });
    // Guests and investors have no create-flow entry point, but Explore stays.
    expect(
      screen.queryByRole("button", { name: /start a campaign/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /explore projects/i }),
    ).toBeInTheDocument();
  });

  it("subscribes to realtime changes on projects and cleans up on unmount", async () => {
    const { unmount } = render(<TrendingProjects />);

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith("landing-trending");
      expect(m.mockOn).toHaveBeenCalledWith(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        expect.any(Function),
      );
      expect(m.mockSubscribe).toHaveBeenCalled();
    });

    unmount();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it("renders server-rendered cards without a mount fetch when initial is provided", async () => {
    render(
      <TrendingProjects
        initial={{
          projects: [
            {
              id: "p1",
              title: "SSR Campaign",
              goal: 100000,
              pledged: 50000,
              deadline: future(5),
              categories: ["AI"],
              owner_id: "u1",
              thumbnail: null,
              short: "Server-rendered on first paint.",
            },
          ],
          creatorMap: { u1: "Alice Founder" },
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("SSR Campaign")).toBeInTheDocument();
    });
    expect(screen.getByText("by Alice Founder")).toBeInTheDocument();
    expect(screen.getByText("50% Funded")).toBeInTheDocument();

    // ISR already rendered the cards — the client must NOT re-query the DB.
    expect(supabase.from).not.toHaveBeenCalledWith("projects");
    expect(supabase.from).not.toHaveBeenCalledWith("profiles");

    // The realtime subscription is still active so the section keeps updating.
    expect(supabase.channel).toHaveBeenCalledWith("landing-trending");
  });
});
