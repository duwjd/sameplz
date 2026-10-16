// ADM read DAL (F8-1~3). Callers pass the Viewer from requireAdmin(); reads go through the service
// client because the admin is profiles.role (no JWT claim yet, so RLS admin policies never match).
// Originals are not read here: src/data/secrets.ts → readVersionOriginalsForAdmin.
import "server-only";
import type { Viewer } from "@/lib/auth/account";
import { createAdminClient } from "@/lib/supabase/admin";
import { DRAFT_MEDIA_BUCKET, mediaUrl } from "@/lib/upload/media";

const HOUR = 3600 * 1000;
export const REVIEW_SLA_HOURS = 24;
export const REPORT_SLA_HOURS = 20;

function assertAdmin(admin: Viewer) {
  if (admin.role !== "admin") throw new Error("NOT_ADMIN");
}

const overdue = (iso: string, hours: number) =>
  Date.now() - new Date(iso).getTime() > hours * HOUR;

export interface AdminOverviewDTO {
  reviews: number;
  reviewsOverdue: number;
  reports: number;
  reportsOverdue: number;
}

export async function getAdminOverview(
  admin: Viewer,
): Promise<AdminOverviewDTO> {
  assertAdmin(admin);
  const db = createAdminClient();
  const [q, r] = await Promise.all([
    db
      .from("review_queue")
      .select("created_at")
      .eq("state", "open")
      .limit(1000),
    db.from("reports").select("created_at").eq("status", "open").limit(1000),
  ]);
  const qs = q.data ?? [];
  const rs = r.data ?? [];
  return {
    reviews: qs.length,
    reviewsOverdue: qs.filter((x) => overdue(x.created_at, REVIEW_SLA_HOURS))
      .length,
    reports: rs.length,
    reportsOverdue: rs.filter((x) => overdue(x.created_at, REPORT_SLA_HOURS))
      .length,
  };
}

// ---------------------------------------------------------------- review queue (F8-1)

export interface ReviewRowDTO {
  versionId: string;
  versionNo: number;
  title: string;
  category: string;
  creator: string;
  reason: string;
  visibility: string;
  createdAt: string;
  overdue: boolean;
}

export async function getReviewQueue(admin: Viewer): Promise<ReviewRowDTO[]> {
  assertAdmin(admin);
  const db = createAdminClient();
  const { data: q } = await db
    .from("review_queue")
    .select("version_id, recipe_id, reason, requested_visibility, created_at")
    .eq("state", "open")
    .order("created_at", { ascending: true })
    .limit(200);
  const rows = q ?? [];
  if (!rows.length) return [];
  const [recipes, versions] = await Promise.all([
    db
      .from("recipes")
      .select("id, title, category, creator_nickname")
      .in("id", [...new Set(rows.map((x) => x.recipe_id))]),
    db
      .from("recipe_versions")
      .select("id, version_no")
      .in(
        "id",
        rows.map((x) => x.version_id),
      ),
  ]);
  const rec = new Map((recipes.data ?? []).map((r) => [r.id, r]));
  const ver = new Map((versions.data ?? []).map((v) => [v.id, v.version_no]));
  return rows.map((x) => ({
    versionId: x.version_id,
    versionNo: ver.get(x.version_id) ?? 0,
    title: rec.get(x.recipe_id)?.title ?? "",
    category: rec.get(x.recipe_id)?.category ?? "",
    creator: rec.get(x.recipe_id)?.creator_nickname ?? "",
    reason: x.reason,
    visibility: x.requested_visibility,
    createdAt: x.created_at,
    overdue: overdue(x.created_at, REVIEW_SLA_HOURS),
  }));
}

export interface CheckFindingDTO {
  code: string;
  severity: string;
  step: number | null;
  field: string;
  note: string;
}

export interface ReviewDetailDTO {
  versionId: string;
  versionNo: number;
  changelog: string;
  hasScripts: boolean;
  publicMeta: unknown;
  previousMeta: unknown;
  previousNo: number | null;
  open: boolean;
  queue: { reason: string; visibility: string; createdAt: string } | null;
  recipe: {
    id: string;
    publicId: string;
    title: string;
    summary: string;
    category: string;
    promptKind: string | null;
    status: string;
    creator: string;
  };
  checks: {
    layer: number;
    result: string;
    checker: string;
    findings: CheckFindingDTO[];
  }[];
  media: { url: string; kind: string; alt: string }[];
  files: { name: string; size: number }[];
}

export async function getReviewDetail(
  admin: Viewer,
  versionId: string,
): Promise<ReviewDetailDTO | null> {
  assertAdmin(admin);
  const db = createAdminClient();
  const { data: v } = await db
    .from("recipe_versions")
    .select("id, recipe_id, version_no, changelog, public_meta, has_scripts")
    .eq("id", versionId)
    .maybeSingle();
  if (!v) return null;
  const [recipe, queue, checks, prev, links, files] = await Promise.all([
    db
      .from("recipes")
      .select(
        "id, public_id, title, summary, category, prompt_kind, status, creator_nickname",
      )
      .eq("id", v.recipe_id)
      .maybeSingle(),
    db
      .from("review_queue")
      .select("reason, requested_visibility, created_at, state")
      .eq("version_id", versionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("auto_checks")
      .select("layer, result, checker, findings")
      .eq("version_id", versionId)
      .order("layer"),
    db
      .from("recipe_versions")
      .select("version_no, public_meta")
      .eq("recipe_id", v.recipe_id)
      .not("approved_at", "is", null)
      .lt("version_no", v.version_no)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("recipe_version_media")
      .select("media_id, sort")
      .eq("version_id", versionId)
      .order("sort"),
    db
      .from("recipe_version_files")
      .select("filename, size_bytes, sort")
      .eq("version_id", versionId)
      .order("sort"),
  ]);
  if (!recipe.data) return null;
  const mediaIds = (links.data ?? []).map((l) => l.media_id);
  const { data: assets } = mediaIds.length
    ? await db
        .from("media_assets")
        .select("id, storage_path, kind, alt_text")
        .in("id", mediaIds)
    : {
        data: [] as {
          id: string;
          storage_path: string;
          kind: string;
          alt_text: string | null;
        }[],
      };
  // Results under review sit in the private draft bucket (D18); fall back to the public URL for
  // results reused from an approved version.
  const paths = (assets ?? []).map((a) => a.storage_path);
  const { data: signed } = paths.length
    ? await db.storage.from(DRAFT_MEDIA_BUCKET).createSignedUrls(paths, 600)
    : {
        data: [] as {
          path: string | null;
          signedUrl: string;
          error: string | null;
        }[],
      };
  const signedOf = new Map(
    (signed ?? [])
      .filter((s) => !s.error && s.path)
      .map((s) => [s.path as string, s.signedUrl]),
  );
  const byId = new Map((assets ?? []).map((a) => [a.id, a]));
  const media = mediaIds
    .map((id) => byId.get(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .map((a) => ({
      url: signedOf.get(a.storage_path) ?? mediaUrl(a.storage_path) ?? "",
      kind: a.kind,
      alt: a.alt_text ?? "",
    }))
    .filter((m) => m.url);
  const r = recipe.data;
  return {
    versionId: v.id,
    versionNo: v.version_no,
    changelog: v.changelog ?? "",
    hasScripts: Boolean(v.has_scripts),
    publicMeta: v.public_meta,
    previousMeta: prev.data?.public_meta ?? null,
    previousNo: prev.data?.version_no ?? null,
    open: queue.data?.state === "open",
    queue: queue.data
      ? {
          reason: queue.data.reason,
          visibility: queue.data.requested_visibility,
          createdAt: queue.data.created_at,
        }
      : null,
    recipe: {
      id: r.id,
      publicId: r.public_id,
      title: r.title,
      summary: r.summary,
      category: r.category,
      promptKind: r.prompt_kind,
      status: r.status,
      creator: r.creator_nickname,
    },
    checks: (checks.data ?? []).map((c) => ({
      layer: c.layer,
      result: c.result,
      checker: c.checker,
      findings: (Array.isArray(c.findings) ? c.findings : []).map((f) => {
        const x = (f ?? {}) as Record<string, unknown>;
        return {
          code: String(x.code ?? ""),
          severity: String(x.severity ?? ""),
          step: typeof x.step === "number" ? x.step : null,
          field: String(x.field ?? ""),
          note: String(x.note ?? ""),
        };
      }),
    })),
    media,
    files: (files.data ?? []).map((f) => ({
      name: f.filename,
      size: f.size_bytes,
    })),
  };
}

// ---------------------------------------------------------------- reports (F8-2)

export interface ReportRowDTO {
  id: string;
  reason: string;
  detail: string;
  createdAt: string;
  overdue: boolean;
  reporter: string;
  /** The reporter's claim of the reported recipe (받은 이력·열람 시각). */
  claim: { claimedAt: string; openedAt: string | null } | null;
  target: {
    type: "recipe" | "post";
    id: string;
    title: string;
    status: string;
    recipeId: string | null;
    publicId: string | null;
  };
  /** Other open reports on the same target (closed together by one answer). */
  sameTarget: number;
}

export async function getOpenReports(admin: Viewer): Promise<ReportRowDTO[]> {
  assertAdmin(admin);
  const db = createAdminClient();
  const { data } = await db
    .from("reports")
    .select(
      "id, reporter_id, target_type, target_id, reason, detail, created_at",
    )
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(200);
  const reports = data ?? [];
  if (!reports.length) return [];
  const postIds = reports
    .filter((r) => r.target_type === "post")
    .map((r) => r.target_id);
  const { data: posts } = postIds.length
    ? await db
        .from("gallery_posts")
        .select("id, title, status, recipe_id")
        .in("id", postIds)
    : {
        data: [] as {
          id: string;
          title: string;
          status: string;
          recipe_id: string;
        }[],
      };
  const postOf = new Map((posts ?? []).map((p) => [p.id, p]));
  const recipeIds = [
    ...new Set([
      ...reports
        .filter((r) => r.target_type === "recipe")
        .map((r) => r.target_id),
      ...(posts ?? []).map((p) => p.recipe_id),
    ]),
  ];
  const reporterIds = [...new Set(reports.map((r) => r.reporter_id))];
  const [recipes, people, claims] = await Promise.all([
    recipeIds.length
      ? db
          .from("recipes")
          .select("id, title, status, public_id")
          .in("id", recipeIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            title: string;
            status: string;
            public_id: string;
          }[],
        }),
    db.from("profiles").select("id, nickname, handle").in("id", reporterIds),
    recipeIds.length
      ? db
          .from("entitlements")
          .select("user_id, recipe_id, created_at, opened_at")
          .in("user_id", reporterIds)
          .in("recipe_id", recipeIds)
      : Promise.resolve({
          data: [] as {
            user_id: string;
            recipe_id: string;
            created_at: string;
            opened_at: string | null;
          }[],
        }),
  ]);
  const recipeOf = new Map((recipes.data ?? []).map((r) => [r.id, r]));
  const personOf = new Map((people.data ?? []).map((p) => [p.id, p]));
  const key = (t: string, id: string) => `${t}:${id}`;
  const counts = new Map<string, number>();
  for (const r of reports)
    counts.set(
      key(r.target_type, r.target_id),
      (counts.get(key(r.target_type, r.target_id)) ?? 0) + 1,
    );
  return reports.map((r) => {
    const post = r.target_type === "post" ? postOf.get(r.target_id) : undefined;
    const recipeId =
      r.target_type === "recipe" ? r.target_id : (post?.recipe_id ?? null);
    const recipe = recipeId ? recipeOf.get(recipeId) : undefined;
    const claim = recipeId
      ? (claims.data ?? []).find(
          (c) => c.user_id === r.reporter_id && c.recipe_id === recipeId,
        )
      : undefined;
    const who = personOf.get(r.reporter_id);
    return {
      id: r.id,
      reason: r.reason,
      detail: r.detail,
      createdAt: r.created_at,
      overdue: overdue(r.created_at, REPORT_SLA_HOURS),
      reporter: who ? `${who.nickname}(@${who.handle})` : "",
      claim: claim
        ? { claimedAt: claim.created_at, openedAt: claim.opened_at }
        : null,
      target: {
        type: r.target_type as "recipe" | "post",
        id: r.target_id,
        title: post ? post.title : (recipe?.title ?? ""),
        status: post ? post.status : (recipe?.status ?? "missing"),
        recipeId,
        publicId: recipe?.public_id ?? null,
      },
      sameTarget: (counts.get(key(r.target_type, r.target_id)) ?? 1) - 1,
    };
  });
}

// ---------------------------------------------------------------- recipes (F8-3)

export interface AdminRecipeDTO {
  id: string;
  publicId: string;
  title: string;
  status: string;
  stoppedReason: string | null;
  stoppedAt: string | null;
  creator: string;
}

/** Find by public id (exact) or title (contains). */
export async function findRecipes(
  admin: Viewer,
  q: string,
): Promise<AdminRecipeDTO[]> {
  assertAdmin(admin);
  const term = q.trim().slice(0, 40);
  if (!term) return [];
  const db = createAdminClient();
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const cols =
    "id, public_id, title, status, stopped_reason, stopped_at, creator_nickname";
  const [byId, byTitle] = await Promise.all([
    /^[a-z0-9]{6,16}$/.test(term)
      ? db.from("recipes").select(cols).eq("public_id", term).limit(1)
      : Promise.resolve({ data: [] }),
    db
      .from("recipes")
      .select(cols)
      .ilike("title", like)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const seen = new Set<string>();
  return [...(byId.data ?? []), ...(byTitle.data ?? [])]
    .filter((r) => !seen.has(r.id) && seen.add(r.id))
    .map((r) => ({
      id: r.id,
      publicId: r.public_id,
      title: r.title,
      status: r.status,
      stoppedReason: r.stopped_reason,
      stoppedAt: r.stopped_at,
      creator: r.creator_nickname,
    }));
}

// ---------------------------------------------------------------- members (F8-4)

export interface AdminUserRowDTO {
  id: string;
  nickname: string;
  handle: string;
  createdAt: string;
  withdrawn: boolean;
}

/** By exact id, handle or a nickname fragment. */
export async function findUsers(
  admin: Viewer,
  q: string,
): Promise<AdminUserRowDTO[]> {
  assertAdmin(admin);
  const term = q.trim().slice(0, 40);
  if (!term) return [];
  const db = createAdminClient();
  const cols = "id, nickname, handle, created_at, deleted_at";
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const isId = /^[0-9a-f-]{36}$/i.test(term);
  const [byId, byHandle, byName] = await Promise.all([
    isId
      ? db.from("profiles").select(cols).eq("id", term).limit(1)
      : Promise.resolve({ data: [] }),
    /^[a-z0-9_]{3,15}$/i.test(term)
      ? db.from("profiles").select(cols).eq("handle", term.toLowerCase()).limit(1)
      : Promise.resolve({ data: [] }),
    isId
      ? Promise.resolve({ data: [] })
      : db
          .from("profiles")
          .select(cols)
          .ilike("nickname", like)
          .order("created_at", { ascending: false })
          .limit(20),
  ]);
  const seen = new Set<string>();
  return [...(byId.data ?? []), ...(byHandle.data ?? []), ...(byName.data ?? [])]
    .filter((p) => !seen.has(p.id) && seen.add(p.id))
    .map((p) => ({
      id: p.id,
      nickname: p.nickname,
      handle: p.handle,
      createdAt: p.created_at,
      withdrawn: Boolean(p.deleted_at),
    }));
}

export interface AdminSanctionDTO {
  id: string;
  level: string;
  reason: string;
  note: string;
  startsAt: string;
  endsAt: string | null;
  liftedAt: string | null;
  liftNote: string | null;
  /** In force now (not lifted, started, not ended). */
  active: boolean;
}

export interface AdminLinkedDTO {
  id: string;
  nickname: string;
  handle: string;
  createdAt: string;
  withdrawn: boolean;
  sanction: string | null;
  via: ("device" | "ip")[];
}

export interface AdminUserDetailDTO {
  user: AdminUserRowDTO & { role: string };
  sanctions: AdminSanctionDTO[];
  credits: {
    available: number;
    held: number;
    generationSuspendedAt: string | null;
    grantEligible: boolean;
  } | null;
  ledger: { type: string; delta: number; at: string }[];
  linked: AdminLinkedDTO[];
  signals: { kind: string; at: string }[];
}

export async function getUserDetail(
  admin: Viewer,
  userId: string,
): Promise<AdminUserDetailDTO | null> {
  assertAdmin(admin);
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const db = createAdminClient();
  const { data: p } = await db
    .from("profiles")
    .select("id, nickname, handle, created_at, deleted_at, role")
    .eq("id", userId)
    .maybeSingle();
  if (!p) return null;
  const [sanctions, account, ledger, linked] = await Promise.all([
    db
      .from("account_sanctions")
      .select("id, level, reason_code, note, starts_at, ends_at, lifted_at, lift_note")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("credit_accounts")
      .select("available, held, generation_suspended_at, grant_eligible")
      .eq("user_id", userId)
      .maybeSingle(),
    db
      .from("credit_ledger")
      .select("entry_type, delta, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(20),
    db.rpc("admin_linked_accounts", { p_actor: admin.id, p_user: userId }),
  ]);
  const now = Date.now();
  const l = (linked.data ?? {}) as {
    accounts?: {
      id: string;
      nickname: string;
      handle: string;
      created_at: string;
      withdrawn: boolean;
      sanction: string | null;
      via: ("device" | "ip")[];
    }[];
    signals?: { kind: string; created_at: string }[];
  };
  return {
    user: {
      id: p.id,
      nickname: p.nickname,
      handle: p.handle,
      createdAt: p.created_at,
      withdrawn: Boolean(p.deleted_at),
      role: p.role,
    },
    sanctions: (sanctions.data ?? []).map((s) => ({
      id: s.id,
      level: s.level,
      reason: s.reason_code,
      note: s.note,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      liftedAt: s.lifted_at,
      liftNote: s.lift_note,
      active:
        !s.lifted_at &&
        new Date(s.starts_at).getTime() <= now &&
        (!s.ends_at || new Date(s.ends_at).getTime() > now),
    })),
    credits: account.data
      ? {
          available: account.data.available,
          held: account.data.held,
          generationSuspendedAt: account.data.generation_suspended_at,
          grantEligible: account.data.grant_eligible,
        }
      : null,
    ledger: (ledger.data ?? []).map((g) => ({
      type: g.entry_type,
      delta: g.delta,
      at: g.created_at,
    })),
    linked: (l.accounts ?? []).map((a) => ({
      id: a.id,
      nickname: a.nickname,
      handle: a.handle,
      createdAt: a.created_at,
      withdrawn: a.withdrawn,
      sanction: a.sanction,
      via: a.via,
    })),
    // Signal kinds and times only: details can carry hashes.
    signals: (l.signals ?? []).map((s) => ({ kind: s.kind, at: s.created_at })),
  };
}
