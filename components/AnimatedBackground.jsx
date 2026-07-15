// components/AnimatedBackground.jsx

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-[#020617]" aria-hidden="true">
      {/* Base dark background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#030817] to-black" />

      {/* Aurora Layers */}
      <div className="aurora-layer aurora-1"></div>
      <div className="aurora-layer aurora-2"></div>
      <div className="aurora-layer aurora-3"></div>

      {/* Soft glow fog */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,180,255,0.15),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,0,180,0.12),transparent_55%)]" />

      {/* Subtle grid for structure */}
      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            "linear-gradient(#0a0f1f 1px, transparent 1px), linear-gradient(90deg, #0a0f1f 1px, transparent 1px)",
          backgroundSize: "70px 70px",
        }}
      />
    </div>
  );
}
