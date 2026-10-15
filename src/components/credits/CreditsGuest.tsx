"use client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button, EmptyState } from "@/components/ds";

export function CreditsGuest() {
  const { requireLogin } = useAuth();
  return (
    <EmptyState
      icon="LockOutlineIcon"
      title="로그인하면 크레딧을 볼 수 있어요"
      description="가입하면 매달 무료 크레딧이 들어와요."
      actions={<Button onClick={() => requireLogin({ next: "/my/credits" })}>로그인하기</Button>}
    />
  );
}
