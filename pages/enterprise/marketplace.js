import { useState, useEffect } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import { authFetch } from "../../lib/authFetch";

export default function MarketplacePage() {
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/marketplace/list");
        const json = await res.json();
        if (json.success && json.data) {
          setListings(json.data);
        } else if (json.data) {
          setListings(json.data);
        } else {
          setListings([]);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Plugin & Template Marketplace</h1>
              <p className="text-gray-400 mt-1">Discover plugins, templates, and integrations for your projects</p>
            </div>
            <span className="text-sm text-gray-500 bg-white/[0.04] px-3 py-1.5 rounded-full">
              {listings.length} listing{listings.length !== 1 ? "s" : ""}
            </span>
          </div>

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-card p-6 animate-pulse">
                  <div className="h-4 bg-white/[0.06] rounded w-3/4 mb-3" />
                  <div className="h-3 bg-white/[0.04] rounded w-full mb-2" />
                  <div className="h-3 bg-white/[0.04] rounded w-2/3 mb-4" />
                  <div className="h-8 bg-white/[0.06] rounded w-24" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-3">error_outline</span>
              <p className="text-red-400 text-lg font-medium">Failed to load marketplace</p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </GlassCard>
          )}

          {!loading && !error && listings.length === 0 && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-gray-500 mb-3">store</span>
              <p className="text-gray-400 text-lg font-medium">No listings available yet</p>
              <p className="text-gray-600 text-sm mt-1">Marketplace plugins and templates will appear here.</p>
            </GlassCard>
          )}

          {!loading && !error && listings.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((item) => (
                <GlassCard key={item.id || item.name} hover className="flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {item.icon && (
                        <span className="material-symbols-outlined text-2xl text-indigo-400">
                          {item.icon}
                        </span>
                      )}
                      <div>
                        <h3 className="text-white font-semibold text-sm">{item.name}</h3>
                        <span className="text-xs text-gray-500 capitalize">{item.category || item.type || "Plugin"}</span>
                      </div>
                    </div>
                    {item.rating && (
                      <div className="flex items-center gap-1 text-yellow-400 text-xs">
                        <span className="material-symbols-outlined text-[14px]">star</span>
                        {item.rating}
                      </div>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed flex-1 mb-4 line-clamp-2">
                    {item.description || "No description available."}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/[0.06]">
                    <span className="text-white font-semibold text-sm">
                      {item.price ? (item.price === 0 ? "Free" : `$${item.price}`) : "Free"}
                    </span>
                    <Button variant="secondary" size="sm">View Details</Button>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}