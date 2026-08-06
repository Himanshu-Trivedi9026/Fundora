/**
 * Organization Settings Page — Settings management for an organization.
 */

import { useRouter } from "next/router";
import Head from "next/head";
import OrganizationSettings from "../../../components/admin/OrganizationSettings";

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const { id } = router.query;

  return (
    <>
      <Head>
        <title>Organization Settings — Fundora</title>
      </Head>
      {id && <OrganizationSettings organizationId={id} />}
    </>
  );
}
