import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BusinessVerificationCard from "../../components/verification/BusinessVerificationCard";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }) => {
      const { initial, animate, whileHover, whileTap, ...domProps } = props;
      return <div {...domProps}>{children}</div>;
    },
  },
}));

describe("BusinessVerificationCard", () => {
  it("renders with not_started status", () => {
    render(<BusinessVerificationCard />);
    expect(screen.getByText("Business Verification")).toBeTruthy();
    expect(screen.getByText("Not Started")).toBeTruthy();
  });

  it("renders with verified status", () => {
    render(
      <BusinessVerificationCard
        verification={{
          status: "verified",
          business_name: "Test Corp",
          business_type: "private_limited",
        }}
      />,
    );
    expect(screen.getByText("Verified")).toBeTruthy();
    expect(screen.getByText("Test Corp")).toBeTruthy();
  });

  it("renders with pending status", () => {
    render(
      <BusinessVerificationCard
        verification={{ status: "pending", business_name: "Pending Co" }}
      />,
    );
    expect(screen.getByText("Under Review")).toBeTruthy();
  });

  it("shows documents when provided", () => {
    const docs = [
      { id: "1", document_type: "gst_certificate", status: "verified" },
      { id: "2", document_type: "pan_card", status: "pending" },
    ];
    render(
      <BusinessVerificationCard
        verification={{ status: "pending" }}
        documents={docs}
      />,
    );
    expect(screen.getByText("Documents (2)")).toBeTruthy();
    expect(screen.getByText("gst certificate")).toBeTruthy();
  });

  it("shows start button when not started", () => {
    const onStart = vi.fn();
    render(<BusinessVerificationCard onStartVerification={onStart} />);
    expect(screen.getByText("Start Business Verification")).toBeTruthy();
  });

  it("hides start button when verification exists", () => {
    render(
      <BusinessVerificationCard
        verification={{ status: "pending" }}
        onStartVerification={vi.fn()}
      />,
    );
    expect(screen.queryByText("Start Business Verification")).toBeNull();
  });
});
