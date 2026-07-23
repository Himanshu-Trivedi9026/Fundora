/**
 * Footer — 4-column footer with brand, platform, company, legal links.
 */
export default function Footer() {
  return (
    <footer className="bg-surface-dim border-t border-white/[0.06]">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 px-4 md:px-16 py-12 max-w-6xl mx-auto">
        {/* Brand */}
        <div className="col-span-1">
          <span className="font-geist text-lg font-bold text-on-surface block mb-4">Fundora</span>
          <p className="text-on-surface-variant font-inter text-sm opacity-80 leading-relaxed">
            Empowering the next generation of founders through architectural intelligence and capital democratization.
          </p>
        </div>

        {/* Platform */}
        <div className="flex flex-col gap-2">
          <p className="font-geist text-sm font-semibold text-on-surface mb-2">Platform</p>
          <a href="/explore" className="text-on-surface-variant hover:text-primary transition-colors font-inter text-sm">Discover</a>
          <a href="/explore" className="text-on-surface-variant hover:text-primary transition-colors font-inter text-sm">Markets</a>
          <span className="text-on-surface-variant hover:text-primary transition-colors font-inter text-sm cursor-pointer">API Documentation</span>
        </div>

        {/* Company */}
        <div className="flex flex-col gap-2">
          <p className="font-geist text-sm font-semibold text-on-surface mb-2">Company</p>
          <span className="text-on-surface-variant hover:text-primary transition-colors font-inter text-sm cursor-pointer">Investor Relations</span>
          <span className="text-on-surface-variant hover:text-primary transition-colors font-inter text-sm cursor-pointer">Help Center</span>
          <span className="text-on-surface-variant hover:text-primary transition-colors font-inter text-sm cursor-pointer">Success Stories</span>
        </div>

        {/* Legal */}
        <div className="flex flex-col gap-2">
          <p className="font-geist text-sm font-semibold text-on-surface mb-2">Legal</p>
          <span className="text-on-surface-variant hover:text-primary transition-colors font-inter text-sm cursor-pointer">Privacy Policy</span>
          <span className="text-on-surface-variant hover:text-primary transition-colors font-inter text-sm cursor-pointer">Terms of Service</span>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/[0.04] py-6 text-center">
        <p className="font-inter text-xs text-on-surface-variant opacity-60">
          © {new Date().getFullYear()} Fundora Intelligence. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
