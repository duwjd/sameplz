import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/ds";
import { MarkNotificationsRead } from "@/components/my/MarkNotificationsRead";
import { MyGuest } from "@/components/my/MyGuest";
import { MyShell } from "@/components/my/MyShell";
import { getMyNotifications, getMySummary } from "@/data/account";
import { getViewer } from "@/lib/auth/account";
import { kstDateTime } from "@/lib/play/copy";

export const metadata: Metadata = {
  title: "알림 · SAMEPLZ",
  robots: { index: false },
};

async function Notifications() {
  const viewer = await getViewer();
  if (!viewer)
    return (
      <MyShell active="notifications" title="알림">
        <MyGuest
          next="/my/notifications"
          title="로그인하면 알림을 볼 수 있어요"
        />
      </MyShell>
    );
  const [list, summary] = await Promise.all([
    getMyNotifications(50),
    getMySummary(viewer),
  ]);
  const unread = list.filter((n) => !n.read).length;
  return (
    <MyShell
      active="notifications"
      title="알림"
      description="놓친 변화를 모아요. 누르면 그 화면으로 가요."
      badges={{ library: summary.updates }}
    >
      <MarkNotificationsRead unread={unread} />
      {list.length === 0 ? (
        <EmptyState
          icon="BellOnOutlineIcon"
          title="아직 알림이 없어요"
          description="레시피를 받거나 올리면 새 버전·SAME 인증·사람 확인 결과를 여기서 알려 드려요."
        />
      ) : (
        <ul
          aria-label="알림 목록"
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {list.map((n) => (
            <li
              key={n.id}
              style={{ borderBottom: "1px solid var(--sp-border-normal)" }}
            >
              <Link
                href={n.href}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: "12px 4px",
                  textDecoration: "none",
                  color: "var(--sp-fg-normal)",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: n.read ? 400 : 700 }}>
                  {!n.read && <span className="sr-only">새 알림 · </span>}
                  {n.title}
                </span>
                {n.body && (
                  <span
                    style={{ fontSize: 13, color: "var(--sp-fg-secondary)" }}
                  >
                    {n.body}
                  </span>
                )}
                <span style={{ fontSize: 12, color: "var(--sp-fg-hint)" }}>
                  {kstDateTime(n.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </MyShell>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div aria-hidden="true" style={{ height: 480 }} />}>
      <Notifications />
    </Suspense>
  );
}
