import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { AdminSidebar } from "../components/AdminSidebar";
import { AdminHeader } from "../components/AdminHeader";
import { useAuth } from "../contexts/AuthContext";

const DESKTOP_AUTO_COLLAPSE_QUERY = "(min-width: 768px) and (hover: hover) and (pointer: fine)";

function useDesktopAutoCollapse() {
  const [enabled, setEnabled] = useState(() => (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(DESKTOP_AUTO_COLLAPSE_QUERY).matches
  ));

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;

    const mediaQuery = window.matchMedia(DESKTOP_AUTO_COLLAPSE_QUERY);
    const handleChange = (event) => setEnabled(event.matches);

    setEnabled(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener?.(handleChange);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener?.(handleChange);
      }
    };
  }, []);

  return enabled;
}

export function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const desktopAutoCollapse = useDesktopAutoCollapse();
  const { admin, logout } = useAuth();

  return (
    <div className="min-h-screen min-w-0 bg-slate-50">
      <AdminSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        desktopAutoCollapse={desktopAutoCollapse}
      />

      <div className={`w-full min-w-0 max-w-full ${desktopAutoCollapse ? "md:pl-[72px]" : "md:pl-72"}`}>
        <AdminHeader
          onOpenMenu={() => setIsSidebarOpen(true)}
          adminName={admin?.display_name || admin?.username}
          isLoggingOut={isLoggingOut}
          onLogout={async () => {
            setIsLoggingOut(true);
            try {
              await logout();
              window.location.href = "/admin/login";
            } finally {
              setIsLoggingOut(false);
            }
          }}
        />
        <main className="admin-page-container mx-auto w-full min-w-0 max-w-7xl p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
