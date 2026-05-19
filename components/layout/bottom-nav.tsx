"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PenSquare, ClipboardList, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/home", label: "홈", icon: Home },
  { href: "/input", label: "입력", icon: PenSquare },
  { href: "/log", label: "기록", icon: ClipboardList },
  { href: "/graph", label: "그래프", icon: BarChart3 },
  { href: "/settings", label: "설정", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-border z-50 flex safe-bottom">
      {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={true}
              data-testid={`nav-${tab.href.slice(1)}`}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[11px] transition-colors",
                isActive
                  ? "text-navy font-semibold"
                  : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-[22px] h-[22px]", isActive ? "stroke-[2.5]" : "stroke-[1.8]")} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
    </nav>
  );
}
