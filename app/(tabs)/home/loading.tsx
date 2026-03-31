export default function HomeLoading() {
  return (
    <div className="pb-6 animate-pulse">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="h-7 w-28 bg-secondary rounded" />
        <div className="h-5 w-24 bg-secondary rounded" />
      </div>
      {/* DietProgressBanner */}
      <div className="mx-4 mt-4 h-28 bg-secondary rounded-xl" />
      {/* InputStatusChips */}
      <div className="px-4 mt-4 space-y-3">
        <div className="h-5 w-32 bg-secondary rounded" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-11 bg-secondary rounded-lg" />
          ))}
        </div>
        <div className="h-2 bg-secondary rounded-full" />
        <div className="h-11 bg-secondary rounded-lg" />
      </div>
      {/* WeightMiniGraph */}
      <div className="mx-4 mt-4 h-44 bg-secondary rounded-xl" />
    </div>
  );
}
