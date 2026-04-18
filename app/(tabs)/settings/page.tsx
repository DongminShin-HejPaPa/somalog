import { Suspense } from "react";
import { SettingsForm } from "@/components/settings/settings-form";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (data?.role === "admin") {
      isAdmin = true;
    }
  }

  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold">설정</h1>
      </header>
      <Suspense>
        <SettingsForm isAdmin={isAdmin} />
      </Suspense>
    </div>
  );
}
