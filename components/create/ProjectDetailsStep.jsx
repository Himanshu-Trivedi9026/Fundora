import { motion } from "framer-motion";
import { PageHeader, GlassCard, Input } from "../ui";
import CategorySelector from "../CategorySelector";

export default function ProjectDetailsStep({ formData, setFormData, errors }) {
  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <motion.section
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
      aria-label="Project details"
    >
      <PageHeader
        title="The Foundation"
        description="Define the core identity of your campaign."
      />

      <GlassCard padding="lg" className="space-y-6">
        <div className="grid grid-cols-1 gap-6">
          <Input
            label="Project Name"
            required
            type="text"
            value={formData.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="e.g. Neuralink Pro Cluster"
            error={errors.title}
          />

          <Input
            label="Tagline"
            required
            type="text"
            value={formData.short}
            onChange={(e) => updateField("short", e.target.value)}
            placeholder="The world's first decentralized neural interface..."
            error={errors.short}
          />

          <div className="space-y-1.5">
            <label className="block font-inter text-sm text-on-surface-variant">
              Category <span className="text-red-400 ml-0.5">*</span>
            </label>
            <CategorySelector
              selected={formData.categories}
              setSelected={(cats) => updateField("categories", cats)}
            />
            {errors.categories && (
              <p className="text-red-400 text-xs font-inter" role="alert">
                {errors.categories}
              </p>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.section>
  );
}
