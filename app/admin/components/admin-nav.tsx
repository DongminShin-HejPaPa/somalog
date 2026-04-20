"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone, Users, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "대시보드", shortLabel: "대시보드", icon: LayoutDashboard, exact: true },
  { href: "/admin/notices", label: "공지사항 관리", shortLabel: "공지사항", icon: Megaphone, exact: false },
  { href: "/admin/users", label: "유저 관리", shortLabel: "유저", icon: Users, exact: false },
  { href: "/admin/billing", label: "API 비용 관리", shortLabel: "비용", icon: DollarSign, exact: false },
];

function useActiveHref() {
  const pathname = usePathname();
  return (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);
}

export function AdminSidebarNav() {
  const isActive = useActiveHref();
  return (
    <nav className="flex-1 p-4 space-y-1">
      {navItems.map(({ href, label, icon: Icon, exact }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            isActive(href, exact)
              ? "bg-navy text-white"
              : "hover:bg-secondary text-muted-foreground"
          )}
        >
          <Icon className="w-4 h-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminMobileNav() {
  const isActive = useActiveHref();
  return (
    <nav className="md:hidden flex overflow-x-auto p-2 border-b border-border bg-card gap-2 no-scrollbar">
      {navItems.map(({ href, shortLabel, exact }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
            isActive(href, exact)
              ? "bg-navy text-white"
              : "text-muted-foreground hover:bg-secondary"
          )}
        >
          {shortLabel}
        </Link>
      ))}
    </nav>
  );
}
