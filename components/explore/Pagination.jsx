import { motion } from "framer-motion";

/**
 * Pagination — Previous / 1 2 … N / Next navigation.
 *
 * Collapses long page ranges into a window around the current page with
 * ellipses (e.g. 1 … 4 5 6 … 10). Pure and testable: only `page`, `totalPages`
 * and `onChange` drive the render.
 *
 * @param {object} props
 * @param {number} props.page current 1-based page.
 * @param {number} props.totalPages total page count (>= 1).
 * @param {(p: number) => void} props.onChange called with the target page.
 * @param {number} [props.totalCount] optional row count for a summary line.
 */
export default function Pagination({ page, totalPages, onChange, totalCount }) {
  // Nothing to paginate: fewer than two pages.
  if (!totalPages || totalPages < 2) return null;

  const pages = getPageWindow(page, totalPages);

  function go(next) {
    if (next < 1 || next > totalPages || next === page) return;
    onChange(next);
  }

  return (
    <nav
      aria-label="Pagination"
      className="mt-16 flex flex-col items-center gap-4"
    >
      {typeof totalCount === "number" && (
        <p className="text-on-surface-variant font-inter text-sm">
          {totalCount} project{totalCount !== 1 ? "s" : ""}
        </p>
      )}

      <div className="flex items-center gap-1.5">
        {/* Previous */}
        <button
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="flex items-center gap-1 border border-outline-variant px-3 py-2 rounded-lg hover:border-primary hover:text-primary transition-all text-on-surface-variant font-inter text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-outline-variant disabled:hover:text-on-surface-variant"
        >
          <span
            className="material-symbols-outlined text-[16px]"
            aria-hidden="true"
          >
            chevron_left
          </span>
          Previous
        </button>

        {/* Page numbers with ellipsis */}
        {pages.map((p, i) =>
          p === "..." ? (
            <span
              key={`ellipsis-${i}`}
              aria-hidden="true"
              className="px-1.5 text-on-surface-variant font-inter text-sm select-none"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => go(p)}
              aria-current={p === page ? "page" : undefined}
              aria-label={`Page ${p}`}
              className={`min-w-[38px] px-2 py-2 rounded-lg font-inter text-sm transition-all ${
                p === page
                  ? "bg-primary text-on-primary shadow-md shadow-primary/25"
                  : "border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"
              }`}
            >
              {p}
            </button>
          ),
        )}

        {/* Next */}
        <button
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="flex items-center gap-1 border border-outline-variant px-3 py-2 rounded-lg hover:border-primary hover:text-primary transition-all text-on-surface-variant font-inter text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-outline-variant disabled:hover:text-on-surface-variant"
        >
          Next
          <span
            className="material-symbols-outlined text-[16px]"
            aria-hidden="true"
          >
            chevron_right
          </span>
        </button>
      </div>

      <motion.p
        key={page}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xs text-on-surface-variant/70 font-inter"
      >
        Page {page} of {totalPages}
      </motion.p>
    </nav>
  );
}

/**
 * Compute the page-number window with ellipses.
 * total <= 7 → show every page. Otherwise show a start cluster, an end
 * cluster, and a 3-page window around `current`, inserting "…" for gaps.
 *   near start → 1 2 3 … N
 *   middle    → 1 … c-1 c c+1 … N
 *   near end  → 1 … N-2 N-1 N
 */
export function getPageWindow(current, total) {
  const c = Math.max(1, Math.min(total, Number(current) || 1));
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const candidates = new Set();
  candidates.add(1);
  candidates.add(total);
  // Start cluster (1 2 3) visible when near the beginning.
  if (c <= 3) {
    candidates.add(2);
    candidates.add(3);
  }
  // End cluster (N-2 N-1 N) visible when near the end.
  if (c >= total - 2) {
    candidates.add(total - 1);
    candidates.add(total - 2);
  }
  candidates.add(c - 1);
  candidates.add(c);
  candidates.add(c + 1);

  const sorted = [...candidates]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("...");
    out.push(p);
    prev = p;
  }
  return out;
}
