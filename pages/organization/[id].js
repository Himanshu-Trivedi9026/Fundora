/**
 * Organization Detail Page — Shows organization info, members, and teams.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import MemberManagement from "../../components/organization/MemberManagement";
import { authFetch } from "../../lib/authFetch";

export default function OrganizationDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overview");

  const fetchOrg = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch(`/api/organization?orgId=${id}`);
      const json = await res.json();
      if (json.success) {
        setOrg(json.data);
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-gray-500" role="status">
        Loading organization...
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-red-500" role="alert">
        {error || "Organization not found"}
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{org.name} — Fundora</title>
      </Head>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{org.name}</h1>
            <span className={`text-xs px-2 py-1 rounded-full ${org.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
              {org.status}
            </span>
          </div>
          {org.description && (
            <p className="text-gray-600">{org.description}</p>
          )}
          <div className="flex gap-4 mt-3 text-sm text-gray-500">
            <span className="bg-gray-100 px-2 py-1 rounded">{org.type}</span>
            {org.industry && <span>{org.industry}</span>}
            {org.size && <span>{org.size} employees</span>}
            {org.website && (
              <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                Website →
              </a>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b mb-6">
          {["overview", "members", "settings"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2 px-1 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === "overview" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Contact</h3>
              <div className="text-sm text-gray-600 space-y-1">
                {org.contact_email && <p>Email: {org.contact_email}</p>}
                {org.contact_phone && <p>Phone: {org.contact_phone}</p>}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Details</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Created: {new Date(org.created_at).toLocaleDateString()}</p>
                <p>Status: {org.status}</p>
                {org.tax_id && <p>Tax ID: {org.tax_id}</p>}
              </div>
            </div>
          </div>
        )}

        {tab === "members" && <MemberManagement organizationId={id} />}

        {tab === "settings" && (
          <div className="text-center py-8 text-gray-500">
            <a href={`/organization/${id}/settings`} className="text-indigo-600 hover:underline">
              Go to Organization Settings →
            </a>
          </div>
        )}
      </div>
    </>
  );
}
