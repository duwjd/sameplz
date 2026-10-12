"use client";

import * as React from "react";
import { Icon, type IconName } from "@/components/ds/icons/Icon";

/* SAMEPLZ Accordion — collapsible disclosure sections (from the SAMEPLZ
   NavigationMenu.Collapsible pattern). Compose AccordionItem children.
   `multiple` allows more than one open at once. */

/**
 * Collapsible disclosure sections. Compose AccordionItem children (give each a
 * unique `id`). `multiple` allows several open at once; `defaultOpen` seeds ids.
 */
export interface AccordionProps {
  multiple?: boolean;
  defaultOpen?: string[];
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export interface AccordionItemProps {
  id: string;
  title?: React.ReactNode;
  icon?: IconName;
  last?: boolean;
  children?: React.ReactNode;
}

interface AccordionContextValue {
  open: Set<string>;
  toggle: (id: string) => void;
}

const Ctx = React.createContext<AccordionContextValue | null>(null);

export function Accordion({
  multiple = false,
  defaultOpen = [],
  children,
  style = {},
}: AccordionProps) {
  const [open, setOpen] = React.useState<Set<string>>(new Set(defaultOpen));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set<string>(multiple ? prev : []);
      if (prev.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  return (
    <Ctx.Provider value={{ open, toggle }}>
      <div
        style={{
          border: "1px solid var(--sp-border-normal)",
          borderRadius: "var(--sp-radius-400)",
          overflow: "hidden",
          fontFamily: "var(--sp-font-sans)",
          ...style,
        }}
      >
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function AccordionItem({
  id,
  title,
  icon,
  children,
  last = false,
}: AccordionItemProps) {
  const { open, toggle } = React.useContext(Ctx) || {
    open: new Set<string>(),
    toggle: () => {},
  };
  const isOpen = open.has(id);
  return (
    <div
      style={{
        borderBottom: last ? "none" : "1px solid var(--sp-border-secondary)",
      }}
    >
      <button
        type="button"
        onClick={() => toggle(id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "14px 16px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontFamily: "var(--sp-font-sans)",
          fontSize: 15,
          fontWeight: 600,
          color: "var(--sp-fg-normal)",
          textAlign: "left",
          outline: "none",
        }}
      >
        {icon && (
          <Icon name={icon} size={20} style={{ color: "var(--sp-fg-hint)" }} />
        )}
        <span style={{ flex: 1 }}>{title}</span>
        <Icon
          name="ChevronDownOutlineIcon"
          size={18}
          style={{
            color: "var(--sp-fg-hint)",
            transform: isOpen ? "rotate(180deg)" : "none",
            transition:
              "transform var(--sp-duration-default) var(--sp-easing-standard)",
          }}
        />
      </button>
      {isOpen && (
        <div
          style={{
            padding: "0 16px 16px",
            fontSize: 14,
            color: "var(--sp-fg-secondary)",
            lineHeight: 1.6,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default Accordion;
