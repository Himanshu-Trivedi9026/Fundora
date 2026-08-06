import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import TrustScoreCard from "../../components/security/TrustScoreCard";
import RiskIndicator from "../../components/security/RiskIndicator";
import VerificationStatus from "../../components/security/VerificationStatus";
import VerificationProgress from "../../components/security/VerificationProgress";
import SecurityShield from "../../components/security/SecurityShield";
import VerificationSteps from "../../components/security/VerificationSteps";

describe("TrustScoreCard", () => {
  it("renders score in normal mode", () => {
    render(<TrustScoreCard score={85} />);
    expect(screen.getByText("85")).toBeTruthy();
    expect(screen.getByText("Trust Score")).toBeTruthy();
  });

  it("renders compact mode", () => {
    render(<TrustScoreCard score={60} compact />);
    expect(screen.getByText("60")).toBeTruthy();
    expect(screen.getByText("Trust Score")).toBeTruthy();
  });

  it("applies success color for high scores", () => {
    render(<TrustScoreCard score={90} />);
    expect(screen.getByText("90").className).toContain("text-success");
  });

  it("applies warning color for medium scores", () => {
    render(<TrustScoreCard score={45} />);
    expect(screen.getByText("45").className).toContain("text-warning");
  });

  it("applies danger color for low scores", () => {
    render(<TrustScoreCard score={15} />);
    expect(screen.getByText("15").className).toContain("text-danger");
  });
});

describe("RiskIndicator", () => {
  it("renders score in normal mode", () => {
    render(<RiskIndicator score={25} />);
    expect(screen.getByText("25")).toBeTruthy();
    expect(screen.getByText("Risk Assessment")).toBeTruthy();
  });

  it("renders compact mode", () => {
    render(<RiskIndicator score={30} compact />);
    expect(screen.getByText("30")).toBeTruthy();
  });

  it("shows Low Risk for low scores", () => {
    render(<RiskIndicator score={10} />);
    expect(screen.getByText("Low Risk")).toBeTruthy();
  });

  it("shows High Risk for high scores", () => {
    render(<RiskIndicator score={80} />);
    expect(screen.getByText("High Risk")).toBeTruthy();
  });
});

describe("VerificationStatus", () => {
  it("renders pending status", () => {
    render(<VerificationStatus status="pending" />);
    expect(screen.getByText("Pending")).toBeTruthy();
  });

  it("renders approved status with success color", () => {
    render(<VerificationStatus status="approved" />);
    const el = screen.getByRole("status");
    expect(el.className).toContain("text-success");
  });

  it("renders rejected status with danger color", () => {
    render(<VerificationStatus status="rejected" />);
    const el = screen.getByRole("status");
    expect(el.className).toContain("text-danger");
  });

  it("hides icon when showIcon is false", () => {
    const { container } = render(
      <VerificationStatus status="approved" showIcon={false} />
    );
    expect(container.querySelector(".material-symbols-outlined")).toBeNull();
  });
});

describe("VerificationProgress", () => {
  it("renders all 6 level markers", () => {
    const { container } = render(<VerificationProgress currentLevel={2} />);
    const markers = container.querySelectorAll(".w-3.h-3.rounded-full");
    expect(markers.length).toBe(6);
  });

  it("highlights completed levels", () => {
    const { container } = render(<VerificationProgress currentLevel={3} />);
    const markers = container.querySelectorAll(".w-3.h-3.rounded-full");
    // First 4 markers (0-3) should have bg-primary
    expect(markers[0].className).toContain("bg-primary");
    expect(markers[3].className).toContain("bg-primary");
    // Marker 4 should not
    expect(markers[4].className).not.toContain("bg-primary");
  });

  it("hides labels when showLabels is false", () => {
    const { container } = render(
      <VerificationProgress currentLevel={2} showLabels={false} />
    );
    const labels = container.querySelectorAll(".text-\\[8px\\]");
    expect(labels.length).toBe(0);
  });
});

describe("SecurityShield", () => {
  it("renders shield icon", () => {
    const { container } = render(<SecurityShield level={0} />);
    expect(container.querySelector(".material-symbols-outlined")).toBeTruthy();
  });

  it("applies correct size classes", () => {
    const { container } = render(<SecurityShield level={2} size="md" />);
    const shield = container.querySelector(".w-16.h-16");
    expect(shield).toBeTruthy();
  });

  it("applies glow for high levels", () => {
    const { container } = render(<SecurityShield level={5} />);
    const glow = container.querySelector(".blur-xl");
    expect(glow).toBeTruthy();
  });
});

describe("VerificationSteps", () => {
  const mockVerification = {
    email_verified: true,
    phone_verified: true,
    identity_verified: false,
    bank_verified: false,
    business_verified: false,
    created_at: "2026-01-01T00:00:00Z",
  };

  const mockHistory = [
    { action: "approved", new_level: 1, created_at: "2026-01-05T10:00:00Z" },
    { action: "level_changed", new_level: 2, created_at: "2026-01-15T12:00:00Z" },
  ];

  it("renders null when verification is null", () => {
    const { container } = render(<VerificationSteps verification={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders all 5 steps", () => {
    render(<VerificationSteps verification={mockVerification} />);
    expect(screen.getByText("Email Verification")).toBeTruthy();
    expect(screen.getByText("Phone Verification")).toBeTruthy();
    expect(screen.getByText("Identity Verification")).toBeTruthy();
    expect(screen.getByText("Bank Verification")).toBeTruthy();
    expect(screen.getByText("Business Verification")).toBeTruthy();
  });

  it("shows completed steps with Done status", () => {
    render(<VerificationSteps verification={mockVerification} />);
    const doneLabels = screen.getAllByText("Done");
    expect(doneLabels.length).toBe(2); // email + phone
  });

  it("shows current step with Next status", () => {
    render(<VerificationSteps verification={mockVerification} />);
    expect(screen.getByText("Next")).toBeTruthy();
  });

  it("shows locked steps with Locked status", () => {
    render(<VerificationSteps verification={mockVerification} />);
    const lockedLabels = screen.getAllByText("Locked");
    expect(lockedLabels.length).toBe(2); // bank + business
  });

  it("displays completion count", () => {
    render(<VerificationSteps verification={mockVerification} />);
    expect(screen.getByText("2/5 Complete")).toBeTruthy();
  });

  it("displays dates from history", () => {
    const { container } = render(<VerificationSteps verification={mockVerification} history={mockHistory} />);
    // Should show dates for completed steps (small text elements)
    const dateElements = container.querySelectorAll(".text-\\[8px\\]");
    expect(dateElements.length).toBeGreaterThanOrEqual(1);
  });

  it("shows title as Verification Timeline", () => {
    render(<VerificationSteps verification={mockVerification} />);
    expect(screen.getByText("Verification Timeline")).toBeTruthy();
  });
});
