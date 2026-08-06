/**
 * Admin Fraud Center Page — Fraud detection and risk management dashboard.
 *
 * Dynamic import to avoid SSR issues with dashboard components.
 */

import Head from "next/head";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import PageLayout from "../../components/PageLayout";
import { useRole } from "../../context/RoleContext";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

const FraudDashboard = dynamic(
  () => import("../../components/admin/FraudDashboard"),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center min-h-[400px]"
        role="status"
        aria-label="Loading fraud center"
      >
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  },
);

export default function FraudPage() {
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
        <title>Fraud Center — Fundora Admin</title>
        <meta
          name="description"
          content="Fraud detection and risk management dashboard"
        />
      </Head>
      <main className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] p-6 pt-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Fraud Center</h1>
            <p className="text-gray-400 text-sm mt-1">
              Fraud detection, risk analysis, and case management
            </p>
          </div>
          <FraudDashboard />
        </div>
      </main>
    </PageLayout>
  );
}
