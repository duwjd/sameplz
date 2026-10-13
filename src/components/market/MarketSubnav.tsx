// Mobile-only submenu row under the GNB on market / collection pages (hover menu replacement).
import Link from "next/link";

const ITEMS = [
  { key: "all", label: "전체", href: "/market" },
  { key: "prompt", label: "프롬프트", href: "/market/prompts" },
  { key: "agent", label: "에이전트", href: "/market/agents" },
  { key: "skill", label: "스킬", href: "/market/skills" },
  { key: "collection", label: "컬렉션", href: "/market/collections" },
] as const;

export type MarketSubnavKey = (typeof ITEMS)[number]["key"];

export function MarketSubnav({ current }: { current: MarketSubnavKey }) {
  return (
    <nav
      aria-label="마켓 하위 메뉴"
      className="flex md:hidden"
      style={{
        gap: 4,
        overflowX: "auto",
        padding: "8px 16px",
        background: "var(--sp-bg-surface)",
        borderBottom: "1px solid var(--sp-border-normal)",
      }}
    >
      {ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === current ? "page" : undefined}
          style={{
            flexShrink: 0,
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: item.key === current ? 700 : 500,
            color:
              item.key === current
                ? "var(--sp-fg-on-contrast)"
                : "var(--sp-fg-secondary)",
            background:
              item.key === current ? "var(--sp-bg-contrast)" : "transparent",
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
