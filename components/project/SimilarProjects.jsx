import Image from "next/image";
import { motion } from "framer-motion";

/**
 * SimilarProjects — Compact card list below FundingSidebar.
 * Props: { projects }
 */
export default function SimilarProjects({ projects }) {
  if (!projects || projects.length === 0) return null;

  return (
    <div className="space-y-4 px-2">
      <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
        Similar Opportunities
      </h3>

      <div className="space-y-3">
        {projects.map((sp) => (
          <motion.a
            key={sp.id}
            whileHover={{ scale: 1.01 }}
            href={`/projects/${sp.id}`}
            className="group block glass-panel p-2.5 rounded-xl hover:bg-white/5 transition-all"
          >
            <div className="flex gap-3">
              {sp.thumbnail ? (
                <div className="w-16 h-16 bg-surface-container-high rounded-lg overflow-hidden shrink-0 relative">
                  <Image
                    src={sp.thumbnail}
                    alt={sp.title}
                    fill
                    sizes="64px"
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 bg-surface-container-high rounded-lg shrink-0 flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-on-surface-variant/30 text-lg"
                    aria-hidden="true"
                  >
                    rocket_launch
                  </span>
                </div>
              )}

              <div className="space-y-0.5 py-0.5">
                <h4 className="font-bold text-on-surface text-[13px] line-clamp-1 group-hover:text-primary transition-colors">
                  {sp.title}
                </h4>
                <p className="text-[10px] text-on-surface-variant line-clamp-2 leading-tight">
                  {sp.short || sp.description?.slice(0, 60)}
                </p>
                <div className="text-[10px] font-bold text-primary pt-1">
                  ₹{(sp.pledged || 0).toLocaleString("en-IN")} raised
                </div>
              </div>
            </div>
          </motion.a>
        ))}
      </div>
    </div>
  );
}
