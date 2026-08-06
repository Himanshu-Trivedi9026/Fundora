/**
 * Creator Earnings Page — Balance overview and payout management.
 *
 * Dynamic import to avoid SSR issues with dashboard components.
 */

import dynamic from "next/dynamic";

const EarningsDashboard = dynamic(
  () => import("../../components/creator/EarningsDashboard"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  },
);

export default function CreatorEarningsPage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            Earnings &amp; Payouts
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            View your earnings, escrow balances, and request payouts
          </p>
        </div>
        <EarningsDashboard />
      </div>
    </div>
  );
}
