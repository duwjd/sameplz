"use client";
// AGT-03: the creator's real run log. Fully rendered in HTML (readable without JS, indexable);
// 「예시 실행 보기」 replays it line by line. Reduced motion → no animation, lines stay as they are.
import { useEffect, useRef, useState } from "react";
import { Button, Icon } from "@/components/ds";

const STEP_MS = 600;

export function SampleRunLog({ lines }: { lines: string[] }) {
  const [shown, setShown] = useState(lines.length);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
    },
    [],
  );

  const play = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(lines.length);
      return;
    }
    if (timer.current) window.clearInterval(timer.current);
    setShown(1);
    setPlaying(true);
    timer.current = window.setInterval(() => {
      setShown((n) => {
        if (n + 1 >= lines.length) {
          if (timer.current) window.clearInterval(timer.current);
          timer.current = null;
          setPlaying(false);
          return lines.length;
        }
        return n + 1;
      });
    }, STEP_MS);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Button
        size="sm"
        variant="outline"
        onClick={play}
        disabled={playing}
        startIcon={<Icon name="PlayOutlineIcon" />}
        style={{ alignSelf: "flex-start" }}
      >
        {playing ? "재생하고 있어요" : "예시 실행 보기"}
      </Button>
      <ol
        aria-label="예시 실행 기록"
        aria-live={playing ? "polite" : undefined}
        style={{
          margin: 0,
          padding: 16,
          listStyle: "none",
          borderRadius: 12,
          background: "var(--sp-bg-secondary)",
          fontFamily: "var(--sp-font-code)",
          fontSize: 13,
          lineHeight: 1.8,
          color: "var(--sp-fg-normal)",
          minHeight: lines.length * 23 + 32,
        }}
      >
        {lines.slice(0, shown).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </div>
  );
}
