'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin Area Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-sm text-center">
        <div className="mx-auto w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-rose-600" />
        </div>
        
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
          접근 권한이 없습니다
        </h2>
        
        <p className="text-muted-foreground mb-8">
          {error.message === 'Unauthorized' 
            ? '로그인이 필요합니다.' 
            : '이 페이지에 접근할 수 있는 관리자 권한이 없습니다.'}
        </p>
        
        <div className="flex flex-col gap-3">
          <Link 
            href="/home" 
            className="w-full bg-navy text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center hover:bg-navy/90 transition-colors"
          >
            앱으로 돌아가기
          </Link>
          
          <button
            onClick={() => reset()}
            className="text-sm font-medium text-muted-foreground hover:text-foreground mt-2"
          >
            다시 시도하기
          </button>
        </div>
      </div>
    </div>
  );
}
