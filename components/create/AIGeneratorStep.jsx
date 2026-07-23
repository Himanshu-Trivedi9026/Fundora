import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { PageHeader, GlassCard } from "../ui";

const CampaignAIGenerator = dynamic(
  () => import("../CampaignAIGenerator"),
  { ssr: false }
);

export default function AIGeneratorStep({ setDescription }) {
  return (
    <motion.section
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
      aria-label="AI campaign generator"
    >
      <PageHeader
        title="AI Intelligence"
        icon="auto_awesome"
        description="Draft a high-impact narrative with architectural precision."
      />

      <GlassCard padding="lg" className="relative overflow-hidden">
        <CampaignAIGenerator setDescription={setDescription} />
      </GlassCard>

      {/* Info Note */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
        <span
          className="material-symbols-outlined text-primary mt-0.5 text-[20px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          info
        </span>
        <p className="text-on-surface-variant font-inter text-xs md:text-sm leading-relaxed">
          The AI will generate a professional campaign description based on your
          inputs. You can edit the generated text in the next step, or
          skip this step and write your own description.
        </p>
      </div>
    </motion.section>
  );
}
