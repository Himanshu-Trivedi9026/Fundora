import dynamic from "next/dynamic";
import { Suspense } from "react";
import HeroSection from "../components/landing/HeroSection";
import StatsBar from "../components/landing/StatsBar";
import TrendingProjects from "../components/landing/TrendingProjects";
import SEO from "../components/SEO";
import { loadLandingPageData } from "../lib/landing/landingData";
import { supabaseServer } from "../lib/supabaseServer";

// Below-the-fold sections are code-split so their JS loads lazily after the
// hero, while SSR keeps their HTML in the initial response (no layout shift,
// no SEO loss). They hydrate into the exact same markup once loaded.
const HowItWorks = dynamic(
  () => import("../components/landing/HowItWorks"),
  { ssr: true, loading: () => <HowItWorksSpacer /> },
);
const FinalCTA = dynamic(
  () => import("../components/landing/FinalCTA"),
  { ssr: true, loading: () => <FinalCTASpacer /> },
);
const Footer = dynamic(
  () => import("../components/Footer"),
  { ssr: true, loading: () => <FooterSpacer /> },
);

// ── Spacers reserve the section's vertical space so the lazy chunk swap
//    below the fold causes no layout shift. ──
function HowItWorksSpacer() {
  return <section className="py-24 bg-surface-dim" aria-hidden="true" />;
}
function FinalCTASpacer() {
  return <section className="py-24 text-center" aria-hidden="true" />;
}
function FooterSpacer() {
  return <footer className="bg-surface-container-lowest" aria-hidden="true" />;
}

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Fundora",
  url: "https://fundora.vercel.app",
  description: "Fundora is an AI-powered crowdfunding platform where creators, innovators, and communities unite to transform ideas into reality.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://fundora.vercel.app/explore?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

/**
 * Home — the landing page.
 *
 * The page is Incrementally Static Regenerated (revalidate: 60): getStaticProps
 * renders the public stats + trending rows server-side, and ISR serves that
 * cached HTML with no per-request DB work. Authenticated rendering (hero CTAs
 * from RoleContext) happens entirely client-side, so no user/role data is ever
 * in the cached payload. Client realtime subscriptions keep the stats and
 * trending sections updating live after the initial render.
 */
export default function Home({ initialStats, initialTrending }) {
  return (
    <>
      <SEO
        title="Crowdfunding Reimagined"
        description="Fundora is an AI-powered crowdfunding platform where creators, innovators, and communities unite to transform ideas into reality. Discover projects, support visionaries."
        url="/"
        structuredData={structuredData}
      />
      <div className="min-h-screen flex flex-col bg-surface-dim">
        <main className="flex-1">
          <HeroSection />
          <StatsBar initialStats={initialStats} />
          <TrendingProjects initial={initialTrending} />
          <Suspense>
            <HowItWorks />
          </Suspense>
          <Suspense>
            <FinalCTA />
          </Suspense>
        </main>
        <Suspense>
          <Footer />
        </Suspense>
      </div>
    </>
  );
}

export async function getStaticProps() {
  const { initialStats, initialTrending } = await loadLandingPageData(
    supabaseServer,
  );
  return {
    props: { initialStats, initialTrending },
    // Public-only data: revalidate the cached HTML in the background every
    // minute. No authenticated data is involved.
    revalidate: 60,
  };
}
