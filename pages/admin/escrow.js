/**
 * Admin Escrow Page — Escrow Center for admins.
 *
 * Dynamic import to avoid SSR issues with dashboard components.
 */

import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import PageLayout from "../../components/PageLayout";
import { useRole } from "../../context/RoleContext";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

const EscrowDashboard = dynamic(
  () => import("../../components/admin/EscrowDashboard"),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-screen bg-black flex items-center justify-center"
        role="status"
        aria-label="Loading escrow dashboard"
      >
        <div
          className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      </div>
    ),
  },
);

export default function AdminEscrowPage() {
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
      <div className="min-h-screen bg-black">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Escrow Center</h1>
            <p className="text-gray-400 text-sm mt-1">
              Manage escrow accounts, releases, and payouts
            </p>
          </div>
          <EscrowDashboard />
        </div>
      </div>
    </PageLayout>
  );
}
