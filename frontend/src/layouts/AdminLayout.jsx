import { Outlet } from "react-router-dom";
import { useState } from "react";
import { AdminSidebar } from "../components/AdminSidebar";
import { AdminHeader } from "../components/AdminHeader";
import { useAuth } from "../contexts/AuthContext";

export function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { admin, logout } = useAuth();

  return (
    <div className="min-h-screen min-w-0 bg-slate-50">
      <AdminSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="w-full min-w-0 max-w-full md:pl-72">
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
