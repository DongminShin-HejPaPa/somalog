import { LogContainer } from "@/components/log/log-container";
import { getAuthUser } from "@/lib/supabase/server";

export default async function LogPage() {
  const user = await getAuthUser();
  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold">기록</h1>
      </header>
      <LogContainer userId={user?.id ?? null} />
    </div>
  );
}
