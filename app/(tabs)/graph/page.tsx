import { GraphContainer } from "@/components/graph/graph-container";
import { getAuthUser } from "@/lib/supabase/server";

export default async function GraphPage() {
  const user = await getAuthUser();
  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold">체중 그래프</h1>
      </header>
      <GraphContainer userId={user?.id ?? null} />
    </div>
  );
}
