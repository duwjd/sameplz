// Test-only login for e2e (local / CI Supabase only; real OAuth never runs in tests).
// Creates a password user through the Admin API, signs in with @supabase/ssr's own server client
// in Node, and copies the exact cookies it would set into the browser context.
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";

interface LocalEnv {
  url: string;
  publishableKey: string;
  secretKey: string;
}

let cached: LocalEnv | null = null;

/** CI exports these; locally they come from `supabase status` (never from .env files). */
export function localSupabaseEnv(): LocalEnv {
  if (cached) return cached;
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) {
    const out = execSync("supabase status -o env", { encoding: "utf8" });
    const env = Object.fromEntries(
      out
        .split("\n")
        .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
        .filter((m): m is RegExpMatchArray => Boolean(m))
        .map((m) => [m[1], m[2]]),
    );
    url = env.API_URL;
    publishableKey = env.PUBLISHABLE_KEY ?? env.ANON_KEY;
    secretKey = env.SECRET_KEY ?? env.SERVICE_ROLE_KEY;
  }
  const host = new URL(url!).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`e2e auth fixture refuses non-local Supabase: ${host}`);
  }
  cached = {
    url: url!,
    publishableKey: publishableKey!,
    secretKey: secretKey!,
  };
  return cached;
}

export interface TestUser {
  id: string;
  email: string;
  nickname: string;
}

type ServerClient = ReturnType<typeof createServerClient>;

/** Sign in with @supabase/ssr in Node and copy the exact cookies it sets into the browser. */
async function signInAndCopyCookies(
  context: BrowserContext,
  email: string,
  password: string,
  baseURL?: string,
  afterSignIn?: (supabase: ServerClient) => Promise<void>,
) {
  const env = localSupabaseEnv();
  const jar = new Map<string, string>();
  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) =>
        cookies.forEach(({ name, value }) =>
          value ? jar.set(name, value) : jar.delete(name),
        ),
    },
  });
  const signedIn = await supabase.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  if (afterSignIn) await afterSignIn(supabase);

  const base = new URL(
    baseURL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  );
  await context.addCookies(
    [...jar].map(([name, value]) => ({
      name,
      value,
      domain: base.hostname,
      path: "/",
      httpOnly: false,
      sameSite: "Lax" as const,
    })),
  );
}

/** Fresh user; signup unfinished unless `completeSignup` (terms + 18+ recorded via the real RPC). */
export async function loginAsNewUser(
  context: BrowserContext,
  opts: { nickname?: string; completeSignup?: boolean; baseURL?: string } = {},
): Promise<TestUser> {
  const env = localSupabaseEnv();
  const email = `e2e-${randomUUID().slice(0, 8)}@sameplz.test`;
  const password = randomUUID();
  const nickname = opts.nickname ?? "테스트회원";

  const admin = createClient(env.url, env.secretKey, {
    auth: { persistSession: false },
  });
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: nickname },
  });
  if (created.error || !created.data.user)
    throw created.error ?? new Error("createUser failed");

  await signInAndCopyCookies(
    context,
    email,
    password,
    opts.baseURL,
    opts.completeSignup
      ? async (supabase) => {
          const { error } = await supabase.rpc("accept_signup_terms", {
            p_terms_version: "2026-10-v1",
          });
          if (error) throw error;
        }
      : undefined,
  );
  return { id: created.data.user.id, email, nickname };
}

/** Seed users (supabase/seed.sql). They have no password; the fixture sets a throwaway one. */
export const SEED_USERS = {
  jiwoo: { id: "00000000-0000-0000-0000-000000000001", email: "jiwoo@sameplz.test" },
  sangse: { id: "00000000-0000-0000-0000-000000000002", email: "sangse@sameplz.test" },
} as const;

/** Sign the browser in as a seed user (local Supabase only). */
export async function loginAsSeedUser(
  context: BrowserContext,
  who: keyof typeof SEED_USERS,
  opts: { baseURL?: string } = {},
) {
  const env = localSupabaseEnv();
  const { id, email } = SEED_USERS[who];
  const password = randomUUID();
  const admin = createClient(env.url, env.secretKey, {
    auth: { persistSession: false },
  });
  const updated = await admin.auth.admin.updateUserById(id, { password });
  if (updated.error) throw updated.error;
  await signInAndCopyCookies(context, email, password, opts.baseURL);
}
