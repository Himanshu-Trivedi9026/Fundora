/**
 * CompletionIndicator — Visual verification completion percentage.
 *
 * @param {Object} props
 * @param {number} props.percentage — Completion percentage (0-100)
 * @param {string} props.label — Optional label
 * @param {string} props.size — 'sm' | 'md' | 'lg'
 */
export default function CompletionIndicator({
  percentage = 0,
  label = "Verification Completion",
  size = "md",
}) {
  const sizes = {
    sm: { ring: 12, text: "text-xs", font: "text-[8px]" },
    md: { ring: 16, text: "text-sm", font: "text-[10px]" },
    lg: { ring: 20, text: "text-base", font: "text-sm" },
  };
  const s = sizes[size] || sizes.md;
  const r = s.ring;
  const circumference = 2 * Math.PI * (r / 2);
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: r * 2 + 8, height: r * 2 + 8 }}>
        <svg
          className="w-full h-full -rotate-90"
          viewBox={`0 0 ${r * 2 + 4} ${r * 2 + 4}`}
        >
          <circle
            cx={r + 2}
            cy={r + 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="2"
          />
          <circle
            cx={r + 2}
            cy={r + 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-primary transition-all duration-1000"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold text-primary ${s.font}`}>
            {percentage}%
          </span>
        </div>
      </div>
      <div>
        <p className={`font-semibold text-on-surface ${s.text}`}>{label}</p>
        <p className="text-xs text-on-surface-variant font-inter">
          {percentage === 100
            ? "Complete"
            : `${Math.round((percentage / 100) * 6)} of 6 steps done`}
        </p>
      </div>
    </div>
  );
}
