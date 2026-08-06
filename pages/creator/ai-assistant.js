import { useRouter } from "next/router";
import { useEffect } from "react";
import Link from "next/link";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../context/RoleContext";

const aiTools = [
  {
    title: "Campaign Generator",
    description:
      "Generate compelling campaign content with AI assistance. Create titles, descriptions, and story elements that resonate with donors.",
    icon: "auto_awesome",
    href: "/create",
    color: "text-primary",
  },
  {
    title: "Campaign Recommendations",
    description:
      "Get AI-powered recommendations to optimize your campaign strategy, audience targeting, and fundraising approach.",
    icon: "recommend",
    href: "/creator/recommendations",
    color: "text-success",
  },
  {
    title: "Funding Predictions",
    description:
      "Leverage AI to predict funding outcomes, forecast donation trends, and estimate your campaign's potential reach.",
    icon: "trending_up",
    href: "/creator/predictions",
    color: "text-warning",
  },
];

export default function AIAssistant() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading AI workspace..." />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-[32px] text-primary">
                psychology
              </span>
              <h1 className="text-2xl md:text-3xl font-bold text-on-surface font-geist">
                AI Workspace
              </h1>
            </div>
            <p className="text-on-surface-variant text-sm max-w-2xl">
              Supercharge your fundraising with AI-powered tools. Generate
              compelling campaign content, get smart recommendations, and
              predict funding outcomes.
            </p>
          </div>

          {/* AI Tools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {aiTools.map((tool, index) => (
              <GlassCard key={index} padding="lg" hover>
                <div className="flex flex-col h-full">
                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-5`}
                  >
                    <span
                      className={`material-symbols-outlined text-[28px] ${tool.color}`}
                    >
                      {tool.icon}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-on-surface font-geist mb-2">
                    {tool.title}
                  </h3>

                  {/* Description */}
                  <p className="text-on-surface-variant text-sm font-inter flex-1 mb-6">
                    {tool.description}
                  </p>

                  {/* Action */}
                  <Link href={tool.href}>
                    <Button variant="primary" size="md" className="w-full">
                      <span className="material-symbols-outlined text-[18px]">
                        arrow_forward
                      </span>
                      Open {tool.title}
                    </Button>
                  </Link>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Info Note */}
          <GlassCard padding="md" className="mt-8">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[20px] text-primary mt-0.5">
                info
              </span>
              <div>
                <p className="text-sm text-on-surface font-inter font-medium">
                  Powered by AI
                </p>
                <p className="text-xs text-on-surface-variant font-inter mt-1">
                  Our AI tools use advanced language models to assist with your
                  fundraising campaigns. All generated content should be
                  reviewed before publishing. Data is processed securely and not
                  stored for training purposes.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </PageLayout>
  );
}