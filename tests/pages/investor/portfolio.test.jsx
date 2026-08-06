import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InvestorPortfolio, { PORTFOLIO_TIMEOUT_MS } from "../../../pages/investor/portfolio";
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

/** A supabase query-chain that resolves to `payload`, or hangs when `hang`. */
function mockQuery(payload, { hang = false } = {}) {
  const q = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  };
  if (hang) {
    // A thenable that never settles — simulates an offline/dropped request.
    q.then = () => {};
  } else {
    q.then = (resolve) => resolve(payload);
  }
  return q;
}

function mockTables(payloads = {}) {
  m.mockFrom.mockImplementation((table) => {
    const payload = payloads[table] || { data: [], count: 0, error: null };
    return mockQuery(payload);
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

describe("pages/investor/portfolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearInvestorCache();
    mockUseRoleValue();
  });

  it("calculates all portfolio metrics from settled donations only (no infinite spinner)", async () => {
    mockTables({
      public_donations: {
        data: [
          donation("d1", 6000, "paid", "p1", "2026-05-01", {
            title: "Alpha Fund",
            goal: 200000,
            pledged: 150000,
            categories: ["AI"],
          }),
          donation("d2", 4000, "paid", "p2", "2026-06-01", {
            title: "Beta Fund",
            goal: 100000,
            pledged: 50000,
            categories: ["Climate"],
          }),
          // Pending is ignored for every settled-only metric.
          donation("d3", 9000, "pending", "p3", "2026-07-01", { title: "Gamma Fund" }),
        ],
      },
    });

    render(<InvestorPortfolio />);

    await waitFor(() => {
      expect(screen.getByText("Total Invested")).toBeInTheDocument();
    });
    expect(screen.queryByText("Calculating portfolio stats...")).not.toBeInTheDocument();

    // KPI cards (settled only: 6000 + 4000).
    expect(screen.getByText("₹10,000")).toBeInTheDocument(); // Total Invested
    expect(screen.getByText("₹16,300")).toBeInTheDocument(); // Current Value
    expect(screen.getByText("63%")).toBeInTheDocument(); // ROI = avg funding progress
    expect(screen.getByText("2")).toBeInTheDocument(); // Number of Projects (unique settled)

    // Diversification card.
    expect(screen.getByText("Diversification")).toBeInTheDocument();
    expect(screen.getByText("48")).toBeInTheDocument(); // (1 - HHI) * 100

    // Category Allocation lists each settled project's category + amount.
    expect(screen.getByText("Category Allocation")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Climate")).toBeInTheDocument();
  });

  it("shows the empty portfolio state for a user with no settled investments", async () => {
    // No donations at all.
    mockTables({ public_donations: { data: [] } });

    render(<InvestorPortfolio />);

    await waitFor(() => {
      expect(screen.getByText("You haven't invested in any projects yet.")).toBeInTheDocument();
    });

    // No metrics render in the empty state.
    expect(screen.queryByText("Total Invested")).not.toBeInTheDocument();
    expect(screen.queryByText("Diversification")).not.toBeInTheDocument();
    expect(screen.queryByText("Category Allocation")).not.toBeInTheDocument();

    const browse = screen.getByRole("link", { name: /browse projects/i });
    expect(browse).toHaveAttribute("href", "/explore");
  });

  it("shows the empty state when the user only has pending donations (nothing settled)", async () => {
    mockTables({
      public_donations: {
        data: [donation("d1", 5000, "pending", "p1", "2026-07-01", { title: "Gamma Fund" })],
      },
    });

    render(<InvestorPortfolio />);

    await waitFor(() => {
      expect(screen.getByText("You haven't invested in any projects yet.")).toBeInTheDocument();
    });
    expect(screen.queryByText("Total Invested")).not.toBeInTheDocument();
  });

  it("stops loading and shows a retryable error when the request fails", async () => {
    m.mockFrom.mockImplementation(() =>
      mockQuery({ data: null, count: 0, error: new Error("boom") }),
    );

    render(<InvestorPortfolio />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load your portfolio/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText("Calculating portfolio stats...")).not.toBeInTheDocument();
  });

  it("recovers after a failed load when Retry is pressed", async () => {
    let calls = 0;
    m.mockFrom.mockImplementation((table) => {
      calls += 1;
      if (calls === 1) {
        return mockQuery({ data: null, count: 0, error: new Error("boom") });
      }
      return mockQuery({
        data: [
          donation("d1", 5000, "paid", "p1", "2026-05-01", {
            title: "Alpha Fund",
            goal: 100000,
            pledged: 100000,
            categories: ["AI"],
          }),
        ],
      });
    });

    render(<InvestorPortfolio />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load your portfolio/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByText("Total Invested")).toBeInTheDocument();
    });
    // ₹5,000 appears in both Total Invested and the Category Allocation row.
    expect(screen.getAllByText("₹5,000").length).toBeGreaterThan(0);
    expect(screen.getByText("100%")).toBeInTheDocument(); // ROI on fully-funded project
  });

  it("never spins forever when the query hangs (slow network) — timeout lands in the error state", async () => {
    vi.useFakeTimers();
    try {
      // A query that never settles.
      m.mockFrom.mockImplementation(() => mockQuery({ data: [], count: 0, error: null }, { hang: true }));

      render(<InvestorPortfolio />);
      expect(screen.getByText("Calculating portfolio stats...")).toBeInTheDocument();

      // Advance past the guard timeout — the spinner must stop.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PORTFOLIO_TIMEOUT_MS + 1000);
      });

      expect(screen.queryByText("Calculating portfolio stats...")).not.toBeInTheDocument();
      expect(screen.getByText(/Failed to load your portfolio/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
