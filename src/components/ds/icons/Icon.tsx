import type { SVGProps } from "react";
import { icons } from "./icon-data";

export type IconName = keyof typeof icons;

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number | string;
}

/** Vapor glyph on a 16px grid. Paints with currentColor — set color via CSS. */
export function Icon({ name, size, ...rest }: IconProps) {
  const d = icons[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox={d.viewBox}
      fill="none"
      aria-hidden={rest["aria-label"] ? undefined : true}
      // body strings are generated <path> geometry from icon-data.ts, never user input.
      dangerouslySetInnerHTML={{ __html: d.body }}
      {...rest}
    />
  );
}

export default Icon;
