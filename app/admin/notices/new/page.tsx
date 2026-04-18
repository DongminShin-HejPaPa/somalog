import { requireAdmin } from "@/lib/auth/admin-guard";
import { NoticeForm } from "@/components/admin/notice-form";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function AdminNoticesNewPage() {
  const adminUserId = await requireAdmin();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/notices"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          공지사항 목록
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">새 공지사항</h1>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <NoticeForm mode="create" adminUserId={adminUserId} />
      </div>
    </div>
  );
}
