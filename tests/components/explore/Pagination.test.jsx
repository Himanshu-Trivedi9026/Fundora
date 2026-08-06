/**
 * Pagination tests — Previous / page numbers with ellipsis / Next.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Pagination, { getPageWindow } from "../../../components/explore/Pagination";

describe("getPageWindow", () => {
  it("shows every page when total is small", () => {
    expect(getPageWindow(1, 1)).toEqual([1]);
    expect(getPageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps a 3-page window around current with ellipses", () => {
    expect(getPageWindow(5, 10)).toEqual([1, "...", 4, 5, 6, "...", 10]);
  });

  it("handles edges (page 1 and page N)", () => {
    // Near start → start cluster visible (1 2 3 … N)
    expect(getPageWindow(1, 10)).toEqual([1, 2, 3, "...", 10]);
    // Near end → end cluster visible (1 … N-2 N-1 N)
    expect(getPageWindow(10, 10)).toEqual([1, "...", 8, 9, 10]);
  });

  it("clamps current to the valid range", () => {
    expect(getPageWindow(0, 10)).toEqual([1, 2, 3, "...", 10]); // clamped to 1
    expect(getPageWindow(999, 10)).toEqual([1, "...", 8, 9, 10]); // clamped to N
  });
});

describe("Pagination", () => {
  it("renders null when there is only one page or no pages", () => {
    const { container } = render(<Pagination page={1} totalPages={1} onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("disables Previous on page 1 and Next on last page", () => {
    render(<Pagination page={1} totalPages={5} onChange={() => {}} />);
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
    expect(screen.getByLabelText("Next page")).not.toBeDisabled();
  });

  it("disables Next on the last page", () => {
    render(<Pagination page={5} totalPages={5} onChange={() => {}} />);
    expect(screen.getByLabelText("Next page")).toBeDisabled();
    expect(screen.getByLabelText("Previous page")).not.toBeDisabled();
  });

  it("shows the total project count when provided", () => {
    render(<Pagination page={1} totalPages={3} totalCount={24} onChange={() => {}} />);
    expect(screen.getByText("24 projects")).toBeInTheDocument();
  });

  it("uses singular wording for one project", () => {
    render(<Pagination page={1} totalPages={2} totalCount={1} onChange={() => {}} />);
    expect(screen.getByText("1 project")).toBeInTheDocument();
  });

  it("shows the page window with ellipsis", () => {
    render(<Pagination page={5} totalPages={10} onChange={() => {}} />);
    expect(screen.getByLabelText("Page 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Page 4")).toBeInTheDocument();
    expect(screen.getByLabelText("Page 5")).toBeInTheDocument();
    expect(screen.getByLabelText("Page 6")).toBeInTheDocument();
    expect(screen.getByLabelText("Page 10")).toBeInTheDocument();
    // Ellipsis markers are aria-hidden; multiple renders are fine.
    expect(screen.getAllByText("…").length).toBeGreaterThan(0);
  });

  it("marks the current page with aria-current", () => {
    render(<Pagination page={2} totalPages={3} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("calls onChange with the target page from Next", () => {
    const onChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("calls onChange with the target page from a number button", () => {
    const onChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Page 4"));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("calls onChange with the target page from Previous", () => {
    const onChange = vi.fn();
    render(<Pagination page={3} totalPages={5} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Previous page"));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("does not call onChange when clicking disabled Previous/Next", () => {
    const onChange = vi.fn();
    render(<Pagination page={1} totalPages={1 + 1} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Previous page"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
