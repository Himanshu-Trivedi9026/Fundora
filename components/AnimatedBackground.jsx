/**
 * AnimatedBackground — Premium dark background with subtle gradients
 *
 * Props:
 *   background: "default" | "minimal" | "none"
 *
 *   "default" — Full premium background with radial gradients + noise + grid
 *   "minimal" — Solid dark background, no gradients
 *   "none"    — No background rendered
 */
export default function AnimatedBackground({ background = "default" }) {
  if (background === "none") return null;

  if (background === "minimal") {
    return (
      <div
        className="fixed inset-0 -z-10 bg-surface-dim pointer-events-none"
        aria-hidden="true"
      />
    );
  }

  /* "default" — full premium background */
  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden bg-surface-dim pointer-events-none"
      aria-hidden="true"
    >
      {/* ── Subtle Radial Gradients ── */}
      {/* Blue-purple glow — top left */}
      <div
        className="absolute -top-40 -left-40 w-[800px] h-[800px] rounded-full animate-gradient-drift"
        style={{
          background:
            "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Violet-pink glow — bottom right */}
      <div
        className="absolute -bottom-32 -right-32 w-[700px] h-[700px] rounded-full animate-gradient-drift"
        style={{
          background:
            "radial-gradient(circle, rgba(236,72,153,0.06) 0%, transparent 70%)",
          animationDelay: "-10s",
        }}
      />

      {/* Cyan-blue glow — center */}
      <div
        className="absolute top-1/3 left-1/3 w-[600px] h-[600px] rounded-full animate-gradient-drift"
        style={{
          background:
            "radial-gradient(circle, rgba(56,189,248,0.04) 0%, transparent 70%)",
          animationDelay: "-20s",
        }}
      />

      {/* ── Noise Texture ── */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />

      {/* ── Subtle Grid ── */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
    </div>
  );
}
