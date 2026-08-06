/**
 * MemberManagement — Manage members and invitations for an organization.
 *
 * Displays member list with role badges, invite form, role update, and remove actions.
 */

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../lib/authFetch";

const ROLE_COLORS = {
  owner: "bg-red-100 text-red-800",
  admin: "bg-purple-100 text-purple-800",
  finance_manager: "bg-green-100 text-green-800",
  campaign_manager: "bg-blue-100 text-blue-800",
  reviewer: "bg-yellow-100 text-yellow-800",
  auditor: "bg-indigo-100 text-indigo-800",
  moderator: "bg-pink-100 text-pink-800",
  member: "bg-gray-100 text-gray-800",
  guest: "bg-gray-50 text-gray-500",
};

export default function MemberManagement({ organizationId }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("members");
  const [inviteForm, setInviteForm] = useState({ email: "", role: "member" });
  const [inviteLoading, setInviteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      const [membersRes, invRes] = await Promise.all([
        authFetch(`/api/organization/members?organizationId=${organizationId}`),
        authFetch(
          `/api/organization/invitations?organizationId=${organizationId}`,
        ),
      ]);

      const membersJson = await membersRes.json();
      const invJson = await invRes.json();

      if (membersJson.success) setMembers(membersJson.data || []);
      if (invJson.success) setInvitations(invJson.data || []);
    } catch (err) {
      queueMicrotask(() => setError(err.message));
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      queueMicrotask(() => fetchData());
    }
  }, [fetchData, organizationId]);

  async function handleInvite(e) {
    e.preventDefault();
    setInviteLoading(true);
    setError(null);

    try {
      const res = await authFetch("/api/organization/invitations", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          organizationId,
          ...inviteForm,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setInviteForm({ email: "", role: "member" });
        fetchData();
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRemoveMember(userId) {
    if (!confirm("Remove this member?")) return;

    try {
      const res = await authFetch("/api/organization/members", {
        method: "POST",
        body: JSON.stringify({ action: "remove", organizationId, userId }),
      });

      const json = await res.json();
      if (json.success) {
        fetchData();
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      const res = await authFetch("/api/organization/members", {
        method: "POST",
        body: JSON.stringify({
          action: "update_role",
          organizationId,
          userId,
          role: newRole,
        }),
      });

      const json = await res.json();
      if (json.success) {
        fetchData();
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRevokeInvite(invitationId) {
    try {
      const res = await authFetch("/api/organization/invitations", {
        method: "POST",
        body: JSON.stringify({ action: "revoke", invitationId }),
      });

      const json = await res.json();
      if (json.success) {
        fetchData();
      } else {
        setError(json.error);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">Loading members...</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Member Management
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setTab("members")}
          className={`pb-2 px-1 text-sm font-medium ${tab === "members" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500"}`}
        >
          Members ({members.length})
        </button>
        <button
          onClick={() => setTab("invitations")}
          className={`pb-2 px-1 text-sm font-medium ${tab === "invitations" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-gray-500"}`}
        >
          Invitations ({invitations.length})
        </button>
      </div>

      {/* Invite Form */}
      <form onSubmit={handleInvite} className="flex gap-3 mb-6">
        <input
          type="email"
          placeholder="Email address"
          value={inviteForm.email}
          onChange={(e) =>
            setInviteForm({ ...inviteForm, email: e.target.value })
          }
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          required
        />
        <select
          value={inviteForm.role}
          onChange={(e) =>
            setInviteForm({ ...inviteForm, role: e.target.value })
          }
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
          <option value="finance_manager">Finance Manager</option>
          <option value="campaign_manager">Campaign Manager</option>
          <option value="reviewer">Reviewer</option>
          <option value="auditor">Auditor</option>
          <option value="moderator">Moderator</option>
          <option value="guest">Guest</option>
        </select>
        <button
          type="submit"
          disabled={inviteLoading}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {inviteLoading ? "Sending..." : "Invite"}
        </button>
      </form>

      {/* Members Tab */}
      {tab === "members" && (
        <div className="space-y-3">
          {members.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No members found
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 text-sm font-medium">
                    {member.user_id?.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.user_id}
                    </p>
                    <p className="text-xs text-gray-500">
                      Joined{" "}
                      {member.joined_at
                        ? new Date(member.joined_at).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${ROLE_COLORS[member.role] || ROLE_COLORS.member}`}
                  >
                    {member.role}
                  </span>
                  <select
                    value={member.role}
                    onChange={(e) =>
                      handleRoleChange(member.user_id, e.target.value)
                    }
                    className="text-xs border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="admin">Admin</option>
                    <option value="finance_manager">Finance Mgr</option>
                    <option value="campaign_manager">Campaign Mgr</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="auditor">Auditor</option>
                    <option value="moderator">Moderator</option>
                    <option value="member">Member</option>
                    <option value="guest">Guest</option>
                  </select>
                  {member.role !== "owner" && (
                    <button
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="text-red-600 text-xs hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Invitations Tab */}
      {tab === "invitations" && (
        <div className="space-y-3">
          {invitations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No pending invitations
            </div>
          ) : (
            invitations.map((inv) => (
              <div
                key={inv.id}
                className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {inv.email}
                  </p>
                  <p className="text-xs text-gray-500">
                    Invited {new Date(inv.created_at).toLocaleDateString()} ·
                    Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${ROLE_COLORS[inv.role] || ROLE_COLORS.member}`}
                  >
                    {inv.role}
                  </span>
                  <span
                    className={`text-xs ${inv.status === "pending" ? "text-yellow-600" : "text-gray-500"}`}
                  >
                    {inv.status}
                  </span>
                  {inv.status === "pending" && (
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="text-red-600 text-xs hover:underline"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
