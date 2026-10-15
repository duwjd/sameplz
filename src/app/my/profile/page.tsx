import type { Metadata } from "next";
import { Suspense } from "react";
import { MyGuest } from "@/components/my/MyGuest";
import { MyShell } from "@/components/my/MyShell";
import { ProfileForm } from "@/components/my/ProfileForm";
import { getMyProfile, getMySummary } from "@/data/account";
import { getReferenceData } from "@/data/catalog";
import { getViewer } from "@/lib/auth/account";

export const metadata: Metadata = { title: "프로필 · SAMEPLZ", robots: { index: false } };

async function Profile() {
  const viewer = await getViewer();
  if (!viewer)
    return (
      <MyShell active="profile" title="프로필">
        <MyGuest next="/my/profile" title="로그인하면 프로필을 고칠 수 있어요" />
      </MyShell>
    );
  const [profile, summary, ref] = await Promise.all([getMyProfile(viewer), getMySummary(viewer), getReferenceData()]);
  return (
    <MyShell
      active="profile"
      title="프로필"
      description="저장하면 레시피·갤러리·메뉴에 바로 보여요."
      badges={{ notifications: summary.unread, library: summary.updates }}
    >
      {profile && <ProfileForm profile={profile} jobs={ref.jobList} />}
    </MyShell>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div aria-hidden="true" style={{ height: 480 }} />}>
      <Profile />
    </Suspense>
  );
}
