// MY-07: the same menu on every my-page screen, with the library update and unread badges.
import Link from "next/link";
import type { ReactNode } from "react";

export type MyKey =
  | "home"
  | "library"
  | "credits"
  | "notifications"
  | "activity"
  | "seller"
  | "profile"
  | "account";

const MENU: { key: MyKey; href: string; label: string; group: string }[] = [
  { key: "home", href: "/my", label: "마이페이지 홈", group: "내 레시피" },
  {
    key: "library",
    href: "/my/library",
    label: "라이브러리",
    group: "내 레시피",
  },
  { key: "credits", href: "/my/credits", label: "크레딧", group: "내 레시피" },
  {
    key: "notifications",
    href: "/my/notifications",
    label: "알림",
    group: "활동",
  },
  {
    key: "activity",
    href: "/my/activity",
    label: "SAME 인증·팔로잉",
    group: "활동",
  },
  { key: "seller", href: "/my/seller", label: "판매자 센터", group: "판매" },
  { key: "profile", href: "/my/profile", label: "프로필", group: "설정" },
  {
    key: "account",
    href: "/my/account",
    label: "계정·알림 설정",
    group: "설정",
  },
];

export function MyShell({
  active,
  title,
  description,
  badges = {},
  children,
}: {
  active: MyKey;
  title: string;
  description?: string;
  badges?: Partial<Record<MyKey, number>>;
  children: ReactNode;
}) {
  const groups = [...new Set(MENU.map((m) => m.group))];
  return (
    <main
      data-screen-label={`My ${active}`}
      style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "32px 24px 80px",
        color: "var(--sp-fg-normal)",
        fontFamily: "var(--sp-font-sans)",
      }}
    >
      <div className="grid gap-8 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav
          aria-label="마이페이지 메뉴"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          {groups.map((g) => (
            <div
              key={g}
              style={{ display: "flex", flexDirection: "column", gap: 2 }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--sp-fg-hint)",
                  padding: "0 8px",
                }}
              >
                {g}
              </span>
              {MENU.filter((m) => m.group === g).map((m) => {
                const n = badges[m.key] ?? 0;
                return (
                  <Link
                    key={m.key}
                    href={m.href}
                    aria-current={m.key === active ? "page" : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      minHeight: 36,
                      padding: "0 8px",
                      borderRadius: 8,
                      fontSize: 14,
                      textDecoration: "none",
                      color: "var(--sp-fg-normal)",
                      background:
                        m.key === active
                          ? "var(--sp-bg-secondary)"
                          : "transparent",
                      fontWeight: m.key === active ? 700 : 400,
                    }}
                  >
                    {m.label}
                    {n > 0 && (
                      <span
                        aria-label={`${n}개 새로`}
                        style={{
                          marginLeft: "auto",
                          minWidth: 20,
                          height: 20,
                          padding: "0 6px",
                          borderRadius: 999,
                          background: "var(--sp-bg-primary)",
                          color: "var(--sp-fg-on-primary, #fff)",
                          fontSize: 12,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {n > 99 ? "99+" : n}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            minWidth: 0,
          }}
        >
          <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>
              {title}
            </h1>
            {description && (
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "var(--sp-fg-secondary)",
                }}
              >
                {description}
              </p>
            )}
          </header>
          {children}
        </div>
      </div>
    </main>
  );
}

export const myCard = {
  border: "1px solid var(--sp-line-normal)",
  borderRadius: 16,
  padding: 20,
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
};
