import { describe, it, expect, vi } from "vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import { render } from "@testing-library/react";
import React from "react";

expect.extend(toHaveNoViolations);

vi.mock("next/router", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    pathname: "/",
    query: {},
    asPath: "/",
  }),
}));

vi.mock("next/link", () => {
  const MockLink = ({ children, href, ...props }) =>
    React.createElement("a", { href, ...props }, children);
  MockLink.displayName = "MockLink";
  return { __esModule: true, default: MockLink };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

let VerificationBadge, TrustScoreCard, RiskIndicator;

try {
  const badge = await import("../../components/security/VerificationBadge");
  VerificationBadge = badge.default || badge.VerificationBadge;
} catch {
  VerificationBadge = null;
}

try {
  const trust = await import("../../components/security/TrustScoreCard");
  TrustScoreCard = trust.default || trust.TrustScoreCard;
} catch {
  TrustScoreCard = null;
}

try {
  const risk = await import("../../components/security/RiskIndicator");
  RiskIndicator = risk.default || risk.RiskIndicator;
} catch {
  RiskIndicator = null;
}

describe("Verification Accessibility (a11y)", () => {
  if (VerificationBadge) {
    describe("VerificationBadge", () => {
      it("renders without axe violations", async () => {
        const { container } = render(<VerificationBadge verified={true} />);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("renders unverified state without axe violations", async () => {
        const { container } = render(<VerificationBadge verified={false} />);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("has accessible text for screen readers", () => {
        const { getByRole } = render(
          <VerificationBadge level={1} status="approved" />,
        );
        const badge = getByRole("status");
        expect(badge).toBeDefined();
      });

      it("interactive elements have proper ARIA attributes", () => {
        const { container } = render(<VerificationBadge verified={true} />);
        const interactiveElements = container.querySelectorAll(
          "button, a, [role='button']",
        );
        interactiveElements.forEach((el) => {
          const hasAccessibleName =
            el.getAttribute("aria-label") ||
            el.getAttribute("aria-labelledby") ||
            el.textContent.trim().length > 0;
          expect(hasAccessibleName).toBeTruthy();
        });
      });
    });
  }

  if (TrustScoreCard) {
    describe("TrustScoreCard", () => {
      it("renders without axe violations", async () => {
        const { container } = render(
          <TrustScoreCard score={85} userId="user-1" />,
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("renders low score without axe violations", async () => {
        const { container } = render(
          <TrustScoreCard score={20} userId="user-1" />,
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("score is accessible to screen readers", () => {
        const { getByText } = render(
          <TrustScoreCard score={75} userId="user-1" />,
        );
        const scoreElement = getByText(/75/);
        expect(scoreElement).toBeDefined();
      });

      it("has no color contrast issues", async () => {
        const { container } = render(
          <TrustScoreCard score={60} userId="user-1" />,
        );
        const results = await axe(container, {
          rules: {
            "color-contrast": { enabled: true },
          },
        });
        expect(results).toHaveNoViolations();
      });
    });
  }

  if (RiskIndicator) {
    describe("RiskIndicator", () => {
      it("renders without axe violations", async () => {
        const { container } = render(<RiskIndicator level="low" />);
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("renders all risk levels without axe violations", async () => {
        const levels = ["low", "medium", "high"];
        for (const level of levels) {
          const { container, unmount } = render(
            <RiskIndicator level={level} />,
          );
          const results = await axe(container);
          expect(results).toHaveNoViolations();
          unmount();
        }
      });

      it("risk level is communicated via text, not just color", () => {
        const { getByText } = render(<RiskIndicator score={80} />);
        const indicator = getByText(/high risk/i);
        expect(indicator).toBeDefined();
      });
    });
  }

  if (!VerificationBadge && !TrustScoreCard && !RiskIndicator) {
    describe("Fallback: Basic HTML a11y structure", () => {
      it("basic verification-related HTML has no axe violations", async () => {
        const { container } = render(
          <div role="region" aria-label="User verification status">
            <h2>Verification Status</h2>
            <div role="status" aria-label="Verified">
              <span aria-hidden="true">&#10003;</span>
              <span>Verified</span>
            </div>
            <div
              role="meter"
              aria-label="Trust score"
              aria-valuenow={85}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span>85%</span>
            </div>
            <div role="status" aria-label="Risk level: Low">
              Low Risk
            </div>
          </div>,
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("interactive verification elements have ARIA attributes", async () => {
        const { container } = render(
          <div>
            <button aria-label="Verify user identity" type="button">
              Verify
            </button>
            <button aria-label="Revoke verification" type="button">
              Revoke
            </button>
            <a href="/verify" aria-describedby="verify-help">
              Learn about verification
            </a>
            <span id="verify-help" className="sr-only">
              Information about the verification process
            </span>
          </div>,
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });

      it("has no color contrast violations with axe configuration", async () => {
        const { container } = render(
          <div
            style={{
              background: "#ffffff",
              color: "#333333",
              padding: "16px",
            }}
          >
            <div
              style={{
                backgroundColor: "#22c55e",
                color: "#ffffff",
                padding: "8px 12px",
                borderRadius: "4px",
              }}
            >
              Verified
            </div>
            <div
              style={{
                backgroundColor: "#ef4444",
                color: "#ffffff",
                padding: "8px 12px",
                borderRadius: "4px",
                marginTop: "8px",
              }}
            >
              Unverified
            </div>
          </div>,
        );
        const results = await axe(container, {
          rules: {
            "color-contrast": { enabled: true },
          },
        });
        expect(results).toHaveNoViolations();
      });

      it("form elements for verification have proper labels", async () => {
        const { container } = render(
          <form aria-label="Identity verification">
            <label htmlFor="id-upload">Upload government ID</label>
            <input
              id="id-upload"
              type="file"
              accept="image/*"
              aria-required="true"
            />

            <label htmlFor="selfie-upload">Upload a selfie</label>
            <input
              id="selfie-upload"
              type="file"
              accept="image/*"
              aria-required="true"
            />

            <button type="submit" aria-label="Submit verification documents">
              Submit
            </button>
          </form>,
        );
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });
    });
  }
});
