import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import VerificationBadge from "../../components/security/VerificationBadge";

describe("VerificationBadge", () => {
  it("renders nothing for level 0 non-approved", () => {
    const { container } = render(
      <VerificationBadge level={0} status="pending" />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders badge for level 2 approved", () => {
    render(<VerificationBadge level={2} status="approved" />);
    expect(screen.getByText("Identity Verified")).toBeTruthy();
  });

  it("renders badge for level 5 fully verified", () => {
    render(<VerificationBadge level={5} status="approved" />);
    expect(screen.getByText("Fully Verified")).toBeTruthy();
  });

  it("applies success color for approved status", () => {
    render(<VerificationBadge level={3} status="approved" />);
    const badge = screen.getByRole("status");
    expect(badge.className).toContain("text-success");
  });

  it("applies primary color for under_review status", () => {
    render(<VerificationBadge level={1} status="under_review" />);
    const badge = screen.getByRole("status");
    expect(badge.className).toContain("text-primary");
  });

  it("hides label when showLabel is false", () => {
    render(<VerificationBadge level={2} status="approved" showLabel={false} />);
    expect(screen.queryByText("Identity Verified")).toBeNull();
  });

  it("applies correct size classes", () => {
    const { rerender } = render(
      <VerificationBadge level={2} status="approved" size="lg" />,
    );
    const badge = screen.getByRole("status");
    expect(badge.className).toContain("px-4");

    rerender(<VerificationBadge level={2} status="approved" size="sm" />);
    const badgeSm = screen.getByRole("status");
    expect(badgeSm.className).toContain("px-2");
  });

  it("has proper ARIA label", () => {
    render(<VerificationBadge level={3} status="approved" />);
    const badge = screen.getByRole("status");
    expect(badge.getAttribute("aria-label")).toContain("Verification level 3");
  });
});
