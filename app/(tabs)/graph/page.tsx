import { Suspense } from "react";
import { GraphContainer } from "@/components/graph/graph-container";
import { ChapterPicker } from "@/components/chapter/chapter-picker";
import { getAuthUser } from "@/lib/supabase/server";

export default async function GraphPage() {
  const user = await getAuthUser();
  const userName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold flex-shrink-0">체중 그래프</h1>
        <ChapterPicker />
      </header>
      {/* GraphContainer 가 useSearchParams(?share=1) 를 사용하므로 Suspense 로 감싼다. */}
      <Suspense>
        <GraphContainer userName={userName} userId={user?.id ?? null} />
      </Suspense>
    </div>
  );
}
