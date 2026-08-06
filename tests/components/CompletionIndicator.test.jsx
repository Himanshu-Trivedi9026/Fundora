import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CompletionIndicator from "../../components/verification/CompletionIndicator";

describe("CompletionIndicator", () => {
  it("renders with 0% completion", () => {
    render(<CompletionIndicator percentage={0} />);
    expect(screen.getByText("0%")).toBeTruthy();
    expect(screen.getByText("0 of 6 steps done")).toBeTruthy();
  });

  it("renders with 50% completion", () => {
    render(<CompletionIndicator percentage={50} />);
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("3 of 6 steps done")).toBeTruthy();
  });

  it("renders with 100% completion", () => {
    render(<CompletionIndicator percentage={100} />);
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("Complete")).toBeTruthy();
  });

  it("shows custom label", () => {
    render(<CompletionIndicator percentage={75} label="Custom Label" />);
    expect(screen.getByText("Custom Label")).toBeTruthy();
  });

  it("shows default label", () => {
    render(<CompletionIndicator percentage={50} />);
    expect(screen.getByText("Verification Completion")).toBeTruthy();
  });

  it("renders SVG circle", () => {
    const { container } = render(<CompletionIndicator percentage={60} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });
});
