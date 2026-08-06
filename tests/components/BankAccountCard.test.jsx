import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BankAccountCard from "../../components/verification/BankAccountCard";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }) => {
      const { initial, animate, whileHover, whileTap, ...domProps } = props;
      return <div {...domProps}>{children}</div>;
    },
  },
}));

describe("BankAccountCard", () => {
  const baseAccount = {
    id: "acc1",
    bank_name: "HDFC Bank",
    account_holder_name: "John Doe",
    account_type: "savings",
    is_primary: false,
    status: "draft",
  };

  it("renders bank name and status", () => {
    render(<BankAccountCard account={baseAccount} />);
    expect(screen.getByText("HDFC Bank")).toBeTruthy();
    expect(screen.getByText("draft")).toBeTruthy();
  });

  it("shows primary badge when is_primary", () => {
    render(<BankAccountCard account={{ ...baseAccount, is_primary: true }} />);
    expect(screen.getByText("Primary")).toBeTruthy();
  });

  it("shows verify button for draft accounts", () => {
    const onVerify = vi.fn();
    render(<BankAccountCard account={baseAccount} onVerify={onVerify} />);
    expect(screen.getByText("Verify")).toBeTruthy();
  });

  it("hides verify button for verified accounts", () => {
    render(<BankAccountCard account={{ ...baseAccount, status: "verified" }} onVerify={vi.fn()} />);
    expect(screen.queryByText("Verify")).toBeNull();
  });

  it("shows set primary for non-primary verified accounts", () => {
    const onSetPrimary = vi.fn();
    render(
      <BankAccountCard
        account={{ ...baseAccount, status: "verified", is_primary: false }}
        onSetPrimary={onSetPrimary}
      />
    );
    expect(screen.getByText("Set Primary")).toBeTruthy();
  });

  it("shows penny drop status when available", () => {
    render(
      <BankAccountCard
        account={{ ...baseAccount, penny_drop_status: "success" }}
      />
    );
    expect(screen.getByText("success")).toBeTruthy();
  });

  it("shows remove button for non-verified accounts", () => {
    const onRemove = vi.fn();
    render(<BankAccountCard account={baseAccount} onRemove={onRemove} />);
    expect(screen.getByText("Remove")).toBeTruthy();
  });

  it("hides remove button for verified accounts", () => {
    render(
      <BankAccountCard
        account={{ ...baseAccount, status: "verified" }}
        onRemove={vi.fn()}
      />
    );
    expect(screen.queryByText("Remove")).toBeNull();
  });
});
