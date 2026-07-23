import { motion } from "framer-motion";

const CATEGORIES = [
  { id: "tech-web3", label: "Tech & Web3" },
  { id: "ai", label: "Artificial Intelligence" },
  { id: "creative", label: "Creative Media" },
  { id: "social", label: "Social Impact" },
];

const STAGES = ["Pre-seed", "Seed", "Series A", "Scale-up"];

/**
 * SidebarFilters — Sticky sidebar with categories, funding range, market stage.
 * Uses same filter state shape as the old FiltersSidebar.
 */
export default function SidebarFilters({ filters, setFilters }) {
  function toggleCategory(label) {
    setFilters((f) => ({
      ...f,
      categories: f.categories.includes(label)
        ? f.categories.filter((c) => c !== label)
        : [...f.categories, label],
    }));
  }

  function setFundingMax(value) {
    setFilters((f) => ({ ...f, maxGoal: value }));
  }

  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="w-full lg:w-72 flex-shrink-0"
    >
      <div className="lg:sticky lg:top-28 space-y-10">
        {/* ─── Categories ─── */}
        <div>
          <h3 className="text-on-surface font-geist text-sm font-semibold uppercase tracking-widest mb-6 border-l-2 border-primary pl-4">
            Categories
          </h3>
          <div className="space-y-2">
            {CATEGORIES.map((cat) => {
              const checked = filters.categories.includes(cat.label);
              return (
                <label
                  key={cat.id}
                  className="flex items-center gap-3 group cursor-pointer p-2 rounded-lg hover:bg-surface-container-high transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(cat.label)}
                    className="w-5 h-5 rounded border-outline-variant bg-surface-container-lowest text-primary focus:ring-primary/20 accent-[var(--color-primary)]"
                  />
                  <span className="text-on-surface-variant group-hover:text-on-surface transition-colors text-sm font-inter">
                    {cat.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* ─── Funding Range ─── */}
        <div>
          <h3 className="text-on-surface font-geist text-sm font-semibold uppercase tracking-widest mb-6 border-l-2 border-primary pl-4">
            Funding Range
          </h3>
          <div className="px-2">
            <input
              type="range"
              min="0"
              max="1000000"
              step="10000"
              value={filters.maxGoal || 1000000}
              onChange={(e) => setFundingMax(Number(e.target.value))}
              className="w-full h-1.5 bg-surface-container-highest rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between mt-3 text-xs font-inter text-on-surface-variant">
              <span>$0</span>
              <span>$1M+</span>
            </div>
          </div>
        </div>

        {/* ─── Market Stage ─── */}
        <div>
          <h3 className="text-on-surface font-geist text-sm font-semibold uppercase tracking-widest mb-6 border-l-2 border-primary pl-4">
            Market Stage
          </h3>
          <div className="flex flex-wrap gap-2">
            {STAGES.map((stage) => (
              <button
                key={stage}
                onClick={() => {
                  /* Stage filtering — can be extended later */
                }}
                className="px-3 py-1.5 rounded bg-surface-container-low border border-outline-variant text-sm font-inter text-on-surface-variant hover:bg-primary/20 hover:border-primary transition-all"
              >
                {stage}
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
