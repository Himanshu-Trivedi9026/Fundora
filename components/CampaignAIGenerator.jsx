import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { PROJECT_CATEGORIES } from "../lib/categories";

/**
 * CampaignAIGenerator — AI-powered campaign description generator.
 * Pre-fills from parent formData, uses shared categories, shows preview before accepting.
 */
export default function CampaignAIGenerator({
  setDescription,
  initialTitle = "",
  initialCategory = "",
  initialGoal = "",
}) {
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState(initialCategory);
  const [goal, setGoal] = useState(initialGoal);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState("");
  const [error, setError] = useState("");

  async function generateCampaign() {
    if (!title.trim() || !category || !goal) {
      setError("Please fill in all fields: Title, Category, and Funding Goal.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setGenerated("");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/ai/generate-campaign", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: title.trim(),
          category,
          goal: Number(goal),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || `API error (${res.status})`);
        return;
      }

      if (!data?.content) {
        setError("AI returned an empty response. Please try again.");
        return;
      }

      setGenerated(data.content);
    } catch (err) {
      console.error("AI generation error:", err);
      setError("Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleAccept() {
    setDescription(generated);
    setGenerated("");
  }

  function handleRegenerate() {
    setGenerated("");
    generateCampaign();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span
            className="material-symbols-outlined text-primary text-[22px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            auto_awesome
          </span>
        </div>
        <div>
          <h3 className="font-geist text-base font-semibold text-on-surface">
            AI Campaign Generator
          </h3>
          <p className="text-on-surface-variant text-xs font-inter">
            Fill in your project details and let AI craft your campaign story.
          </p>
        </div>
      </div>

      {/* Input Fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Campaign Title */}
        <div className="space-y-1.5">
          <label
            htmlFor="campaign-title"
            className="block text-xs font-inter text-on-surface-variant uppercase tracking-wider"
          >
            Campaign Title
          </label>
          <input
            id="campaign-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Neuralink Pro Cluster"
            className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg px-4 py-2.5 text-sm text-on-surface font-inter placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Category Dropdown */}
        <div className="space-y-1.5">
          <label
            htmlFor="campaign-category"
            className="block text-xs font-inter text-on-surface-variant uppercase tracking-wider"
          >
            Category
          </label>
          <select
            id="campaign-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg px-4 py-2.5 text-sm text-on-surface font-inter focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
          >
            <option value="" disabled>
              Select category
            </option>
            {PROJECT_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.label}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Funding Goal */}
        <div className="space-y-1.5">
          <label
            htmlFor="campaign-goal"
            className="block text-xs font-inter text-on-surface-variant uppercase tracking-wider"
          >
            Funding Goal (₹)
          </label>
          <input
            id="campaign-goal"
            type="number"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. 50000"
            min="1"
            className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg px-4 py-2.5 text-sm text-on-surface font-inter placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={generateCampaign}
        disabled={loading || !title.trim() || !category || !goal}
        className="w-full bg-primary text-on-primary px-6 py-3 rounded-lg font-geist text-sm font-semibold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:opacity-40 cursor-pointer flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span
              className="material-symbols-outlined text-[18px] animate-spin"
              aria-hidden="true"
            >
              progress_activity
            </span>
            Generating...
          </>
        ) : (
          <>
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
              aria-hidden="true"
            >
              auto_awesome
            </span>
            Generate AI Campaign
          </>
        )}
      </button>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
            role="alert"
            aria-live="polite"
          >
            <span
              className="material-symbols-outlined text-red-400 text-[18px] mt-0.5"
              aria-hidden="true"
            >
              error
            </span>
            <p className="text-red-300 text-sm font-inter flex-1">{error}</p>
            <button
              onClick={() => setError("")}
              className="text-red-400/60 hover:text-red-300 transition-colors"
              aria-label="Dismiss error"
            >
              <span
                className="material-symbols-outlined text-[16px]"
                aria-hidden="true"
              >
                close
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generated Preview */}
      <AnimatePresence>
        {generated && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <span
                className="material-symbols-outlined text-primary text-[18px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                preview
              </span>
              <h4 className="font-geist text-sm font-semibold text-on-surface">
                Generated Campaign Description
              </h4>
            </div>

            <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-5 max-h-80 overflow-y-auto custom-scrollbar">
              <p className="text-on-surface text-sm font-inter leading-relaxed whitespace-pre-wrap">
                {generated}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleAccept}
                className="flex-1 bg-primary text-on-primary px-5 py-2.5 rounded-lg font-inter text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <span
                  className="material-symbols-outlined text-[16px]"
                  aria-hidden="true"
                >
                  check
                </span>
                Use This Description
              </button>
              <button
                onClick={handleRegenerate}
                disabled={loading}
                className="px-5 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant font-inter text-sm hover:bg-surface-container-high hover:border-primary/50 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <span
                  className="material-symbols-outlined text-[16px]"
                  aria-hidden="true"
                >
                  refresh
                </span>
                Regenerate
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
