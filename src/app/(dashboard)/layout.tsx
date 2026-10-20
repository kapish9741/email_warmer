import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Topbar } from "@/components/layout/topbar"
import { AuthProvider } from "@/components/auth/auth-provider"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <AppSidebar />
        <div className="flex flex-col flex-1 w-full min-w-0 transition-all duration-300 ease-in-out">
          <Topbar />
          <main className="flex-1 p-6 bg-muted/20">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </AuthProvider>
  )
}
