// Admin — Agent Center Page

import React from "react";
import PageLayout from "../../components/PageLayout";
import AgentDashboard from "../../components/admin/AgentCenter/AgentDashboard";
import { useRole } from "../../context/RoleContext";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function AgentCenterPage() {
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
      <AgentDashboard />
    </PageLayout>
  );
}
