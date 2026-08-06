// pages/home.js
import Image from "next/image";
import { useRouter } from "next/router";
import { motion } from "framer-motion";

export default function HomeHero() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#020617] via-[#020617] to-[#020617] text-white">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0">
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] bg-blue-600/30 rounded-full blur-[180px] animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-[520px] h-[520px] bg-purple-600/30 rounded-full blur-[180px] animate-pulse delay-1000" />
        <div className="absolute bottom-0 left-1/3 w-[520px] h-[520px] bg-cyan-500/20 rounded-full blur-[180px] animate-pulse delay-2000" />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 min-h-screen">
        {/* Floating Oval Logo */}
        <motion.div
          animate={{ y: [0, -18, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="mb-10"
        >
          <div className="w-44 h-44 md:w-52 md:h-52 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-1 shadow-[0_0_70px_rgba(99,102,241,0.7)]">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Fundora"
                width={112}
                height={112}
                className="w-28 h-28 object-contain"
                priority
              />
            </div>
          </div>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6"
        >
          Empower Ideas.
          <span className="block bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Build the Future Together.
          </span>
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="max-w-2xl text-slate-300 text-base md:text-lg leading-relaxed mb-12"
        >
          Fundora is a modern crowdfunding ecosystem where creators, innovators,
          and communities unite to transform ideas into reality. Discover
          powerful projects, support visionaries, and contribute to a better
          tomorrow.
        </motion.p>

        {/* CTA */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            router.push("/explore");
          }}
          className="px-12 py-4 rounded-full text-lg font-semibold
                     bg-gradient-to-r from-blue-600 to-purple-600
                     shadow-[0_0_35px_rgba(99,102,241,0.7)]
                     hover:shadow-[0_0_70px_rgba(99,102,241,1)]
                     transition-all duration-300"
        >
          Let&rsquo;s Contribute Together for Future
        </motion.button>
      </div>
    </div>
  );
}
