"use client";
// GNB wired to real routes. Login / account actions arrive with the login popup task.
import { usePathname, useRouter } from "next/navigation";
import { SiteHeader, type SiteHeaderActive } from "@/components/ds";

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
  if (pathname.startsWith("/market")) return "market";
  return "home";
}

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <SiteHeader
      user={null}
      active={activeFor(pathname)}
      onNavigate={(key) => router.push(ROUTES[key] ?? "/")}
      onSearch={(q) => {
        const term = q.trim();
        // F1-4: GNB search always searches the whole market and stays as a chip there.
        router.push(term ? `/market?q=${encodeURIComponent(term)}` : "/market");
      }}
    />
  );
}

/** Prerender fallback (no pathname yet): same header, no active tab, inert controls. */
export function AppHeaderFallback() {
  return <SiteHeader user={null} active={"" as SiteHeaderActive} />;
}
