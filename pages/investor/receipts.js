import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../context/RoleContext";
import PageLayout from "../../components/PageLayout";
import {
  GlassCard,
  PageHeader,
  LoadingSpinner,
  EmptyState,
} from "../../components/ui";
import { generateReceipt as generateReceiptPDF } from "../../lib/generateReceipt";
import { authFetch } from "../../lib/authFetch";

export default function InvestorReceipts() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();
  const [loading, setLoading] = useState(true);
  const [donations, setDonations] = useState([]);
  const [generating, setGenerating] = useState(null);
  const [receipts, setReceipts] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const loadDonations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: donErr } = await supabase
        .from("public_donations")
        .select(
          `
          id,
          amount,
          created_at,
          status,
          project_id,
          projects:project_id (
            id,
            title,
            slug,
            thumbnail
          )
        `,
        )
        .eq("payer_id", user.id)
        .eq("status", "paid")
        .order("created_at", { ascending: false });

      if (donErr) throw donErr;

      setDonations(data || []);
    } catch (err) {
      console.error("Receipts load error:", err);
      setError("Failed to load donations. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load the current user's successful donations once auth resolves.
  useEffect(() => {
    if (user) queueMicrotask(() => loadDonations());
  }, [user, loadDonations]);

  async function generateReceipt(donationId) {
    setGenerating(donationId);
    try {
      const res = await authFetch("/api/receipts/generate", {
        method: "POST",
        body: JSON.stringify({ donationId }),
      });

      if (!res.ok) throw new Error("Failed to generate receipt");

      const data = await res.json();

      if (data.success) {
        setReceipts((prev) => ({
          ...prev,
          [donationId]: data.receipt,
        }));
      }
    } catch (err) {
      console.error("Receipt generation error:", err);
    } finally {
      setGenerating(null);
    }
  }

  async function downloadReceipt(donationId) {
    const receipt = receipts[donationId];
    if (!receipt) return;
    try {
      const pdfBlob = await generateReceiptPDF(receipt);
      if (!pdfBlob) throw new Error("PDF generation failed");
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${receipt.receiptId || "receipt"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Receipt download error:", err);
    }
  }

  function formatAmount(amount) {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  }

  function formatReceiptDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (authLoading || !user) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading receipts..." />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <PageHeader
            title="My Receipts"
            description="View and download receipts for your donations"
            icon="receipt"
          />

          {loading ? (
            <div className="mt-12">
              <LoadingSpinner size="lg" text="Loading receipts..." />
            </div>
          ) : error ? (
            <div className="mt-12">
              <GlassCard>
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-[48px] text-red-400 mb-4">
                    error
                  </span>
                  <p className="text-red-300">{error}</p>
                </div>
              </GlassCard>
            </div>
          ) : (
            <div className="mt-8">
              {donations.length === 0 ? (
                <GlassCard>
                  <EmptyState
                    icon="receipt_long"
                    title="No receipts available"
                    description="Receipts are generated for completed donations. Fund a project to get started."
                    action={
                      <Link
                        href="/explore"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors"
                      >
                        Explore Projects
                        <span className="material-symbols-outlined text-[16px]">
                          arrow_forward
                        </span>
                      </Link>
                    }
                  />
                </GlassCard>
              ) : (
                <div className="space-y-3">
                  {donations.map((donation) => {
                    const receipt = receipts[donation.id];

                    return (
                      <GlassCard key={donation.id} padding="md">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          {/* Donation Info */}
                          <div className="flex-1 min-w-0">
                            <a
                              href={`/projects/${donation.project_id}`}
                              className="text-sm font-medium text-white hover:text-primary transition-colors"
                            >
                              {donation.projects?.title || "Unknown Project"}
                            </a>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-xs text-on-surface-variant">
                                {formatReceiptDate(donation.created_at)}
                              </p>
                              <span className="text-xs text-on-surface-variant">
                                &middot;
                              </span>
                              <p className="text-xs font-semibold text-green-400">
                                {formatAmount(donation.amount)}
                              </p>
                            </div>
                          </div>

                          {/* Receipt Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {receipt ? (
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-xs font-medium text-green-400">
                                    {receipt.receiptId}
                                  </p>
                                  <p className="text-[10px] text-on-surface-variant">
                                    Generated
                                  </p>
                                </div>
                                <button
                                  onClick={() => downloadReceipt(donation.id)}
                                  className="px-3 py-2 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-all"
                                >
                                  <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">
                                      download
                                    </span>
                                    Download
                                  </span>
                                </button>
                                <button
                                  onClick={() => generateReceipt(donation.id)}
                                  className="px-3 py-2 rounded-lg bg-white/5 text-on-surface-variant text-xs font-medium hover:bg-white/10 hover:text-white transition-all"
                                >
                                  <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">
                                      refresh
                                    </span>
                                    Regenerate
                                  </span>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => generateReceipt(donation.id)}
                                disabled={generating === donation.id}
                                className="px-4 py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              >
                                {generating === donation.id ? (
                                  <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px] animate-spin">
                                      progress_activity
                                    </span>
                                    Generating...
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px]">
                                      receipt
                                    </span>
                                    Get Receipt
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
