"use client";
// F7-2: guests on any /my screen are asked to log in and come back to the same screen.
import { useAuth } from "@/components/auth/AuthProvider";
import { Button, EmptyState } from "@/components/ds";

export function MyGuest({
  next,
  title = "로그인하면 마이페이지를 볼 수 있어요",
}: {
  next: string;
  title?: string;
}) {
  const { requireLogin } = useAuth();
  return (
    <EmptyState
      icon="LockOutlineIcon"
      title={title}
      description="받은 레시피, 크레딧, 알림, 내 활동을 한곳에서 봐요."
      actions={
        <Button onClick={() => requireLogin({ next })}>로그인하기</Button>
      }
    />
  );
}
