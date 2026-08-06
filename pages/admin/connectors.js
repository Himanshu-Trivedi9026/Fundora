// Admin — Enterprise Connectors Page

import React from "react";
import { useRouter } from "next/router";
import PageLayout from "../../components/PageLayout";
import ConnectorStatus from "../../components/admin/EnterpriseDashboard/ConnectorStatus";
import { useRole } from "../../context/RoleContext";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function ConnectorsPage() {
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
      <ConnectorStatus />
    </PageLayout>
  );
}
