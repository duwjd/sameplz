"use client";
// PLAY EX playGate: guests see the playground pitch and log in first.
import { useAuth } from "@/components/auth/AuthProvider";
import { Button, EmptyState } from "@/components/ds";

export function PlayGuest({ next = "/play" }: { next?: string }) {
  const { requireLogin } = useAuth();
  return (
    <EmptyState
      icon="MagicWandIcon"
      title="로그인하면 바로 만들어 볼 수 있어요"
      description="가입하면 매달 무료 크레딧이 들어와요. 받은 레시피나 내 프롬프트로 모델 3개까지 나란히 비교해요."
      actions={<Button onClick={() => requireLogin({ next })}>로그인하기</Button>}
    />
  );
}
