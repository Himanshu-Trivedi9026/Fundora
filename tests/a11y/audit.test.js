/**
 * Automated Accessibility Audit using jest-axe + jsdom
 *
 * Tests key components for WCAG 2.1 AA compliance.
 */
import { vi } from "vitest";
import { axe } from "jest-axe";
import { render } from "@testing-library/react";

// ---- Mocks for components that use browser APIs ----
vi.mock("next/router", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    query: {},
    asPath: "/",
    pathname: "/",
  })),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    channel: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnValue({}),
    removeChannel: vi.fn(),
  },
}));

// ---- Tests ----
describe("Accessibility Audit (jest-axe WCAG 2.1 AA)", () => {
  it("Footer has no violations", async () => {
    const { default: Footer } = await import("../../components/Footer");
    const { container } = render(<Footer />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("ProgressBar has no violations", async () => {
    const { default: ProgressBar } = await import("../../components/ProgressBar");
    const { container } = render(<ProgressBar pledged={5000} goal={10000} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("AnimatedBackground has no violations", async () => {
    const { default: AnimatedBackground } = await import("../../components/AnimatedBackground");
    const { container } = render(<AnimatedBackground />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("CategorySelector has no violations", async () => {
    const { default: CategorySelector } = await import("../../components/CategorySelector");
    const { container } = render(<CategorySelector selected={[]} setSelected={vi.fn()} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("TeamEditor has no violations", async () => {
    const { default: TeamEditor } = await import("../../components/TeamEditor");
    const { container } = render(<TeamEditor team={[]} setTeam={vi.fn()} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("TypingText has no violations", async () => {
    const { default: TypingText } = await import("../../components/TypingText");
    const { container } = render(<TypingText text="Hello world" />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("MediaUploader has no violations", async () => {
    const { default: MediaUploader } = await import("../../components/MediaUploader");
    const { container } = render(<MediaUploader mediaFiles={[]} setMediaFiles={vi.fn()} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("CampaignAIGenerator has no critical violations", async () => {
    const { default: CampaignAIGenerator } = await import("../../components/CampaignAIGenerator");
    const { container } = render(<CampaignAIGenerator setDescription={vi.fn()} />);
    const results = await axe(container);
    // Allow minor violations but no critical/serious ones
    const critical = results.violations.filter(v => v.impact === "critical" || v.impact === "serious");
    expect(critical).toEqual([]);
  });

  it("Summary: reports all violations found for review", async () => {
    const components = [
      { name: "Footer", path: "../../components/Footer", props: {} },
      { name: "ProgressBar", path: "../../components/ProgressBar", props: { pledged: 5000, goal: 10000 } },
      { name: "AnimatedBackground", path: "../../components/AnimatedBackground", props: {} },
      { name: "CategorySelector", path: "../../components/CategorySelector", props: { selected: [], setSelected: vi.fn() } },
      { name: "TeamEditor", path: "../../components/TeamEditor", props: { team: [], setTeam: vi.fn() } },
      { name: "TypingText", path: "../../components/TypingText", props: { text: "Test" } },
      { name: "MediaUploader", path: "../../components/MediaUploader", props: { mediaFiles: [], setMediaFiles: vi.fn() } },
      { name: "CampaignAIGenerator", path: "../../components/CampaignAIGenerator", props: { setDescription: vi.fn() } },
    ];

    const allViolations = [];
    for (const c of components) {
      const { default: Comp } = await import(c.path);
      const { container } = render(<Comp {...c.props} />);
      const results = await axe(container);
      for (const v of results.violations) {
        allViolations.push({
          component: c.name,
          rule: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.length,
        });
      }
    }

    console.log("\n=== ACCESSIBILITY AUDIT SUMMARY ===");
    console.log(`Components tested: ${components.length}`);
    console.log(`Total violations found: ${allViolations.length}`);
    if (allViolations.length > 0) {
      console.table(allViolations);
    } else {
      console.log("No violations found! ✅");
    }

    // This test always passes — it's for reporting, not gating
    expect(true).toBe(true);
  });
});
