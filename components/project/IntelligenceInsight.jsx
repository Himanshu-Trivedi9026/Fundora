import { motion } from "framer-motion";
import {
  computeGrowthScore,
  computePerformanceScore,
} from "../../lib/ai/projectScore";

function deriveMetrics(growthScore, performanceScore, project) {
  const pledged = project?.pledged || 0;
  const goal = project?.goal || 1;
  const progress = Math.min(pledged / goal, 1);
  return {
    technicalFeasibility: Math.min(Math.round(progress * 100), 98),
    roi: (1 + progress * 3.5).toFixed(1) + "x",
    marketAlpha: progress >= 0.7 ? "High" : progress >= 0.4 ? "Medium" : "Low",
    energyOptimization: performanceScore,
    latency: Math.max(8, Math.round(20 - performanceScore / 10)) + "ms",
    efficiencyTier:
      performanceScore >= 85
        ? "Alpha"
        : performanceScore >= 65
          ? "Beta"
          : "Standard",
  };
}

function GrowthCatalystCard({ score, metrics }) {
  return (
    <div className="glass-panel p-5 rounded-xl space-y-4 border border-white/5">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-primary font-bold text-base">Growth Catalyst</h3>
          <p className="text-on-surface-variant text-[10px]">
            Algorithmic potential score
          </p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">
            {score}
            <span className="text-xs text-on-surface-variant font-normal">
              /100
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] font-medium">
          <span className="text-on-surface-variant uppercase tracking-wider">
            Technical Feasibility
          </span>
          <span>{metrics.technicalFeasibility}%</span>
        </div>
        <div
          className="h-1 bg-surface-container-high rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={metrics.technicalFeasibility}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Technical feasibility"
        >
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${metrics.technicalFeasibility}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-primary rounded-full"
          />
        </div>
      </div>
      <div className="flex gap-4 pt-3 border-t border-outline-variant/10">
        <div className="flex-1 text-center">
          <div className="text-primary font-bold text-lg">{metrics.roi}</div>
          <div className="text-[8px] uppercase font-bold text-on-surface-variant tracking-widest">
            ROI Projected
          </div>
        </div>
        <div className="w-px bg-outline-variant/10 h-6" />
        <div className="flex-1 text-center">
          <div
            className={`font-bold text-lg ${metrics.marketAlpha === "High" ? "text-primary" : "text-on-surface"}`}
          >
            {metrics.marketAlpha}
          </div>
          <div className="text-[8px] uppercase font-bold text-on-surface-variant tracking-widest">
            Market Alpha
          </div>
        </div>
      </div>
    </div>
  );
}

function PerformanceCard({ score, metrics }) {
  return (
    <div className="glass-panel p-5 rounded-xl space-y-4 border border-white/5">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-primary font-bold text-base">Performance</h3>
          <p className="text-on-surface-variant text-[10px]">
            Operational efficiency metrics
          </p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">
            {score}
            <span className="text-xs text-on-surface-variant font-normal">
              /100
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] font-medium">
          <span className="text-on-surface-variant uppercase tracking-wider">
            Energy Optimization
          </span>
          <span>{metrics.energyOptimization}%</span>
        </div>
        <div
          className="h-1 bg-surface-container-high rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={metrics.energyOptimization}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Energy optimization"
        >
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${metrics.energyOptimization}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.15 }}
            className="h-full bg-primary rounded-full"
          />
        </div>
      </div>
      <div className="flex gap-4 pt-3 border-t border-outline-variant/10">
        <div className="flex-1 text-center">
          <div className="text-primary font-bold text-lg">
            {metrics.latency}
          </div>
          <div className="text-[8px] uppercase font-bold text-on-surface-variant tracking-widest">
            Latency
          </div>
        </div>
        <div className="w-px bg-outline-variant/10 h-6" />
        <div className="flex-1 text-center">
          <div
            className={`font-bold text-lg ${metrics.efficiencyTier === "Alpha" ? "text-primary" : "text-on-surface"}`}
          >
            {metrics.efficiencyTier}
          </div>
          <div className="text-[8px] uppercase font-bold text-on-surface-variant tracking-widest">
            Efficiency Tier
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * IntelligenceInsight — Two-panel AI insight section.
 * Props: { project, mediaCount, teamCount }
 */
export default function IntelligenceInsight({
  project,
  mediaCount,
  teamCount,
}) {
  const growthScore = computeGrowthScore(project);
  const perfScore = computePerformanceScore(project, mediaCount, teamCount);
  const metrics = deriveMetrics(growthScore, perfScore, project);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
      aria-label="Intelligence insight"
    >
      <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
        <h2 className="font-geist text-[20px] flex items-center gap-3 font-semibold">
          <span
            className="material-symbols-outlined text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            analytics
          </span>
          Intelligence Insight
        </h2>
        <div className="text-on-surface-variant flex items-center gap-2">
          <span className="text-xs">Verified by Fundora AI</span>
          <span
            className="material-symbols-outlined text-[16px]"
            aria-hidden="true"
          >
            verified
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <GrowthCatalystCard score={growthScore} metrics={metrics} />
        <PerformanceCard score={perfScore} metrics={metrics} />
      </div>
    </motion.section>
  );
}
