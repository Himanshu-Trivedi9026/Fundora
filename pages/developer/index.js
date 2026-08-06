// Developer Portal — plugin development dashboard
import { useState, useEffect } from "react";
import Head from "next/head";
import { withAuth } from "../../lib/withAuth.js";
import DeveloperPortal from "../../components/admin/DeveloperPortal.jsx";

function DeveloperPortalPage() {
  return (
    <>
      <Head>
        <title>Developer Portal — Fundora</title>
        <meta name="description" content="Fundora plugin developer portal" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <DeveloperPortal />
        </div>
      </div>
    </>
  );
}

export default withAuth(DeveloperPortalPage);
