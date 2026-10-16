"use client";
// Last-resort error screen (the root layout itself failed). Reports once to Sentry when configured.
import { useEffect } from "react";
import { captureError } from "@/lib/ops/sentry";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void captureError(
      {
        error,
        source: "client",
        path: window.location.pathname,
        tags: { boundary: "global" },
      },
      process.env.NEXT_PUBLIC_SENTRY_DSN,
    );
  }, [error]);
  return (
    <html lang="ko">
      <body style={{ fontFamily: "sans-serif", padding: 32, lineHeight: 1.6 }}>
        <h1 style={{ fontSize: 22 }}>잠시 문제가 생겼어요</h1>
        <p>
          화면을 불러오지 못했어요. 다시 시도해도 같으면 잠시 뒤에 다시 들어와
          주세요.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{ padding: "8px 16px", fontSize: 15 }}
        >
          다시 시도하기
        </button>
      </body>
    </html>
  );
}
