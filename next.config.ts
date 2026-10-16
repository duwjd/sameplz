import type { NextConfig } from "next";

// Security headers on every response. The CSP has no nonce: Cache Components prerenders static shells
// that cannot carry a per-request nonce (Next CSP guide), and the UI uses inline styles — so scripts and
// styles allow 'unsafe-inline', and the policy instead pins every origin the app talks to.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;
const supabaseHttp = supabase ? supabase.origin : "";
const supabaseWs = supabase
  ? `${supabase.protocol === "https:" ? "wss:" : "ws:"}//${supabase.host}`
  : "";
const dev = process.env.NODE_ENV === "development";
// Vercel preview deployments load the feedback toolbar from vercel.live.
const preview = process.env.VERCEL_ENV === "preview";

// D21: GA4 and Sentry origins are added only when their keys are set (PR O), so the CSP never opens
// an outbound channel the app does not use.
const gaOn = Boolean(process.env.NEXT_PUBLIC_GA_ID);
const ga = gaOn ? ["https://www.googletagmanager.com"] : [];
const gaConnect = gaOn
  ? [
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
      "https://www.googletagmanager.com",
    ]
  : [];
const sentry = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? ["https://*.ingest.sentry.io", "https://*.ingest.us.sentry.io"]
  : [];
// OAuth avatars (Google, Kakao, Naver) shown as profile pictures.
const avatars = [
  "https://*.googleusercontent.com",
  "https://*.kakaocdn.net",
  "https://*.pstatic.net",
];
const vercelLive = preview
  ? ["https://vercel.live", "https://*.pusher.com"]
  : [];

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} ${[...ga, ...vercelLive].join(" ")}`,
  `style-src 'self' 'unsafe-inline'${preview ? " https://vercel.live" : ""}`,
  `img-src 'self' data: blob: ${[supabaseHttp, ...avatars, ...gaConnect, ...vercelLive].join(" ")}`,
  `media-src 'self' blob: ${supabaseHttp}`,
  "font-src 'self' data:",
  `connect-src 'self' ${[supabaseHttp, supabaseWs, ...gaConnect, ...sentry, ...vercelLive, ...(preview ? ["wss://*.pusher.com"] : [])].join(" ")}`,
  `frame-src ${preview ? "https://vercel.live" : "'none'"}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Not against a local http Supabase (dev, e2e), where upgrading would break every request.
  ...(supabase?.protocol === "https:" ? ["upgrade-insecure-requests"] : []),
]
  .map((d) => d.replace(/\s+/g, " ").trim())
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
