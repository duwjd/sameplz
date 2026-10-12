import * as React from "react";

/* SAMEPLZ Logo — gradient symbol (triangle · circle · rounded square · star)
   plus the SAMEPLZ wordmark. variant: lockup | symbol | wordmark.
   `size` is the rendered height in px. Wordmark ink follows --sp-logo-ink
   (#0A0C0E light, #FFFFFF dark) unless `color` is passed. */

/**
 * SAMEPLZ logo. Gradient symbol + wordmark. Use the lockup in the GNB, the symbol alone for
 * favicons/avatars/app icons, the wordmark alone in footers and legal text.
 */
export interface LogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "lockup" | "symbol" | "wordmark";
  /** Rendered height in px. Default 32. */
  size?: number;
  /** Wordmark fill. Default var(--sp-logo-ink). */
  color?: string;
  /** Accessible name. Default "SAMEPLZ". */
  title?: string;
}
export interface LogoSymbolProps {
  size?: number;
  title?: string;
  style?: React.CSSProperties;
}
export interface LogoWordmarkProps {
  size?: number;
  color?: string;
  title?: string;
  style?: React.CSSProperties;
}

type Shape =
  | { circle: true; d?: undefined; g: [number, number, number, number] }
  | { circle?: undefined; d: string; g: [number, number, number, number] };

const WORD =
  "M12.64 34.56C10.3467 34.56 8.13333 34.28 6 33.72C3.89333 33.1333 2.17333 32.3867 0.84 31.48L3.44 25.64C4.69333 26.44 6.13333 27.1067 7.76 27.64C9.41333 28.1467 11.0533 28.4 12.68 28.4C13.7733 28.4 14.6533 28.3067 15.32 28.12C15.9867 27.9067 16.4667 27.64 16.76 27.32C17.08 26.9733 17.24 26.5733 17.24 26.12C17.24 25.48 16.9467 24.9733 16.36 24.6C15.7733 24.2267 15.0133 23.92 14.08 23.68C13.1467 23.44 12.1067 23.2 10.96 22.96C9.84 22.72 8.70667 22.4133 7.56 22.04C6.44 21.6667 5.41333 21.1867 4.48 20.6C3.54667 19.9867 2.78667 19.2 2.2 18.24C1.61333 17.2533 1.32 16.0133 1.32 14.52C1.32 12.84 1.77333 11.32 2.68 9.96C3.61333 8.6 5 7.50667 6.84 6.68C8.68 5.85333 10.9733 5.44 13.72 5.44C15.56 5.44 17.36 5.65333 19.12 6.08C20.9067 6.48 22.4933 7.08 23.88 7.88L21.44 13.76C20.1067 13.04 18.7867 12.5067 17.48 12.16C16.1733 11.7867 14.9067 11.6 13.68 11.6C12.5867 11.6 11.7067 11.72 11.04 11.96C10.3733 12.1733 9.89333 12.4667 9.6 12.84C9.30667 13.2133 9.16 13.64 9.16 14.12C9.16 14.7333 9.44 15.2267 10 15.6C10.5867 15.9467 11.3467 16.24 12.28 16.48C13.24 16.6933 14.28 16.92 15.4 17.16C16.5467 17.4 17.68 17.7067 18.8 18.08C19.9467 18.4267 20.9867 18.9067 21.92 19.52C22.8533 20.1067 23.6 20.8933 24.16 21.88C24.7467 22.84 25.04 24.0533 25.04 25.52C25.04 27.1467 24.5733 28.6533 23.64 30.04C22.7333 31.4 21.36 32.4933 19.52 33.32C17.7067 34.1467 15.4133 34.56 12.64 34.56ZM24.9384 34L37.2984 6H45.0984L57.4984 34H49.2584L39.5784 9.88H42.6984L33.0184 34H24.9384ZM31.6984 28.56L33.7384 22.72H47.4184L49.4584 28.56H31.6984ZM59.3438 34V6H65.8638L77.4638 25.04H74.0238L85.3038 6H91.8238L91.9038 34H84.6238L84.5438 17.08H85.7838L77.3438 31.24H73.8238L65.1438 17.08H66.6638V34H59.3438ZM97.1078 34V6H119.068V12.12H104.948V27.88H119.588V34H97.1078ZM104.388 22.76V16.84H117.388V22.76H104.388ZM123.583 34V6H136.383C138.943 6 141.143 6.41333 142.983 7.24C144.849 8.06667 146.289 9.26667 147.303 10.84C148.316 12.3867 148.823 14.2267 148.823 16.36C148.823 18.4667 148.316 20.2933 147.303 21.84C146.289 23.3867 144.849 24.5867 142.983 25.44C141.143 26.2667 138.943 26.68 136.383 26.68H127.983L131.503 23.24V34H123.583ZM131.503 24.08L127.983 20.44H135.903C137.556 20.44 138.783 20.08 139.583 19.36C140.409 18.64 140.823 17.64 140.823 16.36C140.823 15.0533 140.409 14.04 139.583 13.32C138.783 12.6 137.556 12.24 135.903 12.24H127.983L131.503 8.6V24.08ZM152.284 34V6H160.204V27.72H173.564V34H152.284ZM174.898 34V29.04L191.378 9.48L192.338 12.28H175.258V6H199.378V10.96L182.898 30.52L181.938 27.72H199.978V34H174.898Z";
const SHAPES: Shape[] = [
  { circle: true, g: [44.0001, 43.5455, 4.4546, 4] },
  {
    d: "M16.4675 25.8182H9.71429C6.55837 25.8182 4 28.3766 4 31.5325V38.2858C4 41.4417 6.55837 44.0001 9.71429 44.0001H16.4675C19.6234 44.0001 22.1818 41.4417 22.1818 38.2858V31.5325C22.1818 28.3766 19.6234 25.8182 16.4675 25.8182Z",
    g: [44, 44.0001, 4, 4.90915],
  },
  {
    d: "M11.5899 5.81724C12.2379 4.60633 13.9439 4.60633 14.592 5.81724L21.9706 19.6047C22.5921 20.7659 21.7674 22.1818 20.4696 22.1818H5.71224C4.41438 22.1818 3.58971 20.7659 4.21119 19.6047L7.96144 12.5971L11.5899 5.81724Z",
    g: [43.0083, 44.9091, 5.89183, 3.79958],
  },
  {
    d: "M44.0001 25.8182C44.0001 29.1301 43.1138 32.2347 41.5666 34.9091C43.1138 37.5835 44.0001 40.6881 44.0001 44.0001C40.6881 44.0001 37.5835 43.1138 34.9091 41.5666C32.2347 43.1138 29.1301 44.0001 25.8182 44.0001C25.8182 40.6883 26.7037 37.5834 28.2508 34.9091C26.7037 32.2348 25.8182 29.13 25.8182 25.8182C29.13 25.8182 32.2348 26.7037 34.9091 28.2508C37.5834 26.7037 40.6883 25.8182 44.0001 25.8182Z",
    g: [44.6199, 43.7934, 4.90915, 5.36369],
  },
];
const STOPS: [string, number][] = [
  ["#00E6A6", 0],
  ["#6DF08B", 0.5],
  ["#FFEA2E", 1],
];

export function LogoSymbol({ size = 32, title, style = {} }: LogoSymbolProps) {
  const uid = "spg" + React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      <defs>
        {SHAPES.map((s, i) => (
          <linearGradient
            key={i}
            id={uid + i}
            x1={s.g[0]}
            y1={s.g[1]}
            x2={s.g[2]}
            y2={s.g[3]}
            gradientUnits="userSpaceOnUse"
          >
            {STOPS.map(([c, o]) => (
              <stop key={o} offset={o} stopColor={c} />
            ))}
          </linearGradient>
        ))}
      </defs>
      {SHAPES.map((s, i) =>
        s.circle ? (
          <circle
            key={i}
            cx="34.9091"
            cy="13.0909"
            r="9.09091"
            fill={"url(#" + uid + i + ")"}
          />
        ) : (
          <path key={i} d={s.d} fill={"url(#" + uid + i + ")"} />
        ),
      )}
    </svg>
  );
}

export function LogoWordmark({
  size = 24,
  color = "var(--sp-logo-ink)",
  title,
  style = {},
}: LogoWordmarkProps) {
  return (
    <svg
      width={(size * 201) / 40}
      height={size}
      viewBox="0 0 201 40"
      fill="none"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      <path d={WORD} fill={color} />
    </svg>
  );
}

export function Logo({
  variant = "lockup",
  size = 32,
  color,
  title = "SAMEPLZ",
  style = {},
  ...rest
}: LogoProps) {
  if (variant === "symbol")
    return <LogoSymbol size={size} title={title} style={style} />;
  if (variant === "wordmark")
    return (
      <LogoWordmark size={size} color={color} title={title} style={style} />
    );
  return (
    <span
      role="img"
      aria-label={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.25,
        ...style,
      }}
      {...rest}
    >
      <LogoSymbol size={size} />
      <LogoWordmark size={size * 0.625} color={color} />
    </span>
  );
}

export default Logo;
