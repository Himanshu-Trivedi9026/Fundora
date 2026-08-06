import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InvestorAnalytics from "../../../pages/investor/analytics";
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
    user: {
      id: "u1",
      email: "investor@fundora.dev",
      user_metadata: { full_name: "Investor One" },
    },
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

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const donation = (
  id,
  amount,
  status,
  project_id,
  created_at,
  overrides = {},
) => ({
  id,
  amount,
  status,
  project_id,
  created_at,
  projects: {
    id: project_id,
    title: `Project ${project_id}`,
    slug: `project-${project_id}`,
    thumbnail: null,
    goal: 100000,
    pledged: 60000,
    categories: ["AI"],
    deleted: false,
    ...overrides,
  },
});

function sampleDonations() {
  return [
    donation("d1", 1000, "paid", "p1", daysAgo(75), {
      title: "Alpha Fund",
      categories: ["AI"],
      pledged: 60000,
    }),
    donation("d2", 2000, "paid", "p2", daysAgo(45), {
      title: "Beta Fund",
      categories: ["Climate"],
      goal: 200000,
      pledged: 100000,
    }),
    donation("d3", 3000, "paid", "p3", daysAgo(15), {
      title: "Gamma Fund",
      categories: ["Health"],
      pledged: 90000,
    }),
    donation("d4", 500, "pending", "p4", daysAgo(5), {
      title: "Delta Fund",
      categories: ["AI"],
    }),
  ];
}

function mockSampleData() {
  mockTables({ public_donations: { data: sampleDonations() } });
}

describe("pages/investor/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearInvestorCache();
    mockUseRoleValue();
  });

  it("renders every analytics widget with derived data (real charts render)", async () => {
    mockSampleData();
    render(<InvestorAnalytics />);

    // Performance metrics + ROI KPIs (settled only, en-IN).
    await waitFor(() => {
      expect(screen.getByText("Performance Metrics")).toBeInTheDocument();
    });
    expect(screen.getByText("₹6,000")).toBeInTheDocument(); // total invested
    // "3" is the value of both Projects Funded and Active Projects.
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getByText("67%")).toBeInTheDocument(); // ROI = avg funding progress

    // Every widget section renders, in page order.
    const order = [
      "Performance Metrics",
      "Investment Growth",
      "Monthly Investment",
      "Portfolio Allocation",
      "Sector Distribution",
      "Historical Trends",
      "Funding Timeline",
    ].map((t) => screen.getByText(t));
    for (let i = 1; i < order.length; i += 1) {
      expect(
        order[i - 1].compareDocumentPosition(order[i]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }

    // Funding timeline (real markup) lists every status under All Time. It is
    // a lazily-loaded component, so wait for its content to hydrate.
    await waitFor(() => {
      expect(screen.getByText("Alpha Fund")).toBeInTheDocument();
    });
    expect(screen.getByText("Delta Fund")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();

    // Allocation view defaults to the By Category tab.
    expect(screen.getByRole("button", { name: "By Category" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("switches the derived data when the global range filter changes", async () => {
    mockSampleData();
    render(<InvestorAnalytics />);

    await waitFor(() => {
      expect(screen.getByText("₹6,000")).toBeInTheDocument();
    });
    expect(screen.getByText("Alpha Fund")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "30 Days" }));

    // Only the two most recent donations (Gamma + pending Delta) survive the
    // 30-day cutoff, so the invested total drops. "₹3,000" is both the new
    // total and the largest (only) settled donation.
    await waitFor(() => {
      expect(screen.getAllByText("₹3,000").length).toBeGreaterThan(0);
    });
    // Wait for the timeline to hydrate with the filtered rows before asserting
    // which projects survived the cutoff.
    await waitFor(() => {
      expect(screen.getByText("Delta Fund")).toBeInTheDocument();
    });
    expect(screen.queryByText("₹6,000")).not.toBeInTheDocument();
    expect(screen.queryByText("Alpha Fund")).not.toBeInTheDocument();
    expect(screen.queryByText("Beta Fund")).not.toBeInTheDocument();
    expect(screen.getByText("Gamma Fund")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "30 Days" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "All Time" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("toggles the allocation donut between By Category and By Project", async () => {
    mockSampleData();
    render(<InvestorAnalytics />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "By Category" }),
      ).toHaveAttribute("aria-pressed", "true");
    });

    await userEvent.click(screen.getByRole("button", { name: "By Project" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "By Project" }),
      ).toHaveAttribute("aria-pressed", "true");
    });
    expect(screen.getByRole("button", { name: "By Category" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows a single onboarding empty state for new investors and no chart widgets", async () => {
    mockTables({ public_donations: { data: [] } });
    render(<InvestorAnalytics />);

    await waitFor(() => {
      expect(screen.getByText("No investment data yet")).toBeInTheDocument();
    });

    // No analytics widgets render in the empty state.
    expect(screen.queryByText("Performance Metrics")).not.toBeInTheDocument();
    expect(screen.queryByText("Funding Timeline")).not.toBeInTheDocument();
    expect(screen.queryByText("Investment Growth")).not.toBeInTheDocument();

    // Overview-only content is absent from the analytics page.
    expect(screen.queryByText("Welcome")).not.toBeInTheDocument();
    expect(screen.queryByText("Recommended Projects")).not.toBeInTheDocument();

    const cta = screen.getByRole("link", { name: /explore projects/i });
    expect(cta).toHaveAttribute("href", "/explore");
  });
});
