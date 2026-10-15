"use client";
// UP-01 5-step upload (MVP: free only). Drafts autosave (UP-08), 「다음」 checks the step and
// focuses the first bad field (F5-1), the last step submits; the server runs both check layers.
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { Button, Callout, EmptyState, Icon, Stepper } from "@/components/ds";
import { sentence } from "@/lib/upload/messages";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  discardDraft,
  saveDraft,
  submitRecipe,
  type SubmitResult,
} from "@/actions/upload";
import { loadOwnOriginal } from "@/actions/seller";
import { WaitlistCard } from "@/components/seller/WaitlistCard";
import {
  REJECT_COPY,
  type Finding,
  type RejectCode,
} from "@/lib/moderation/reject-codes";
import {
  emptyUploadForm,
  validateStep,
  type UploadForm,
} from "@/lib/validation/upload";
import { fid, type Errors } from "./fields";
import {
  StepCategory,
  StepContent,
  StepMedia,
  StepVisibility,
  type UploadOptions,
} from "./steps";

type Step = 1 | 2 | 3 | 4 | 5;
const STEPS = ["카테고리", "내용", "결과물", "공개 범위", "검사"];
const SAVE_DELAY_MS = 1200;

const card: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 24,
  padding: 24,
  borderRadius: 16,
  border: "1px solid var(--sp-border-normal)",
  background: "var(--sp-bg-surface)",
};

export interface UploadDraft {
  form: UploadForm;
  step: number;
  updatedAt: string;
}

const kstTime = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

const asStep = (n: number): Step => (n >= 1 && n <= 5 ? (n as Step) : 1);
const toErrors = (list: { field: string; message: string }[]): Errors =>
  Object.fromEntries(list.map((e) => [e.field, e.message]).reverse());

export function UploadGuest() {
  const { requireLogin } = useAuth();
  return (
    <EmptyState
      icon="LockOutlineIcon"
      title="로그인하면 레시피를 올릴 수 있어요"
      description="쓰던 내용은 초안으로 남아요. 로그인하고 이어서 올려요."
      actions={
        <Button onClick={() => requireLogin({ next: "/my/seller/upload" })}>
          로그인하기
        </Button>
      }
    />
  );
}

/** 「고쳐서 다시 제출」 / 「새 버전 올리기」: the latest version, without its original. */
export interface UploadEdit {
  form: UploadForm;
  versionNo: number;
  reject: { code: RejectCode | null; note: string | null } | null;
}

export function UploadWizard({
  draft,
  options,
  edit = null,
  blocked = null,
  waitlist,
}: {
  draft: UploadDraft | null;
  options: UploadOptions;
  edit?: UploadEdit | null;
  /** Server says this recipe cannot take a new version right now (stopped / under review). */
  blocked?: { title: string; description: string } | null;
  waitlist: { joined: boolean; categories: string[] };
}) {
  const router = useRouter();
  const base = useCallback(() => edit?.form ?? emptyUploadForm(), [edit]);
  const [form, setForm] = useState<UploadForm>(base);
  const [step, setStep] = useState<Step>(1);
  const [errors, setErrors] = useState<Errors>({});
  const [pendingDraft, setPendingDraft] = useState<UploadDraft | null>(draft);
  const [saved, setSaved] = useState<
    "idle" | "saving" | "saved" | "error" | "discarded"
  >("idle");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  // Field to focus once the target step has rendered; the tick re-runs the effect.
  const focusRef = useRef<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const setFocusField = (field: string) => {
    focusRef.current = field;
    setFocusTick((n) => n + 1);
  };
  const dirty = useRef(false);

  // New version / resubmit: the owner's original arrives through a server action, never as a prop.
  const loadOriginal = useCallback(async () => {
    if (!edit?.form.recipeId) return;
    const r = await loadOwnOriginal({ recipeId: edit.form.recipeId });
    if (!r.ok) return;
    setForm((f) => ({
      ...f,
      prompt: { ...f.prompt, body: f.prompt.body || r.original.promptBody },
      skill: { ...f.skill, skillMd: f.skill.skillMd || r.original.skillMd },
      agent: { ...f.agent, config: f.agent.config || r.original.agentConfig },
    }));
  }, [edit]);
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current || draft) return;
    loaded.current = true;
    void loadOriginal();
  }, [draft, loadOriginal]);

  const patch = useCallback((p: Partial<UploadForm>) => {
    dirty.current = true;
    setForm((f) => ({ ...f, ...p }));
    setErrors((e) => {
      if (!Object.keys(e).length) return e;
      const keys = Object.keys(p);
      return Object.fromEntries(
        Object.entries(e).filter(
          ([k]) => !keys.some((key) => k === key || k.startsWith(`${key}.`)),
        ),
      );
    });
  }, []);

  // UP-08 autosave while writing (not while the resume question is open, not after submit).
  useEffect(() => {
    // Never while submitting: a late save would race the submit's own draft cleanup.
    if (!dirty.current || pendingDraft || result?.ok || submitting) return;
    const t = setTimeout(async () => {
      setSaved("saving");
      const r = await saveDraft({ form, step });
      setSaved(r.ok ? "saved" : "error");
    }, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [form, step, pendingDraft, result, submitting]);

  useEffect(() => {
    const field = focusRef.current;
    if (!field) return;
    focusRef.current = null;
    const el =
      document.getElementById(fid(field)) ??
      document.getElementById(fid(field.split(".").slice(0, 2).join(".")));
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusTick, step]);

  const goTo = (s: Step, field?: string) => {
    setStep(s);
    if (field) setFocusField(field);
    else window.scrollTo({ top: 0 });
  };

  function next() {
    if (step === 5) return;
    const list = validateStep(step as 1 | 2 | 3 | 4, form);
    if (list.length) {
      setErrors(toErrors(list));
      setFocusField(list[0].field);
      return;
    }
    setErrors({});
    goTo(asStep(step + 1));
  }

  async function submit() {
    setSubmitting(true);
    setResult(null);
    const r = await submitRecipe({ form });
    setSubmitting(false);
    if (r.ok) {
      // New versions report in the seller center: this page re-renders as "under review" right
      // after the submit, so the done screen must not depend on this component surviving.
      if (form.recipeId) {
        router.replace(
          `/my/seller?submitted=${r.review ? "review" : r.status === "live" ? "live" : "private"}`,
        );
        return;
      }
      setResult(r);
      window.scrollTo({ top: 0 });
      return;
    }
    if (r.errors?.length) {
      setErrors(toErrors(r.errors));
      goTo(asStep(r.step ?? 2), r.errors[0].field);
      return;
    }
    // Findings also mark their fields, so 「고치러 가기」 lands on a field showing the problem.
    if (r.findings?.length)
      setErrors(
        toErrors(r.findings.map((f) => ({ field: f.field, message: f.note }))),
      );
    setResult(r);
    setFocusField("check-result");
  }

  function startOver() {
    setForm(emptyUploadForm());
    window.history.replaceState(null, "", "/my/seller/upload");
    setStep(1);
    setErrors({});
    setResult(null);
    dirty.current = false;
    setSaved("idle");
  }

  if (result?.ok) return <SubmitDone result={result} onAnother={startOver} />;
  if (blocked)
    return (
      <EmptyState
        icon="InfoCircleOutlineIcon"
        title={blocked.title}
        description={blocked.description}
        actions={
          <Link href="/my/seller" style={{ textDecoration: "none" }}>
            <Button>내 레시피로 가기</Button>
          </Link>
        }
      />
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {pendingDraft && (
        <div role="status">
          <Callout color="primary" title="쓰던 초안이 있어요">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span>
                {kstTime(pendingDraft.updatedAt)}에 저장한 초안이에요. 이어서
                쓸까요?
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                  onClick={() => {
                    setForm(pendingDraft.form);
                    setStep(asStep(Math.min(pendingDraft.step, 4)));
                    setPendingDraft(null);
                    setFocusField("step-title");
                  }}
                >
                  이어서 쓰기
                </Button>
                <Button
                  variant="outline"
                  color="secondary"
                  onClick={async () => {
                    setPendingDraft(null);
                    setFocusField("step-title");
                    if (edit) {
                      setForm(base());
                      void loadOriginal();
                    }
                    const r = await discardDraft({
                      recipeId: edit?.form.recipeId ?? null,
                    });
                    setSaved(r.ok ? "discarded" : "idle");
                  }}
                >
                  새로 시작
                </Button>
              </div>
            </div>
          </Callout>
        </div>
      )}

      {edit && (
        <Callout
          color={edit.reject ? "danger" : "hint"}
          title={
            edit.reject
              ? `반려 사유: ${edit.reject.code ? REJECT_COPY[edit.reject.code].title : "확인이 필요해요"}`
              : `v${edit.versionNo + 1}을 올려요`
          }
        >
          {edit.reject
            ? `${sentence(edit.reject.note ?? (edit.reject.code ? REJECT_COPY[edit.reject.code].fix : ""))} 고친 뒤 4단계에 바뀐 점을 적어 주세요.`
            : "지난 버전 내용을 불러왔어요. 카테고리는 바꿀 수 없고, 4단계에 바뀐 점을 적어야 해요. 받은 사람은 골라서 업데이트해요."}
        </Callout>
      )}
      {!edit && form.forkOf && (
        <Callout color="hint" title={`「${form.forkOf.title}」을 바탕으로 만들어요`}>
          원작의 원문은 복사되지 않아요. 내 프롬프트와 결과물로 채워 올리면 상세에 원작이 표시돼요.
        </Callout>
      )}
      {/* 390px cannot fit five labels: phones get the current step as text. */}
      <div className="hidden md:block">
        <Stepper steps={STEPS.map((label) => ({ label }))} current={step - 1} />
      </div>
      <p
        className="md:hidden"
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 600,
          color: "var(--sp-fg-secondary)",
        }}
      >
        {step}/5단계 · {STEPS[step - 1]}
        {step < 5 ? ` → 다음: ${STEPS[step]}` : ""}
      </p>

      <section aria-labelledby="up-step-title" style={card}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h2
            id="up-step-title"
            tabIndex={-1}
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              outline: "none",
            }}
          >
            {step}. {STEPS[step - 1]}
          </h2>
          <span
            aria-live="polite"
            style={{ fontSize: 13, color: "var(--sp-fg-hint)" }}
          >
            {saved === "saving"
              ? "초안 저장 중…"
              : saved === "saved"
                ? "초안을 저장했어요"
                : saved === "error"
                  ? "초안을 저장하지 못했어요"
                  : saved === "discarded"
                    ? "초안을 지웠어요"
                    : ""}
          </span>
        </header>

        {step === 1 && (
          <StepCategory
            form={form}
            patch={patch}
            errors={errors}
            options={options}
            locked={Boolean(form.recipeId)}
          />
        )}
        {step === 2 && (
          <StepContent
            form={form}
            patch={patch}
            errors={errors}
            options={options}
          />
        )}
        {step === 3 && (
          <StepMedia
            form={form}
            patch={patch}
            errors={errors}
            options={options}
          />
        )}
        {step === 4 && (
          <>
            <StepVisibility
              form={form}
              patch={patch}
              errors={errors}
              options={options}
            />
            <WaitlistCard initial={waitlist} compact />
          </>
        )}
        {step === 5 && (
          <StepCheck
            form={form}
            result={result}
            onFix={(f) => goTo(f.step as Step, f.field)}
          />
        )}

        <footer
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Button
            variant="outline"
            color="secondary"
            disabled={step === 1 || submitting}
            onClick={() => goTo(asStep(step - 1))}
          >
            이전
          </Button>
          {step < 5 ? (
            <Button onClick={next} disabled={Boolean(pendingDraft)}>
              다음
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "검사하고 있어요…" : "검사하고 올리기"}
            </Button>
          )}
        </footer>
      </section>
    </div>
  );
}

function StepCheck({
  form,
  result,
  onFix,
}: {
  form: UploadForm;
  result: SubmitResult | null;
  onFix: (f: Finding) => void;
}) {
  const review = form.category === "agent";
  if (!result || result.ok) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        <p style={{ margin: 0 }}>
          올리기 전에 자동 검사를 해요. 보이지 않는 문자, 숨은 지시문,
          키·개인정보, 쓸 수 없는 표현, 결과물 수를 확인해요.
        </p>
        <p style={{ margin: 0, color: "var(--sp-fg-secondary)" }}>
          {review
            ? "에이전트는 검사를 통과하면 사람이 1~2일 안에 한 번 더 확인하고 공개해요."
            : "검사를 통과하면 바로 공개돼요. 스크립트가 있거나 판단이 애매하면 사람이 1~2일 안에 확인해요."}
        </p>
      </div>
    );
  }
  const findings = result.findings ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        id="up-check-result"
        role="alert"
        tabIndex={-1}
        style={{ outline: "none" }}
      >
        <Callout color="danger" title={result.message}>
          {findings.length
            ? "아래 항목을 고친 뒤 다시 올려 주세요."
            : result.step
              ? ""
              : "잠시 뒤 다시 시도해 주세요."}
        </Callout>
      </div>
      {result.step && result.step < 5 && !findings.length && (
        <Button
          variant="outline"
          color="secondary"
          style={{ alignSelf: "flex-start" }}
          onClick={() =>
            onFix({
              code: "R01",
              severity: "fail",
              step: result.step as 1,
              field: "",
              note: "",
            })
          }
        >
          고치러 가기
        </Button>
      )}
      {findings.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {findings.map((f, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sp-border-normal)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  fontSize: 14,
                }}
              >
                <strong
                  style={{
                    display: "inline-flex",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  <Icon
                    name={
                      f.severity === "fail"
                        ? "WarningOutlineIcon"
                        : "InfoCircleOutlineIcon"
                    }
                    size={16}
                  />
                  {REJECT_COPY[f.code].title}
                  {f.severity === "review" ? " · 사람이 확인해요" : ""}
                </strong>
                <span style={{ color: "var(--sp-fg-secondary)" }}>
                  {f.note}
                  {f.line ? ` (${f.line}번째 줄)` : ""}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                color="secondary"
                onClick={() => onFix(f)}
              >
                고치러 가기
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SubmitDone({
  result,
  onAnother,
}: {
  result: Extract<SubmitResult, { ok: true }>;
  onAnother: () => void;
}) {
  const live = result.status === "live";
  const title = live
    ? "레시피를 공개했어요"
    : result.review
      ? "사람이 확인하고 있어요"
      : "비공개로 저장했어요";
  const description = live
    ? "마켓에서 누구나 무료로 받을 수 있어요."
    : result.review
      ? "1~2일 안에 확인하고 결과를 알려 드려요. 확인이 끝나면 고른 공개 범위로 올라가요."
      : "나만 볼 수 있어요. 공개로 바꾸면 마켓에 올라가요.";
  return (
    <div
      role="status"
      tabIndex={-1}
      ref={(el) => el?.focus()}
      style={{ outline: "none" }}
    >
      <EmptyState
        icon={live ? "CheckCircleOutlineIcon" : "InfoCircleOutlineIcon"}
        title={title}
        description={description}
        actions={
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {live && (
              <Link
                href={`/r/${result.publicId}`}
                style={{ textDecoration: "none" }}
              >
                <Button>상세 화면 보기</Button>
              </Link>
            )}
            <Link href="/my/seller" style={{ textDecoration: "none" }}>
              <Button
                variant={live ? "outline" : "fill"}
                color={live ? "secondary" : undefined}
              >
                내 레시피 보기
              </Button>
            </Link>
            <Button variant="outline" color="secondary" onClick={onAnother}>
              다른 레시피 올리기
            </Button>
          </div>
        }
      />
    </div>
  );
}
