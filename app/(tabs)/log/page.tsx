import { LogContainer } from "@/components/log/log-container";
import { ChapterPicker } from "@/components/chapter/chapter-picker";
import { getAuthUser } from "@/lib/supabase/server";

export default async function LogPage() {
  const user = await getAuthUser();
  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold flex-shrink-0">기록</h1>
        <ChapterPicker />
      </header>
      <LogContainer userId={user?.id ?? null} />
    </div>
  );
}
