"use client";
// PLAY-01~07 (MVP): pick a recipe or a blank prompt, fill [변수], pick up to 3 models with their own
// settings, see the server quote, run, and watch the grid fill in. Results arrive over the private
// run:{id} channel (with a short poll as backup). The prompt template never reaches this component.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ackAiNotice,
  createPlayRefUpload,
  quotePlay,
  refreshRuns,
  type QuoteDTO,
} from "@/actions/play";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Button,
  Callout,
  Checkbox,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Icon,
  ModelOption,
  SegmentedControl,
  Textarea,
  TextInput,
} from "@/components/ds";
import {
  FormField,
  ariaFor,
  fid,
  type Errors,
} from "@/components/upload/fields";
import type {
  CreditSummaryDTO,
  PlayModelDTO,
  PlayRecipeDTO,
  PlayRunDTO,
} from "@/data/playground";
import {
  AI_NOTICE,
  FACE_CONSENT,
  isTerminal,
  kstMonthDay,
  paramValueLabel,
  runErrorCopy,
} from "@/lib/play/copy";
import { createClient } from "@/lib/supabase/client";
import { RunList } from "./RunList";

const MAX_MODELS = 3;
const MAX_REF_BYTES = 10 * 1024 * 1024;
const REF_MIME = ["image/png", "image/jpeg", "image/webp"];
const COUNTS = [1, 2, 4];

interface Selected {
  model: string;
  params: Record<string, string | number | boolean>;
  count: number;
}

interface RefItem {
  id: string;
  name: string;
  preview: string;
}

export type PlayNotice = "not_received" | null;

export function PlayView({
  models,
  recipes,
  initialRecipe,
  notice,
  noticeRecipe = null,
  runs: initialRuns,
  summary,
}: {
  models: PlayModelDTO[];
  recipes: PlayRecipeDTO[];
  initialRecipe: string | null;
  notice: PlayNotice;
  noticeRecipe?: string | null;
  runs: PlayRunDTO[];
  summary: CreditSummaryDTO;
}) {
  const router = useRouter();
  const { notify } = useAuth();
  const [recipeKey, setRecipeKey] = useState(initialRecipe ?? "");
  const recipe = recipes.find((r) => r.publicId === recipeKey) ?? null;
  const [prompt, setPrompt] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Selected[]>([]);
  const [refs, setRefs] = useState<RefItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [faceConsent, setFaceConsent] = useState(false);
  const [running, setRunning] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [runs, setRuns] = useState(initialRuns);
  const [aiAcked, setAiAcked] = useState(summary.aiNoticeAcked);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [online, setOnline] = useState(true);

  const modelOf = useMemo(
    () => new Map(models.map((m) => [m.id, m])),
    [models],
  );
  const refMax = selected.length
    ? Math.min(...selected.map((s) => modelOf.get(s.model)?.refMax ?? 0))
    : 4;

  // ---------------------------------------------------------------- recipe / mode
  const chooseRecipe = (key: string) => {
    setRecipeKey(key);
    setValues({});
    setErrors({});
    setFormError(null);
  };
  const fillExamples = () => {
    if (!recipe) return;
    setValues(
      Object.fromEntries(
        recipe.variables.map((v) => [v.name, v.example ?? ""]),
      ),
    );
    setErrors({});
  };

  // ---------------------------------------------------------------- models
  const toggleModel = (id: string, on: boolean) => {
    setSelected((cur) => {
      if (!on) return cur.filter((s) => s.model !== id);
      if (cur.length >= MAX_MODELS || cur.some((s) => s.model === id))
        return cur;
      const m = modelOf.get(id)!;
      return [
        ...cur,
        {
          model: id,
          params: Object.fromEntries(m.params.map((p) => [p.name, p.default])),
          count: 1,
        },
      ];
    });
    setErrors((e) => ({ ...e, models: "" }));
  };
  const setParam = (
    id: string,
    name: string,
    value: string | number | boolean,
  ) =>
    setSelected((cur) =>
      cur.map((s) =>
        s.model === id ? { ...s, params: { ...s.params, [name]: value } } : s,
      ),
    );
  const setCount = (id: string, count: number) =>
    setSelected((cur) =>
      cur.map((s) => (s.model === id ? { ...s, count } : s)),
    );

  // Server quote (F4-1): recomputed on every change; the run sends it back and is refused if it moved.
  const quoteKey = JSON.stringify([selected, refs.length]);
  const [quoted, setQuoted] = useState<{ key: string; quote: QuoteDTO | null } | null>(null);
  useEffect(() => {
    if (!selected.length) return;
    let alive = true;
    const t = setTimeout(async () => {
      const r = await quotePlay({ cells: selected, refs: refs.length });
      if (alive) setQuoted({ key: quoteKey, quote: r.ok ? r.quote : null });
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);
  const quote = selected.length && quoted?.key === quoteKey ? quoted.quote : null;
  const quoting = selected.length > 0 && quoted?.key !== quoteKey;
  const requote = async () => {
    const r = await quotePlay({ cells: selected, refs: refs.length });
    setQuoted({ key: quoteKey, quote: r.ok ? r.quote : null });
  };

  // ---------------------------------------------------------------- references (F4-8)
  const addRef = async (file: File) => {
    setFormError(null);
    if (!REF_MIME.includes(file.type)) {
      setErrors((e) => ({
        ...e,
        refs: "PNG·JPG·WEBP 이미지만 올릴 수 있어요.",
      }));
      return;
    }
    if (file.size > MAX_REF_BYTES) {
      setErrors((e) => ({ ...e, refs: "10MB 이하 이미지만 올릴 수 있어요." }));
      return;
    }
    setUploading(true);
    try {
      const target = await createPlayRefUpload({
        mime: file.type,
        size: file.size,
      });
      if (!target.ok) {
        setErrors((e) => ({
          ...e,
          refs:
            target.reason === "RATE_LIMITED"
              ? "잠시 뒤에 다시 올려 주세요."
              : "이미지를 올리지 못했어요. 다시 시도해 주세요.",
        }));
        return;
      }
      const up = await createClient()
        .storage.from("play-refs")
        .uploadToSignedUrl(target.path, target.token, file, {
          contentType: file.type,
        });
      if (up.error) {
        setErrors((e) => ({
          ...e,
          refs: "이미지를 올리지 못했어요. 다시 시도해 주세요.",
        }));
        return;
      }
      setRefs((cur) => [
        ...cur,
        { id: target.id, name: file.name, preview: URL.createObjectURL(file) },
      ]);
      setErrors((e) => ({ ...e, refs: "" }));
    } finally {
      setUploading(false);
    }
  };

  // ---------------------------------------------------------------- online (playOffline)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // ---------------------------------------------------------------- live results
  const activeIds = runs
    .filter((r) => r.cells.some((c) => !isTerminal(c.status)))
    .map((r) => r.id);
  const activeKey = activeIds.join(",");
  const mergeRuns = (fresh: PlayRunDTO[]) =>
    setRuns((cur) => cur.map((r) => fresh.find((f) => f.id === r.id) ?? r));
  useEffect(() => {
    if (!activeKey) return;
    const ids = activeKey.split(",");
    const refresh = async (only: string[]) => mergeRuns(await refreshRuns(only));
    const supabase = createClient();
    const channels = ids.map((id) =>
      supabase
        .channel(`run:${id}`, { config: { private: true } })
        .on("broadcast", { event: "cell" }, () => void refresh([id])),
    );
    void supabase.realtime.setAuth().then(() => channels.forEach((c) => c.subscribe()));
    // Backup when a broadcast is missed (tab asleep, socket dropped).
    const poll = setInterval(() => void refresh(ids), 4000);
    return () => {
      clearInterval(poll);
      channels.forEach((c) => void supabase.removeChannel(c));
    };
     
  }, [activeKey]);
  const anyFinished = useRef(0);
  const finishedCount = runs.reduce(
    (n, r) => n + r.cells.filter((c) => isTerminal(c.status)).length,
    0,
  );
  useEffect(() => {
    // Balance and today's limit move when cells settle: re-read the server summary.
    if (finishedCount !== anyFinished.current) {
      anyFinished.current = finishedCount;
      router.refresh();
      window.dispatchEvent(new Event("sameplz:credits"));
    }
  }, [finishedCount, router]);

  // ---------------------------------------------------------------- run (PLAY-04)
  const total = quote?.total ?? 0;
  const blockedReason = !online
    ? "연결되면 누를 수 있어요."
    : summary.suspended
      ? runErrorCopy("GENERATION_SUSPENDED")
      : summary.budgetClosed
        ? runErrorCopy("BUDGET_EXHAUSTED", { nextResetAt: summary.nextResetAt })
        : quote && quote.cells.some((c) => c.exceedsDailyLimit)
          ? `한 번에 하루 한도(${summary.dailyLimit}C)를 넘는 설정이 있어요. 길이·해상도를 줄여 주세요.`
          : quote && quote.exceedsRemaining
            ? `오늘 남은 ${quote.remainingToday}C로는 만들 수 없어요. 장 수를 줄이거나 내일 다시 해 주세요.`
            : quote && total > summary.available
              ? runErrorCopy("INSUFFICIENT_CREDITS", {
                  nextResetAt: summary.nextResetAt,
                })
              : null;

  const validate = (): Errors => {
    const e: Errors = {};
    if (!recipe && !prompt.trim()) e.prompt = "프롬프트를 입력해 주세요.";
    if (recipe)
      recipe.variables.forEach((v, i) => {
        if (!values[v.name]?.trim())
          e[`var-${i}`] =
            `[${v.name}]을(를) 채워 주세요. 「예시로 채우기」를 눌러도 돼요.`;
      });
    if (!selected.length) e.models = "모델을 하나 이상 골라 주세요.";
    if (refs.length > refMax)
      e.refs =
        refMax === 0
          ? "고른 모델은 레퍼런스를 쓰지 않아요. 이미지를 빼 주세요."
          : `고른 모델은 레퍼런스를 ${refMax}장까지 써요.`;
    if (refs.length && !faceConsent)
      e.consent = "얼굴 사진 사용 동의에 체크해 주세요.";
    return e;
  };

  const run = async (opts: { acked?: boolean } = {}) => {
    setFormError(null);
    const e = validate();
    setErrors(e);
    const first = Object.keys(e).find((k) => e[k]);
    if (first) {
      document.getElementById(fid(first))?.focus();
      return;
    }
    if (!quote) return;
    if (!aiAcked && !opts.acked) {
      setNoticeOpen(true);
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/play/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientRequestId: crypto.randomUUID(),
          mode: recipe ? recipe.mode : "blank",
          recipeVersionId: recipe ? recipe.versionId : null,
          prompt: recipe ? "" : prompt,
          variables: recipe
            ? Object.fromEntries(
                recipe.variables.map((v) => [v.name, values[v.name] ?? ""]),
              )
            : {},
          cells: selected,
          referenceIds: refs.map((r) => r.id),
          faceConsent,
          priceVersions: quote.priceVersions,
          expectedTotal: quote.total,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        runId?: string;
        error?: string;
        shortfall?: number;
      };
      if (!res.ok || !body.runId) {
        const code = body.error ?? "FAILED";
        if (code === "PRICE_CHANGED") await requote();
        if (code === "AI_NOTICE_REQUIRED") setAiAcked(false);
        setFormError(
          runErrorCopy(code, {
            nextResetAt: summary.nextResetAt,
            dailyLimit: summary.dailyLimit,
            shortfall: body.shortfall,
          }),
        );
        return;
      }
      const fresh = await refreshRuns([body.runId]);
      setRuns((cur) => [...fresh, ...cur.filter((r) => r.id !== body.runId)]);
      router.refresh();
    } catch {
      setFormError(runErrorCopy("FAILED"));
    } finally {
      setRunning(false);
    }
  };

  const acknowledge = async () => {
    const r = await ackAiNotice();
    if (!r.ok) {
      notify("확인을 저장하지 못했어요. 다시 눌러 주세요.");
      return;
    }
    setAiAcked(true);
    setNoticeOpen(false);
    document.getElementById("play-run")?.focus();
    void run({ acked: true });
  };

  // ---------------------------------------------------------------- render
  const modeBanner = recipe
    ? recipe.mode === "own"
      ? {
          title: "내 레시피",
          body: "내 레시피를 [변수]만 바꿔 돌려 봐요. 생성에는 크레딧만 들어요.",
        }
      : {
          title: "받은 무료 레시피",
          body: "레시피는 무료, 생성에는 크레딧이 들어요.",
        }
    : {
        title: "빈 프롬프트",
        body: "내 프롬프트로 바로 돌려 보세요. 결과가 마음에 들면 레시피로 올릴 수 있어요.",
      };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {!online && (
        <div role="alert">
          <Callout color="warning" title="연결이 끊겼어요">
            다시 연결되면 이어서 해요 · 「만들기」는 연결된 뒤 누를 수 있어요
          </Callout>
        </div>
      )}
      <CreditBox summary={summary} />
      {notice === "not_received" && (
        <Callout
          color="hint"
          title="받은 레시피만 여기서 바로 만들어 볼 수 있어요"
        >
          상세에서 먼저 받은 뒤 다시 와 주세요. 지금은 빈 프롬프트나 받은
          레시피로 해 볼 수 있어요.
          {noticeRecipe && (
            <>
              {" "}
              <Link href={`/r/${noticeRecipe}`} style={{ color: "var(--sp-fg-accent)", fontWeight: 600 }}>
                상세로 가기
              </Link>
            </>
          )}
        </Callout>
      )}
      <Callout color="primary" title={modeBanner.title}>
        {modeBanner.body}
      </Callout>

      <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section
          aria-label="만들기 설정"
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
        >
          <FormField field="recipe" label="레시피" errors={errors}>
            <select
              id={fid("recipe")}
              value={recipeKey}
              onChange={(e) => chooseRecipe(e.target.value)}
              style={{
                height: 40,
                padding: "0 12px",
                fontSize: 14,
                borderRadius: 8,
                border: "1px solid var(--sp-line-normal)",
                background: "var(--sp-bg-normal)",
                color: "var(--sp-fg-normal)",
              }}
            >
              <option value="">빈 프롬프트로 시작</option>
              {recipes.map((r) => (
                <option key={r.publicId} value={r.publicId}>
                  {r.title} · {r.mode === "own" ? "내 레시피" : "무료"}
                </option>
              ))}
            </select>
          </FormField>

          {recipe ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recipe.variables.length === 0 && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: "var(--sp-fg-secondary)",
                  }}
                >
                  이 레시피는 채울 [변수]가 없어요. 모델만 골라 만들면 돼요.
                </p>
              )}
              {recipe.variables.map((v, i) => {
                // Index, not name: Korean names would collapse to the same element id.
                const field = `var-${i}`;
                return (
                  <FormField
                    key={v.name}
                    field={field}
                    label={`[${v.name}]`}
                    description={v.description}
                    errors={errors}
                  >
                    <TextInput
                      {...ariaFor(field, errors)}
                      value={values[v.name] ?? ""}
                      maxLength={500}
                      placeholder={v.example ? `예: ${v.example}` : undefined}
                      onChange={(e) => {
                        setValues((cur) => ({
                          ...cur,
                          [v.name]: e.target.value,
                        }));
                        if (errors[field])
                          setErrors((x) => ({ ...x, [field]: "" }));
                      }}
                    />
                  </FormField>
                );
              })}
              {recipe.variables.some((v) => v.example) && (
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
                    color="secondary"
                    onClick={fillExamples}
                  >
                    예시로 채우기
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <FormField field="prompt" label="프롬프트" errors={errors}>
              <Textarea
                {...ariaFor("prompt", errors)}
                rows={5}
                maxLength={4000}
                value={prompt}
                placeholder="예: 흰 대리석 위 수분크림, 아침 햇살, 얕은 심도"
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (errors.prompt) setErrors((x) => ({ ...x, prompt: "" }));
                }}
              />
            </FormField>
          )}

          <fieldset
            style={{
              border: 0,
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              모델{" "}
              <span style={{ fontWeight: 400, color: "var(--sp-fg-hint)" }}>
                · 최대 3개를 나란히 비교
              </span>
            </legend>
            <div
              id={fid("models")}
              tabIndex={-1}
              aria-describedby={
                errors.models ? `${fid("models")}-error` : undefined
              }
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 8,
              }}
            >
              {models.map((m) => {
                const on = selected.some((s) => s.model === m.id);
                const overDaily =
                  m.baseCredits == null || m.baseCredits > summary.dailyLimit;
                const full = !on && selected.length >= MAX_MODELS;
                return (
                  <ModelOption
                    key={m.id}
                    name={m.label}
                    kind={m.kind === "video" ? "영상" : "이미지"}
                    cost={m.baseCredits ?? undefined}
                    unit={m.kind === "video" ? "편부터" : "장부터"}
                    selected={on}
                    disabledReason={
                      on
                        ? undefined
                        : overDaily
                          ? `가장 싼 설정도 하루 한도(${summary.dailyLimit}C)를 넘어요`
                          : full
                            ? "최대 3개까지 골라요"
                            : undefined
                    }
                    onChange={(v) => toggleModel(m.id, v)}
                  />
                );
              })}
            </div>
            {errors.models && (
              <span
                id={`${fid("models")}-error`}
                role="alert"
                style={{ fontSize: 13, color: "var(--sp-fg-danger)" }}
              >
                {errors.models}
              </span>
            )}
          </fieldset>

          {selected.map((s) => {
            const m = modelOf.get(s.model)!;
            const q = quote?.cells.find((c) => c.model === s.model);
            return (
              <div
                key={s.model}
                role="group"
                aria-label={`${m.label} 설정`}
                style={{
                  border: "1px solid var(--sp-line-normal)",
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 14,
                  }}
                >
                  <b>{m.label}</b>
                  <span
                    style={{
                      color: q?.exceedsDailyLimit
                        ? "var(--sp-fg-danger)"
                        : "var(--sp-fg-secondary)",
                    }}
                  >
                    {q
                      ? `${q.credits}C × ${q.count}`
                      : quoting
                        ? "견적 중…"
                        : ""}
                  </span>
                </div>
                {m.params.map((p) => (
                  <div
                    key={p.name}
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <span
                      style={{ fontSize: 13, color: "var(--sp-fg-secondary)" }}
                    >
                      {p.label}
                    </span>
                    <SegmentedControl
                      size="sm"
                      aria-label={`${m.label} ${p.label}`}
                      items={p.values.map((v) => ({
                        value: String(v),
                        label: paramValueLabel(p.name, v),
                      }))}
                      value={String(s.params[p.name])}
                      onChange={(v) =>
                        setParam(
                          s.model,
                          p.name,
                          p.values.find((x) => String(x) === v) ?? v,
                        )
                      }
                    />
                  </div>
                ))}
                {m.kind === "image" && (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <span
                      style={{ fontSize: 13, color: "var(--sp-fg-secondary)" }}
                    >
                      장 수
                    </span>
                    <SegmentedControl
                      size="sm"
                      aria-label={`${m.label} 장 수`}
                      items={COUNTS.map((n) => ({
                        value: String(n),
                        label: `${n}장`,
                      }))}
                      value={String(s.count)}
                      onChange={(v) => setCount(s.model, Number(v))}
                    />
                  </div>
                )}
                {q?.exceedsDailyLimit && (
                  <span style={{ fontSize: 13, color: "var(--sp-fg-danger)" }}>
                    한 번에 하루 한도({summary.dailyLimit}C)를 넘어요.
                    길이·해상도를 줄여 주세요.
                  </span>
                )}
              </div>
            );
          })}

          <FormField
            field="refs"
            label="레퍼런스 이미지"
            description={`선택 · PNG·JPG·WEBP 10MB 이하 · 고른 모델 기준 ${refMax}장까지 · 24시간 뒤 자동 삭제돼요`}
            errors={errors}
          >
            <Button
              size="md"
              variant="outline"
              color="secondary"
              disabled={uploading || refs.length >= refMax || refMax === 0}
              aria-describedby={errors.refs ? `${fid("refs")}-error` : undefined}
              onClick={() => document.getElementById(fid("refs"))?.click()}
              style={{ alignSelf: "flex-start" }}
            >
              {uploading ? "올리는 중…" : "이미지 고르기"}
            </Button>
            <input
              {...ariaFor("refs", errors)}
              type="file"
              hidden
              tabIndex={-1}
              accept={REF_MIME.join(",")}
              disabled={
                uploading || refs.length >= Math.max(refMax, 0) || refMax === 0
              }
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void addRef(f);
              }}
            />
            {refs.length > 0 && (
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {refs.map((r) => (
                  <li
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.preview}
                      alt={`레퍼런스 ${r.name}`}
                      width={40}
                      height={40}
                      style={{ objectFit: "cover", borderRadius: 6 }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      color="secondary"
                      aria-label={`레퍼런스 ${r.name} 빼기`}
                      onClick={() =>
                        setRefs((cur) => cur.filter((x) => x.id !== r.id))
                      }
                    >
                      빼기
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </FormField>
          {refs.length > 0 && (
            <FormField
              field="consent"
              label="얼굴 사진 동의"
              required
              errors={errors}
            >
              <Checkbox
                {...ariaFor("consent", errors)}
                checked={faceConsent}
                onChange={(e) => {
                  setFaceConsent(e.target.checked);
                  if (errors.consent) setErrors((x) => ({ ...x, consent: "" }));
                }}
                label={FACE_CONSENT}
              />
            </FormField>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Button
              id="play-run"
              size="xl"
              color="primary"
              stretch
              disabled={
                running ||
                !online ||
                Boolean(blockedReason && selected.length) ||
                quoting
              }
              aria-describedby="play-run-help"
              onClick={() => void run()}
              startIcon={<Icon name="MagicWandIcon" />}
            >
              {running
                ? "만드는 중…"
                : selected.length && quote
                  ? `만들기 · ${quote.total}C`
                  : "만들기"}
            </Button>
            <span
              id="play-run-help"
              style={{ fontSize: 13, color: "var(--sp-fg-secondary)" }}
            >
              {quote
                ? `예상 ${quote.total}C · 보유 ${summary.available}C · 오늘 남은 ${quote.remainingToday}C`
                : `보유 ${summary.available}C · 오늘 남은 ${summary.remainingToday}C`}
              {blockedReason && selected.length ? ` · ${blockedReason}` : ""}
            </span>
            {formError && (
              <div role="alert">
                <Callout color="danger">{formError}</Callout>
              </div>
            )}
          </div>
        </section>

        <RunList
          runs={runs}
          onSaved={(cellId, saved) =>
            setRuns((cur) =>
              cur.map((r) => ({
                ...r,
                cells: r.cells.map((c) =>
                  c.id === cellId ? { ...c, saved } : c,
                ),
              })),
            )
          }
        />
      </div>

      <Dialog open={noticeOpen} onClose={() => setNoticeOpen(false)} size="sm">
        <DialogHeader
          title="생성형 AI 안내"
          onClose={() => setNoticeOpen(false)}
        />
        <DialogBody>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
            {AI_NOTICE}.
          </p>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--sp-fg-secondary)",
            }}
          >
            결과마다 「AI 생성」 표시가 붙어요. 실존 인물을 흉내 내거나 남을
            해치는 데 쓰지 말아 주세요.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            color="secondary"
            onClick={() => setNoticeOpen(false)}
          >
            닫기
          </Button>
          <Button color="primary" onClick={() => void acknowledge()}>
            확인하고 만들기
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function CreditBox({ summary }: { summary: CreditSummaryDTO }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
        border: "1px solid var(--sp-line-normal)",
        borderRadius: 12,
        padding: "12px 16px",
        fontSize: 14,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Icon name="LightningIcon" size={16} />
        보유 <b data-testid="play-balance">{summary.available}C</b>
      </span>
      <span>
        오늘 남은 <b>{summary.remainingToday}C</b> / {summary.dailyLimit}C
      </span>
      <span style={{ color: "var(--sp-fg-secondary)" }}>
        {kstMonthDay(summary.nextResetAt)}에 다시 채워져요
      </span>
      <Link
        href="/my/credits"
        style={{
          marginLeft: "auto",
          color: "var(--sp-fg-accent)",
          fontWeight: 600,
        }}
      >
        내역 보기
      </Link>
    </div>
  );
}
