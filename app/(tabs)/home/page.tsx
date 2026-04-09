import { HomeContainer } from "@/components/home/home-container";
import { getAuthUser } from "@/lib/supabase/server";

export default async function HomePage() {
  const user = await getAuthUser();
  return <HomeContainer userId={user?.id ?? null} />;
}
