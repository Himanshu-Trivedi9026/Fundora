/**
 * WelcomeCard — Personalized greeting with onboarding tips
 *
 * Usage:
 *   <WelcomeCard userName="Alex" role="creator" tips={["Tip 1", "Tip 2"]} />
 */

export default function WelcomeCard({
  userName = "",
  role = "investor",
  tips = [],
  className = "",
}) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const roleLabels = {
    investor: "My Dashboard",
    creator: "Creator Dashboard",
    admin: "Admin Dashboard",
  };

  const roleTitle = roleLabels[role] || "Dashboard";

  return (
    <div className={`fade-in-up ${className}`}>
      <div className="glass-card overflow-hidden relative">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-primary/8 to-primary/3 px-6 md:px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-on-surface font-geist">
                {greeting}, {userName || "there"}
              </h1>
              <p className="text-on-surface-variant text-sm mt-1">
                Welcome to {roleTitle}
              </p>
            </div>
          </div>
        </div>

        {/* Tips */}
        {tips.length > 0 && (
          <div className="px-6 md:px-8 py-4 border-t border-white/[0.06]">
            <ul className="space-y-2">
              {tips.map((tip, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-on-surface-variant"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary mt-0.5 shrink-0">
                    lightbulb
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
