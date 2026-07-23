import { motion } from "framer-motion";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/**
 * GalleryGrid — Bento-style image gallery with hover reveal overlays.
 * Props: { media, onPreview }
 */
export default function GalleryGrid({ media, onPreview }) {
  const images = (media || []).filter((m) => m.type === "image");

  if (images.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <h2 className="font-geist text-2xl font-bold text-on-surface mb-8">Concept Gallery</h2>

      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        className="grid grid-cols-2 md:grid-cols-3 gap-4 h-[600px]"
      >
        {images.slice(0, 6).map((img, i) => {
          const isLarge = i === 0;
          return (
            <motion.div
              key={img.id}
              variants={fadeUp}
              whileHover={{ scale: 1.02 }}
              onClick={() => onPreview({ type: "image", url: img.url })}
              className={`rounded-xl overflow-hidden border border-outline-variant/30 relative group cursor-pointer ${
                isLarge ? "col-span-2 row-span-2" : ""
              }`}
            >
              <img
                src={img.url}
                alt={img.name || "Project media"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-surface/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-end">
                <p className="text-sm font-inter text-on-surface">
                  {img.name || `Image ${i + 1}`}
                </p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.section>
  );
}
