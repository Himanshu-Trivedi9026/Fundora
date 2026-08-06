// Admin Plugins Dashboard — manage installed plugins and submissions
import { useState, useEffect } from "react";
import Head from "next/head";
import { withAuth } from "../../lib/withAuth.js";
import PageLayout from "../../components/PageLayout";
import PluginManager from "../../components/admin/PluginManager.jsx";

function AdminPluginsPage() {
  return (
    <PageLayout>
      <Head>
        <title>Plugin Manager — Fundora</title>
        <meta name="description" content="Manage Fundora plugins" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-white mb-8">Plugin Manager</h1>
          <PluginManager />
        </div>
      </div>
    </PageLayout>
  );
}

export default withAuth(AdminPluginsPage);
