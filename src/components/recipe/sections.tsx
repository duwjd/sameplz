// PRM / AGT / SKL body sections (server). Public meta only: originals never reach these components.
import type { CSSProperties, ReactNode } from "react";
import {
  AgentFlow,
  Badge,
  ChatExample,
  Icon,
  Media,
  PromptPreview,
} from "@/components/ds";
import type { GalleryPostDTO } from "@/data/gallery";
import { KIND } from "@/lib/catalog/card";
import { mediaUrl } from "@/lib/upload/media";
import {
  formatFileSize,
  maskedTemplate,
  type RecipeDetail,
} from "@/lib/recipe/detail";
import { InstallGuide } from "./InstallGuide";
import { SampleRunLog } from "./SampleRunLog";

const sectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const h2Style: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
  color: "var(--sp-fg-normal)",
};
const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "var(--sp-fg-hint)",
};
const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 14,
  lineHeight: 1.6,
  color: "var(--sp-fg-secondary)",
};

export function Section({
  title,
  hint,
  children,
  id,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section style={sectionStyle} aria-labelledby={id}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 id={id} style={h2Style}>
          {title}
        </h2>
        {hint && <p style={hintStyle}>{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function KeyValues({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  if (rows.length === 0) return null;
  return (
    <dl
      style={{
        margin: 0,
        display: "grid",
        gridTemplateColumns: "minmax(88px,auto) 1fr",
        rowGap: 10,
        columnGap: 16,
        fontSize: 14,
      }}
    >
      {rows.map((r) => (
        <div key={r.label} style={{ display: "contents" }}>
          <dt style={{ fontWeight: 600, color: "var(--sp-fg-normal)" }}>
            {r.label}
          </dt>
          <dd style={{ margin: 0, color: "var(--sp-fg-secondary)" }}>
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** PRM-01: results first. 「AI 생성」 both visible and in text; 9:16 stays vertical, no autoplay. */
function ResultGallery({ recipe }: { recipe: RecipeDetail }) {
  const kind = recipe.prompt_kind ? KIND[recipe.prompt_kind] : undefined;
  if (recipe.media.length === 0) {
    return (
      <Media
        ratio={(recipe.filters.ratio as string | undefined) ?? "4/3"}
        kind={kind}
        label="결과물 예시를 준비하고 있어요"
      />
    );
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
        gap: 12,
      }}
    >
      {recipe.media.map((m) => {
        const src = mediaUrl(m.path);
        const aiBadge = m.ai ? (
          <Badge size="sm" color="contrast" variant="fill">
            AI 생성
          </Badge>
        ) : undefined;
        return (
          <figure key={m.id} style={{ margin: 0 }}>
            {src && m.kind === "video" ? (
              // No autoplay: the first frame is the poster, the viewer presses play.
              <Media ratio={m.ratio ?? "9/16"} kind="영상" topLeft={aiBadge}>
                <video
                  src={src}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={m.alt ?? "결과물 영상"}
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
              <Media
                src={src ?? undefined}
                ratio={m.ratio ?? "1/1"}
                kind={m.kind === "video" ? "영상" : "이미지"}
                video={m.kind === "video"}
                label={m.alt ?? undefined}
                alt={m.alt ?? ""}
                topLeft={aiBadge}
              />
            )}
            {(m.alt || m.ai) && (
              <figcaption style={{ ...hintStyle, marginTop: 6 }}>
                {[m.alt, m.ai ? "AI로 만든 결과물이에요" : null]
                  .filter(Boolean)
                  .join(" · ")}
              </figcaption>
            )}
          </figure>
        );
      })}
    </div>
  );
}

function ToolsRow({ recipe }: { recipe: RecipeDetail }) {
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
      {recipe.tools.map((t) => (
        <Badge key={t.code} size="sm" color="hint" variant="subtle">
          {t.label}
          {recipe.category === "prompt" && !t.has_api ? " · API 없음" : ""}
        </Badge>
      ))}
    </span>
  );
}

export function PromptSections({ recipe }: { recipe: RecipeDetail }) {
  const meta = recipe.version.meta;
  return (
    <>
      <ResultGallery recipe={recipe} />
      <Section
        title="사용 도구·설정"
        hint="같은 결과를 내는 데 필요한 값이에요."
      >
        <KeyValues
          rows={[
            ...(recipe.tools.length
              ? [{ label: "도구", value: <ToolsRow recipe={recipe} /> }]
              : []),
            ...meta.settings.map((s) => ({ label: s.label, value: s.value })),
          ]}
        />
      </Section>
      <Section
        title="프롬프트 미리보기"
        hint="본문은 가리고 바꿔 넣을 [변수]만 보여 줘요."
      >
        <PromptPreview
          template={maskedTemplate(meta.variables)}
          variables={meta.variables.map((v) => ({
            name: v.name,
            description: v.description,
            example: v.example,
          }))}
        />
      </Section>

    </>
  );
}

/** Agents and skills show uploaded results (screenshots, outputs) once any exist. */
function ResultsSection({ recipe }: { recipe: RecipeDetail }) {
  if (recipe.media.length === 0) return null;
  return (
    <Section title="결과물" hint="크리에이터가 이 레시피로 만든 결과예요.">
      <ResultGallery recipe={recipe} />
    </Section>
  );
}

export function AgentSections({ recipe }: { recipe: RecipeDetail }) {
  const meta = recipe.version.meta;
  return (
    <>
      <ResultsSection recipe={recipe} />
      {meta.flow.length > 0 && (
        <Section title="동작 흐름" hint="입력부터 결과까지 이렇게 움직여요.">
          <AgentFlow steps={meta.flow.map((title) => ({ title }))} />
        </Section>
      )}
      {meta.sample_log.length > 0 && (
        <Section title="예시 실행" hint="크리에이터가 실제로 돌린 기록이에요.">
          <SampleRunLog lines={meta.sample_log} />
        </Section>
      )}
      <Section
        title="실행 환경·연동"
        hint="실행과 비용은 받은 사람 계정에서 해요."
      >
        <KeyValues
          rows={[
            ...(meta.runtime
              ? [{ label: "실행 환경", value: meta.runtime }]
              : []),
            ...(meta.integrations.length
              ? [{ label: "연결", value: meta.integrations.join(", ") }]
              : []),
            ...(meta.prepare.length
              ? [{ label: "준비할 것", value: meta.prepare.join(", ") }]
              : []),
            ...(recipe.tools.length
              ? [{ label: "도구", value: <ToolsRow recipe={recipe} /> }]
              : []),
          ]}
        />
      </Section>
      {(meta.does.length > 0 || meta.does_not.length > 0) && (
        <Section title="하는 일·안 하는 일">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 16,
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>하는 일</h3>
              <ul style={listStyle}>
                {meta.does.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>안 하는 일</h3>
              <ul style={listStyle}>
                {meta.does_not.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      )}
      <FileList recipe={recipe} />
    </>
  );
}

export function SkillSections({ recipe }: { recipe: RecipeDetail }) {
  const meta = recipe.version.meta;
  const tool = recipe.tools[0]?.label;
  return (
    <>
      <ResultsSection recipe={recipe} />
      {meta.examples.length > 0 && (
        <Section title="이렇게 말하면 작동해요">
          {meta.examples.map((e, i) => (
            <ChatExample
              key={i}
              tool={tool}
              messages={[
                { role: "user", text: e.user },
                { role: "assistant", text: e.reply },
              ]}
            />
          ))}
        </Section>
      )}
      {meta.before && meta.after && (
        <Section title="전후 비교">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 12,
            }}
          >
            {[
              { label: "넣은 것", text: meta.before },
              { label: "나온 것", text: meta.after },
            ].map((b) => (
              <div
                key={b.label}
                style={{
                  padding: 16,
                  borderRadius: 12,
                  border: "1px solid var(--sp-border-normal)",
                  background: "var(--sp-bg-surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--sp-fg-hint)",
                  }}
                >
                  {b.label}
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.6 }}>{b.text}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
      {meta.install.length > 0 && (
        <Section
          title="설치 안내"
          hint="도구를 고르면 3단계가 그 도구에 맞게 바뀌어요."
        >
          <InstallGuide
            guides={meta.install.map((g) => ({
              tool: g.tool,
              label:
                recipe.tools.find((t) => t.code === g.tool)?.label ?? g.tool,
              steps: g.steps,
              command: g.command,
            }))}
          />
        </Section>
      )}
      <FileList recipe={recipe} />
    </>
  );
}

/** SKL-05 / AGT-04: names and sizes only; contents come after receiving. */
function FileList({ recipe }: { recipe: RecipeDetail }) {
  if (recipe.files.length === 0 && !recipe.version.has_scripts) return null;
  return (
    <Section
      title="파일 구성"
      hint="내용은 받은 뒤 라이브러리에서 열 수 있어요."
    >
      {recipe.version.has_scripts && (
        <Badge
          size="sm"
          color="warning"
          variant="subtle"
          style={{ alignSelf: "flex-start" }}
        >
          스크립트 있음 · 사람 확인 완료
        </Badge>
      )}
      {recipe.files.length > 0 && (
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {recipe.files.map((f) => (
            <li
              key={f.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                fontFamily: "var(--sp-font-code)",
              }}
            >
              <Icon name="FileOutlineIcon" size={16} />
              <span>{f.name}</span>
              <span style={{ color: "var(--sp-fg-hint)" }}>
                {formatFileSize(f.size)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** GAL on the detail page: SAME 인증 posted by people who received this recipe (public, cached). */
export function SameResults({
  recipe,
  posts,
}: {
  recipe: RecipeDetail;
  posts: GalleryPostDTO[];
}) {
  return (
    <Section title="따라 만든 결과" hint="받은 사람이 올린 SAME 인증이 여기에 모여요.">
      <p style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-secondary)" }}>
        {recipe.stats.same_count > 0
          ? `${recipe.stats.same_count.toLocaleString("ko-KR")}명이 따라 만들었어요. 받은 뒤 내 결과도 올릴 수 있어요.`
          : "아직 올라온 결과가 없어요. 받은 뒤 첫 결과를 올려 보세요."}
      </p>
      {posts.length > 0 && (
        <ul
          aria-label="따라 만든 결과"
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          {posts.map((p) => (
            <li key={p.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Media
                src={p.media ?? undefined}
                alt={p.alt ?? `${p.author}님의 결과: ${p.title}`}
                ratio={p.ratio}
                kind={p.kind === "video" ? "영상" : "이미지"}
                video={p.kind === "video"}
                radius={10}
                topLeft={
                  <Badge color="contrast" variant="fill" size="sm">
                    AI 생성
                  </Badge>
                }
                topRight={
                  p.madeHere ? (
                    <Badge color="primary" variant="fill" size="sm">
                      여기서 생성
                    </Badge>
                  ) : null
                }
              />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</span>
              <span style={{ fontSize: 12, color: "var(--sp-fg-secondary)" }}>{p.author}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
