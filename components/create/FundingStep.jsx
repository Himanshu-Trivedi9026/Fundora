import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { PageHeader, GlassCard, Card, Input } from "../ui";

const TeamEditor = dynamic(() => import("../TeamEditor"), { ssr: false });

export default function FundingStep({
  formData,
  setFormData,
  team,
  setTeam,
  errors,
}) {
  const [showTeam, setShowTeam] = useState(false);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Calculate deadline based on duration selection
  const handleDurationSelect = (days) => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + days);
    const formatted = deadline.toISOString().split("T")[0];
    updateField("deadline", formatted);
    updateField("duration", days);
  };

  // Projection calculations
  const projection = useMemo(() => {
    const goalNum = Number(formData.goal) || 0;
    const feeRate = 0.025;
    const fees = Math.round(goalNum * feeRate);
    const netAmount = goalNum - fees;

    let completionDate = "—";
    if (formData.deadline) {
      const d = new Date(formData.deadline);
      completionDate = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    return { fees, netAmount, completionDate };
  }, [formData.goal, formData.deadline]);

  // Calculate setup progress
  const setupProgress = useMemo(() => {
    let filled = 0;
    let total = 4;
    if (formData.goal) filled++;
    if (formData.deadline) filled++;
    if (formData.prototypeUrl) filled++;
    if (team.length > 0) filled++;
    return Math.round((filled / total) * 100);
  }, [formData, team]);

  return (
    <motion.section
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
      aria-label="Funding and timeline"
    >
      <PageHeader
        title="Financial Targets"
        description="Configure your milestones and funding trajectory."
      />

      <GlassCard padding="lg" className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Inputs */}
        <div className="space-y-6">
          <Input
            label="Funding Goal (INR)"
            required
            type="number"
            min="1"
            prefix="₹"
            value={formData.goal}
            onChange={(e) => updateField("goal", e.target.value)}
            placeholder="5,00,000"
            error={errors.goal}
          />

          {/* Campaign Duration */}
          <div className="space-y-1.5">
            <label className="block font-inter text-sm text-on-surface-variant">
              Campaign Duration <span className="text-red-400 ml-0.5">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              {[30, 60].map((days) => {
                const isSelected = formData.duration === days;
                return (
                  <motion.button
                    key={days}
                    onClick={() => handleDurationSelect(days)}
                    className={`p-4 rounded-lg text-center font-inter text-sm font-medium transition-all border cursor-pointer ${
                      isSelected
                        ? "bg-primary text-on-primary border-primary shadow-lg shadow-primary/20"
                        : "bg-surface-container-lowest border-outline-variant text-on-surface hover:border-primary"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    aria-pressed={isSelected}
                    aria-label={`${days} days campaign duration`}
                  >
                    {days} Days
                  </motion.button>
                );
              })}
            </div>
            {errors.deadline && (
              <p className="text-red-400 text-xs font-inter" role="alert">
                {errors.deadline}
              </p>
            )}
          </div>

          <Input
            label="Prototype URL"
            hint="optional"
            type="url"
            value={formData.prototypeUrl}
            onChange={(e) => updateField("prototypeUrl", e.target.value)}
            placeholder="https://yourprototype.com"
          />
        </div>

        {/* Right: Projection Card */}
        <Card
          padding="md"
          animate={false}
          className="h-full flex flex-col justify-between"
        >
          <div className="space-y-3">
            <h4 className="font-geist text-base font-semibold text-on-surface">
              Projection
            </h4>
            <div className="space-y-1">
              <p className="text-on-surface-variant font-inter text-sm">
                Estimated platform fees:{" "}
                <span className="text-on-surface">
                  ₹{projection.fees.toLocaleString("en-IN")}
                </span>
              </p>
              <p className="text-on-surface-variant font-inter text-sm">
                Estimated completion:{" "}
                <span className="text-on-surface">
                  {projection.completionDate}
                </span>
              </p>
              <p className="text-on-surface-variant font-inter text-sm">
                Net amount:{" "}
                <span className="text-primary font-medium">
                  ₹{projection.netAmount.toLocaleString("en-IN")}
                </span>
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-outline-variant/20">
            <div className="flex justify-between items-center mb-2">
              <span className="font-inter text-xs text-on-surface-variant">
                Setup Progress
              </span>
              <span className="font-inter text-xs text-primary font-medium">
                {setupProgress}%
              </span>
            </div>
            <div className="w-full h-2 bg-outline-variant rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${setupProgress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>
        </Card>
      </GlassCard>

      {/* Team Section (Expandable) */}
      <GlassCard padding="none" className="overflow-hidden">
        <button
          onClick={() => setShowTeam(!showTeam)}
          className="w-full flex items-center justify-between p-6 text-left hover:bg-surface-container-high/30 transition-colors"
          aria-expanded={showTeam}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[22px]">
              group
            </span>
            <div>
              <h3 className="font-geist text-base font-semibold text-on-surface">
                Team Members
              </h3>
              <p className="text-on-surface-variant font-inter text-xs mt-0.5">
                {team.length > 0
                  ? `${team.length} member${team.length !== 1 ? "s" : ""} added`
                  : "Add your team collaborators"}
              </p>
            </div>
          </div>
          <span
            className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 ${
              showTeam ? "rotate-180" : ""
            }`}
          >
            expand_more
          </span>
        </button>

        <AnimatePresence>
          {showTeam && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-6 border-t border-outline-variant/20 pt-4">
                <TeamEditor team={team} setTeam={setTeam} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.section>
  );
}
