// Admin Observability Dashboard — metrics, health, alerts, traces
import { useState, useEffect } from "react";
import Head from "next/head";
import { withAuth } from "../../lib/withAuth.js";
import PageLayout from "../../components/PageLayout";
import ObservabilityDashboard from "../../components/admin/ObservabilityDashboard.jsx";

function AdminObservabilityPage() {
  return (
    <PageLayout>
      <Head>
        <title>Observability — Fundora</title>
        <meta
          name="description"
          content="Platform monitoring and observability"
        />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-white mb-8">
            Observability Dashboard
          </h1>
          <ObservabilityDashboard />
        </div>
      </div>
    </PageLayout>
  );
}

export default withAuth(AdminObservabilityPage);
