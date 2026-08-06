// Admin Marketplace Dashboard — manage plugins, reviews, and developer submissions
import { useState, useEffect } from "react";
import Head from "next/head";
import { withAuth } from "../../lib/withAuth.js";
import PageLayout from "../../components/PageLayout";
import MarketplaceDashboard from "../../components/admin/MarketplaceDashboard.jsx";

function AdminMarketplacePage() {
  return (
    <PageLayout>
      <Head>
        <title>Marketplace Admin — Fundora</title>
        <meta name="description" content="Manage the Fundora plugin marketplace" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-white mb-8">Marketplace Administration</h1>
          <MarketplaceDashboard />
        </div>
      </div>
    </PageLayout>
  );
}

export default withAuth(AdminMarketplacePage);
