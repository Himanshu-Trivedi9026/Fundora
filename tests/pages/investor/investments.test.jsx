import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InvestorInvestments, { INVESTMENTS_TIMEOUT_MS } from "../../../pages/investor/investments";
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

const donation = (id, amount, status, project_id, created_at, overrides = {}) => ({
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
    ...overrides,
  },
});

describe("pages/investor/investments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearInvestorCache();
    mockUseRoleValue();
  });

  it("loads and renders investments for a user with history (no infinite spinner)", async () => {
    mockTables({
      public_donations: {
        data: [
          donation("d1", 1000, "paid", "p1", "2026-05-01T10:00:00Z", { title: "Alpha Fund" }),
          donation("d2", 2000, "pending", "p2", "2026-06-15T10:00:00Z", { title: "Beta Fund" }),
        ],
      },
    });

    render(<InvestorInvestments />);

    // The list eventually renders; the loading spinner is gone.
    await waitFor(() => {
      expect(screen.getByText("Alpha Fund")).toBeInTheDocument();
    });
    expect(screen.queryByText("Loading investments...")).not.toBeInTheDocument();

    // Summary card: total sums every listed donation (₹ en-IN), projects = rows.
    expect(screen.getByText("Total Invested")).toBeInTheDocument();
    expect(screen.getByText("₹3,000")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    // Status badges: "paid" renders as a success badge (green), "pending" as warning.
    expect(screen.getByText("paid")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();

    // Each row links to its project.
    expect(screen.getByRole("link", { name: /beta fund/i })).toHaveAttribute(
      "href",
      "/projects/p2",
    );
  });

  it("shows the empty state with illustration, message, and Browse Projects for a new investor", async () => {
    mockTables({ public_donations: { data: [] } });

    render(<InvestorInvestments />);

    await waitFor(() => {
      expect(screen.getByText("You haven't invested in any projects yet.")).toBeInTheDocument();
    });

    // Empty illustration icon and no summary card in the empty state.
    expect(screen.getByText("account_balance_wallet")).toBeInTheDocument();
    expect(screen.queryByText("Total Invested")).not.toBeInTheDocument();

    // Discover CTA targets Explore.
    const browse = screen.getByRole("link", { name: /browse projects/i });
    expect(browse).toHaveAttribute("href", "/explore");
  });

  it("stops loading and shows a retryable error when the request fails", async () => {
    m.mockFrom.mockImplementation(() =>
      mockQuery({ data: null, count: 0, error: new Error("boom") }),
    );

    render(<InvestorInvestments />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load your investments/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText("Loading investments...")).not.toBeInTheDocument();
  });

  it("recovers after a failed load when Retry is pressed", async () => {
    let calls = 0;
    m.mockFrom.mockImplementation((table) => {
      calls += 1;
      if (calls === 1) {
        return mockQuery({ data: null, count: 0, error: new Error("boom") });
      }
      return mockQuery({ data: [donation("d1", 5000, "paid", "p1", "2026-05-01", { title: "Alpha Fund" })] });
    });

    render(<InvestorInvestments />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load your investments/i)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByText("Alpha Fund")).toBeInTheDocument();
    });
    // ₹5,000 appears in both the summary card and the row amount.
    expect(screen.getAllByText("₹5,000").length).toBeGreaterThan(0);
  });

  it("never spins forever when the query hangs (offline) — timeout lands in the error state", async () => {
    vi.useFakeTimers();
    try {
      // A query that never settles.
      m.mockFrom.mockImplementation(() => mockQuery({ data: [], count: 0, error: null }, { hang: true }));

      render(<InvestorInvestments />);
      expect(screen.getByText("Loading investments...")).toBeInTheDocument();

      // Advance past the guard timeout — the spinner must stop.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(INVESTMENTS_TIMEOUT_MS + 1000);
      });

      expect(screen.queryByText("Loading investments...")).not.toBeInTheDocument();
      expect(screen.getByText(/Failed to load your investments/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
