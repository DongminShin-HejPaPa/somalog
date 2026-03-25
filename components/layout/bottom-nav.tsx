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
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-border z-50">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-full h-full min-h-[44px] min-w-[44px] text-xs transition-colors",
                isActive
                  ? "text-navy font-semibold"
                  : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
