/**
 * PageLayout — Standard page wrapper with Navbar + collapsible Sidebar + Footer.
 *
 * Usage:
 *   import PageLayout from "../../components/PageLayout";
 *   export default function MyPage() {
 *     return (
 *       <PageLayout>
 *         <h1>Page content</h1>
 *       </PageLayout>
 *     );
 *   }
 */

import { useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import { useRole } from "../context/RoleContext";

export default function PageLayout({
  children,
  onToggleFilters,
  hideSidebar = false,
  hideFooter = false,
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    typeof window !== "undefined" &&
      localStorage.getItem("sidebarCollapsed") === "true",
  );
  const { user, loading } = useRole();
  const isLoggedIn = !!user;

  const sidebarWidth = sidebarCollapsed ? 64 : 256;

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem("sidebarCollapsed", next);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navbar */}
      <Navbar
        onToggleFilters={onToggleFilters}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={isLoggedIn && !hideSidebar ? toggleSidebar : undefined}
      />

      {/* Body */}
      <div className="flex flex-1 pt-14">
        {/* Sidebar */}
        {isLoggedIn && !hideSidebar && (
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        )}

        {/* Main content */}
        <main
          className={`flex-1 transition-all duration-300 ease-in-out ${
            isLoggedIn && !hideSidebar ? `ml-0 md:ml-[${sidebarWidth}px]` : ""
          }`}
          style={{
            marginLeft:
              isLoggedIn && !hideSidebar
                ? typeof window !== "undefined" && window.innerWidth >= 768
                  ? sidebarWidth
                  : 0
                : 0,
          }}
        >
          {children}
        </main>
      </div>

      {/* Footer */}
      {!hideFooter && <Footer />}
    </div>
  );
}
