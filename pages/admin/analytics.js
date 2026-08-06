/**
 * Admin Analytics Page — Platform Analytics for admins.
 *
 * Dynamic import to avoid SSR issues with dashboard components.
 */

import Head from "next/head";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { useState } from "react";
import PageLayout from "../../components/PageLayout";
import { useRole } from "../../context/RoleContext";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

const PlatformAnalytics = dynamic(
  () => import("../../components/admin/PlatformAnalytics"),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center min-h-[400px]"
        role="status"
        aria-label="Loading"
      >
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  },
);

const GlobalAnalyticsDashboard = dynamic(
  () => import("../../components/admin/GlobalAnalyticsDashboard"),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center min-h-[400px]"
        role="status"
        aria-label="Loading"
      >
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  },
);

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();
  const [view, setView] = useState("platform");

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
        <title>Platform Analytics — Fundora Admin</title>
        <meta
          name="description"
          content="Platform health, trust distribution, and growth analytics"
        />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">
              Platform Analytics
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Monitor platform health, trends, and performance metrics
            </p>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setView("platform")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === "platform"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                Platform Analytics
              </button>
              <button
                onClick={() => setView("global")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === "global"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                Global Dashboard
              </button>
            </div>
          </div>

          {view === "platform" ? (
            <PlatformAnalytics />
          ) : (
            <GlobalAnalyticsDashboard />
          )}
        </div>
      </div>
    </PageLayout>
  );
}
