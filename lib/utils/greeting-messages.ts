import type { DailyLog, Settings } from "@/lib/types";

interface GreetingContext {
  name: string;
  todayLog: DailyLog | null;
  recentLogs: DailyLog[]; // 최신순 정렬
  settings: Settings;
  now: Date;
}

interface GreetingRule {
  condition: (ctx: GreetingContext) => boolean;
  messages: (ctx: GreetingContext) => string[];
}

// ─────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────

function getHour(now: Date): number {
  // KST(+9)로 시간 계산
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const kstMs = utcMs + 9 * 3_600_000;
  return new Date(kstMs).getHours();
}

function getDietDays(settings: Settings): number {
  if (!settings.dietStartDate) return 0;
  const start = new Date(settings.dietStartDate + "T00:00:00");
  const diff = Date.now() - start.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000) + 1);
}

function getTotalLoss(settings: Settings, todayLog: DailyLog | null): number {
  const current = todayLog?.weight ?? settings.currentWeight;
  if (!current || !settings.startWeight) return 0;
  return Math.round((settings.startWeight - current) * 10) / 10;
}

/** 연속 입력 일수 (오늘 포함, weight 또는 임의 한 가지라도 입력) */
function getStreakDays(recentLogs: DailyLog[]): number {
  let streak = 0;
  for (const log of recentLogs) {
    const hasInput =
      log.weight !== null ||
      log.water !== null ||
      log.exercise !== null ||
      log.breakfast !== null ||
      log.lunch !== null ||
      log.dinner !== null ||
      log.lateSnack !== null;
    if (hasInput) streak++;
    else break;
  }
  return streak;
}

/** 마지막으로 입력한 날로부터 며칠 지났는지 (오늘 입력 시 0, 어제 입력 시 1, 그저께 입력 시 2(어제 하루 쉼)) */
function getDaysSinceLastInput(ctx: GreetingContext): number {
  if (ctx.recentLogs.length === 0) return 0;
  
  // 한국 시간(KST) 기준 날짜 문자열 만들기
  const utcMs = ctx.now.getTime() + ctx.now.getTimezoneOffset() * 60_000;
  const kst = new Date(utcMs + 9 * 3_600_000);
  const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
  const todayTime = new Date(todayStr + "T00:00:00Z").getTime();

  for (const log of ctx.recentLogs) {
    const hasInput =
      log.weight !== null ||
      log.water !== null ||
      log.exercise !== null ||
      log.breakfast !== null ||
      log.lunch !== null ||
      log.dinner !== null ||
      log.lateSnack !== null;

    if (hasInput) {
      const logTime = new Date(log.date + "T00:00:00Z").getTime();
      return Math.max(0, Math.floor((todayTime - logTime) / 86400000));
    }
  }
  return 999;
}

function isWeekend(now: Date): boolean {
  const day = now.getDay();
  return day === 0 || day === 6;
}

function todayInputCount(log: DailyLog | null): number {
  if (!log) return 0;
  return [
    log.weight, log.water, log.exercise, log.breakfast,
    log.lunch, log.dinner, log.lateSnack,
  ].filter((v) => v !== null).length;
}

// ─────────────────────────────────────────────────────────
// 룰 정의
// ─────────────────────────────────────────────────────────

const rules: GreetingRule[] = [
  // ── 시간대 ──
  {
    condition: (ctx) => getHour(ctx.now) >= 5 && getHour(ctx.now) < 9,
    messages: (ctx) => [
      `${ctx.name}님, 좋은 아침이에요! 오늘도 힘차게 시작해봐요 🌅`,
      `${ctx.name}님, 아침부터 앱 켜셨네요! 이 부지런함이 다이어트 성공의 비결이에요`,
      `일찍 일어난 ${ctx.name}님! 오늘 체중 측정 잊지 마세요 ⚖️`,
      `${ctx.name}님, 좋은 아침! 오늘도 어제의 나보다 0.1kg 가볍게 살아봐요`,
    ],
  },
  {
    condition: (ctx) => getHour(ctx.now) >= 9 && getHour(ctx.now) < 12,
    messages: (ctx) => [
      `${ctx.name}님, 오전이 가기 전에 체중 측정은 하셨나요? ☀️`,
      `좋은 오전이에요, ${ctx.name}님! 오늘 하루도 잘 부탁드려요`,
      `${ctx.name}님, 오늘도 잘 해내실 거예요! 아자아자 💪`,
    ],
  },
  {
    condition: (ctx) => getHour(ctx.now) >= 12 && getHour(ctx.now) < 14,
    messages: (ctx) => [
      `${ctx.name}님, 점심 맛있게 드셨나요? 식단 기록 잊지 마세요 🍱`,
      `점심시간이에요, ${ctx.name}님! 야식 대신 점심으로 든든하게 채우세요`,
      `${ctx.name}님, 오후도 파이팅이에요! 🌟`,
    ],
  },
  {
    condition: (ctx) => getHour(ctx.now) >= 14 && getHour(ctx.now) < 18,
    messages: (ctx) => [
      `${ctx.name}님, 오후도 잘 이겨내고 계시죠? 😊`,
      `한낮의 ${ctx.name}님! 수분 보충은 충분히 하고 계신가요? 💧`,
      `${ctx.name}님, 오후 슬럼프 오는 시간이에요. 물 한 잔 마시고 가요!`,
    ],
  },
  {
    condition: (ctx) => getHour(ctx.now) >= 18 && getHour(ctx.now) < 21,
    messages: (ctx) => [
      `${ctx.name}님, 오늘 하루는 어떠셨나요? 저녁 식단도 기록해두세요 🌙`,
      `퇴근 후의 ${ctx.name}님, 수고 많으셨어요! 야식은 오늘도 참아봐요 💪`,
      `${ctx.name}님, 저녁이에요! 오늘 목표 달성까지 얼마나 남았는지 확인해볼까요?`,
    ],
  },
  {
    condition: (ctx) => getHour(ctx.now) >= 21 && getHour(ctx.now) < 24,
    messages: (ctx) => [
      `${ctx.name}님, 오늘 하루도 정말 수고 많으셨어요 🌙`,
      `늦은 밤의 ${ctx.name}님! 야식 유혹 이겨내고 계신가요? 자면 없어져요 😴`,
      `${ctx.name}님, 오늘 기록 마무리하고 편안한 밤 되세요 ✨`,
      `곧 자야 하는 시간이에요, ${ctx.name}님. 마감 버튼 눌러봐요!`,
    ],
  },
  {
    condition: (ctx) => getHour(ctx.now) >= 0 && getHour(ctx.now) < 5,
    messages: (ctx) => [
      `${ctx.name}님, 아직도 안 주무세요? 수면도 다이어트예요 😴`,
      `야심한 밤에 기록하시는 ${ctx.name}님, 대단해요! 이제 주무세요 🌙`,
    ],
  },

  // ── 다이어트 날짜 마일스톤 ──
  {
    condition: (ctx) => getDietDays(ctx.settings) === 1,
    messages: (ctx) => [`${ctx.name}님, 다이어트 첫날이에요! 이 시작이 끝을 만들어요 🎉`],
  },
  {
    condition: (ctx) => getDietDays(ctx.settings) === 7,
    messages: (ctx) => [`${ctx.name}님, 일주일째에요! 벌써 7일, 잘 해내고 있어요 🎊`],
  },
  {
    condition: (ctx) => getDietDays(ctx.settings) === 30,
    messages: (ctx) => [`${ctx.name}님, 한 달! 30일을 버텼다는 게 대단해요 👏`],
  },
  {
    condition: (ctx) => getDietDays(ctx.settings) === 50,
    messages: (ctx) => [`${ctx.name}님, D+50이에요! 반환점도 넘어섰어요 🏃`],
  },
  {
    condition: (ctx) => getDietDays(ctx.settings) === 100,
    messages: (ctx) => [`${ctx.name}님, 다이어트 100일째!! 정말 대단하세요 🎯`],
  },
  {
    condition: (ctx) => getDietDays(ctx.settings) > 0 && getDietDays(ctx.settings) % 30 === 0 && getDietDays(ctx.settings) > 100,
    messages: (ctx) => [`${ctx.name}님, 벌써 ${getDietDays(ctx.settings)}일째에요! 포기하지 않은 당신이 최고예요 💪`],
  },
  {
    condition: (ctx) => getDietDays(ctx.settings) >= 3 && getDietDays(ctx.settings) <= 6,
    messages: (ctx) => [`${ctx.name}님, 이제 다이어트 ${getDietDays(ctx.settings)}일째! 3일 고비를 넘겨봐요 🔥`],
  },
  {
    condition: (ctx) => getDietDays(ctx.settings) >= 8 && getDietDays(ctx.settings) <= 13,
    messages: (ctx) => [`${ctx.name}님, ${getDietDays(ctx.settings)}일째 진행 중! 2주 고비 곧 온다, 파이팅 💪`],
  },

  // ── 체중 감량 마일스톤 ──
  {
    condition: (ctx) => getTotalLoss(ctx.settings, ctx.todayLog) >= 1 && getTotalLoss(ctx.settings, ctx.todayLog) < 2,
    messages: (ctx) => [`${ctx.name}님, 벌써 1kg 감량! 첫 고비를 넘으셨어요 🎉`],
  },
  {
    condition: (ctx) => getTotalLoss(ctx.settings, ctx.todayLog) >= 2 && getTotalLoss(ctx.settings, ctx.todayLog) < 3,
    messages: (ctx) => [`${ctx.name}님, 2kg 감량 달성! 이 흐름 계속 이어가요 📉`],
  },
  {
    condition: (ctx) => getTotalLoss(ctx.settings, ctx.todayLog) >= 3 && getTotalLoss(ctx.settings, ctx.todayLog) < 5,
    messages: (ctx) => [`${ctx.name}님, ${getTotalLoss(ctx.settings, ctx.todayLog)}kg 감량! 눈에 띄기 시작할 것 같아요 ✨`],
  },
  {
    condition: (ctx) => getTotalLoss(ctx.settings, ctx.todayLog) >= 5 && getTotalLoss(ctx.settings, ctx.todayLog) < 10,
    messages: (ctx) => [`${ctx.name}님, 무려 ${getTotalLoss(ctx.settings, ctx.todayLog)}kg 감량! 주변에서 알아보기 시작했나요? 😊`],
  },
  {
    condition: (ctx) => getTotalLoss(ctx.settings, ctx.todayLog) >= 10,
    messages: (ctx) => [`${ctx.name}님, 10kg 이상 감량! 완전히 다른 사람이 됐어요 🏆`],
  },
  {
    condition: (ctx) => {
      const loss = getTotalLoss(ctx.settings, ctx.todayLog);
      const target = ctx.settings.startWeight - ctx.settings.targetWeight;
      return target > 0 && loss > 0 && loss / target >= 0.5 && loss / target < 0.8;
    },
    messages: (ctx) => {
      const pct = Math.round((getTotalLoss(ctx.settings, ctx.todayLog) / (ctx.settings.startWeight - ctx.settings.targetWeight)) * 100);
      return [`${ctx.name}님, 목표의 ${pct}% 달성! 반환점 돌았어요 🔄`];
    },
  },
  {
    condition: (ctx) => {
      const loss = getTotalLoss(ctx.settings, ctx.todayLog);
      const target = ctx.settings.startWeight - ctx.settings.targetWeight;
      return target > 0 && loss > 0 && loss / target >= 0.8 && loss / target < 1;
    },
    messages: (ctx) => [`${ctx.name}님, 목표까지 이제 얼마 안 남았어요! 마지막 스퍼트예요 🏁`],
  },

  // ── 연속 입력 스트릭 ──
  {
    condition: (ctx) => getStreakDays(ctx.recentLogs) >= 3 && getStreakDays(ctx.recentLogs) < 7,
    messages: (ctx) => [`${ctx.name}님, ${getStreakDays(ctx.recentLogs)}일 연속 입력 중! 이 습관이 성공의 비결이에요 🔥`],
  },
  {
    condition: (ctx) => getStreakDays(ctx.recentLogs) >= 7 && getStreakDays(ctx.recentLogs) < 14,
    messages: (ctx) => [`${ctx.name}님, ${getStreakDays(ctx.recentLogs)}일 연속 입력! 일주일 넘게 쉬지 않았어요 💪`],
  },
  {
    condition: (ctx) => getStreakDays(ctx.recentLogs) >= 14 && getStreakDays(ctx.recentLogs) < 30,
    messages: (ctx) => [`${ctx.name}님, ${getStreakDays(ctx.recentLogs)}일 연속 기록! 2주 이상 꾸준하다는 거 대단해요 🌟`],
  },
  {
    condition: (ctx) => getStreakDays(ctx.recentLogs) >= 30,
    messages: (ctx) => [`${ctx.name}님, ${getStreakDays(ctx.recentLogs)}일 연속 기록!! 이미 습관이 되셨네요 🏆`],
  },

  // ── 최근 미입력 (독려) ──
  {
    condition: (ctx) => getDaysSinceLastInput(ctx) === 2,
    messages: (ctx) => [`${ctx.name}님, 어제 하루 쉬셨네요. 오늘은 꼭 기록해요!`],
  },
  {
    condition: (ctx) => getDaysSinceLastInput(ctx) === 3,
    messages: (ctx) => [`${ctx.name}님, 이틀째 기록이 없어요. 작은 것부터 다시 시작해봐요 💪`],
  },
  {
    condition: (ctx) => getDaysSinceLastInput(ctx) === 4,
    messages: (ctx) => [`${ctx.name}님, 3일째 기록 없어요 😢 오늘 하나만 입력해봐요!`],
  },
  {
    condition: (ctx) => getDaysSinceLastInput(ctx) >= 5 && getDaysSinceLastInput(ctx) < 8,
    messages: (ctx) => [`${ctx.name}님, ${getDaysSinceLastInput(ctx) - 1}일째 잠수 중... 살짝 걱정돼요. 돌아와요!`],
  },
  {
    condition: (ctx) => getDaysSinceLastInput(ctx) >= 8,
    messages: (ctx) => [`${ctx.name}님, 오랜만이에요! 일주일 이상 비웠지만 지금 돌아온 거잖아요. 환영해요 🎉`],
  },

  // ── 오늘 입력 완료 ──
  {
    condition: (ctx) => todayInputCount(ctx.todayLog) >= 8,
    messages: (ctx) => [
      `${ctx.name}님, 오늘 모든 항목 입력 완료! 완벽한 하루예요 ✅`,
      `오늘 항목 8개 모두 채우셨어요, ${ctx.name}님! 마감 버튼만 누르면 완성!`,
    ],
  },
  {
    condition: (ctx) => todayInputCount(ctx.todayLog) >= 5 && todayInputCount(ctx.todayLog) < 8,
    messages: (ctx) => [`${ctx.name}님, 오늘 ${todayInputCount(ctx.todayLog)}개 입력! 조금만 더 채워볼까요? 📝`],
  },
  {
    condition: (ctx) => todayInputCount(ctx.todayLog) > 0 && todayInputCount(ctx.todayLog) < 5,
    messages: (ctx) => [`${ctx.name}님, 오늘 시작했어요! 나머지도 틈틈이 채워봐요 📋`],
  },

  // ── 오늘의 구체적 입력 내용 ──
  {
    condition: (ctx) => ctx.todayLog?.exercise === "Y",
    messages: (ctx) => [
      `오늘도 운동하신 ${ctx.name}님! 불끈불끈 💪`,
      `${ctx.name}님, 오늘 운동 완료! 이 정도면 진짜 의지의 한국인이에요 🏋️`,
      `운동까지 하셨어요, ${ctx.name}님! 칼로리 소비 완료 🔥`,
    ],
  },
  {
    condition: (ctx) => ctx.todayLog?.exercise === "N" && ctx.todayLog?.lateSnack === "N",
    messages: (ctx) => [
      `${ctx.name}님, 운동은 못 했지만 야식 참으셨어요! 그것만으로도 충분해요 🌙`,
      `야식 참은 ${ctx.name}님, 오늘의 진정한 승자예요 👑`,
    ],
  },
  {
    condition: (ctx) => ctx.todayLog?.lateSnack === "Y",
    messages: (ctx) => [
      `${ctx.name}님, 야식은 솔직하게 기록하는 게 포인트예요. 내일은 이겨봐요 😅`,
      `오늘 야식 하셨군요, ${ctx.name}님. 기록한 것만으로도 반은 성공이에요 📝`,
    ],
  },
  {
    condition: (ctx) => {
      const w = ctx.todayLog?.water;
      const goal = ctx.settings.waterGoal;
      return w !== null && w !== undefined && goal > 0 && w >= goal;
    },
    messages: (ctx) => [
      `${ctx.name}님, 수분 목표 달성! 벌컥벌컥 보충 완료 💧`,
      `오늘 물 충분히 드셨어요, ${ctx.name}님! 피부도 좋아질 거예요 ✨`,
    ],
  },
  {
    condition: (ctx) => {
      const w = ctx.todayLog?.water;
      const goal = ctx.settings.waterGoal;
      return w !== null && w !== undefined && goal > 0 && w > 0 && w < goal;
    },
    messages: (ctx) => {
      const remaining = Math.round(((ctx.settings.waterGoal) - (ctx.todayLog!.water ?? 0)) * 10) / 10;
      return [`${ctx.name}님, 수분 목표까지 ${remaining}L 남았어요! 화이팅 💧`];
    },
  },
  {
    condition: (ctx) =>
      !!ctx.todayLog?.breakfast && !ctx.todayLog?.lunch && !ctx.todayLog?.dinner,
    messages: (ctx) => [
      `${ctx.name}님, 아침 드셨군요! 하루의 시작이 좋네요 🍳`,
      `아침 챙겨드신 ${ctx.name}님, 아침식사가 다이어트 성공의 열쇠예요 🌅`,
    ],
  },
  {
    condition: (ctx) => !!ctx.todayLog?.lunch,
    messages: (ctx) => {
      const meal = ctx.todayLog!.lunch!;
      return [
        `${meal}으로 점심 드셨군요, ${ctx.name}님! 맛있으셨나요? 😋`,
        `오늘 점심은 ${meal}! 기록 칭찬해요 ${ctx.name}님 📝`,
      ];
    },
  },
  {
    condition: (ctx) => !!ctx.todayLog?.dinner,
    messages: (ctx) => {
      const meal = ctx.todayLog!.dinner!;
      return [
        `저녁으로 ${meal} 드셨군요, ${ctx.name}님! 맛있으셨길 바라요 🍽️`,
      ];
    },
  },

  // ── Hard Reset Day ──
  {
    condition: (ctx) => ctx.todayLog?.intensiveDay === true,
    messages: (ctx) => [
      `${ctx.name}님, 오늘은 Hard Reset Day예요! 식단 관리가 핵심이에요 🔥`,
      `Hard Reset 발동! ${ctx.name}님, 오늘만 잘 버티면 돼요 💪`,
    ],
  },

  // ── 주말 ──
  {
    condition: (ctx) => isWeekend(ctx.now),
    messages: (ctx) => [
      `${ctx.name}님, 주말이에요! 외식해도 기록은 잊지 마세요 🍽️`,
      `주말에도 기록하는 ${ctx.name}님, 이미 남들과 다른 거예요 💪`,
      `${ctx.name}님, 주말 모임이 있으셔도 오늘의 기록 한 줄이면 충분해요`,
    ],
  },

  // ── 목표 체중 근접 ──
  {
    condition: (ctx) => {
      const current = ctx.todayLog?.weight ?? ctx.settings.currentWeight;
      const target = ctx.settings.targetWeight;
      return current > 0 && target > 0 && current - target > 0 && current - target <= 1;
    },
    messages: (ctx) => [`${ctx.name}님, 목표 체중까지 1kg도 안 남았어요!! 거의 다 왔어요 🏁`],
  },

  // ── 마감 완료 ──
  {
    condition: (ctx) => ctx.todayLog?.closed === true,
    messages: (ctx) => [
      `${ctx.name}님, 오늘 마감 완료! 오늘도 기록으로 완성했어요 ✅`,
      `오늘 하루 마감하셨어요, ${ctx.name}님! 내일도 이렇게 해봐요 🌙`,
    ],
  },

  // ── 기본 메세지 (항상 매칭) ──
  {
    condition: () => true,
    messages: (ctx) => [
      `${ctx.name}님, 오늘도 잘 해내실 거예요 😊`,
      `안녕하세요, ${ctx.name}님! 오늘도 파이팅이에요 💪`,
      `${ctx.name}님, 기록이 습관이 되면 다이어트는 자연스럽게 따라와요 📝`,
      `${ctx.name}님, 오늘의 기록이 미래의 나를 만들어요 ✨`,
      `${ctx.name}님, 천천히 꾸준하게. 그게 제일 좋은 방법이에요 🐢`,
      `반가워요, ${ctx.name}님! 오늘도 하나씩 채워봐요 📋`,
    ],
  },
];

// ─────────────────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────────────────

export function getGreetingMessage(
  name: string,
  todayLog: DailyLog | null,
  recentLogs: DailyLog[],
  settings: Settings
): string {
  const ctx: GreetingContext = { name, todayLog, recentLogs, settings, now: new Date() };

  // 매칭된 룰의 모든 메세지 후보를 모음
  const candidates: string[] = [];
  for (const rule of rules) {
    if (rule.condition(ctx)) {
      candidates.push(...rule.messages(ctx));
    }
  }

  if (candidates.length === 0) return `${name}님, 안녕하세요!`;

  // 랜덤 선택
  return candidates[Math.floor(Math.random() * candidates.length)];
}
