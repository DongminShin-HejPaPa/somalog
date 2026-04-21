import { HomeContainer } from "@/components/home/home-container";
import { getAuthUser } from "@/lib/supabase/server";

export default async function HomePage() {
  const user = await getAuthUser();
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    null;
  return <HomeContainer userId={user?.id ?? null} initialDisplayName={displayName} />;
}
