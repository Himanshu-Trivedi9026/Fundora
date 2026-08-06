import Image from "next/image";
import { motion } from "framer-motion";

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.08 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/**
 * GalleryGrid — Bento-style image gallery.
 * Props: { media, onPreview }
 */
export default function GalleryGrid({ media, onPreview }) {
  const images = (media || []).filter((m) => m.type === "image");

  if (images.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5 }}
      aria-label="Concept gallery"
    >
      <h2 className="font-geist text-[24px] font-bold border-b border-outline-variant/30 pb-3 mb-4">
        Concept Gallery
      </h2>

      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-30px" }}
        className="grid grid-cols-2 gap-3 h-[400px] md:h-[450px]"
      >
        {images.slice(0, 4).map((img, i) => {
          const isLarge = i === 0;
          return (
            <motion.div
              key={img.id}
              variants={fadeUp}
              whileHover={{ scale: 1.02 }}
              onClick={() => onPreview({ type: "image", url: img.url })}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPreview({ type: "image", url: img.url }); } }}
              role="button"
              tabIndex={0}
              className={`rounded-xl overflow-hidden border border-outline-variant/20 relative group cursor-pointer ${
                isLarge ? "col-span-2 row-span-2" : ""
              }`}
            >
              <Image
                src={img.url}
                alt={img.name || "Project media"}
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                <p className="text-xs font-inter text-on-surface">
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
