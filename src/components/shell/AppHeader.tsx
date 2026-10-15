"use client";
import Link from "next/link";
// GNB wired to real routes. Login / account actions arrive with the login popup task.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/actions/auth";
import { useAuth } from "@/components/auth/AuthProvider";
import { SiteHeader, type SiteHeaderActive } from "@/components/ds";
import { createClient } from "@/lib/supabase/client";

const ROUTES: Record<string, string> = {
  home: "/",
  gallery: "/gallery",
  market: "/market",
  play: "/play",
  prompt: "/market/prompts",
  agent: "/market/agents",
  skill: "/market/skills",
  collection: "/market/collections",
};

export function activeFor(pathname: string): SiteHeaderActive {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/gallery")) return "gallery";
  if (pathname.startsWith("/play")) return "play";
  if (pathname.startsWith("/market/prompts")) return "prompt";
  if (pathname.startsWith("/market/agents")) return "agent";
  if (pathname.startsWith("/market/skills")) return "skill";
  if (pathname.startsWith("/market/collections")) return "collection";
  if (pathname.startsWith("/market") || pathname.startsWith("/r/"))
    return "market";
  // Account pages (/my/*) and others: no main-menu item is current.
  return "" as SiteHeaderActive;
}

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { viewer, requireLogin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [credits, setCredits] = useState(0);
  // NOTI-02: unread count, re-read on navigation, on the list being read, and on each new
  // notification broadcast on the private user:{uid} channel (F7-3).
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!viewer) return;
    const supabase = createClient();
    let alive = true;
    const load = () =>
      void supabase.rpc("unread_notification_count").then(({ data }) => {
        if (alive && typeof data === "number") setUnread(data);
      });
    load();
    window.addEventListener("sameplz:notifications", load);
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!alive || !data.user) return;
      await supabase.realtime.setAuth();
      channel = supabase
        .channel(`user:${data.user.id}`, { config: { private: true } })
        .on("broadcast", { event: "notification" }, load)
        .subscribe();
    });
    return () => {
      alive = false;
      window.removeEventListener("sameplz:notifications", load);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [viewer, pathname]);
  // /play announces settled runs so the GNB balance follows without a navigation.
  const [creditsVersion, setCreditsVersion] = useState(0);
  useEffect(() => {
    const bump = () => setCreditsVersion((v) => v + 1);
    window.addEventListener("sameplz:credits", bump);
    return () => window.removeEventListener("sameplz:credits", bump);
  }, []);

  // GNB balance (CRD-01): re-read on navigation, so it follows playground runs.
  useEffect(() => {
    if (!viewer) return;
    let alive = true;
    void createClient()
      .rpc("my_credit_summary")
      .then(({ data }) => {
        const available = (data as { available?: number } | null)?.available;
        if (alive && typeof available === "number") setCredits(available);
      });
    return () => {
      alive = false;
    };
  }, [viewer, pathname, creditsVersion]);

  // Open: focus the first item. Esc (anywhere): close and return focus to the account button.
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      wrapRef.current
        ?.querySelector<HTMLElement>('button[aria-label="마이페이지"]')
        ?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <SiteHeader
        user={
          viewer
            ? { name: viewer.nickname, avatar: viewer.avatarUrl ?? undefined }
            : null
        }
        active={activeFor(pathname)}
        onNavigate={(key) => router.push(ROUTES[key] ?? "/")}
        onSearch={(q) => {
          const term = q.trim();
          // F1-4: GNB search always searches the whole market and stays as a chip there.
          router.push(
            term ? `/market?q=${encodeURIComponent(term)}` : "/market",
          );
        }}
        onLogin={() => requireLogin()}
        onAccount={() => setMenuOpen((v) => !v)}
        credits={viewer ? credits : 0}
        onCredits={() => router.push("/my/credits")}
        notifications={viewer ? unread : 0}
        onNotifications={() => router.push("/my/notifications")}
      />
      {viewer && menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="계정"
          style={{
            position: "absolute",
            top: 64,
            right: 24,
            zIndex: 90,
            minWidth: 180,
            padding: 8,
            borderRadius: 12,
            background: "var(--sp-bg-surface)",
            border: "1px solid var(--sp-border-normal)",
            boxShadow: "var(--sp-shadow-md)",
          }}
        >
          <p
            style={{
              margin: "4px 8px 8px",
              fontSize: 13,
              color: "var(--sp-fg-hint)",
            }}
          >
            {viewer.nickname}님
          </p>
          <Link
            href="/my"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              height: 36,
              padding: "0 8px",
              borderRadius: 8,
              fontSize: 14,
              color: "var(--sp-fg-normal)",
              textDecoration: "none",
            }}
          >
            마이페이지
          </Link>
          <Link
            href="/my/library"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              height: 36,
              padding: "0 8px",
              borderRadius: 8,
              fontSize: 14,
              color: "var(--sp-fg-normal)",
              textDecoration: "none",
            }}
          >
            라이브러리
          </Link>
          <Link
            href="/my/credits"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              height: 36,
              padding: "0 8px",
              borderRadius: 8,
              fontSize: 14,
              color: "var(--sp-fg-normal)",
              textDecoration: "none",
            }}
          >
            크레딧
          </Link>
          <Link
            href="/my/seller/upload"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              height: 36,
              padding: "0 8px",
              borderRadius: 8,
              fontSize: 14,
              color: "var(--sp-fg-normal)",
              textDecoration: "none",
            }}
          >
            레시피 올리기
          </Link>
          <Link
            href="/my/seller"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              height: 36,
              padding: "0 8px",
              borderRadius: 8,
              fontSize: 14,
              color: "var(--sp-fg-normal)",
              textDecoration: "none",
            }}
          >
            판매자 센터
          </Link>
          <form action={signOut.bind(null, pathname)}>
            <button
              type="submit"
              role="menuitem"
              style={{
                width: "100%",
                height: 36,
                textAlign: "left",
                padding: "0 8px",
                border: "none",
                borderRadius: 8,
                background: "transparent",
                fontSize: 14,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              로그아웃
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Prerender fallback (no pathname yet): same header, no active tab, inert controls. */
export function AppHeaderFallback() {
  return <SiteHeader user={null} active={"" as SiteHeaderActive} />;
}
