"use client";
// URL-driven market controls (MKT-02~05). The server computes every target href; these
// components only navigate, so results stay server-rendered.
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Chip, SegmentedControl } from "@/components/ds";

export interface ChipLink {
  label: string;
  href: string;
  selected?: boolean;
  count?: number;
}

export function ChipGroup({
  label,
  chips,
}: {
  label: string;
  chips: ChipLink[];
}) {
  const router = useRouter();
  return (
    <div
      role="group"
      aria-label={label}
      style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
    >
      {chips.map((c) => (
        <Chip
          key={c.href + c.label}
          size="sm"
          selected={c.selected}
          count={c.count}
          onClick={() => router.push(c.href, { scroll: false })}
        >
          {c.label}
        </Chip>
      ))}
    </div>
  );
}

export interface AppliedChip {
  label: string;
  removeHref: string;
}

/** MKT-04: each chip removes only its own condition. */
export function AppliedChips({
  chips,
  clearHref,
}: {
  chips: AppliedChip[];
  clearHref: string;
}) {
  const router = useRouter();
  if (chips.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-hint)" }}>
        적용된 필터 없음
      </p>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
      }}
    >
      {chips.map((c) => (
        <Chip
          key={c.label}
          size="sm"
          selected
          removeLabel={`${c.label} 해제`}
          onRemove={() => router.push(c.removeHref, { scroll: false })}
        >
          {c.label}
        </Chip>
      ))}
      <a
        href={clearHref}
        onClick={(e) => {
          e.preventDefault();
          router.push(clearHref, { scroll: false });
        }}
        style={{ fontSize: 13, fontWeight: 600 }}
      >
        모두 해제
      </a>
    </div>
  );
}

/** MKT-03 sort. */
export function SortControl({
  value,
  options,
}: {
  value: string;
  options: { value: string; label: string; href: string }[];
}) {
  const router = useRouter();
  return (
    <div role="group" aria-label="정렬">
      <SegmentedControl
        size="sm"
        value={value}
        items={options.map(({ value: v, label }) => ({ value: v, label }))}
        onChange={(v) => {
          const target = options.find((o) => o.value === v);
          if (target) router.push(target.href, { scroll: false });
        }}
      />
    </div>
  );
}

/** Mobile: filters collapse behind 「필터 (n)」 (MKT-02 EX). Desktop: always open. */
export function FilterPanel({
  title,
  activeCount,
  children,
}: {
  title: string;
  activeCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <aside aria-label={title} className="w-full md:w-60 md:shrink-0">
      <button
        type="button"
        className="md:hidden"
        aria-expanded={open}
        aria-controls="market-filters"
        onClick={() => setOpen((v) => !v)}
        style={{
          height: 36,
          padding: "0 14px",
          borderRadius: 8,
          border: "1px solid var(--sp-border-normal)",
          background: "var(--sp-bg-surface)",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {activeCount > 0 ? `필터 (${activeCount})` : "필터"}
      </button>
      <div
        id="market-filters"
        className={open ? "mt-3 block md:mt-0" : "hidden md:block"}
      >
        {children}
      </div>
    </aside>
  );
}

export function LinkButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(href, { scroll: false })}
      style={{
        height: 32,
        padding: "0 12px",
        borderRadius: 8,
        border: "1px solid var(--sp-border-normal)",
        background: "var(--sp-bg-surface)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
