import { useRouter } from "next/router";
import { useEffect, useState, useCallback } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../context/RoleContext";

const statusVariant = {
  pending: "warning",
  verified: "success",
  rejected: "danger",
  active: "success",
  inactive: "default",
};

function maskAccountNumber(accountNumber) {
  if (!accountNumber) return "—";
  const str = String(accountNumber);
  const last4 = str.slice(-4);
  const masked = "X".repeat(Math.min(str.length - 4, 8));
  return masked + last4;
}

export default function BankVerification() {
  const router = useRouter();
  const { user, loading: roleLoading } = useRole();
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBankAccounts = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    queueMicrotask(() => setError(null));
    try {
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Error fetching bank accounts:", fetchError);
        setError(fetchError.message || "Failed to load bank accounts");
        setBankAccounts([]);
      } else {
        setBankAccounts(data || []);
      }
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, [user]);

  useEffect(() => {
    if (roleLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    fetchBankAccounts();
  }, [user, roleLoading, fetchBankAccounts, router]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBankAccounts();
    setRefreshing(false);
  };

  if (roleLoading || loading) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex items-center justify-center min-h-[60vh]">
              <LoadingSpinner size="lg" text="Loading bank accounts..." />
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white font-geist tracking-tight">
                Bank Account Verification
              </h1>
              <p className="text-gray-400 font-inter text-sm mt-1">
                Manage and verify your linked bank accounts for payouts
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="self-start"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-danger-muted border border-danger/20 text-danger text-sm font-inter">
              {error}
            </div>
          )}

          {/* Bank Accounts List */}
          {bankAccounts.length === 0 ? (
            <GlassCard padding="lg">
              <EmptyState
                icon="account_balance"
                title="No bank accounts linked"
                description="You haven't added any bank accounts yet. Add a bank account to receive payouts."
                action={
                  <Button variant="primary" size="sm">
                    Add Bank Account
                  </Button>
                }
              />
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bankAccounts.map((account) => (
                <GlassCard
                  key={account.id}
                  padding="md"
                  hover
                  className="relative overflow-hidden"
                >
                  {/* Status indicator bar */}
                  <div
                    className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${
                      account.status === "verified" ||
                      account.status === "active"
                        ? "bg-success"
                        : account.status === "rejected"
                          ? "bg-danger"
                          : "bg-warning"
                    }`}
                  />

                  <div className="pl-3">
                    {/* Header with bank name and status */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-primary/10 shrink-0">
                          <span className="material-symbols-outlined text-primary text-[22px]">
                            account_balance
                          </span>
                        </div>
                        <div>
                          <h3 className="text-white font-geist font-semibold text-base">
                            {account.bank_name || "Bank"}
                          </h3>
                          <p className="text-gray-400 text-xs font-inter">
                            {account.account_type
                              ? account.account_type.replace(/_/g, " ")
                              : "Bank Account"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={statusVariant[account.status] || "default"}
                      >
                        {account.status || "pending"}
                      </Badge>
                    </div>

                    {/* Account Details */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                        <span className="text-gray-400 text-xs font-inter">
                          Account Holder
                        </span>
                        <span className="text-white text-sm font-inter font-medium">
                          {account.account_holder_name ||
                            account.holder_name ||
                            "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                        <span className="text-gray-400 text-xs font-inter">
                          Account Number
                        </span>
                        <span className="text-white text-sm font-inter font-mono tracking-wider">
                          {maskAccountNumber(
                            account.account_number || account.account_no,
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                        <span className="text-gray-400 text-xs font-inter">
                          IFSC Code
                        </span>
                        <span className="text-white text-sm font-inter font-mono uppercase">
                          {account.ifsc_code || account.ifsc || "—"}
                        </span>
                      </div>

                      {account.branch_name && (
                        <div className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                          <span className="text-gray-400 text-xs font-inter">
                            Branch
                          </span>
                          <span className="text-white text-sm font-inter">
                            {account.branch_name}
                          </span>
                        </div>
                      )}

                      {account.verified_at && (
                        <div className="flex items-center justify-between py-2">
                          <span className="text-gray-400 text-xs font-inter">
                            Verified On
                          </span>
                          <span className="text-gray-300 text-sm font-inter">
                            {new Date(account.verified_at).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}

          {/* Account count */}
          {bankAccounts.length > 0 && (
            <p className="text-gray-500 text-xs font-inter mt-6 text-center">
              {bankAccounts.length} bank account
              {bankAccounts.length !== 1 ? "s" : ""} linked
            </p>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
