"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { Icon } from "@/components/ds/icons/Icon";
import { Button } from "@/components/ds/actions/Button";

/* SAMEPLZ HeroBanner — the home rolling banner. Always renders in the dark
   theme (ink surface) so brand Mint reads as light. Advances every
   `interval` ms; pauses on hover or focus inside; manual prev/next turns
   autoplay off. Users with reduced motion start paused (WCAG 2.2.2).
   Fixed `height` (default 360) on every slide: title and description clamp to
   2 lines each so slides never change the banner's size.
   slides = [{ name, eyebrow, title, description, actions:[{label, primary, onClick}], image, imageLabel }] */

export interface HeroBannerAction {
  label: string;
  primary?: boolean;
  onClick?: () => void;
}

export interface HeroBannerSlide {
  name: string;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: HeroBannerAction[];
  image?: string;
  imageLabel?: string;
}

/**
 * Dark rolling banner. Autoplays every 5s, pauses on hover/focus, manual navigation stops autoplay, reduced motion starts paused. Height is fixed across slides.
 */
export interface HeroBannerProps {
  slides: HeroBannerSlide[];
  interval?: number;
  /** Fixed banner height in px. Default 360. */
  height?: number;
  style?: CSSProperties;
}

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReduce = (cb: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(REDUCE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getReduce = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia(REDUCE_QUERY).matches;
const getReduceServer = () => false;

export function HeroBanner({
  slides = [],
  interval = 5000,
  height = 360,
  style = {},
}: HeroBannerProps) {
  const reduce = useSyncExternalStore(
    subscribeReduce,
    getReduce,
    getReduceServer,
  );
  const [i, setI] = useState(0);
  // null = the user has not toggled yet: autoplay unless reduced motion is preferred.
  const [userPlay, setUserPlay] = useState<boolean | null>(null);
  const play = userPlay ?? !reduce;
  const [hold, setHold] = useState(false);
  const n = slides.length;
  useEffect(() => {
    if (!play || hold || n < 2) return undefined;
    const t = setTimeout(() => setI((v) => (v + 1) % n), interval);
    return () => clearTimeout(t);
  }, [i, play, hold, n, interval]);
  const step = (d: number) => {
    setUserPlay(false);
    setI((v) => (v + d + n) % n);
  };
  const s: Partial<HeroBannerSlide> = slides[i] || {};
  const ctl: CSSProperties = {
    all: "unset",
    cursor: "pointer",
    width: 32,
    height: 32,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#FFFFFF",
    background: "rgba(255,255,255,0.08)",
  };
  return (
    <section
      data-theme="dark"
      aria-roledescription="캐러셀"
      aria-label="주요 소식"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHold(false);
      }}
      style={{
        position: "relative",
        height,
        boxSizing: "border-box",
        borderRadius: 24,
        overflow: "hidden",
        background: "var(--sp-ink)",
        color: "#FFFFFF",
        fontFamily: "var(--sp-font-sans)",
        ...style,
      }}
    >
      <div
        role="group"
        aria-roledescription="배너"
        aria-label={i + 1 + " / " + n + " · " + (s.name || "")}
        aria-live={play ? "off" : "polite"}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
          height: "100%",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            padding: "32px 40px 84px",
            minWidth: 0,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: "auto",
              marginBottom: "auto",
            }}
          >
            {s.eyebrow ? (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                  color: "var(--sp-brand-mint)",
                }}
              >
                {s.eyebrow}
              </span>
            ) : null}
            <h2
              style={{
                margin: 0,
                fontSize: 30,
                lineHeight: 1.3,
                fontWeight: 800,
                letterSpacing: -0.8,
                textWrap: "balance",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {s.title}
            </h2>
            {s.description ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  lineHeight: 1.6,
                  color: "#C5CDC9",
                  maxWidth: 440,
                  textWrap: "pretty",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {s.description}
              </p>
            ) : null}
            {s.actions && s.actions.length ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "nowrap",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                {s.actions.map((a, k) => (
                  <Button
                    key={k}
                    size="lg"
                    color={a.primary ? "primary" : "secondary"}
                    variant={a.primary ? "fill" : "outline"}
                    onClick={a.onClick}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
          <div
            style={{
              position: "absolute",
              left: 40,
              bottom: 28,
              display: "flex",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                style={ctl}
                aria-pressed={!play}
                aria-label={play ? "자동 넘김 멈추기" : "자동 넘김 시작"}
                onClick={() => setUserPlay(!play)}
              >
                <Icon name={play ? "PauseIcon" : "PlayIcon"} size={14} />
              </button>
              <button
                type="button"
                style={ctl}
                aria-label="이전 배너"
                onClick={() => step(-1)}
              >
                <Icon name="ChevronLeftOutlineIcon" size={16} />
              </button>
              <span
                style={{
                  fontFamily: "var(--sp-font-code)",
                  fontSize: 12,
                  color: "#C5CDC9",
                  minWidth: 40,
                  textAlign: "center",
                }}
              >
                {i + 1} / {n}
              </span>
              <button
                type="button"
                style={ctl}
                aria-label="다음 배너"
                onClick={() => step(1)}
              >
                <Icon name="ChevronRightOutlineIcon" size={16} />
              </button>
            </div>
          </div>
        </div>
        <div
          style={{ position: "relative", background: "rgba(255,255,255,0.04)" }}
        >
          {s.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- banner art; kept identical to the design source
            <img
              src={s.image}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                alignItems: "center",
                justifyContent: "center",
                color: "#7A847F",
                fontSize: 13,
              }}
            >
              <Icon name="ImageOutlineIcon" size={28} />
              {s.imageLabel || "배너 이미지"}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

export default HeroBanner;
