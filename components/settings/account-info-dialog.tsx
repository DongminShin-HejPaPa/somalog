"use client";

import { useState, useEffect, useActionState } from "react";
import { X } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { updateAccountInfo, type AccountInfoState } from "@/app/actions/account-actions";
import { useKeyboardOffset } from "@/lib/hooks/use-keyboard-offset";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const initial: AccountInfoState = {};

export function AccountInfoDialog({ isOpen, onClose }: Props) {
  const [state, formAction, isPending] = useActionState(updateAccountInfo, initial);
  const keyboardOffset = useKeyboardOffset();

  // 현재 유저 정보 (초기값)
  const [currentName, setCurrentName] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");

  // 다이얼로그 열릴 때 유저 정보 로드
  useEffect(() => {
    if (!isOpen) return;
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentName(
          (data.user.user_metadata?.full_name as string) ??
          (data.user.user_metadata?.name as string) ??
          ""
        );
        setCurrentEmail(data.user.email ?? "");
      }
    });
  }, [isOpen]);

  // 성공 후 2초 뒤 자동 닫기
  useEffect(() => {
    if (state.success) {
      const t = setTimeout(onClose, 2000);
      return () => clearTimeout(t);
    }
  }, [state.success, onClose]);

  // 배경 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 바텀 시트 — marginBottom으로 키보드 위로 밀어올림 */}
      <div
        className="relative bg-white rounded-t-2xl max-h-[90dvh] flex flex-col shadow-xl"
        style={{ marginBottom: keyboardOffset }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border shrink-0">
          <h2 className="text-base font-semibold">개인정보 변경</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="overflow-y-auto flex-1 px-4 py-4">

          {/* 에러 메시지 */}
          {state.error && (
            <div className="mb-4 p-3 rounded-lg bg-coral-light border border-coral/30 text-sm text-coral">
              {state.error}
            </div>
          )}

          {/* 성공 메시지 */}
          {state.success && (
            <div className="mb-4 p-3 rounded-lg bg-success-light border border-success/30 text-sm text-success">
              개인정보가 변경되었습니다.
            </div>
          )}

          {/* 이메일 — 읽기 전용 표시 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">이메일 (변경 불가)</label>
            <div className="w-full h-11 px-3 rounded-lg border border-border bg-secondary text-sm text-muted-foreground flex items-center select-none">
              {currentEmail || <span className="opacity-50">불러오는 중...</span>}
            </div>
          </div>

          {/* key를 사용해 유저 데이터 로드 후 폼 remount → defaultValue 반영 */}
          <form key={currentName} action={formAction} className="flex flex-col gap-4">
            {/* ── 이름 ── */}
            <FieldInput
              name="name"
              type="text"
              label="이름"
              placeholder="홍길동"
              defaultValue={currentName}
              required
            />

            {/* ── 비밀번호 변경 (선택) ── */}
            <div className="flex flex-col gap-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                비밀번호를 변경하려면 아래를 입력해주세요. 변경하지 않으려면 비워두세요.
              </p>
              <FieldInput
                name="password"
                type="password"
                label="새 비밀번호"
                placeholder="6자 이상 입력하세요"
              />
              <FieldInput
                name="passwordConfirm"
                type="password"
                label="비밀번호 확인"
                placeholder="비밀번호를 다시 입력하세요"
              />
            </div>

            <button
              type="submit"
              disabled={isPending || !!state.success}
              className="w-full py-3 rounded-xl bg-navy text-white text-sm font-semibold min-h-[48px] disabled:opacity-60 transition-all active:scale-[0.98]"
            >
              {isPending ? "저장 중..." : state.success ? "저장 완료 ✓" : "변경 저장"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

interface FieldInputProps {
  name: string;
  type: "text" | "email" | "password";
  label: string;
  placeholder: string;
  defaultValue?: string;
  required?: boolean;
}

function FieldInput({ name, type, label, placeholder, defaultValue, required }: FieldInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        autoComplete={type === "password" ? "new-password" : undefined}
        className="w-full h-11 px-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
      />
    </div>
  );
}
