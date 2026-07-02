import type { MilestoneEvent } from "@/lib/types";

/**
 * 마감 직후 마일스톤 이벤트 → 작은 토스트 문구.
 * 입력탭·홈탭 두 컨테이너가 동일 문구를 쓰도록 한 곳에 모은다.
 */
export function milestoneToastMessage(m: MilestoneEvent): string {
  switch (m.kind) {
    case "streak":
      return `🔥 ${m.streakDays}일 연속 기록! 꾸준함이 답이에요`;
    case "loss":
      return `🎉 −${m.lostKg}kg 달성! 이 흐름 그대로 가요`;
    case "lowest":
      return `🎯 역대 최저 체중 갱신! ${m.weight}kg`;
    case "eta":
      return m.etaDays >= 30
        ? "📅 이 페이스면 한 달 안에 목표 도달!"
        : m.etaDays >= 14
          ? "🏁 목표까지 2주 예상! 막판 스퍼트예요"
          : "🔥 이번 주 안에 도달할 수도 있어요!";
    case "weeklyLoss":
      return `📉 ${m.weeks}주 연속 감량 중! 완벽한 흐름이에요`;
    case "anniversary":
      return `🎂 다이어트 ${m.years}주년! ${m.days}일을 함께 왔어요`;
    case "birthday":
      return "🎂 생일 축하해요! 오늘만큼은 나에게 선물 같은 하루 되길";
  }
}
