// Local load test (runbook 10 「용량 기준」). No dependencies: Node 22 fetch.
//   node scripts/load/run.mjs read  [--base http://localhost:3000] [--concurrency 20] [--seconds 60]
//   node scripts/load/run.mjs play  [--base http://localhost:3000] [--users 10] [--runs 3]
// `play` needs a local prod build with GENERATION_PROVIDER=mock and local Supabase (it creates test
// members through the local admin API). Refuses anything that is not localhost.
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(3).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const mode = process.argv[2] ?? "read";
const base = args.base ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  console.error("Refusing a non-local target:", base);
  process.exit(1);
}

const pct = (xs, p) => xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] : 0;
function summary(name, times, statuses) {
  const by = {};
  for (const s of statuses) by[s] = (by[s] ?? 0) + 1;
  const errors = statuses.filter((s) => s >= 500 || s === 0).length;
  console.log(
    `${name}: ${times.length} req · p50 ${pct(times, 50)}ms · p95 ${pct(times, 95)}ms · max ${Math.max(0, ...times)}ms · ` +
      `5xx/net ${errors} (${((errors / Math.max(1, statuses.length)) * 100).toFixed(1)}%) · status ${JSON.stringify(by)}`,
  );
}

async function timed(url, init) {
  const t = performance.now();
  try {
    const r = await fetch(url, { ...init, redirect: "manual" });
    await r.arrayBuffer();
    return [Math.round(performance.now() - t), r.status];
  } catch {
    return [Math.round(performance.now() - t), 0];
  }
}

async function read() {
  const concurrency = Number(args.concurrency ?? 20);
  const seconds = Number(args.seconds ?? 60);
  const paths = ["/", "/market", "/market/prompts", "/gallery", "/r/rdetailcopy", "/r/rcafetone01", "/guide"];
  const end = Date.now() + seconds * 1000;
  const times = [];
  const statuses = [];
  await Promise.all(
    Array.from({ length: concurrency }, async (_, w) => {
      for (let i = w; Date.now() < end; i++) {
        const [ms, st] = await timed(base + paths[i % paths.length]);
        times.push(ms);
        statuses.push(st);
      }
    }),
  );
  summary(`read c=${concurrency} ${seconds}s`, times, statuses);
}

function localEnv() {
  const out = execSync("supabase status -o env", { encoding: "utf8" });
  const env = Object.fromEntries(
    out.split("\n").map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]),
  );
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(env.API_URL ?? "")) {
    console.error("Refusing a non-local Supabase:", env.API_URL);
    process.exit(1);
  }
  return { url: env.API_URL, anon: env.PUBLISHABLE_KEY ?? env.ANON_KEY, secret: env.SECRET_KEY ?? env.SERVICE_ROLE_KEY };
}

async function rest(env, path, body, key = env.secret) {
  const r = await fetch(`${env.url}${path}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

/** A signed-in member: password user + terms + credits + AI notice, cookies in @supabase/ssr format. */
async function member(env) {
  const email = `load-${randomUUID().slice(0, 8)}@sameplz.test`;
  const password = randomUUID();
  const created = await rest(env, "/auth/v1/admin/users", { email, password, email_confirm: true });
  const id = created.id;
  const session = await rest(env, "/auth/v1/token?grant_type=password", { email, password }, env.anon);
  const headers = { apikey: env.secret, Authorization: `Bearer ${env.secret}`, "Content-Type": "application/json" };
  await fetch(`${env.url}/rest/v1/profiles?id=eq.${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ terms_version: "2026-10-v1", terms_accepted_at: new Date().toISOString(), adult_confirmed_at: new Date().toISOString(), ai_notice_ack_at: new Date().toISOString() }),
  });
  await rest(env, "/rest/v1/rpc/complete_signup_credits", { p_user: id, p_device_hash: null, p_ip_hash: null });
  const ref = new URL(env.url).hostname.split(".")[0];
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  return { id, cookie: `sb-${ref}-auth-token=${value}` };
}

async function play() {
  const env = localEnv();
  const users = Number(args.users ?? 10);
  const runs = Number(args.runs ?? 3);
  const members = await Promise.all(Array.from({ length: users }, () => member(env)));
  const times = [];
  const statuses = [];
  const reasons = {};
  // Three result cells of the cheapest image model (11C each = 33C a run; 3 runs stay under 135C/day),
  // the request shape the UI sends (e2e/fixtures/play.ts runBody).
  const cells = [{ model: "gpt-image-2.5-flare", params: {}, count: 3 }];
  await Promise.all(
    members.map(async (m) => {
      for (let i = 0; i < runs; i++) {
        const t = performance.now();
        const r = await fetch(`${base}/api/play/runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: m.cookie },
          body: JSON.stringify({ clientRequestId: randomUUID(), mode: "blank", recipeVersionId: null, prompt: "푸른 바다 위 등대, 수채화", cells, priceVersions: { "gpt-image-2.5-flare": 1 }, expectedTotal: 33 }),
        }).catch(() => null);
        times.push(Math.round(performance.now() - t));
        statuses.push(r?.status ?? 0);
        const body = r ? await r.json().catch(() => ({})) : {};
        if (body.error) reasons[body.error] = (reasons[body.error] ?? 0) + 1;
      }
    }),
  );
  summary(`play users=${users} runs=${runs}`, times, statuses);
  console.log("refusal reasons:", JSON.stringify(reasons));
  await new Promise((r) => setTimeout(r, 15000)); // let the mock webhooks settle
  const health = await rest(env, "/rest/v1/rpc/ops_health", {});
  console.log("ops_health after:", JSON.stringify(health));
}

await (mode === "play" ? play() : read());
