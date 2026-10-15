import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountView } from "@/components/my/AccountView";
import { MyGuest } from "@/components/my/MyGuest";
import { MyShell } from "@/components/my/MyShell";
import { getMyLoginMethods, getMySummary, getNotificationSettings } from "@/data/account";
import { getCreditSummary } from "@/data/playground";
import { getViewer } from "@/lib/auth/account";

export const metadata: Metadata = { title: "계정·알림 설정 · SAMEPLZ", robots: { index: false } };

async function Account() {
  const viewer = await getViewer();
  if (!viewer)
    return (
      <MyShell active="account" title="계정·알림 설정">
        <MyGuest next="/my/account" title="로그인하면 계정을 관리할 수 있어요" />
      </MyShell>
    );
  const [methods, settings, summary, credits] = await Promise.all([
    getMyLoginMethods(),
    getNotificationSettings(),
    getMySummary(viewer),
    getCreditSummary(viewer),
  ]);
  return (
    <MyShell
      active="account"
      title="계정·알림 설정"
      badges={{ notifications: summary.unread, library: summary.updates }}
    >
      <AccountView methods={methods} settings={settings} credits={credits?.available ?? 0} />
    </MyShell>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div aria-hidden="true" style={{ height: 480 }} />}>
      <Account />
    </Suspense>
  );
}
