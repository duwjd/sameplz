import * as React from "react";

/* SAMEPLZ Switch — toggle. Sizes sm(32×18), md(40×24), lg(52×32). rounded track. */

/**
 * Boolean toggle switch.
 * @startingPoint section="Forms" subtitle="Switch — on/off toggle, 3 sizes" viewport="700x100"
 */
export interface SwitchProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  checked?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  label?: React.ReactNode;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SIZES: Record<
  NonNullable<SwitchProps["size"]>,
  { w: number; h: number; thumb: number }
> = {
  sm: { w: 32, h: 18, thumb: 14 },
  md: { w: 40, h: 24, thumb: 16 },
  lg: { w: 52, h: 32, thumb: 24 },
};

export function Switch({
  checked = false,
  disabled = false,
  size = "md",
  label,
  onChange,
  style = {},
  ...rest
}: SwitchProps) {
  const s = SIZES[size] || SIZES.md;
  const pad = (s.h - s.thumb) / 2;
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontFamily: "var(--sp-font-sans)",
        fontSize: 14,
        color: "var(--sp-fg-normal)",
        userSelect: "none",
        ...style,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        {...rest}
      />
      <span
        aria-hidden="true"
        style={{
          position: "relative",
          width: s.w,
          height: s.h,
          flexShrink: 0,
          borderRadius: 999,
          background: checked ? "var(--sp-bg-primary)" : "var(--sp-gray-300)",
          transition:
            "background var(--sp-duration-default) var(--sp-easing-standard)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: pad,
            left: checked ? s.w - s.thumb - pad : pad,
            width: s.thumb,
            height: s.thumb,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgb(0 0 0 / 20%)",
            transition:
              "left var(--sp-duration-default) var(--sp-easing-standard)",
          }}
        />
      </span>
      {label != null && <span>{label}</span>}
    </label>
  );
}

export default Switch;
