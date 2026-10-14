"use client";
// UP-02 ~ UP-06 step bodies. Pure inputs: the wizard owns state, saving and submitting.
import { useRef, useState, type CSSProperties } from "react";
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  Icon,
  Media,
  RadioCard,
  RadioCardGroup,
  Select,
  Spinner,
  Textarea,
  TextInput,
} from "@/components/ds";
import {
  createMediaUpload,
  createSkillZipUpload,
  inspectSkillZipUpload,
} from "@/actions/upload";
import { createClient } from "@/lib/supabase/client";
import {
  isMediaMime,
  MEDIA_BUCKET,
  mediaKindOf,
  mediaUrl,
  nearestRatio,
} from "@/lib/upload/media";
import {
  MAX_MEDIA,
  RATIOS,
  syncVariables,
  type UploadForm,
  type UploadMedia,
} from "@/lib/validation/upload";
import {
  ariaFor,
  CodeChips,
  FormField,
  LineList,
  fid,
  type Errors,
} from "./fields";

export interface StepProps {
  form: UploadForm;
  patch: (p: Partial<UploadForm>) => void;
  errors: Errors;
  options: UploadOptions;
}

export interface UploadOptions {
  jobs: { code: string; label: string }[];
  tools: { code: string; label: string; kind: string }[];
}

const stack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 20,
};
const hint: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "var(--sp-fg-hint)",
  lineHeight: 1.6,
};

// ---------------------------------------------------------------- 1 카테고리 (UP-02)

const CATEGORY_CARDS = [
  {
    value: "prompt",
    title: "프롬프트",
    description:
      "이미지·영상·텍스트를 만드는 지시문이에요. [변수]를 바꿔 쓰게 해요.",
  },
  {
    value: "skill",
    title: "스킬",
    description: "Claude·ChatGPT 같은 도구에 넣어 쓰는 SKILL.md 묶음이에요.",
  },
  {
    value: "agent",
    title: "에이전트",
    description:
      "n8n·Make처럼 여러 단계를 스스로 돌리는 자동화예요. 사람이 한 번 확인해요.",
  },
] as const;

const KIND_CARDS = [
  { value: "image", title: "이미지" },
  { value: "video", title: "영상" },
  { value: "text", title: "텍스트" },
] as const;

export function StepCategory({
  form,
  patch,
  errors,
  locked,
}: StepProps & { locked: boolean }) {
  return (
    <div style={stack}>
      <FormField
        field="category"
        label="어떤 레시피인가요?"
        required
        errors={errors}
      >
        <div id={fid("category")} tabIndex={-1} style={{ outline: "none" }}>
          <RadioCardGroup
            value={form.category ?? undefined}
            onChange={(v) =>
              !locked &&
              patch({
                category: v as UploadForm["category"],
                promptKind: v === "prompt" ? form.promptKind : null,
              })
            }
          >
            {CATEGORY_CARDS.map((c) => (
              <RadioCard
                key={c.value}
                value={c.value}
                title={c.title}
                description={c.description}
                disabled={locked && form.category !== c.value}
              />
            ))}
          </RadioCardGroup>
        </div>
      </FormField>
      {locked && <p style={hint}>새 버전에서는 카테고리를 바꿀 수 없어요.</p>}
      {form.category === "prompt" && (
        <FormField
          field="promptKind"
          label="무엇을 만드는 프롬프트인가요?"
          required
          errors={errors}
        >
          <div id={fid("promptKind")} tabIndex={-1} style={{ outline: "none" }}>
            <RadioCardGroup
              direction="row"
              value={form.promptKind ?? undefined}
              onChange={(v) =>
                patch({ promptKind: v as UploadForm["promptKind"] })
              }
            >
              {KIND_CARDS.map((k) => (
                <RadioCard key={k.value} value={k.value} title={k.title} />
              ))}
            </RadioCardGroup>
          </div>
        </FormField>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 2 내용 (UP-04)

const toolKinds: Record<string, string[]> = {
  prompt: ["generator", "assistant"],
  skill: ["assistant"],
  agent: ["runner", "integration", "assistant"],
};

export function StepContent(props: StepProps) {
  const { form, patch, errors, options } = props;
  const [tagText, setTagText] = useState(form.tags.join(", "));
  const tools = options.tools.filter((t) =>
    toolKinds[form.category ?? "prompt"]?.includes(t.kind),
  );
  return (
    <div style={stack}>
      <FormField
        field="title"
        label="제목"
        required
        description="무엇을 만드는지 바로 알 수 있게 써 주세요. 예: 셀카 한 장으로 링크드인 프로필 사진"
        errors={errors}
      >
        <TextInput
          {...ariaFor("title", errors)}
          value={form.title}
          maxLength={40}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </FormField>
      <FormField
        field="summary"
        label="한 줄 설명"
        required
        description="60자까지 써요. 마켓 카드에 보여요."
        errors={errors}
      >
        <TextInput
          {...ariaFor("summary", errors)}
          value={form.summary}
          maxLength={60}
          onChange={(e) => patch({ summary: e.target.value })}
        />
      </FormField>
      <FormField
        field="jobCodes"
        label="어떤 일에 쓰나요?"
        required
        description="직무를 1~2개 골라 주세요."
        errors={errors}
      >
        <CodeChips
          field="jobCodes"
          options={options.jobs}
          value={form.jobCodes}
          onChange={(v) => patch({ jobCodes: v })}
          max={2}
          errors={errors}
        />
      </FormField>
      {tools.length > 0 && (
        <FormField
          field="toolCodes"
          label="쓰는 도구"
          description="결과를 낸 도구를 골라 주세요."
          errors={errors}
        >
          <CodeChips
            field="toolCodes"
            options={tools}
            value={form.toolCodes}
            onChange={(v) => patch({ toolCodes: v })}
            max={10}
            errors={errors}
          />
        </FormField>
      )}
      <FormField
        field="tags"
        label="검색 태그"
        description="쉼표로 나눠 10개까지 넣어요. 예: 프로필, 증명사진"
        errors={errors}
      >
        <TextInput
          {...ariaFor("tags", errors)}
          value={tagText}
          onChange={(e) => {
            setTagText(e.target.value);
            patch({
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            });
          }}
        />
      </FormField>
      {form.category === "prompt" && <PromptFields {...props} />}
      {form.category === "skill" && <SkillFields {...props} />}
      {form.category === "agent" && <AgentFields {...props} />}
    </div>
  );
}

function PromptFields({ form, patch, errors }: StepProps) {
  const p = form.prompt;
  const setPrompt = (next: Partial<UploadForm["prompt"]>) =>
    patch({ prompt: { ...p, ...next } });
  return (
    <>
      <FormField
        field="prompt.body"
        label="프롬프트 본문"
        required
        description="바꿔 쓸 부분은 [대괄호]로 감싸 주세요. 예: [직업] 느낌의 [배경] 앞 프로필 사진. 본문은 받은 사람만 볼 수 있어요."
        errors={errors}
      >
        <Textarea
          {...ariaFor("prompt.body", errors)}
          rows={8}
          value={p.body}
          maxLength={20000}
          onChange={(e) =>
            setPrompt({
              body: e.target.value,
              variables: syncVariables(e.target.value, p.variables),
            })
          }
        />
      </FormField>
      <FormField
        field="prompt.variables"
        label="[변수] 설명"
        description={
          p.variables.length
            ? "변수마다 무엇을 넣는지와 예시를 적어 주세요. 상세 화면에 보여요."
            : "본문에 [대괄호]를 쓰면 여기에 변수가 생겨요."
        }
        errors={errors}
      >
        <div
          id={fid("prompt.variables")}
          tabIndex={-1}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            outline: "none",
          }}
        >
          {p.variables.map((v, i) => (
            <div
              key={v.name}
              style={{
                display: "grid",
                gap: 8,
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sp-border-normal)",
              }}
            >
              <Badge
                size="sm"
                color="primary"
                variant="subtle"
                style={{ justifySelf: "start" }}
              >
                [{v.name}]
              </Badge>
              <FormField
                field={`prompt.variables.${i}.description`}
                label="설명"
                required
                errors={errors}
              >
                <TextInput
                  {...ariaFor(`prompt.variables.${i}.description`, errors)}
                  value={v.description}
                  maxLength={120}
                  placeholder="예: 사진 속 사람의 직업"
                  onChange={(e) =>
                    setPrompt({
                      variables: p.variables.map((x, j) =>
                        j === i ? { ...x, description: e.target.value } : x,
                      ),
                    })
                  }
                />
              </FormField>
              <FormField
                field={`prompt.variables.${i}.example`}
                label="예시"
                required
                errors={errors}
              >
                <TextInput
                  {...ariaFor(`prompt.variables.${i}.example`, errors)}
                  value={v.example}
                  maxLength={80}
                  placeholder="예: 개발자"
                  onChange={(e) =>
                    setPrompt({
                      variables: p.variables.map((x, j) =>
                        j === i ? { ...x, example: e.target.value } : x,
                      ),
                    })
                  }
                />
              </FormField>
            </div>
          ))}
        </div>
      </FormField>
      <FormField
        field="prompt.settings"
        label="설정"
        description="모델·비율·스타일처럼 같은 결과에 필요한 값을 적어요. 10개까지예요."
        errors={errors}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {p.settings.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <TextInput
                aria-label={`설정 ${i + 1} 이름`}
                value={s.label}
                maxLength={20}
                placeholder="예: 비율"
                onChange={(e) =>
                  setPrompt({
                    settings: p.settings.map((x, j) =>
                      j === i ? { ...x, label: e.target.value } : x,
                    ),
                  })
                }
                style={{ width: 140 }}
              />
              <TextInput
                aria-label={`설정 ${i + 1} 값`}
                value={s.value}
                maxLength={80}
                placeholder="예: 1:1"
                onChange={(e) =>
                  setPrompt({
                    settings: p.settings.map((x, j) =>
                      j === i ? { ...x, value: e.target.value } : x,
                    ),
                  })
                }
                style={{ flex: 1 }}
              />
              <Button
                type="button"
                variant="ghost"
                color="secondary"
                aria-label={`설정 ${i + 1} 지우기`}
                onClick={() =>
                  setPrompt({ settings: p.settings.filter((_, j) => j !== i) })
                }
              >
                <Icon name="CloseOutlineIcon" size={16} />
              </Button>
            </div>
          ))}
          {p.settings.length < 10 && (
            <Button
              type="button"
              variant="outline"
              color="secondary"
              style={{ alignSelf: "flex-start" }}
              onClick={() =>
                setPrompt({
                  settings: [...p.settings, { label: "", value: "" }],
                })
              }
            >
              설정 추가
            </Button>
          )}
        </div>
      </FormField>
    </>
  );
}

function SkillFields({ form, patch, errors }: StepProps) {
  const s = form.skill;
  const setSkill = (next: Partial<UploadForm["skill"]>) =>
    patch({ skill: { ...s, ...next } });
  const [zipState, setZipState] = useState<{
    busy: boolean;
    message?: string;
    info?: string;
    scripts?: boolean;
  }>({ busy: false });
  const fileRef = useRef<HTMLInputElement>(null);

  async function onZip(file: File) {
    setZipState({ busy: true });
    const target = await createSkillZipUpload({ size: file.size });
    if (!target.ok)
      return setZipState({ busy: false, message: target.message });
    const { error } = await createClient()
      .storage.from("recipe-files")
      .uploadToSignedUrl(target.path, target.token, file, {
        contentType: "application/zip",
      });
    if (error)
      return setZipState({
        busy: false,
        message: "zip을 올리지 못했어요. 다시 시도해 주세요.",
      });
    const r = await inspectSkillZipUpload({ path: target.path });
    if (!r.ok) {
      setSkill({ zip: null });
      return setZipState({ busy: false, message: r.message });
    }
    setSkill({
      zip: {
        path: target.path,
        filename: file.name.slice(0, 120),
        size: file.size,
      },
    });
    setZipState({
      busy: false,
      info: `${r.name} · 파일 ${r.fileCount}개`,
      scripts: r.hasScripts,
    });
  }

  return (
    <>
      <FormField
        field="skill.source"
        label="스킬을 어떻게 올릴까요?"
        errors={errors}
      >
        <RadioCardGroup
          direction="row"
          value={s.source}
          onChange={(v) => setSkill({ source: v as "md" | "zip" })}
        >
          <RadioCard
            value="md"
            title="SKILL.md 붙여 넣기"
            description="파일 하나로 된 스킬"
          />
          <RadioCard
            value="zip"
            title="zip 올리기"
            description="참고 파일이 있는 스킬 폴더"
          />
        </RadioCardGroup>
      </FormField>
      {s.source === "md" ? (
        <FormField
          field="skill.skillMd"
          label="SKILL.md"
          required
          description="맨 위에 name(소문자·숫자·하이픈)과 description을 적어 주세요. 본문은 받은 사람만 볼 수 있어요."
          errors={errors}
        >
          <Textarea
            {...ariaFor("skill.skillMd", errors)}
            rows={10}
            value={s.skillMd}
            placeholder={
              "---\nname: tax-checklist\ndescription: 종합소득세 신고 전에 빠진 서류를 점검해요.\n---\n\n# 세금 점검표"
            }
            onChange={(e) => setSkill({ skillMd: e.target.value })}
            style={{ fontFamily: "var(--sp-font-mono, monospace)" }}
          />
        </FormField>
      ) : (
        <FormField
          field="skill.zip"
          label="스킬 zip"
          required
          description="스킬 이름과 같은 폴더 하나를 압축해 주세요. 5MB까지예요. scripts/ 폴더나 실행 명령이 있으면 사람이 한 번 확인해요(1~2일)."
          errors={errors}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onZip(f);
            }}
          />
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Button
              {...ariaFor("skill.zip", errors)}
              type="button"
              variant="outline"
              color="secondary"
              disabled={zipState.busy}
              onClick={() => fileRef.current?.click()}
            >
              {zipState.busy ? (
                <Spinner size="sm" />
              ) : (
                <Icon name="UploadOutlineIcon" size={16} />
              )}
              {s.zip ? "다른 zip 고르기" : "zip 고르기"}
            </Button>
            {s.zip && (
              <span style={{ fontSize: 14 }}>
                {zipState.info ?? s.zip.filename}
              </span>
            )}
          </div>
          {zipState.message && (
            <p role="alert" style={{ ...hint, color: "var(--sp-fg-danger)" }}>
              {zipState.message}
            </p>
          )}
          {zipState.scripts && (
            <p style={hint}>스크립트가 있어 사람이 한 번 확인한 뒤 공개돼요.</p>
          )}
        </FormField>
      )}
      <FormField
        field="skill.examples"
        label="호출 예시"
        description="이렇게 말하면 이렇게 답해요. 3개까지 넣어요."
        errors={errors}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {s.examples.map((ex, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gap: 8,
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sp-border-normal)",
              }}
            >
              <TextInput
                aria-label={`예시 ${i + 1} 요청`}
                value={ex.user}
                maxLength={500}
                placeholder="요청: 올해 종소세 서류 점검해 줘"
                onChange={(e) =>
                  setSkill({
                    examples: s.examples.map((x, j) =>
                      j === i ? { ...x, user: e.target.value } : x,
                    ),
                  })
                }
              />
              <Textarea
                aria-label={`예시 ${i + 1} 답`}
                rows={3}
                value={ex.reply}
                maxLength={500}
                placeholder="답: 빠진 서류 3개를 찾았어요…"
                onChange={(e) =>
                  setSkill({
                    examples: s.examples.map((x, j) =>
                      j === i ? { ...x, reply: e.target.value } : x,
                    ),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                color="secondary"
                style={{ justifySelf: "start" }}
                onClick={() =>
                  setSkill({ examples: s.examples.filter((_, j) => j !== i) })
                }
              >
                예시 지우기
              </Button>
            </div>
          ))}
          {s.examples.length < 3 && (
            <Button
              type="button"
              variant="outline"
              color="secondary"
              style={{ alignSelf: "flex-start" }}
              onClick={() =>
                setSkill({ examples: [...s.examples, { user: "", reply: "" }] })
              }
            >
              예시 추가
            </Button>
          )}
        </div>
      </FormField>
      <FormField
        field="skill.before"
        label="넣은 것 (전후 비교)"
        errors={errors}
      >
        <Textarea
          {...ariaFor("skill.before", errors)}
          rows={2}
          value={s.before}
          maxLength={500}
          onChange={(e) => setSkill({ before: e.target.value })}
        />
      </FormField>
      <FormField
        field="skill.after"
        label="나온 것 (전후 비교)"
        errors={errors}
      >
        <Textarea
          {...ariaFor("skill.after", errors)}
          rows={2}
          value={s.after}
          maxLength={500}
          onChange={(e) => setSkill({ after: e.target.value })}
        />
      </FormField>
    </>
  );
}

function AgentFields({ form, patch, errors, options }: StepProps) {
  const a = form.agent;
  const setAgent = (next: Partial<UploadForm["agent"]>) =>
    patch({ agent: { ...a, ...next } });
  const runners = options.tools.filter((t) => t.kind === "runner");
  return (
    <>
      <Callout color="hint" title="에이전트는 사람이 한 번 확인해요">
        자동 검사를 통과해도 공개 전에 1~2일 안에 사람이 확인해요.
      </Callout>
      <FormField field="agent.runtime" label="실행 환경" errors={errors}>
        <Select
          options={[
            { value: "", label: "고르지 않음" },
            ...runners.map((r) => ({ value: r.code, label: r.label })),
          ]}
          value={a.runtime}
          onChange={(v) => setAgent({ runtime: v })}
        />
      </FormField>
      <FormField
        field="agent.flow"
        label="실행 단계"
        required
        description="입력부터 결과까지 순서대로 적어 주세요. 8단계까지예요."
        errors={errors}
      >
        <LineList
          field="agent.flow"
          values={a.flow}
          onChange={(v) => setAgent({ flow: v })}
          placeholder="예: 새 주문 메일 읽기"
          max={8}
          maxLength={60}
          errors={errors}
          addLabel="단계 추가"
        />
      </FormField>
      <FormField field="agent.does" label="하는 일" required errors={errors}>
        <LineList
          field="agent.does"
          values={a.does}
          onChange={(v) => setAgent({ does: v })}
          placeholder="예: 주문을 시트에 정리해요"
          max={10}
          maxLength={80}
          errors={errors}
          addLabel="하는 일 추가"
        />
      </FormField>
      <FormField
        field="agent.doesNot"
        label="안 하는 일"
        required
        description="받는 사람이 걱정할 만한 일을 하지 않는다고 적어 주세요."
        errors={errors}
      >
        <LineList
          field="agent.doesNot"
          values={a.doesNot}
          onChange={(v) => setAgent({ doesNot: v })}
          placeholder="예: 고객에게 메일을 보내지 않아요"
          max={10}
          maxLength={80}
          errors={errors}
          addLabel="안 하는 일 추가"
        />
      </FormField>
      <FormField
        field="agent.integrations"
        label="연결하는 서비스"
        errors={errors}
      >
        <LineList
          field="agent.integrations"
          values={a.integrations}
          onChange={(v) => setAgent({ integrations: v })}
          placeholder="예: 구글 시트"
          max={10}
          maxLength={40}
          errors={errors}
          addLabel="서비스 추가"
        />
      </FormField>
      <FormField
        field="agent.prepare"
        label="받는 사람이 준비할 것"
        errors={errors}
      >
        <LineList
          field="agent.prepare"
          values={a.prepare}
          onChange={(v) => setAgent({ prepare: v })}
          placeholder="예: 내 n8n 계정"
          max={10}
          maxLength={80}
          errors={errors}
          addLabel="준비물 추가"
        />
      </FormField>
      <FormField
        field="agent.config"
        label="설정·지침 원문"
        required
        description="워크플로 JSON을 붙여 넣거나 지침을 글로 써 주세요. 받은 사람만 볼 수 있어요."
        errors={errors}
      >
        <Textarea
          {...ariaFor("agent.config", errors)}
          rows={8}
          value={a.config}
          onChange={(e) => setAgent({ config: e.target.value })}
          style={{ fontFamily: "var(--sp-font-mono, monospace)" }}
        />
      </FormField>
      <FormField field="agent.noKeys" label="키 확인" required errors={errors}>
        <Checkbox
          {...ariaFor("agent.noKeys", errors)}
          checked={a.noKeys}
          onChange={(e) => setAgent({ noKeys: e.target.checked })}
          label="API 키·비밀번호·토큰을 지웠어요"
        />
      </FormField>
    </>
  );
}

// ---------------------------------------------------------------- 3 결과물 (UP-05)

async function dimensions(
  file: File,
  kind: "image" | "video",
): Promise<{ w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    if (kind === "image") {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { w: img.naturalWidth, h: img.naturalHeight };
    }
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => resolve();
      v.onerror = () => reject(new Error("video"));
    });
    return { w: v.videoWidth, h: v.videoHeight };
  } catch {
    return { w: 0, h: 0 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function StepMedia({ form, patch, errors }: StepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const media = form.media;
  const setItem = (i: number, next: Partial<UploadMedia>) =>
    patch({ media: media.map((m, j) => (j === i ? { ...m, ...next } : m)) });

  async function onFiles(files: File[]) {
    setMessage(null);
    const room = MAX_MEDIA - media.length;
    const picked = files.slice(0, room);
    if (files.length > room)
      setMessage(`결과물은 ${MAX_MEDIA}개까지 올릴 수 있어요.`);
    const added: UploadMedia[] = [];
    setBusy((n) => n + picked.length);
    for (const file of picked) {
      try {
        if (!isMediaMime(file.type)) {
          setMessage(
            "PNG·JPG·WEBP·GIF 이미지나 MP4·WEBM 영상만 올릴 수 있어요.",
          );
          continue;
        }
        const kind = mediaKindOf(file.type);
        const target = await createMediaUpload({
          mime: file.type,
          size: file.size,
        });
        if (!target.ok) {
          setMessage(target.message);
          continue;
        }
        const { error } = await createClient()
          .storage.from(MEDIA_BUCKET)
          .uploadToSignedUrl(target.path, target.token, file, {
            contentType: file.type,
          });
        if (error) {
          setMessage("결과물을 올리지 못했어요. 다시 시도해 주세요.");
          continue;
        }
        const { w, h } = await dimensions(file, kind);
        added.push({
          path: target.path,
          kind,
          ratio: nearestRatio(w, h),
          alt: "",
          ai: true,
          url: mediaUrl(target.path) ?? "",
        });
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (added.length) patch({ media: [...media, ...added] });
  }

  return (
    <div style={stack}>
      <Callout color="hint" title="결과물은 공개돼요">
        이 레시피로 직접 만든 결과를 1개 이상 올려 주세요. 결과물에는 개인정보나
        남의 얼굴·상표를 넣지 마세요.
      </Callout>
      <FormField
        field="media"
        label={`결과물 (${media.length}/${MAX_MEDIA})`}
        required
        description="이미지는 10MB, 영상은 50MB까지예요. 첫 번째 결과물이 대표 이미지가 돼요."
        errors={errors}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
          multiple
          hidden
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (fs.length) void onFiles(fs);
          }}
        />
        <Button
          {...ariaFor("media", errors)}
          type="button"
          variant="outline"
          color="secondary"
          disabled={busy > 0 || media.length >= MAX_MEDIA}
          onClick={() => fileRef.current?.click()}
          style={{ alignSelf: "flex-start" }}
        >
          {busy > 0 ? (
            <Spinner size="sm" />
          ) : (
            <Icon name="UploadOutlineIcon" size={16} />
          )}
          {busy > 0 ? "올리는 중이에요" : "결과물 고르기"}
        </Button>
        {message && (
          <p role="alert" style={{ ...hint, color: "var(--sp-fg-danger)" }}>
            {message}
          </p>
        )}
      </FormField>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
          gap: 16,
        }}
      >
        {media.map((m, i) => (
          <div
            key={m.path}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {m.kind === "video" ? (
              <Media ratio={m.ratio} kind="영상" radius={12}>
                <video
                  src={m.url}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={m.alt || `결과물 ${i + 1}`}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    background: "#000",
                  }}
                />
              </Media>
            ) : (
              <Media src={m.url} alt={m.alt} ratio={m.ratio} radius={12} />
            )}
            <FormField
              field={`media.${i}.alt`}
              label={`결과물 ${i + 1} 설명`}
              description="화면 낭독기와 검색에 쓰여요."
              errors={errors}
            >
              <TextInput
                {...ariaFor(`media.${i}.alt`, errors)}
                value={m.alt}
                maxLength={120}
                placeholder="예: 네이비 셔츠 프로필 사진"
                onChange={(e) => setItem(i, { alt: e.target.value })}
              />
            </FormField>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <Select
                options={RATIOS.map((r) => ({
                  value: r,
                  label: r.replace("/", ":"),
                }))}
                value={m.ratio}
                onChange={(v) =>
                  setItem(i, { ratio: v as UploadMedia["ratio"] })
                }
                size="sm"
                style={{ width: 96 }}
              />
              <Checkbox
                size="sm"
                checked={m.ai}
                onChange={(e) => setItem(i, { ai: e.target.checked })}
                label="AI 생성"
              />
              <Button
                type="button"
                variant="ghost"
                color="secondary"
                size="sm"
                onClick={() =>
                  patch({ media: media.filter((_, j) => j !== i) })
                }
              >
                빼기
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 4 공개 범위 (UP-06, MVP)

export function StepVisibility({ form, patch, errors }: StepProps) {
  return (
    <div style={stack}>
      <FormField field="visibility" label="공개 범위" required errors={errors}>
        <RadioCardGroup
          value={form.visibility}
          onChange={(v) => patch({ visibility: v as "public" | "private" })}
        >
          <RadioCard
            value="public"
            title="공개"
            description="마켓에 올라가고 누구나 무료로 받을 수 있어요."
          />
          <RadioCard
            value="private"
            title="비공개"
            description="나만 볼 수 있어요. 나중에 공개로 바꿀 수 있어요."
          />
        </RadioCardGroup>
      </FormField>
      {form.recipeId && (
        <FormField
          field="changelog"
          label="바뀐 점"
          required
          description="받은 사람에게 업데이트 안내로 보여요. 500자까지예요."
          errors={errors}
        >
          <Textarea
            {...ariaFor("changelog", errors)}
            rows={3}
            value={form.changelog}
            maxLength={500}
            onChange={(e) => patch({ changelog: e.target.value })}
          />
        </FormField>
      )}
      <p style={hint}>
        지금은 무료로만 올릴 수 있어요. 유료 판매는 준비 중이에요.
      </p>
    </div>
  );
}
