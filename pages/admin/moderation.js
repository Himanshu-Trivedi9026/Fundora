/**
 * Admin Moderation Page — Moderation Center for admins.
 *
 * Dynamic import to avoid SSR issues with dashboard components.
 */

import Head from "next/head";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import PageLayout from "../../components/PageLayout";
import { useRole } from "../../context/RoleContext";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

const ModerationDashboard = dynamic(() => import("../../components/admin/ModerationDashboard"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]" role="status" aria-label="Loading">
      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function ModerationPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();

  if (authLoading) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      </PageLayout>
    );
  }

  if (!user) return null;

  return (
    <PageLayout>
      <Head>
        <title>Moderation Center — Fundora Admin</title>
        <meta name="description" content="Content moderation and report management dashboard" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Moderation Center</h1>
            <p className="text-gray-400 text-sm mt-1">Review reports, evidence, and take moderation actions</p>
          </div>
          <ModerationDashboard />
        </div>
      </div>
    </PageLayout>
  );
}
