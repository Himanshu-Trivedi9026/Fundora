import Link from "next/link";
import { useRole } from "../context/RoleContext";
import { canStartProject, startProjectHref } from "../lib/roles";

/**
 * Footer — 6-column footer matching mockup.
 */
export default function Footer() {
  const { role } = useRole();
  return (
    <footer className="bg-surface-container-lowest border-t border-outline-variant/20">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 px-10 lg:px-16 py-12 max-w-[1280px] mx-auto">
        {/* Brand */}
        <div className="col-span-2 lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold text-primary tracking-tighter font-geist">
            Fundora
          </h2>
          <p className="text-on-surface-variant text-xs max-w-xs leading-relaxed">
            The world&apos;s first architectural intelligence crowdfunding
            platform. Engineering the future, block by block.
          </p>
        </div>

        {/* Platform */}
        <div className="space-y-3">
          <h3 className="text-on-surface font-bold text-xs uppercase tracking-wider">
            Platform
          </h3>
          <nav aria-label="Platform" className="flex flex-col gap-2 text-xs">
            <Link
              href="/explore"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Explore
            </Link>
            <Link
              href="/explore?sort=trending"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Invest
            </Link>
            {/* Raise (create-flow) is a creator-only entry point. */}
            {canStartProject({ role }) && (
              <Link
                href={startProjectHref({ role })}
                className="text-on-surface-variant hover:text-on-surface transition-colors"
              >
                Raise
              </Link>
            )}
          </nav>
        </div>

        {/* Company */}
        <div className="space-y-3">
          <h3 className="text-on-surface font-bold text-xs uppercase tracking-wider">
            Company
          </h3>
          <nav aria-label="Company" className="flex flex-col gap-2 text-xs">
            <Link
              href="/"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              About
            </Link>
            <Link
              href="/explore"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Explore Projects
            </Link>
            <Link
              href="/login"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Contact
            </Link>
          </nav>
        </div>

        {/* Resources */}
        <div className="space-y-3">
          <h3 className="text-on-surface font-bold text-xs uppercase tracking-wider">
            Resources
          </h3>
          <nav aria-label="Resources" className="flex flex-col gap-2 text-xs">
            <Link
              href="/explore"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Intelligence
            </Link>
            <Link
              href="/explore"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Community
            </Link>
          </nav>
        </div>

        {/* Legal */}
        <div className="space-y-3">
          <h3 className="text-on-surface font-bold text-xs uppercase tracking-wider">
            Legal
          </h3>
          <nav aria-label="Legal" className="flex flex-col gap-2 text-xs">
            <Link
              href="/"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Terms
            </Link>
          </nav>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-10 lg:px-16 py-6 border-t border-outline-variant/10 text-center text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">
        &copy; {new Date().getFullYear()} Fundora Architectural Intelligence.
        All rights reserved.
      </div>
    </footer>
  );
}
