import { useState, useEffect } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";

const EXPORT_OPTIONS = [
  {
    id: "analytics",
    label: "Analytics Data",
    icon: "bar_chart",
    description: "Export campaign analytics, earnings, and project metrics",
    endpoint: "/api/export-analytics",
    formats: ["PDF", "CSV", "JSON"],
  },
  {
    id: "transactions",
    label: "Transaction History",
    icon: "receipt_long",
    description: "Export all payment transactions and donation records",
    endpoint: "/api/exports",
    formats: ["CSV", "JSON", "XLSX"],
  },
  {
    id: "users",
    label: "User Data",
    icon: "group",
    description: "Export user profiles, roles, and activity logs",
    endpoint: "/api/exports",
    formats: ["CSV", "JSON"],
  },
];

export default function ExportsPage() {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleExport = async (option, format) => {
    setExporting(option.id);
    setError(null);
    setSuccess(null);
    try {
      if (option.id === "analytics") {
        // POST to /api/export-analytics with sample data to trigger PDF generation
        const res = await fetch(option.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalEarnings: 25000,
            totalDonations: 340,
            projectCount: 12,
            topProject: "Community Fund",
            earningsByDate: [
              { date: "2026-01", value: 5000 },
              { date: "2026-02", value: 7000 },
              { date: "2026-03", value: 8000 },
              { date: "2026-04", value: 5000 },
            ],
            fundingByProject: [
              { name: "Project A", amount: 12000 },
              { name: "Project B", amount: 8000 },
              { name: "Project C", amount: 5000 },
            ],
            donorsByProject: [
              { name: "Project A", donors: 120 },
              { name: "Project B", donors: 90 },
              { name: "Project C", donors: 130 },
            ],
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Export failed (${res.status})`);
        }
        // If it returns a PDF blob, download it
        const contentType = res.headers.get("Content-Type");
        if (contentType && contentType.includes("pdf")) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `analytics-report.${format.toLowerCase()}`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          setSuccess(`Analytics ${format} export completed.`);
        }
      } else {
        const res = await fetch(option.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: option.id,
            format: format.toLowerCase(),
            storeResult: true,
          }),
        });
        const json = await res.json();
        if (json.success || res.ok) {
          setSuccess(`${option.label} exported as ${format} successfully.`);
        } else {
          throw new Error(json.error || "Export failed");
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Data Export Center</h1>
            <p className="text-gray-400 mt-1">Export your data in various formats</p>
          </div>

          {error && (
            <GlassCard className="mb-6 flex items-center gap-3 border-red-500/20">
              <span className="material-symbols-outlined text-red-400">error</span>
              <p className="text-red-400 text-sm flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-gray-500 hover:text-gray-300">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </GlassCard>
          )}

          {success && (
            <GlassCard className="mb-6 flex items-center gap-3 border-green-500/20">
              <span className="material-symbols-outlined text-green-400">check_circle</span>
              <p className="text-green-400 text-sm flex-1">{success}</p>
              <button onClick={() => setSuccess(null)} className="text-gray-500 hover:text-gray-300">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </GlassCard>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {EXPORT_OPTIONS.map((option) => (
              <GlassCard key={option.id} className="flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl text-indigo-400">{option.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{option.label}</h3>
                  </div>
                </div>
                <p className="text-gray-400 text-xs flex-1 mb-4">{option.description}</p>
                <div className="space-y-2 pt-3 border-t border-white/[0.06]">
                  <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Export as</p>
                  <div className="flex flex-wrap gap-2">
                    {option.formats.map((fmt) => (
                      <Button
                        key={fmt}
                        variant="secondary"
                        size="sm"
                        loading={exporting === option.id}
                        disabled={exporting !== null}
                        onClick={() => handleExport(option, fmt)}
                      >
                        {fmt}
                      </Button>
                    ))}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}