/**
 * Admin Organizations Page — Organization management dashboard.
 */

import Head from "next/head";
import { useRouter } from "next/router";
import PageLayout from "../../components/PageLayout";
import OrganizationDashboard from "../../components/admin/OrganizationDashboard";
import { useRole } from "../../context/RoleContext";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function AdminOrganizationsPage() {
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
      <Head>
        <title>Organizations — Fundora Admin</title>
      </Head>
      <OrganizationDashboard />
    </PageLayout>
  );
}
