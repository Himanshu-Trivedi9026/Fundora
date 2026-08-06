import { useState, useEffect } from "react";
import PageLayout from "../../components/PageLayout";
import GlassCard from "../../components/ui/GlassCard";
import Button from "../../components/ui/Button";
import { authFetch } from "../../lib/authFetch";

export default function MCPPage() {
  const [loading, setLoading] = useState(true);
  const [serverInfo, setServerInfo] = useState(null);
  const [tools, setTools] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/mcp?info=true");
        const json = await res.json();
        if (json.success && json.data) {
          setServerInfo(json.data);
        }
      } catch (e) {
        // non-fatal, try for tools
      }

      try {
        const res = await authFetch("/api/mcp");
        const json = await res.json();
        if (json.success && json.data) {
          setTools(json.data.tools || []);
          if (!json.data.serverInfo && json.data.info) {
            setServerInfo(json.data.info);
          }
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
              <h1 className="text-2xl font-bold text-white">
                MCP Server Management
              </h1>
              <p className="text-gray-400 mt-1">
                Manage model-context-protocol servers, tools, and configurations
              </p>
            </div>
            <Button variant="primary" size="md">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add Server
            </Button>
          </div>

          {/* Server Info */}
          {serverInfo && (
            <GlassCard className="mb-6">
              <h2 className="text-white font-semibold text-sm mb-3">
                Server Status
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-500 text-[11px] uppercase tracking-wider">
                    Status
                  </p>
                  <p className="text-green-400 text-sm font-medium mt-1">
                    <span className="material-symbols-outlined text-[14px] align-text-bottom">
                      check_circle
                    </span>{" "}
                    Online
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-[11px] uppercase tracking-wider">
                    Name
                  </p>
                  <p className="text-white text-sm mt-1">
                    {serverInfo.name || "MCP Server"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-[11px] uppercase tracking-wider">
                    Version
                  </p>
                  <p className="text-white text-sm mt-1">
                    {serverInfo.version || "1.0.0"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-[11px] uppercase tracking-wider">
                    Tools
                  </p>
                  <p className="text-white text-sm mt-1">
                    {tools.length} registered
                  </p>
                </div>
              </div>
            </GlassCard>
          )}

          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card p-6 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
                    <div className="h-4 bg-white/[0.06] rounded w-24" />
                  </div>
                  <div className="h-3 bg-white/[0.04] rounded w-3/4 mb-2" />
                  <div className="h-3 bg-white/[0.04] rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-red-400 mb-3">
                error_outline
              </span>
              <p className="text-red-400 text-lg font-medium">
                Failed to load MCP servers
              </p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </GlassCard>
          )}

          {!loading && !error && tools.length === 0 && !serverInfo && (
            <GlassCard className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-gray-500 mb-3">
                dns
              </span>
              <p className="text-gray-400 text-lg font-medium">
                No MCP servers connected
              </p>
              <p className="text-gray-600 text-sm mt-1">
                Configure an MCP server to enable AI-powered tool execution.
              </p>
            </GlassCard>
          )}

          {!loading && !error && (tools.length > 0 || serverInfo) && (
            <>
              {/* Connected Servers */}
              <h2 className="text-white font-semibold text-sm mb-4">
                Connected Servers
              </h2>
              <div className="space-y-3 mb-8">
                <GlassCard className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px] text-indigo-400">
                        dns
                      </span>
                    </div>
                    <div>
                      <h3 className="text-white text-sm font-medium">
                        Default MCP Server
                      </h3>
                      <p className="text-gray-500 text-[11px]">
                        {serverInfo?.name || "localhost"} ({tools.length} tools)
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                    Connected
                  </span>
                </GlassCard>
              </div>

              {/* Available Tools */}
              {tools.length > 0 && (
                <>
                  <h2 className="text-white font-semibold text-sm mb-4">
                    Available Tools ({tools.length})
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tools.map((tool, idx) => (
                      <GlassCard key={tool.name || idx} hover>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="material-symbols-outlined text-[18px] text-indigo-400">
                            build
                          </span>
                          <h3 className="text-white text-sm font-medium truncate">
                            {tool.name}
                          </h3>
                        </div>
                        <p className="text-gray-500 text-xs line-clamp-2">
                          {tool.description || "No description"}
                        </p>
                        {tool.inputSchema && (
                          <div className="mt-2 pt-2 border-t border-white/[0.06]">
                            <span className="text-[10px] text-gray-600">
                              {
                                Object.keys(tool.inputSchema?.properties || {})
                                  .length
                              }{" "}
                              parameter(s)
                            </span>
                          </div>
                        )}
                      </GlassCard>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
