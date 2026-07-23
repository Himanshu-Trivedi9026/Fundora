import { motion } from "framer-motion";
import { useRouter } from "next/router";

/**
 * FinalCTA — Final call-to-action section.
 */
export default function FinalCTA() {
  const router = useRouter();

  return (
    <section className="py-24 text-center">
      <div className="max-w-3xl mx-auto px-4">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="font-geist text-4xl md:text-5xl font-bold text-on-surface mb-8"
        >
          Ready to fund the next giant?
        </motion.h2>
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push("/signup")}
          className="bg-primary text-on-primary px-10 py-5 rounded-full font-geist text-lg font-semibold shadow-xl shadow-primary/30 hover:opacity-90 transition-opacity cursor-pointer"
        >
          Get Early Access
        </motion.button>
      </div>
    </section>
  );
}
