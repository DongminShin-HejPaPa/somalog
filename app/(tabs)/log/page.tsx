import { LogContainer } from "@/components/log/log-container";

export default function LogPage() {
  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold">기록</h1>
      </header>
      <LogContainer />
    </div>
  );
}
