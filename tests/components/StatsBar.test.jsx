import { render, screen, waitFor } from "@testing-library/react";
import { act } from "@testing-library/react";
import StatsBar from "../../components/landing/StatsBar";
import { supabase } from "../../lib/supabaseClient";

// --- Hoisted mocks (safe inside vi.mock factory) ---
const m = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
  mockLimit: vi.fn(),
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

/**
 * Sets the per-table query results the landing stats read:
 *  - public_donations -> { data: rows }            (amount/payer_id/status)
 *  - projects          -> { data: null, count }    (head count, deleted=false)
 *  - team_members      -> { data: null, count }    (head count)
 */
function mockFixtures({ donations = [], projects = 0, team = 0 }) {
  m.mockFrom.mockImplementation((table) => {
    const q = {
      select: m.mockSelect,
      eq: m.mockEq,
      order: m.mockOrder,
      limit: m.mockLimit,
      then: (resolve) => {
        if (table === "public_donations")
          resolve({ data: donations, error: null });
        else if (table === "projects")
          resolve({ data: null, count: projects, error: null });
        else resolve({ data: null, count: team, error: null });
      },
    };
    m.mockSelect.mockReturnValue(q);
    m.mockEq.mockReturnValue(q);
    m.mockOrder.mockReturnValue(q);
    m.mockLimit.mockReturnValue(q);
    return q;
  });
}

/**
 * Drives framer-motion's useInView (IntersectionObserver) so the
 * AnimatedNumber count-up runs, then advance fake timers so the rAF loop
 * completes and the rendered figures reach their real targets.
 */
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

async function flushCountUp() {
  // 1) Flush the useInView state update so the AnimatedNumber effects run.
  await act(async () => {});
  // 2) Drive the 1500ms count-up to completion via fake-timer rAF frames.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1600);
  });
}

function mockRealtime() {
  m.mockChannel.mockReturnValue({
    on: m.mockOn.mockReturnThis(),
    subscribe: m.mockSubscribe.mockReturnValue({ name: "landing-stats" }),
  });
}

describe("StatsBar live platform statistics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // shouldAdvanceTime keeps testing-library's waitFor polling alive while
    // fake timers drive the AnimatedNumber count-up (same pattern as Login).
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFixtures({});
    mockRealtime();
    mockInView();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the four statistic labels", () => {
    render(<StatsBar />);

    expect(screen.getByText("Capital Raised")).toBeInTheDocument();
    expect(screen.getByText("Projects Launched")).toBeInTheDocument();
    expect(screen.getByText("Total Backers")).toBeInTheDocument();
    expect(screen.getByText("Team Members")).toBeInTheDocument();
  });

  it("sums only paid donations for Capital Raised and dedupes payer ids", async () => {
    // ₹1,00,000 paid + ₹20,000 paid = ₹1,20,000 (₹40,000 pending is excluded).
    // payer_id appears across 4 rows but only 3 are distinct.
    mockFixtures({
      donations: [
        { amount: 100000, payer_id: "p1", status: "paid" },
        { amount: 40000, payer_id: "p1", status: "pending" },
        { amount: 20000, payer_id: "p2", status: "paid" },
        { amount: 1000, payer_id: "p2", status: "paid" },
      ],
      projects: 3,
      team: 5,
    });

    render(<StatsBar />);
    await flushCountUp();

    await waitFor(() => {
      expect(screen.getByText("₹1.2L")).toBeInTheDocument(); // 1,20,000
    });
    expect(screen.getByText("2")).toBeInTheDocument(); // distinct backers: p1, p2
    expect(screen.getByText("3")).toBeInTheDocument(); // projects launched
    expect(screen.getByText("5")).toBeInTheDocument(); // team members
  });

  it("reads live rows: donations, non-deleted project count, and team_members count", async () => {
    mockFixtures({
      donations: [{ amount: 500, status: "paid" }],
      projects: 7,
      team: 9,
    });
    render(<StatsBar />);
    await flushCountUp();

    await waitFor(() => {
      // Capital Raised reads the full donation row set (filtered in JS to paid).
      expect(supabase.from).toHaveBeenCalledWith("public_donations");
      expect(m.mockSelect).toHaveBeenCalledWith("amount, payer_id, status");

      // Projects Launched counts only non-deleted rows.
      expect(supabase.from).toHaveBeenCalledWith("projects");
      expect(m.mockSelect).toHaveBeenCalledWith("id", {
        count: "exact",
        head: true,
      });
      expect(m.mockEq).toHaveBeenCalledWith("deleted", false);

      // Team Members is a real head-count of the existing schema.
      expect(supabase.from).toHaveBeenCalledWith("team_members");
      expect(m.mockSelect).toHaveBeenCalledWith("*", {
        count: "exact",
        head: true,
      });
    });
  });

  it("subscribes to realtime changes on all stat tables and cleans up on unmount", async () => {
    const { unmount } = render(<StatsBar />);
    await flushCountUp();

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith(
        "landing-stats-public_donations",
      );
      expect(supabase.channel).toHaveBeenCalledWith("landing-stats-projects");
      expect(supabase.channel).toHaveBeenCalledWith(
        "landing-stats-team_members",
      );
      expect(m.mockOn).toHaveBeenCalledWith(
        "postgres_changes",
        { event: "*", schema: "public", table: "public_donations" },
        expect.any(Function),
      );
      expect(m.mockOn).toHaveBeenCalledWith(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        expect.any(Function),
      );
      expect(m.mockOn).toHaveBeenCalledWith(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_members" },
        expect.any(Function),
      );
    });

    unmount();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it("shows zeros (never fabricated numbers) when the database is empty", async () => {
    mockFixtures({ donations: [], projects: 0, team: 0 });
    render(<StatsBar />);
    await flushCountUp();

    await waitFor(() => {
      expect(screen.getByText("₹0")).toBeInTheDocument();
    });
    // All three animated counters settle on their real (empty) value: 0.
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(3);
  });

  it("renders server-rendered stats without a mount fetch when initialStats is provided", async () => {
    mockFixtures({
      donations: [{ amount: 500, status: "paid" }],
      projects: 7,
      team: 9,
    });
    render(
      <StatsBar
        initialStats={{
          totalRaised: 500,
          totalProjects: 7,
          totalBackers: 1,
          totalTeamMembers: 9,
        }}
      />,
    );
    await flushCountUp();

    await waitFor(() => {
      expect(screen.getByText("₹500")).toBeInTheDocument();
    });
    expect(screen.getByText("7")).toBeInTheDocument(); // projects
    expect(screen.getByText("9")).toBeInTheDocument(); // team members

    // ISR already rendered these values — the client must NOT re-query them.
    // `from` is only used by the realtime subscription's channel setup here.
    expect(supabase.from).not.toHaveBeenCalledWith("public_donations");
    expect(supabase.from).not.toHaveBeenCalledWith("projects");
    expect(supabase.from).not.toHaveBeenCalledWith("team_members");

    // But the realtime subscription is still active so stats stay live.
    expect(supabase.channel).toHaveBeenCalledWith(
      "landing-stats-public_donations",
    );
  });
});
