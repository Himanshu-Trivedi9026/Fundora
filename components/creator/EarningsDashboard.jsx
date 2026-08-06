/**
 * EarningsDashboard — Creator earnings and balance overview.
 *
 * Displays balance breakdown, per-campaign escrow, payout history.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import EscrowCard from "../escrow/EscrowCard";
import PayoutHistory from "../escrow/PayoutHistory";
import { authFetch } from "../../lib/authFetch";

function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export default function EarningsDashboard() {
  const [balance, setBalance] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [requestForm, setRequestForm] = useState({ escrowAccountId: "", bankAccountId: "", amount: "" });
  const [requestLoading, setRequestLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [balanceRes, accountsRes, payoutsRes] = await Promise.all([
        authFetch("/api/creator/balance"),
        authFetch("/api/escrow/account"),
        authFetch("/api/payout/status?mode=history&limit=20"),
      ]);

      const balanceJson = await balanceRes.json();
      const accountsJson = await accountsRes.json();
      const payoutsJson = await payoutsRes.json();

      if (balanceJson.success) setBalance(balanceJson.balance);
      if (accountsJson.success) setAccounts(accountsJson.accounts || []);
      if (payoutsJson.success) setPayouts(payoutsJson.requests || []);
    } catch (err) {
      setError("Failed to load earnings data");
    } finally {
      setLoading(false);
    }
  }

  async function handlePayoutRequest(e) {
    e.preventDefault();
    setRequestLoading(true);
    try {
      const res = await authFetch("/api/payout", {
        method: "POST",
        body: JSON.stringify({
          escrowAccountId: requestForm.escrowAccountId,
          bankAccountId: requestForm.bankAccountId,
          amount: parseFloat(requestForm.amount),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setRequestForm({ escrowAccountId: "", bankAccountId: "", amount: "" });
        fetchData();
      } else {
        alert(json.error || "Failed to create payout request");
      }
    } finally {
      setRequestLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12" role="status" aria-label="Loading earnings data">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-center" role="alert">
        <p className="text-red-400">{error}</p>
        <button onClick={fetchData} className="mt-3 text-sm text-blue-400 hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-2" role="tablist">
        {["overview", "campaigns", "payouts", "request"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            aria-selected={activeTab === tab}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Available Balance", value: formatCurrency(balance?.available || 0), color: "text-green-400" },
              { label: "Locked in Escrow", value: formatCurrency(balance?.locked || 0), color: "text-yellow-400" },
              { label: "Total Released", value: formatCurrency(balance?.released || 0), color: "text-blue-400" },
              { label: "Pending Payouts", value: formatCurrency(balance?.pending || 0), color: "text-orange-400" },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-gray-400 text-xs">{stat.label}</p>
                <p className={`text-2xl font-bold mt-2 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Campaigns Tab */}
      {activeTab === "campaigns" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {accounts.length > 0 ? (
            accounts.map((acc) => <EscrowCard key={acc.id} escrow={acc} />)
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-500 text-sm">No escrow accounts yet</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Payouts Tab */}
      {activeTab === "payouts" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <PayoutHistory requests={payouts} />
        </motion.div>
      )}

      {/* Request Payout Tab */}
      {activeTab === "request" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <form onSubmit={handlePayoutRequest} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-semibold">Request Payout</h3>
            <div>
              <label htmlFor="escrow-account" className="block text-gray-400 text-xs mb-1">Escrow Account</label>
              <select
                id="escrow-account"
                value={requestForm.escrowAccountId}
                onChange={(e) => setRequestForm({ ...requestForm, escrowAccountId: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                required
              >
                <option value="">Select escrow account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    Campaign {a.campaign_id?.substring(0, 8)}... — {formatCurrency(a.creator_earnings)} available
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bank-account-id" className="block text-gray-400 text-xs mb-1">Bank Account ID</label>
              <input
                id="bank-account-id"
                type="text"
                value={requestForm.bankAccountId}
                onChange={(e) => setRequestForm({ ...requestForm, bankAccountId: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                placeholder="Verified bank account UUID"
                required
              />
            </div>
            <div>
              <label htmlFor="payout-amount" className="block text-gray-400 text-xs mb-1">Amount (₹)</label>
              <input
                id="payout-amount"
                type="number"
                value={requestForm.amount}
                onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                min="1"
                required
              />
            </div>
            <button
              type="submit"
              disabled={requestLoading}
              className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {requestLoading ? "Creating Request..." : "Request Payout"}
            </button>
          </form>
        </motion.div>
      )}
    </div>
  );
}
