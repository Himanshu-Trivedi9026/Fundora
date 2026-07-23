import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import HeroSection from "../components/landing/HeroSection";
import StatsBar from "../components/landing/StatsBar";
import TrendingProjects from "../components/landing/TrendingProjects";
import HowItWorks from "../components/landing/HowItWorks";
import FinalCTA from "../components/landing/FinalCTA";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-dim">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <StatsBar />
        <TrendingProjects />
        <HowItWorks />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
