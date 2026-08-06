import { useState, useEffect } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import { authFetch } from "../../lib/authFetch";

export default function CurrencyPage() {
  const [loading, setLoading] = useState(true);
  const [currencies, setCurrencies] = useState([]);
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/currency/rates");
        const json = await res.json();
        const items = json.data || json.currencies || [];
        setCurrencies(Array.isArray(items) ? items : []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSetDefault = async (code) => {
    setDefaultCurrency(code);
    try {
      await authFetch("/api/currency/rates", {
        method: "POST",
        body: JSON.stringify({ fromCurrency: code, toCurrency: code, rate: 1 }),
      });
    } catch {
      // silently fail
    }
  };

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Multi-Currency Settings</h1>
            <p className="text-gray-400 mt-1">Manage supported currencies and exchange rates</p>
          </div>

          {loading && (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="glass-card p-6 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-6 bg-white/[0.06] rounded" />
                      <div className="h-4 bg-white/[0.06] rounded w-24" />
                    </div>
                    <div className="h-3 bg-white/[0.04] rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-3">error_outline</span>
              <p className="text-red-400 text-lg font-medium">Failed to load currency data</p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </GlassCard>
          )}

          {!loading && !error && currencies.length === 0 && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-gray-500 mb-3">payments</span>
              <p className="text-gray-400 text-lg font-medium">No currencies configured</p>
              <p className="text-gray-600 text-sm mt-1">Configure supported currencies and exchange rates.</p>
            </GlassCard>
          )}

          {!loading && !error && currencies.length > 0 && (
            <>
              {/* Default Currency */}
              <GlassCard className="mb-6">
                <h2 className="text-white font-semibold text-sm mb-3">Default Currency</h2>
                <div className="flex items-center gap-3">
                  <span className="text-white font-bold text-lg">{defaultCurrency}</span>
                  <span className="text-gray-500 text-sm">
                    {currencies.find((c) => c.code === defaultCurrency)?.name || ""}
                  </span>
                </div>
              </GlassCard>

              {/* Currency List */}
              <h2 className="text-white font-semibold text-sm mb-4">Supported Currencies</h2>
              <div className="space-y-3">
                {currencies.map((curr) => {
                  const code = curr.code || curr.currency;
                  const rate = curr.rate || curr.rateToUSD || 1;
                  return (
                    <GlassCard key={code} className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-white font-bold text-lg w-10">{curr.symbol || code?.slice(0, 2)}</span>
                        <div>
                          <h3 className="text-white text-sm font-medium">{code}</h3>
                          <p className="text-gray-500 text-[11px]">{curr.name || `${code} Currency`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-gray-400 text-xs">
                            1 USD = {rate} {code}
                          </p>
                          {curr.decimals !== undefined && (
                            <p className="text-gray-600 text-[11px]">{curr.decimals} decimal places</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleSetDefault(code)}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                            defaultCurrency === code
                              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                              : "bg-white/[0.04] text-gray-400 border border-white/[0.06] hover:bg-white/[0.08]"
                          }`}
                        >
                          {defaultCurrency === code ? "Default" : "Set as Default"}
                        </button>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}