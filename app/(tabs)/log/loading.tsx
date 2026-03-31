export default function LogLoading() {
  return (
    <div className="pb-6 animate-pulse">
      <div className="px-4 pt-4 pb-2">
        <div className="h-7 w-16 bg-secondary rounded" />
      </div>
      {/* 검색 + 필터 */}
      <div className="px-4 mb-3 space-y-3">
        <div className="h-11 bg-secondary rounded-lg" />
        <div className="flex gap-2">
          <div className="h-8 w-16 bg-secondary rounded-lg" />
          <div className="h-8 w-28 bg-secondary rounded-full" />
          <div className="h-8 w-20 bg-secondary rounded-full" />
          <div className="h-8 w-24 bg-secondary rounded-full" />
        </div>
      </div>
      {/* 로그 카드 리스트 */}
      <div className="px-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-secondary rounded-xl" />
        ))}
      </div>
    </div>
  );
}
