/**
 * StatCard — Presentational KPI card matching the investor dashboard's stat
 * markup exactly (glass-card, material icon, uppercase label). Shared by the
 * Overview "Portfolio Summary" and Analytics "Performance metrics" grids so
 * both pages stay visually identical without duplicating the card JSX.
 *
 * Usage:
 *   <StatCard label="Total Invested" value="₹1,50,000" icon="account_balance" color="text-primary" />
 */

export default function StatCard({
  label,
  value,
  icon,
  color = "text-primary",
  className = "",
}) {
  return (
    <div
      className={`glass-card p-4 hover:border-primary/30 transition-all duration-200 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-on-surface-variant text-xs font-inter uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-bold text-on-surface mt-2 font-geist">{value}</p>
        </div>
        <span className={`material-symbols-outlined text-[28px] ${color}`} aria-hidden="true">
          {icon}
        </span>
      </div>
    </div>
  );
}
