import { motion } from "framer-motion";
import ParallaxBanner from "./ParallaxBanner";

export default function ProfileHeader({ banner, avatar, fullName, bio, children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="animate-fade-in"
    >
      <ParallaxBanner banner={banner} avatar={avatar} fullName={fullName} bio={bio}>
        {children}
      </ParallaxBanner>
    </motion.div>
  );
}
