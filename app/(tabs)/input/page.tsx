import { Suspense } from "react";
import { InputContainer } from "@/components/input/input-container";
import { getAuthUser } from "@/lib/supabase/server";

export default async function InputPage() {
  const user = await getAuthUser();
  return (
    <Suspense>
      <InputContainer userId={user?.id ?? null} />
    </Suspense>
  );
}
