import { HomeContainer } from "@/components/home/home-container";
import { getAuthUser } from "@/lib/supabase/server";
import { getHomeInitialData } from "@/lib/services/home-service";

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getAuthUser();
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    null;

  // 서버에서 초기 데이터를 fetch 해 SSR HTML 에 실 콘텐츠를 박는다.
  // SW가 HTML 을 캐시하면, 사용자는 JS 청크 다운로드/하이드레이션을 기다리지 않고
  // HTML 파싱 직후 콘텐츠를 본다. iOS PWA 의 /_next/static/ 청크 evict 로 인한
  // 3.5초 mount-갭을 사용자 가시 시간에서 제거.
  // familyTime ChatRoom 은 빈 배열을 넘기지만 그쪽 JS 번들이 작아 가능. somalog 는
  // 청크가 더 무거우므로 SSR 데이터 박기로 보완한다.
  const userId = user?.id ?? null;
  const initialData = userId ? await getHomeInitialData(userId) : null;

  return (
    <HomeContainer
      userId={userId}
      initialDisplayName={displayName}
      initialData={initialData}
    />
  );
}
