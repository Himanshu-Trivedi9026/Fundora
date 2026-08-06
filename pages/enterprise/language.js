import { useState, useEffect } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import { authFetch } from "../../lib/authFetch";

export default function LanguagePage() {
  const [loading, setLoading] = useState(true);
  const [locales, setLocales] = useState([]);
  const [currentLocale, setCurrentLocale] = useState("en");
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/i18n/translations?packs=true");
        const json = await res.json();
        const packs = json.data || [];
        setLocales(Array.isArray(packs) ? packs : []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLocaleChange = async (locale) => {
    setCurrentLocale(locale);
    try {
      await authFetch("/api/i18n/translations", {
        method: "POST",
        body: JSON.stringify({ locale, key: "_active_locale", value: locale }),
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
            <h1 className="text-2xl font-bold text-white">Internationalization Settings</h1>
            <p className="text-gray-400 mt-1">Manage language packs and locale settings</p>
          </div>

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-card p-6 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
                    <div className="h-4 bg-white/[0.06] rounded w-20" />
                  </div>
                  <div className="h-3 bg-white/[0.04] rounded w-2/3" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-3">error_outline</span>
              <p className="text-red-400 text-lg font-medium">Failed to load language packs</p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </GlassCard>
          )}

          {!loading && !error && locales.length === 0 && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-gray-500 mb-3">language</span>
              <p className="text-gray-400 text-lg font-medium">No language packs available</p>
              <p className="text-gray-600 text-sm mt-1">Language packs will appear here once configured.</p>
            </GlassCard>
          )}

          {!loading && !error && locales.length > 0 && (
            <>
              {/* Current Locale */}
              <GlassCard className="mb-6">
                <h2 className="text-white font-semibold text-sm mb-3">Current Locale</h2>
                <div className="flex items-center gap-4">
                  <span className="text-2xl">
                    {locales.find((l) => l.code === currentLocale)?.flag || "🌐"}
                  </span>
                  <div>
                    <p className="text-white font-medium">
                      {locales.find((l) => l.code === currentLocale)?.name || currentLocale}
                    </p>
                    <p className="text-gray-500 text-xs">
                      Code: <span className="text-gray-400 font-mono">{currentLocale}</span>
                    </p>
                  </div>
                </div>
              </GlassCard>

              {/* Language Selector */}
              <h2 className="text-white font-semibold text-sm mb-4">Available Languages</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {locales.map((lang) => (
                  <GlassCard
                    key={lang.code || lang.locale}
                    hover
                    className={`cursor-pointer transition-all ${
                      currentLocale === (lang.code || lang.locale)
                        ? "ring-1 ring-indigo-500/40"
                        : ""
                    }`}
                    onClick={() => handleLocaleChange(lang.code || lang.locale)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{lang.flag || "🌐"}</span>
                      <div className="flex-1">
                        <h3 className="text-white text-sm font-medium">{lang.name}</h3>
                        <p className="text-gray-500 text-[11px]">{(lang.code || lang.locale).toUpperCase()}</p>
                      </div>
                      {currentLocale === (lang.code || lang.locale) && (
                        <span className="material-symbols-outlined text-indigo-400 text-[18px]">check_circle</span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-gray-500">
                        {lang.translationCount || lang.count || 0} translation(s)
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          (lang.percentage || lang.progress || 0) >= 90
                            ? "bg-green-500/10 text-green-400"
                            : (lang.percentage || lang.progress || 0) >= 50
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-gray-500/10 text-gray-400"
                        }`}
                      >
                        {lang.percentage || lang.progress || 0}%
                      </span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}