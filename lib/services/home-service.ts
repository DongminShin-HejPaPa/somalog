import { getRecentDailyLogs, getFirstUnclosedLog, upsertDailyLog, getDailyLog } from "@/lib/services/daily-log-service";
import { formatDate } from "@/lib/utils/date-utils";
import type { DailyLog } from "@/lib/types";

export interface HomeInitialData {
  recentLogs: DailyLog[];
  firstUnclosed: DailyLog | null;
  todayLog: DailyLog | null;
}

export async function getHomeInitialData(userId: string | null): Promise<HomeInitialData> {
  if (!userId) {
    return { recentLogs: [], firstUnclosed: null, todayLog: null };
  }

  const today = formatDate(new Date());

  // 병렬로 필요한 데이터를 단일 서버 렌더링 사이클에서 모두 가져옵니다.
  const [recentLogs, firstUnclosed, todayLog] = await Promise.all([
    getRecentDailyLogs(30),
    getFirstUnclosedLog(),
    getDailyLog(today),
  ]);

  let finalTodayLog = todayLog;

  // 만약 오늘자 로그가 없다면, 클라이언트에서 revalidatePath를 부르는 서버 액션 핑퐁을 피하기 위해
  // 서버에서 투명하게 빈 로그를 즉시 생성(Upsert) 해줍니다.
  if (!finalTodayLog) {
    // 빈 {}를 보내면 date, day, 빈 필드들로 구성된 로그를 생성함.
    finalTodayLog = await upsertDailyLog(today, {});
    // 생성된 오늘 로그가 recentLogs 배열에 없었다면 맨 앞에 직접 추가합니다.
    if (!recentLogs.find((l) => l.date === today)) {
      recentLogs.unshift(finalTodayLog);
      // 최대 30개로 맞춤
      if (recentLogs.length > 30) recentLogs.pop();
    }
  }

  return {
    recentLogs,
    firstUnclosed,
    todayLog: finalTodayLog,
  };
}
