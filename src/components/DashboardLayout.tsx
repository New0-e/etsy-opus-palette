import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { DrivePanel } from "@/components/DrivePanel";
import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <div className="h-screen flex w-full overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
        <DrivePanel />
      </div>
    </SidebarProvider>
  );
}
