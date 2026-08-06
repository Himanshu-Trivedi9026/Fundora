/**
 * Notifications Page — Notification center for users.
 *
 * Dynamic import to avoid SSR issues with dashboard components.
 */

import Head from "next/head";
import dynamic from "next/dynamic";

const NotificationCenter = dynamic(() => import("../components/notifications/NotificationCenter"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function NotificationsPage() {
  return (
    <>
      <Head>
        <title>Notifications — Fundora</title>
        <meta name="description" content="View and manage your notifications" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            <p className="text-gray-400 text-sm mt-1">Stay updated with your latest notifications</p>
          </div>
          <NotificationCenter />
        </div>
      </div>
    </>
  );
}
