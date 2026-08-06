import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InvestorDashboard from "../../../pages/investor/dashboard";
import { useRole } from "../../../context/RoleContext";
import { ROLES } from "../../../lib/roles";
import { clearInvestorCache } from "../../../lib/investor/investorData";

// --- Hoisted mocks (safe inside vi.mock factory) ---
const m = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: { from: m.mockFrom },
}));

vi.mock("../../../context/RoleContext", () => ({
  useRole: vi.fn(),
}));

vi.mock("next/image", () => ({
  // Test-only mock: next/image's optimizer is unavailable under jsdom.
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props) => <img {...props} />,
}));

// Isolate the page content — PageLayout pulls in Navbar/Sidebar/Footer noise.
vi.mock("../../../components/PageLayout", () => ({
  __esModule: true,
  default: ({ children }) => <main>{children}</main>,
}));

function mockUseRoleValue(overrides = {}) {
  vi.mocked(useRole).mockReturnValue({
    user: { id: "u1", email: "investor@fundora.dev", user_metadata: { full_name: "Investor One" } },
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

/**
 * Make supabase.from(table) return an await-able chain resolving to per-table
 * payloads. Head-count tables (saved_projects/followers) resolve {data,count};
 * row tables resolve {data}.
 */
function mockTables(payloads = {}) {
  m.mockFrom.mockImplementation((table) => {
    const result = payloads[table] || { data: [], count: 0, error: null };
    const q = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      overlaps: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: (resolve) => resolve(result),
    };
    return q;
  });
}

const project = (id, title, overrides = {}) => ({
  id,
  title,
  slug: title.toLowerCase().replace(/\s+/g, "-"),
  thumbnail: null,
  goal: 100000,
  pledged: 60000,
  categories: ["AI"],
  deleted: false,
  ...overrides,
});

const donation = (id, amount, status, project_id, created_at, projOverrides = {}) => ({
  id,
  amount,
  status,
  project_id,
  created_at,
  projects: project(project_id, `Project ${project_id}`, projOverrides),
});

describe("pages/investor/dashboard (Overview)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearInvestorCache();
    mockUseRoleValue();
  });

  it("renders all Overview sections in order with AI Recommendations below Portfolio Summary", async () => {
    mockTables({
      public_donations: {
        data: [donation("d1", 5000, "paid", "p1", "2026-05-01", { categories: ["AI"], title: "Alpha Fund" })],
      },
      saved_projects: { data: null, count: 2 },
      followers: { data: null, count: 3 },
      projects: {
        data: [
          project("cand-a", "Beta Startup", { owner_id: "u9", categories: ["AI"], pledged: 90000 }),
        ],
      },
      profiles: { data: [{ id: "u9", full_name: "Alice Founder" }] },
    });

    render(<InvestorDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Portfolio Summary")).toBeInTheDocument();
    });

    // Portfolio Summary KPIs (settled donation only, en-IN rupees).
    expect(screen.getByText("Total Invested")).toBeInTheDocument();
    expect(screen.getByText("₹5,000")).toBeInTheDocument();
    expect(screen.getByText("Projects Funded")).toBeInTheDocument();

    // Section order: Portfolio Summary < AI Recommendations < Portfolio Health
    // < Recent Activity < Recommended Projects < Latest Investments.
    const order = [
      "Portfolio Summary",
      "AI Recommendations",
      "Portfolio Health",
      "Recent Activity",
      "Recommended Projects",
      "Latest Investments",
    ].map((t) => screen.getByText(t));
    for (let i = 1; i < order.length; i += 1) {
      expect(
        order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }

    // Portfolio Health card renders its composite score block.
    expect(screen.getByText(/overall score/i)).toBeInTheDocument();

    // Quick Actions exposes the new Analytics + My Investments entry points.
    const analyticsAction = screen.getByRole("link", { name: /track your performance/i });
    expect(analyticsAction).toHaveAttribute("href", "/investor/analytics");
    const investmentsAction = screen.getByRole("link", { name: /review your donations/i });
    expect(investmentsAction).toHaveAttribute("href", "/investor/investments");

    // AI Recommendations premium card shows derived insights. "AI growth
    // score N/100" appears both on the top-pick card and in each
    // recommendation's reason list, so use getAllByText.
    expect(screen.getAllByText("Beta Startup").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AI growth score \d+\/100/).length).toBeGreaterThan(0);
    expect(screen.getByText(/strongest sector/i)).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();

    // Recent Activity + Latest Investments surface the settled donation.
    expect(screen.getAllByText("Alpha Fund").length).toBeGreaterThan(0);
    // Recommendation card reason list includes category match + similarity.
    expect(screen.getByText(/Matches your interest in AI/i)).toBeInTheDocument();
    expect(screen.getByText(/Similar to Alpha Fund/i)).toBeInTheDocument();
    // Batch-fetched creator name (ProjectCard renders "By: {name}").
    expect(screen.getByText(/By: Alice Founder/i)).toBeInTheDocument();
  });

  it("shows the single onboarding empty state for new investors but still recommends projects", async () => {
    // No donations → totalInvested 0 → onboarding. Recommendations fall back
    // to a trending query, so discovery content still renders.
    mockTables({
      public_donations: { data: [] },
      saved_projects: { data: null, count: 0 },
      followers: { data: null, count: 0 },
      projects: {
        data: [project("cand-t", "Trending Pick", { owner_id: "u9", categories: ["AI"] })],
      },
      profiles: { data: [{ id: "u9", full_name: "Alice Founder" }] },
    });

    render(<InvestorDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Start your investment journey")).toBeInTheDocument();
    });

    // No per-widget empties for the portfolio-derived sections — they are
    // replaced by the single onboarding card.
    expect(screen.queryByText("Portfolio Summary")).not.toBeInTheDocument();
    expect(screen.queryByText("AI Recommendations")).not.toBeInTheDocument();
    expect(screen.queryByText("Portfolio Health")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Activity")).not.toBeInTheDocument();
    expect(screen.queryByText("Latest Investments")).not.toBeInTheDocument();

    // Trending fallback still gives the new investor projects to discover.
    expect(screen.getByText("Recommended Projects")).toBeInTheDocument();
    expect(screen.getByText("Trending Pick")).toBeInTheDocument();

    // Onboarding CTA goes to Explore. "Explore Projects" also appears as a
    // Quick Action on the Overview, so every matching link must target Explore.
    const ctaLinks = screen.getAllByRole("link", { name: /explore projects/i });
    expect(ctaLinks.length).toBeGreaterThan(0);
    ctaLinks.forEach((link) => expect(link).toHaveAttribute("href", "/explore"));
  });

  it("renders a retryable error card when the data load fails", async () => {
    m.mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      overlaps: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: (resolve) => resolve({ data: null, count: 0, error: new Error("boom") }),
    }));

    render(<InvestorDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load dashboard data/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
