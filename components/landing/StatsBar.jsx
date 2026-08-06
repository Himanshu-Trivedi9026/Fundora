import { useEffect, useState, useRef, useCallback } from "react";
import { motion, useInView } from "framer-motion";
import { supabase } from "../../lib/supabaseClient";
import { loadLandingStats, EMPTY_STATS } from "../../lib/landing/landingData";

/**
 * AnimatedNumber — counts up from 0 to target value when in viewport.
 */
function AnimatedNumber({ target, prefix = "", suffix = "", decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!inView) return;

    const duration = 1500;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;

      if (decimals > 0) {
        setDisplay(current.toFixed(decimals));
      } else {
        setDisplay(Math.round(current).toLocaleString("en-IN"));
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, [inView, target, decimals]);

  return (
    <motion.span
      ref={ref}
      className="font-geist text-4xl md:text-5xl font-bold text-primary"
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
    >
      {prefix}{display}{suffix}
    </motion.span>
  );
}

/**
 * formatCurrency — formats a number as ₹X or ₹X.XL for lakhs/crores.
 */
function formatCurrency(amount) {
  if (amount >= 10000000) {
    return "₹" + (amount / 10000000).toFixed(1) + "Cr";
  }
  if (amount >= 100000) {
    return "₹" + (amount / 100000).toFixed(1) + "L";
  }
  return "₹" + amount.toLocaleString("en-IN");
}

/**
 * StatsBar — Renders live platform stats and keeps them in sync with the
 * database via Realtime postgres_changes subscriptions.
 *
 * Accepts `initialStats` (rendered server-side by the landing page's ISR). When
 * provided, the initial fetch is skipped — the SSR payload is already correct,
 * avoiding a redundant client query. The realtime subscription is always
 * active so the numbers keep updating live as the database changes.
 *
 * Every number is derived from real rows:
 *  - Capital Raised:    SUM(public_donations.amount WHERE status = 'paid')
 *  - Projects Launched: COUNT(projects WHERE deleted = false)
 *  - Total Backers:     COUNT(DISTINCT public_donations.payer_id)
 *  - Team Members:      COUNT(team_members) — existing schema only
 *
 * @param {object} [props]
 * @param {object} [props.initialStats] server-rendered stats (public data).
 */
export default function StatsBar({ initialStats = null }) {
  const [stats, setStats] = useState(initialStats || { ...EMPTY_STATS });
  const debounceRef = useRef(null);

  const loadStats = useCallback(async () => {
    try {
      // Three reads fire in parallel; donations drives both raised + backers.
      setStats(await loadLandingStats(supabase));
    } catch (err) {
      // Never fabricate numbers — keep the previous values on failure.
      console.error("Failed to load stats:", err);
    }
  }, []);

  useEffect(() => {
    // ISR already rendered these values; don't re-query them on the client.
    // Deferred to a microtask so the setState inside loadStats is not applied
    // synchronously within this effect (react-hooks/set-state-in-effect).
    if (!initialStats) queueMicrotask(loadStats);

    // The landing page must update whenever database values change. These
    // channels are a no-op if the tables are not in the realtime publication,
    // so they are safe to subscribe unconditionally. Bursts of events are
    // debounced so a flurry of DB writes collapses into one refetch.
    const scheduleRefetch = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => loadStats(), 250);
    };

    const channels = ["public_donations", "projects", "team_members"].map(
      (table) =>
        supabase
          .channel(`landing-stats-${table}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table },
            scheduleRefetch,
          )
          .subscribe(),
    );

    return () => {
      clearTimeout(debounceRef.current);
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [loadStats, initialStats]);

  const statItems = [
    {
      value: stats.totalRaised,
      prefix: "",
      suffix: "",
      decimals: 0,
      display: formatCurrency(stats.totalRaised),
      label: "Capital Raised",
      useFormatted: true,
    },
    {
      value: stats.totalProjects,
      label: "Projects Launched",
    },
    {
      value: stats.totalBackers,
      label: "Total Backers",
    },
    {
      value: stats.totalTeamMembers,
      label: "Team Members",
    },
  ];

  return (
    <section className="py-12 border-y border-white/[0.06] bg-surface-container-lowest/50 backdrop-blur-sm" aria-label="Platform statistics">
      <div className="max-w-6xl mx-auto px-4 md:px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {statItems.map((s, i) => (
          <div key={i} className="space-y-2" aria-live="polite" aria-atomic="true">
            {s.useFormatted ? (
              <motion.span
                className="font-geist text-4xl md:text-5xl font-bold text-primary"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                {s.display}
              </motion.span>
            ) : (
              <AnimatedNumber
                target={s.value}
                prefix={s.prefix}
                suffix={s.suffix}
                decimals={s.decimals || 0}
              />
            )}
            <p className="font-inter text-xs text-on-surface-variant uppercase tracking-widest">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
