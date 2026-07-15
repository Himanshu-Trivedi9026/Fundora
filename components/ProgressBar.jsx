import { useEffect, useState } from "react";

export default function ProgressBar({ pledged = 0, goal = 100 }) {
  const percent = Math.min(100, Math.round((pledged / goal) * 100));
  const [animatedWidth, setAnimatedWidth] = useState(0);

  // Animate whenever pledged changes (realtime update)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setAnimatedWidth(percent);
    }, 100);

    return () => clearTimeout(timeout);
  }, [percent]);

  return (
    <div className="space-y-1">
      {/* BAR CONTAINER */}
      <div
        className="relative w-full h-3 rounded-full overflow-hidden bg-slate-700"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Funding progress: ${percent}%`}
      >

        {/* GLOW BACKDROP */}
        <div
          className="absolute inset-0 blur-md opacity-40 transition-all duration-700"
          style={{
            width: `${animatedWidth}%`,
            background:
              "linear-gradient(90deg, #22c55e, #4ade80, #22c55e)",
          }}
        />

        {/* MAIN BAR */}
        <div
          className="relative h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${animatedWidth}%`,
            background:
              "linear-gradient(90deg, #16a34a, #4ade80, #22c55e)",
          }}
        />
      </div>

      {/* LABEL */}
      <p className="text-xs text-slate-300 mt-1">
        {percent}% funded — ₹{pledged} of ₹{goal}
      </p>
    </div>
  );
}
