import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useRole } from "../../context/RoleContext";
import PageLayout from "../../components/PageLayout";
import { GlassCard, PageHeader, LoadingSpinner } from "../../components/ui";

export default function InvestorSettings() {
  const router = useRouter();
  const { user, loading: authLoading } = useRole();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  function handleRedirect(href) {
    setRedirecting(true);
    router.push(href);
  }

  if (authLoading || !user) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading settings..." />
        </div>
      </PageLayout>
    );
  }

  if (redirecting) {
    return (
      <PageLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f] flex items-center justify-center">
          <LoadingSpinner size="lg" text="Redirecting..." />
        </div>
      </PageLayout>
    );
  }

  const settingsSections = [
    {
      title: "Profile",
      description: "Manage your personal information and public profile",
      icon: "person",
      action: {
        label: "Edit Profile",
        href: "/edit-profile",
      },
    },
    {
      title: "Account",
      description: "Manage your account settings and preferences",
      icon: "settings",
      action: {
        label: "Account Settings",
        href: "/account/delete",
      },
    },
    {
      title: "Notifications",
      description: "Configure email and push notification preferences",
      icon: "notifications",
      action: {
        label: "Manage Notifications",
        href: "/notifications",
      },
    },
    {
      title: "Privacy & Security",
      description: "Manage your privacy settings and security preferences",
      icon: "security",
      action: {
        label: "Privacy Settings",
        href: "/edit-profile",
      },
    },
  ];

  return (
    <PageLayout>
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <PageHeader
            title="Investor Settings"
            description="Manage your account and preferences"
            icon="settings"
          />

          <div className="mt-8 space-y-4">
            {settingsSections.map((section) => (
              <GlassCard key={section.title} hover>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                    <span
                      className="material-symbols-outlined text-primary text-[24px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {section.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white">
                      {section.title}
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {section.description}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRedirect(section.action.href)}
                    className="px-4 py-2 rounded-lg bg-white/5 text-sm font-medium text-on-surface-variant hover:bg-white/10 hover:text-white transition-all shrink-0"
                  >
                    <span className="flex items-center gap-1.5">
                      {section.action.label}
                      <span className="material-symbols-outlined text-[16px]">
                        arrow_forward
                      </span>
                    </span>
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Quick links section */}
          <GlassCard className="mt-8">
            <h3 className="text-sm font-semibold text-white mb-4 font-geist">
              Quick Links
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { label: "Edit Profile", href: "/edit-profile", icon: "edit" },
                { label: "Saved Projects", href: "/saved", icon: "bookmark" },
                { label: "My Investments", href: "/investor/investments", icon: "account_balance" },
                { label: "Payment History", href: "/investor/payment-history", icon: "receipt_long" },
                { label: "My Receipts", href: "/investor/receipts", icon: "receipt" },
                { label: "Messages", href: "/dm", icon: "chat" },
              ].map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleRedirect(link.href)}
                  className="flex items-center gap-2.5 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    {link.icon}
                  </span>
                  <span className="text-sm text-on-surface-variant hover:text-white transition-colors">
                    {link.label}
                  </span>
                </button>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </PageLayout>
  );
}