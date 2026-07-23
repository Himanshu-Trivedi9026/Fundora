import SectionReveal from "./SectionReveal";

/**
 * DashboardLayout — Responsive 4-column grid shell.
 * Sidebar below main on mobile, left on desktop.
 */
export default function DashboardLayout({ sidebar, children }) {
  return (
    <SectionReveal className="max-w-6xl mx-auto px-4 md:px-6 mt-6 md:mt-10">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
        {/* Sidebar — below main on mobile, left on desktop */}
        <aside className="lg:col-span-1 order-2 lg:order-1 space-y-6">
          {sidebar}
        </aside>

        {/* Main content */}
        <div className="lg:col-span-3 order-1 lg:order-2 space-y-8">
          {children}
        </div>
      </div>
    </SectionReveal>
  );
}
