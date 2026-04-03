import { GraphContainer } from "@/components/graph/graph-container";

export default function GraphPage() {
  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold">체중 그래프</h1>
      </header>
      <GraphContainer />
    </div>
  );
}
