import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MyGuest } from "@/components/my/MyGuest";
import { myCard, MyShell } from "@/components/my/MyShell";
import { getMyNotifications, getMyProfile, getMySummary } from "@/data/account";
import { getMyLibrary } from "@/data/library";
import { getCreditSummary } from "@/data/playground";
import { getViewer } from "@/lib/auth/account";
import { recipeHref } from "@/lib/catalog/card";
import { kstShortDate } from "@/lib/play/copy";

export const metadata: Metadata = {
  title: "마이페이지 · SAMEPLZ",
  robots: { index: false },
};

const tile = {
  ...myCard,
  padding: 16,
  gap: 4,
  textDecoration: "none",
  color: "var(--sp-fg-normal)",
};

async function MyHome() {
  const viewer = await getViewer();
  if (!viewer)
    return (
      <MyShell active="home" title="마이페이지">
        <MyGuest next="/my" />
      </MyShell>
    );
  const [summary, profile, credits, notes, library] = await Promise.all([
    getMySummary(viewer),
    getMyProfile(viewer),
    getCreditSummary(viewer),
    getMyNotifications(3),
    getMyLibrary(),
  ]);
  const recent = [...library]
    .sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))
    .slice(0, 3);
  const badges = { notifications: summary.unread, library: summary.updates };
  const tiles: { label: string; value: string | number; href?: string }[] = [
    { label: "받은 레시피", value: summary.received, href: "/my/library" },
    {
      label: "크레딧",
      value: credits ? `${credits.available}C` : "-",
      href: "/my/credits",
    },
    // No "liked recipes" list in MVP: the count only.
    { label: "좋아요", value: summary.likes },
    {
      label: "팔로잉",
      value: summary.following,
      href: "/my/activity?tab=following",
    },
    { label: "SAME 인증", value: summary.sameCerts, href: "/my/activity" },
  ];
  const isNew = summary.received === 0 && summary.sameCerts === 0;
  return (
    <MyShell active="home" title="마이페이지" badges={badges}>
      <section aria-labelledby="my-profile" style={myCard}>
        <h2
          id="my-profile"
          style={{ margin: 0, fontSize: 18, fontWeight: 700 }}
        >
          {profile?.nickname ?? viewer.nickname}
          <span
            style={{
              marginLeft: 8,
              fontSize: 14,
              fontWeight: 400,
              color: "var(--sp-fg-secondary)",
            }}
          >
            @{profile?.handle ?? viewer.handle}
          </span>
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}>
          {profile?.bio || "소개를 아직 쓰지 않았어요."}
          {profile ? ` · ${kstShortDate(profile.createdAt)} 가입` : ""}
        </p>
        <Link
          href="/my/profile"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--sp-fg-accent)",
          }}
        >
          프로필 편집
        </Link>
      </section>

      <section
        aria-label="내 숫자"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 12,
        }}
      >
        {tiles.map((t) => {
          const body = (
            <>
              <span style={{ fontSize: 13, color: "var(--sp-fg-secondary)" }}>
                {t.label}
              </span>
              <b style={{ fontSize: 22 }}>{t.value}</b>
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} style={tile}>
              {body}
            </Link>
          ) : (
            <div key={t.label} style={tile}>
              {body}
            </div>
          );
        })}
      </section>
      {isNew && (
        <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}>
          마켓에서 레시피를 받고, 따라 만든 결과를 SAME 인증으로 올려 보세요.{" "}
          <Link
            href="/market"
            style={{ color: "var(--sp-fg-accent)", fontWeight: 600 }}
          >
            마켓 둘러보기
          </Link>
        </p>
      )}

      {summary.updates > 0 && (
        <section aria-labelledby="my-updates" style={myCard}>
          <h2
            id="my-updates"
            style={{ margin: 0, fontSize: 16, fontWeight: 700 }}
          >
            업데이트가 있어요
          </h2>
          <p style={{ margin: 0, fontSize: 14 }}>
            받은 레시피 {summary.updates}개에 새 버전이 나왔어요.{" "}
            <Link
              href="/my/library"
              style={{ color: "var(--sp-fg-accent)", fontWeight: 600 }}
            >
              라이브러리에서 업데이트하기
            </Link>
          </p>
        </section>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="my-recent" style={myCard}>
          <h2
            id="my-recent"
            style={{ margin: 0, fontSize: 16, fontWeight: 700 }}
          >
            최근 받은 레시피
          </h2>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {recent.map((r) => (
              <li key={r.entitlementId} style={{ fontSize: 14 }}>
                <Link
                  href={recipeHref(r.publicId)}
                  style={{ color: "var(--sp-fg-normal)" }}
                >
                  {r.title}
                </Link>
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 12,
                    color: "var(--sp-fg-hint)",
                  }}
                >
                  v{r.versionNo} · {kstShortDate(r.claimedAt)} 받음
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/my/library"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--sp-fg-accent)",
            }}
          >
            라이브러리 열기
          </Link>
        </section>
      )}

      <section aria-labelledby="my-seller" style={myCard}>
        <h2 id="my-seller" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          판매자 센터
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}>
          {summary.myRecipes > 0
            ? `올린 레시피 ${summary.myRecipes}개의 반응을 판매자 센터에서 봐요.`
            : "내 프롬프트·스킬·에이전트를 무료로 올려 보세요."}
        </p>
        <Link
          href={summary.myRecipes > 0 ? "/my/seller" : "/my/seller/upload"}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--sp-fg-accent)",
          }}
        >
          {summary.myRecipes > 0 ? "판매자 센터 열기" : "레시피 올리기"}
        </Link>
      </section>

      <section aria-labelledby="my-notes" style={myCard}>
        <h2 id="my-notes" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
          최근 알림
        </h2>
        {notes.length === 0 ? (
          <p
            style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}
          >
            아직 알림이 없어요.
          </p>
        ) : (
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {notes.map((n) => (
              <li key={n.id} style={{ fontSize: 14 }}>
                <Link href={n.href} style={{ color: "var(--sp-fg-normal)" }}>
                  {n.title}
                </Link>
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 12,
                    color: "var(--sp-fg-hint)",
                  }}
                >
                  {kstShortDate(n.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/my/notifications"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--sp-fg-accent)",
          }}
        >
          알림 모두 보기
        </Link>
      </section>
    </MyShell>
  );
}

export default function MyPage() {
  return (
    <Suspense fallback={<div aria-hidden="true" style={{ height: 480 }} />}>
      <MyHome />
    </Suspense>
  );
}
