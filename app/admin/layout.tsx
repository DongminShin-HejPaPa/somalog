import { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { AdminSidebarNav, AdminMobileNav } from "@/app/admin/components/admin-nav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return (
    <div className="fixed inset-0 z-50 bg-background flex overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col">
        <div className="p-6 border-b border-border">
          <Link href="/home" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4 text-xs font-semibold">
            <ChevronLeft className="w-4 h-4" />
            앱으로 돌아가기
          </Link>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-xl tracking-tight text-navy">Soma Log</h2>
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">Admin</span>
          </div>
        </div>
        <AdminSidebarNav />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 bg-secondary/20">
        {/* Mobile Header */}
        <header className="md:hidden p-4 border-b border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg text-navy">Soma Log</h2>
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">Admin</span>
          </div>
          <Link href="/home" className="text-xs font-semibold text-muted-foreground">
            닫기
          </Link>
        </header>

        <AdminMobileNav />

        <div className="flex-1 p-6 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
