import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../context/RoleContext";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

let EscrowCard = null;
let LedgerTable = null;

async function loadDynamicComponents() {
  try {
    const escrowModule = await import("../../components/escrow/EscrowCard");
    EscrowCard = escrowModule.default || escrowModule;
  } catch {
    EscrowCard = null;
  }
  try {
    const ledgerModule = await import("../../components/escrow/LedgerTable");
    LedgerTable = ledgerModule.default || ledgerModule;
  } catch {
    LedgerTable = null;
  }
}

export default function EscrowPage() {
  const router = useRouter();
  const { user, loading: roleLoading } = useRole();
  const [escrowAccounts, setEscrowAccounts] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [dynamicReady, setDynamicReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEscrowData = useCallback(async () => {
    try {
      // 1. Fetch escrow accounts for this user
      const { data: accounts, error: accountsError } = await supabase
        .from("escrow_accounts")
        .select("*")
        .eq("user_id", user.id);

      if (accountsError) throw accountsError;

      const fetchedAccounts = accounts || [];
      setEscrowAccounts(fetchedAccounts);

      // 2. Fetch ledger entries if accounts exist
      if (fetchedAccounts.length > 0) {
        const accountIds = fetchedAccounts.map((a) => a.id);
        const { data: ledger, error: ledgerError } = await supabase
          .from("escrow_ledger")
          .select("*")
          .in("escrow_account_id", accountIds)
          .order("created_at", { ascending: false });

        if (ledgerError) throw ledgerError;
        setLedgerEntries(ledger || []);
      } else {
        setLedgerEntries([]);
      }
    } catch (err) {
      console.error("Failed to fetch escrow data:", err);
      setError(err.message || "Failed to load escrow data");
    }
  }, [user]);

  useEffect(() => {
    if (!roleLoading && !user) {
      router.push("/login");
      return;
    }

    async function init() {
      await loadDynamicComponents();
      setDynamicReady(true);
      if (user) {
        setLoading(true);
        setError(null);
        await fetchEscrowData();
        queueMicrotask(() => setLoading(false));
      }
    }

    if (user) {
      init();
    } else if (!roleLoading) {
      queueMicrotask(() => setLoading(false));
    }
  }, [user, roleLoading, fetchEscrowData, router]);

  // Compute summary stats
  const totalBalance = escrowAccounts.reduce(
    (sum, acc) => sum + (acc.balance || 0),
    0,
  );
  const totalHeld = escrowAccounts.reduce(
    (sum, acc) => sum + (acc.held_amount || 0),
    0,
  );
  const totalAvailable = totalBalance - totalHeld;

  // Auth / loading guard
  if (roleLoading) {
    return (
      <PageLayout hideSidebar={false}>
        <div className="max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" text="Checking authentication..." />
        </div>
      </PageLayout>
    );
  }

  if (!user) return null;

  return (
    <PageLayout>
      <div className="bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-on-surface mb-2">
              Escrow Overview
            </h1>
            <p className="text-on-surface-variant text-sm md:text-base">
              Manage your escrow accounts, view balances, and track
              transactions.
            </p>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center min-h-[40vh]">
              <LoadingSpinner size="lg" text="Loading escrow data..." />
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
              <div className="glass-card p-8 text-center max-w-md">
                <span className="material-symbols-outlined text-[48px] text-danger mb-4">
                  error_outline
                </span>
                <h3 className="text-lg font-semibold text-on-surface mb-2">
                  Could not load escrow data
                </h3>
                <p className="text-on-surface-variant text-sm mb-6">{error}</p>
                <Button variant="primary" onClick={fetchEscrowData}>
                  <span className="material-symbols-outlined text-[18px]">
                    refresh
                  </span>
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Loaded content */}
          {!loading && !error && (
            <>
              {/* Stat cards */}
              {escrowAccounts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <GlassCard hover className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[28px] text-primary">
                        account_balance
                      </span>
                      <div>
                        <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">
                          Total Balance
                        </p>
                        <p className="text-2xl font-bold text-on-surface">
                          {currencyFormatter.format(totalBalance)}
                        </p>
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard hover className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[28px] text-warning">
                        lock
                      </span>
                      <div>
                        <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">
                          Held Amount
                        </p>
                        <p className="text-2xl font-bold text-on-surface">
                          {currencyFormatter.format(totalHeld)}
                        </p>
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard hover className="flex flex-col">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[28px] text-success">
                        check_circle
                      </span>
                      <div>
                        <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">
                          Available
                        </p>
                        <p className="text-2xl font-bold text-on-surface">
                          {currencyFormatter.format(totalAvailable)}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              )}

              {/* Empty state */}
              {escrowAccounts.length === 0 && (
                <EmptyState
                  icon="account_balance_wallet"
                  title="No escrow accounts"
                  description="You don't have any escrow accounts yet. Escrow accounts are created when you receive funds through campaigns."
                />
              )}

              {/* Escrow account cards */}
              {escrowAccounts.length > 0 && (
                <div className="space-y-6 mb-8">
                  <h2 className="text-lg font-semibold text-on-surface">
                    Escrow Accounts
                  </h2>

                  {dynamicReady && EscrowCard
                    ? escrowAccounts.map((account) => (
                        <EscrowCard key={account.id} account={account} />
                      ))
                    : escrowAccounts.map((account) => (
                        <GlassCard key={account.id}>
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-on-surface">
                                {account.name ||
                                  `Escrow #${account.id.slice(0, 8)}`}
                              </h3>
                              <p className="text-xs text-on-surface-variant">
                                Balance:{" "}
                                {currencyFormatter.format(
                                  account.balance || 0,
                                )}
                              </p>
                            </div>
                            <span className="text-xs text-on-surface-variant">
                              {account.currency || "INR"}
                            </span>
                          </div>
                        </GlassCard>
                      ))}
                </div>
              )}

              {/* Ledger entries */}
              {escrowAccounts.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-on-surface">
                    Transaction Ledger
                  </h2>

                  {ledgerEntries.length === 0 ? (
                    <GlassCard>
                      <p className="text-sm text-on-surface-variant text-center py-4">
                        No transactions recorded yet.
                      </p>
                    </GlassCard>
                  ) : dynamicReady && LedgerTable ? (
                    <LedgerTable entries={ledgerEntries} />
                  ) : (
                    <GlassCard>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/[0.06]">
                              <th className="text-left py-2 px-3 text-on-surface-variant font-medium">
                                Date
                              </th>
                              <th className="text-left py-2 px-3 text-on-surface-variant font-medium">
                                Type
                              </th>
                              <th className="text-right py-2 px-3 text-on-surface-variant font-medium">
                                Amount
                              </th>
                              <th className="text-right py-2 px-3 text-on-surface-variant font-medium">
                                Balance
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledgerEntries.map((entry) => (
                              <tr
                                key={entry.id}
                                className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                              >
                                <td className="py-2 px-3 text-on-surface">
                                  {entry.created_at
                                    ? new Date(
                                        entry.created_at,
                                      ).toLocaleDateString("en-IN")
                                    : "—"}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="capitalize text-on-surface">
                                    {entry.transaction_type ||
                                      entry.type ||
                                      "unknown"}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right text-on-surface">
                                  {entry.amount != null
                                    ? currencyFormatter.format(entry.amount)
                                    : "—"}
                                </td>
                                <td className="py-2 px-3 text-right text-on-surface">
                                  {entry.balance_after != null
                                    ? currencyFormatter.format(
                                        entry.balance_after,
                                      )
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </GlassCard>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}