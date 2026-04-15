import { Suspense } from "react";
import { SettingsForm } from "@/components/settings/settings-form";

export default function SettingsPage() {
  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold">설정</h1>
      </header>
      <Suspense>
        <SettingsForm />
      </Suspense>
    </div>
  );
}
