// Admin Infrastructure Dashboard — system health, deployments, jobs, cache, performance, backups
import { useState } from "react";
import Head from "next/head";
import { withAuth } from "../../lib/withAuth.js";
import PageLayout from "../../components/PageLayout";
import SystemHealthPanel from "../../components/admin/InfrastructureDashboard/SystemHealthPanel.jsx";
import DeploymentList from "../../components/admin/InfrastructureDashboard/DeploymentList.jsx";
import JobQueuePanel from "../../components/admin/InfrastructureDashboard/JobQueuePanel.jsx";
import CacheManager from "../../components/admin/InfrastructureDashboard/CacheManager.jsx";
import PerformanceMetrics from "../../components/admin/InfrastructureDashboard/PerformanceMetrics.jsx";

// Legacy backup dashboard (phase 10)
import InfrastructureDashboard from "../../components/admin/InfrastructureDashboard.jsx";

const TABS = [
  { id: "health", label: "System Health", component: SystemHealthPanel },
  { id: "deployments", label: "Deployments", component: DeploymentList },
  { id: "jobs", label: "Background Jobs", component: JobQueuePanel },
  { id: "cache", label: "Cache", component: CacheManager },
  { id: "performance", label: "Performance", component: PerformanceMetrics },
  { id: "backups", label: "Backups", component: InfrastructureDashboard },
];

function AdminInfrastructurePage() {
  const [activeTab, setActiveTab] = useState("health");
  const ActiveComponent =
    TABS.find((t) => t.id === activeTab)?.component || SystemHealthPanel;

  return (
    <PageLayout>
      <Head>
        <title>Infrastructure — Fundora</title>
        <meta name="description" content="Platform infrastructure management" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Infrastructure Dashboard
            </h1>
            <p className="text-gray-400 mt-1">
              System health, deployments, queues, cache, performance, and
              backups
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-8 overflow-x-auto border-b border-gray-800 pb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <ActiveComponent />
        </div>
      </div>
    </PageLayout>
  );
}

export default withAuth(AdminInfrastructurePage);
