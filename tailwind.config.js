/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./app/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        geist: ["Geist", "system-ui", "sans-serif"],
        inter: ["Inter", "system-ui", "sans-serif"],
        poppins: ["Poppins", "system-ui", "sans-serif"],
      },
      colors: {
        /* ─── Surface Scale (dark-only) ─── */
        surface: {
          dim: "#0a0a0f",
          DEFAULT: "#0e0e14",
          bright: "#27272e",
          container: {
            lowest: "#08080c",
            low: "#12121a",
            DEFAULT: "#1a1a24",
            high: "#22222e",
            highest: "#2a2a36",
          },
        },

        /* ─── Primary (Violet) ─── */
        primary: {
          DEFAULT: "#c4a8ff",
          container: "#8b5cf6",
          fixed: "#e0d4ff",
        },

        /* ─── Outline ─── */
        outline: {
          DEFAULT: "#958ea0",
          variant: "#2a2a36",
        },

        /* ─── Text on Surfaces ─── */
        "on-surface": {
          DEFAULT: "#e4e1e5",
          variant: "#cbc3d7",
        },
        "on-primary": "#1a0040",

        /* ─── Muted (secondary text) ─── */
        muted: {
          DEFAULT: "#71717a",
          light: "#a1a1aa",
        },

        /* ─── Semantic Colors ─── */
        success: {
          DEFAULT: "#34d399",
          muted: "rgba(52, 211, 153, 0.15)",
        },
        warning: {
          DEFAULT: "#fbbf24",
          muted: "rgba(251, 191, 36, 0.15)",
        },
        danger: {
          DEFAULT: "#f87171",
          muted: "rgba(248, 113, 113, 0.15)",
        },

        /* ─── Glass ─── */
        glass: {
          DEFAULT: "rgba(18, 18, 24, 0.72)",
          border: "rgba(255, 255, 255, 0.06)",
        },
      },

      /* ─── Shadows ─── */
      boxShadow: {
        glass: "0 0 0 1px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
        "glass-lg": "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.3)",
        glow: "0 0 20px rgba(196,168,255,0.15)",
        "glow-lg": "0 0 40px rgba(196,168,255,0.2)",
      },

      /* ─── Border Radius ─── */
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },

      /* ─── Animations ─── */
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        "gradient-drift": "gradientDrift 30s ease-in-out infinite",
      },

      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        gradientDrift: {
          "0%": { transform: "translate(0%, 0%) scale(1)" },
          "33%": { transform: "translate(3%, -2%) scale(1.02)" },
          "66%": { transform: "translate(-2%, 3%) scale(0.98)" },
          "100%": { transform: "translate(0%, 0%) scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
