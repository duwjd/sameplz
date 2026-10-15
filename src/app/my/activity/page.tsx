import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityView, type ActivityTab } from "@/components/my/ActivityView";
import { MyGuest } from "@/components/my/MyGuest";
import { MyShell } from "@/components/my/MyShell";
import { getMyActivity, getMySummary } from "@/data/account";
import { getViewer } from "@/lib/auth/account";

export const metadata: Metadata = { title: "SAME 인증·팔로잉 · SAMEPLZ", robots: { index: false } };

async function Activity({ searchParams }: { searchParams: PageProps<"/my/activity">["searchParams"] }) {
  const sp = await searchParams;
  const tab: ActivityTab = sp.tab === "following" || sp.tab === "reports" ? sp.tab : "same";
  const viewer = await getViewer();
  if (!viewer)
    return (
      <MyShell active="activity" title="SAME 인증·팔로잉">
        <MyGuest next="/my/activity" title="로그인하면 내 활동을 볼 수 있어요" />
      </MyShell>
    );
  const [activity, summary] = await Promise.all([getMyActivity(viewer), getMySummary(viewer)]);
  return (
    <MyShell
      active="activity"
      title="SAME 인증·팔로잉"
      description="내가 올린 SAME 인증, 팔로우한 크리에이터, 신고 내역을 모았어요."
      badges={{ notifications: summary.unread, library: summary.updates }}
    >
      <ActivityView tab={tab} posts={activity.posts} following={activity.following} reports={activity.reports} />
    </MyShell>
  );
}

export default function ActivityPage(props: PageProps<"/my/activity">) {
  return (
    <Suspense fallback={<div aria-hidden="true" style={{ height: 480 }} />}>
      <Activity searchParams={props.searchParams} />
    </Suspense>
  );
}
