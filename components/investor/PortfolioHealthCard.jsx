/**
 * PortfolioHealthCard — Presents the deterministic Portfolio Health Score
 * (0–100) with its four labelled sub-scores. Rendered on the Overview page
 * directly below the AI Recommendations card.
 *
 * Input is the output of computePortfolioHealth (lib/investor/investorData.js).
 */

import GlassCard from "../ui/GlassCard";

export default function PortfolioHealthCard({ health, className = "" }) {
  const safe =
    health && health.score != null
      ? health
      : {
          score: 0,
          breakdown: {
            diversification: 0,
            fundingProgress: 0,
            categorySpread: 0,
            consistency: 0,
          },
        };
  const { score, breakdown } = safe;

  const sections = [
    { label: "Diversification", value: breakdown.diversification },
    { label: "Funding progress", value: breakdown.fundingProgress },
    { label: "Category spread", value: breakdown.categorySpread },
    { label: "Consistency", value: breakdown.consistency },
  ];

  return (
    <GlassCard className={className}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[20px] text-primary"
            aria-hidden="true"
          >
            monitoring_heart
          </span>
          <h3 className="text-sm font-semibold text-on-surface font-geist">
            Portfolio Health
          </h3>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-on-surface font-geist leading-none">
            {score}
            <span className="text-base text-on-surface-variant font-inter">
              /100
            </span>
          </p>
          <p className="text-[10px] uppercase tracking-wider text-on-surface-variant mt-1">
            Overall score
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-on-surface-variant font-inter">
                {s.label}
              </span>
              <span className="text-on-surface font-inter font-medium">
                {s.value}
              </span>
            </div>
            <div
              className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={s.value}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={s.label}
            >
              <div
                className="bg-primary h-full rounded-full transition-all duration-700"
                style={{ width: `${s.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
