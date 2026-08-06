import { motion } from "framer-motion";
import { PROJECT_CATEGORIES } from "../../lib/categories";

const STAGES = ["Pre-seed", "Seed", "Series A", "Scale-up"];

/**
 * SidebarFilters — Sticky sidebar with categories, funding range, market stage.
 * Categories come from shared lib/categories.js to match what's stored in Supabase.
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

  function toggleStage(stage) {
    setFilters((f) => ({
      ...f,
      stage: f.stage === stage ? "" : stage,
    }));
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
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
            {PROJECT_CATEGORIES.map((cat) => {
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
              aria-label={`Maximum funding goal: ₹${(filters.maxGoal || 1000000).toLocaleString("en-IN")}`}
            />
            <div className="flex justify-between mt-3 text-xs font-inter text-on-surface-variant" aria-hidden="true">
              <span>₹0</span>
              <span>₹10L+</span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1" aria-live="polite">
              Max: ₹{(filters.maxGoal || 1000000).toLocaleString("en-IN")}
            </p>
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
                onClick={() => toggleStage(stage)}
                className={`px-3 py-1.5 rounded border text-sm font-inter transition-all ${
                  filters.stage === stage
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-surface-container-low border-outline-variant text-on-surface-variant hover:bg-primary/10 hover:border-primary/50"
                }`}
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
