/**
 * SecurityDashboard — Creator-facing security status display.
 *
 * Extends the Trust Center with:
 *   - Risk status indicator (no internal scoring exposed)
 *   - Security recommendations
 *   - Missing verification steps
 *   - Recent security events
 *   - Device/login history
 *
 * Security:
 *   - Never exposes raw risk scores or internal algorithms
 *   - Shows only user-friendly status indicators
 *   - No admin-level detail exposed
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../lib/authFetch";

const STATUS_COLORS = {
  secure: "#10b981",
  attention: "#f59e0b",
  action_required: "#ef4444",
};

export default function SecurityDashboard({ userId }) {
  const [profile, setProfile] = useState(null);
  const [devices, setDevices] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    queueMicrotask(() => setLoading(true));
    try {
      // Fetch fraud profile (sanitized)
      const profileRes = await authFetch("/api/fraud/profile");
      const profileData = await profileRes.json();
      if (profileData.success) {
        queueMicrotask(() => setProfile(profileData.profile));
      }

      // Fetch devices
      const devicesRes = await authFetch("/api/fraud/devices?limit=5");
      const devicesData = await devicesRes.json();
      if (devicesData.success) {
        queueMicrotask(() => setDevices(devicesData.devices || []));
      }

      // Fetch recent events
      const eventsRes = await authFetch("/api/fraud/events?limit=5");
      const eventsData = await eventsRes.json();
      if (eventsData.success) {
        queueMicrotask(() => setEvents(eventsData.events || []));
      }
    } catch {
      // Silently handle errors
    } finally {
      queueMicrotask(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);

  if (loading) {
    return (
      <div className="glass-panel rounded-2xl p-6">
        <div className="text-gray-400 font-inter">
          Loading security status...
        </div>
      </div>
    );
  }

  const securityStatus = getSecurityStatus(profile);

  return (
    <div className="space-y-6">
      {/* Security Status Card */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: `${STATUS_COLORS[securityStatus.level]}20`,
            }}
          >
            <span
              className="material-symbols-outlined text-2xl"
              style={{ color: STATUS_COLORS[securityStatus.level] }}
            >
              {securityStatus.icon}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white font-geist">
              {securityStatus.title}
            </h3>
            <p className="text-sm text-gray-400 font-inter">
              {securityStatus.description}
            </p>
          </div>
        </div>

        {/* Recommendations */}
        {securityStatus.recommendations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-400">
              Recommendations
            </h4>
            {securityStatus.recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-3 bg-white/5 rounded-lg p-3"
              >
                <span className="material-symbols-outlined text-lg text-amber-400 mt-0.5">
                  lightbulb
                </span>
                <div>
                  <p className="text-sm text-white font-inter">{rec.title}</p>
                  <p className="text-xs text-gray-400 font-inter">
                    {rec.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Device History */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white font-geist mb-4">
          Recent Devices
        </h3>
        {devices.length === 0 ? (
          <p className="text-sm text-gray-400 font-inter">
            No device history available
          </p>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between bg-white/5 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-gray-400">
                    {getDeviceIcon(device.platform)}
                  </span>
                  <div>
                    <p className="text-sm text-white font-inter">
                      {device.browser || "Unknown"} on{" "}
                      {device.platform || "Unknown"}
                    </p>
                    <p className="text-xs text-gray-400 font-inter">
                      Last active:{" "}
                      {new Date(device.last_seen_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {device.is_known ? (
                  <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
                    Known
                  </span>
                ) : (
                  <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full">
                    New
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Security Events */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white font-geist mb-4">
          Recent Activity
        </h3>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400 font-inter">
            No recent security events
          </p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between bg-white/5 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-gray-400">
                    {getEventIcon(event.eventCategory)}
                  </span>
                  <div>
                    <p className="text-sm text-white font-inter">
                      {formatEventType(event.eventType)}
                    </p>
                    <p className="text-xs text-gray-400 font-inter">
                      {new Date(event.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span
                  className="text-xs px-2 py-1 rounded-full"
                  style={{
                    backgroundColor:
                      event.severity === "critical"
                        ? "#ef444420"
                        : event.severity === "warning"
                          ? "#f59e0b20"
                          : "#10b98120",
                    color:
                      event.severity === "critical"
                        ? "#ef4444"
                        : event.severity === "warning"
                          ? "#f59e0b"
                          : "#10b981",
                  }}
                >
                  {event.severity}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───

function getSecurityStatus(profile) {
  if (!profile) {
    return {
      level: "attention",
      icon: "info",
      title: "Security Status Unknown",
      description:
        "Complete your verification to improve your security status.",
      recommendations: [
        {
          title: "Verify your email",
          description:
            "Start by verifying your email address to secure your account.",
        },
      ],
    };
  }

  const recommendations = [];

  if (profile.decision === "block") {
    return {
      level: "action_required",
      icon: "gpp_bad",
      title: "Account Restricted",
      description: "Your account has been restricted. Please contact support.",
      recommendations: [],
    };
  }

  if (profile.decision === "manual_review") {
    return {
      level: "attention",
      icon: "pending",
      title: "Account Under Review",
      description:
        "Your account is currently under review. This is usually resolved within 24-48 hours.",
      recommendations: [],
    };
  }

  if (profile.decision === "monitor") {
    recommendations.push({
      title: "Enhanced verification recommended",
      description:
        "Complete additional verification steps to improve your account status.",
    });
  }

  return {
    level: "secure",
    icon: "verified_user",
    title: "Account Secure",
    description: "Your account is in good standing with no security concerns.",
    recommendations,
  };
}

function getDeviceIcon(platform) {
  if (!platform) return "devices";
  const p = platform.toLowerCase();
  if (p.includes("iphone") || p.includes("ipad") || p.includes("ios"))
    return "smartphone";
  if (p.includes("android")) return "smartphone";
  if (p.includes("windows")) return "computer";
  if (p.includes("mac")) return "computer";
  if (p.includes("linux")) return "computer";
  return "devices";
}

function getEventIcon(category) {
  switch (category) {
    case "login":
      return "login";
    case "verification":
      return "verified_user";
    case "donation":
      return "volunteer_activism";
    case "account":
      return "person";
    case "document":
      return "description";
    case "campaign":
      return "campaign";
    default:
      return "info";
  }
}

function formatEventType(type) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
