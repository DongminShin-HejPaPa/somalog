export default function GraphLoading() {
  return (
    <div className="pb-6 animate-pulse">
      <div className="px-4 pt-4 pb-2">
        <div className="h-7 w-28 bg-secondary rounded" />
      </div>
      {/* 기간 필터 버튼 */}
      <div className="px-4 mb-3 flex gap-1.5">
        {["2주", "1개월", "3개월", "전체"].map((_, i) => (
          <div key={i} className="h-9 w-16 bg-secondary rounded-full" />
        ))}
      </div>
      {/* 차트 영역 */}
      <div className="px-2 h-[300px] bg-secondary rounded-xl mx-2" />
      {/* 통계 카드 */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-secondary rounded-xl" />
        ))}
      </div>
    </div>
  );
}
