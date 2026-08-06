/**
 * Admin Policies Page — Policy Management for admins.
 *
 * Dynamic import to avoid SSR issues with dashboard components.
 */

import Head from "next/head";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import PageLayout from "../../components/PageLayout";
import { useRole } from "../../context/RoleContext";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

const PolicyManagement = dynamic(() => import("../../components/admin/PolicyManagement"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]" role="status" aria-label="Loading">
      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function PoliciesPage() {
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
        <title>Policy Management — Fundora Admin</title>
        <meta name="description" content="Platform policy configuration and version history" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Policy Management</h1>
            <p className="text-gray-400 text-sm mt-1">Configure platform policies, limits, and thresholds</p>
          </div>
          <PolicyManagement />
        </div>
      </div>
    </PageLayout>
  );
}
