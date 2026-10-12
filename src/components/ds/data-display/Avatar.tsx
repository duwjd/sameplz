import * as React from "react";

/* SAMEPLZ Avatar — user image or initials. Sizes sm/md/lg/xl, shape circle
   or rounded-square. Falls back to initials, then a neutral placeholder. */

/** User avatar — image, initials fallback, or neutral placeholder. */
export interface AvatarProps {
  src?: string;
  alt?: string;
  /** Used to derive initials when no image. */
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "square";
  style?: React.CSSProperties;
}

type Size = NonNullable<AvatarProps["size"]>;

const SIZES: Record<Size, number> = { sm: 24, md: 32, lg: 40, xl: 48 };
const FONT: Record<Size, number> = { sm: 11, md: 13, lg: 16, xl: 18 };

export function Avatar({
  src,
  alt = "",
  name,
  size = "md",
  shape = "circle",
  style = {},
}: AvatarProps) {
  const box = SIZES[size] || SIZES.md;
  const radius = shape === "circle" ? "50%" : "var(--sp-radius-300)";
  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : null;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: box,
        height: box,
        borderRadius: radius,
        overflow: "hidden",
        background: "var(--sp-bg-secondary)",
        color: "var(--sp-fg-hint)",
        fontFamily: "var(--sp-font-sans)",
        fontSize: FONT[size] || 13,
        fontWeight: 600,
        flexShrink: 0,
        userSelect: "none",
        ...style,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary user image URL, sized by the avatar box.
        <img
          src={src}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : initials ? (
        initials
      ) : (
        <svg
          width={box * 0.6}
          height={box * 0.6}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6v1H4v-1z" />
        </svg>
      )}
    </span>
  );
}

export default Avatar;
