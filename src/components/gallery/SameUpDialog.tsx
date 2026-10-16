"use client";
// m:sameup / m:sameupEmpty (GAL-04, F6-1/3, F4-11): post a SAME 인증 for a received recipe. From the
// playground the result comes as it is (「여기서 생성」); otherwise the user uploads an image.
import Link from "next/link";
import { useState } from "react";
import { createSameUpload, postSameCert } from "@/actions/gallery";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  TextInput,
} from "@/components/ds";
import {
  FormField,
  ariaFor,
  fid,
  type Errors,
} from "@/components/upload/fields";
import type { SameTargetDTO } from "@/data/gallery";
import { createClient } from "@/lib/supabase/client";

const IMAGE = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const VIDEO = ["video/mp4", "video/webm"];

export interface PlayResultRef {
  cellId: string;
  url: string;
  kind: "image" | "video";
}

const REASON_COPY: Record<string, string> = {
  NOT_ENTITLED: "받은 레시피에만 SAME 인증을 올릴 수 있어요.",
  SAFETY_BLOCKED:
    "이미지가 안전 기준에 맞지 않아 올리지 않았어요. 다른 이미지를 골라 주세요.",
  RATE_LIMITED: "한 시간에 10개까지 올릴 수 있어요. 잠시 뒤에 다시 해 주세요.",
  MEDIA_NOT_UPLOADED: "이미지를 다시 올려 주세요.",
  SIGNUP_INCOMPLETE: "가입을 마치면 올릴 수 있어요.",
  ACCOUNT_SUSPENDED: "이용이 제한된 계정이라 지금은 할 수 없어요. 자세한 건 알림을 확인해 주세요.",
  LOGIN_REQUIRED: "로그인하고 올려 주세요.",
};

export function SameUpDialog({
  open,
  onClose,
  targets,
  recipeId = null,
  playResult = null,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  targets: SameTargetDTO[];
  recipeId?: string | null;
  playResult?: PlayResultRef | null;
  onPosted?: (status: "visible" | "pending_review") => void;
}) {
  const { notify } = useAuth();
  const [recipe, setRecipe] = useState(recipeId ?? targets[0]?.recipeId ?? "");
  const [title, setTitle] = useState("");
  const [alt, setAlt] = useState("");
  const [upload, setUpload] = useState<{
    path: string;
    kind: "image" | "video";
    preview: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (targets.length === 0 && !recipeId)
    return (
      <Dialog open={open} onClose={onClose} size="sm">
        <DialogHeader title="먼저 레시피를 받아 보세요" onClose={onClose} />
        <DialogBody>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            SAME 인증은 받은 레시피로 만든 결과만 올릴 수 있어요. 마음에 드는
            결과를 찾아 「같은 걸로」를 눌러 보세요.
          </p>
        </DialogBody>
        <DialogFooter>
          <Link
            href="/gallery"
            onClick={onClose}
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--sp-fg-accent)",
            }}
          >
            갤러리 구경하기
          </Link>
        </DialogFooter>
      </Dialog>
    );

  const pick = async (file: File) => {
    setFormError(null);
    const kind = VIDEO.includes(file.type)
      ? "video"
      : IMAGE.includes(file.type)
        ? "image"
        : null;
    if (!kind) {
      setErrors((e) => ({
        ...e,
        "same-media":
          "PNG·JPG·WEBP·GIF 이미지나 MP4·WEBM 영상만 올릴 수 있어요.",
      }));
      return;
    }
    setBusy(true);
    try {
      const target = await createSameUpload({
        mime: file.type,
        size: file.size,
      });
      if (!target.ok) {
        setErrors((e) => ({
          ...e,
          "same-media":
            target.reason === "TOO_LARGE"
              ? "이미지는 10MB, 영상은 50MB까지 올릴 수 있어요."
              : target.reason === "RATE_LIMITED"
                ? "오늘은 더 올릴 수 없어요. 내일 다시 해 주세요."
                : "올리지 못했어요. 다시 시도해 주세요.",
        }));
        return;
      }
      const up = await createClient()
        .storage.from(target.bucket ?? "recipe-media-draft")
        .uploadToSignedUrl(target.path, target.token, file, {
          contentType: file.type,
          cacheControl: "60",
        });
      if (up.error) {
        setErrors((e) => ({
          ...e,
          "same-media": "올리지 못했어요. 다시 시도해 주세요.",
        }));
        return;
      }
      setUpload({
        path: target.path,
        kind,
        preview: URL.createObjectURL(file),
      });
      setErrors((e) => ({ ...e, "same-media": "" }));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const e: Errors = {};
    if (!recipe) e["same-recipe"] = "레시피를 골라 주세요.";
    if (!playResult && !upload) e["same-media"] = "결과 이미지를 올려 주세요.";
    if (!title.trim())
      e["same-title"] =
        "한 줄 소개를 적어 주세요. 어떤 입력으로 했는지 적으면 좋아요.";
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      // The file input is hidden: focus its visible picker button instead.
      document.getElementById(first === "same-media" ? "same-media-pick" : fid(first))?.focus();
      return;
    }
    setBusy(true);
    setFormError(null);
    const r = await postSameCert({
      recipeId: recipe,
      title: title.trim(),
      alt,
      mediaPath: playResult ? null : upload!.path,
      kind: playResult ? playResult.kind : upload!.kind,
      playCellId: playResult?.cellId ?? null,
    });
    setBusy(false);
    if (!r.ok) {
      setFormError(
        REASON_COPY[r.reason] ?? "올리지 못했어요. 잠시 뒤에 다시 해 주세요.",
      );
      return;
    }
    notify(
      r.status === "visible"
        ? "SAME 인증을 올렸어요. 갤러리 맨 위에 보여요."
        : "SAME 인증을 받았어요. 사람이 확인한 뒤 갤러리에 보여요.",
    );
    onPosted?.(r.status);
    onClose();
  };

  const preview = playResult?.url ?? upload?.preview ?? null;
  const previewKind = playResult?.kind ?? upload?.kind ?? "image";

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogHeader title="SAME 인증 올리기" onClose={onClose} />
      <DialogBody style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {!recipeId && (
          <FormField field="same-recipe" label="받은 레시피" errors={errors}>
            <select
              {...ariaFor("same-recipe", errors)}
              value={recipe}
              onChange={(e) => setRecipe(e.target.value)}
              style={{
                height: 40,
                padding: "0 12px",
                fontSize: 14,
                borderRadius: 8,
                border: "1px solid var(--sp-border-normal)",
                background: "var(--sp-bg-normal)",
                color: "var(--sp-fg-normal)",
              }}
            >
              {targets.map((t) => (
                <option key={t.recipeId} value={t.recipeId}>
                  {t.title}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <FormField
          field="same-media"
          label="결과"
          description={
            playResult
              ? "플레이그라운드 결과를 그대로 올려요 · 「여기서 생성」이 붙어요"
              : "따라 만든 결과를 올려 주세요"
          }
          errors={errors}
        >
          {preview ? (
            previewKind === "video" ? (
              <video
                src={preview}
                controls
                preload="metadata"
                style={{ maxHeight: 240, borderRadius: 8 }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="올릴 결과 미리보기"
                style={{
                  maxHeight: 240,
                  maxWidth: "100%",
                  objectFit: "contain",
                  borderRadius: 8,
                }}
              />
            )
          ) : null}
          {!playResult && (
            <>
              <Button
                id="same-media-pick"
                size="md"
                variant="outline"
                color="secondary"
                aria-describedby={errors["same-media"] ? `${fid("same-media")}-error` : undefined}
                disabled={busy}
                onClick={() =>
                  document.getElementById(fid("same-media"))?.click()
                }
                style={{ alignSelf: "flex-start" }}
              >
                {busy
                  ? "올리는 중…"
                  : upload
                    ? "다른 결과 고르기"
                    : "결과 고르기"}
              </Button>
              <input
                {...ariaFor("same-media", errors)}
                type="file"
                hidden
                tabIndex={-1}
                accept={[...IMAGE, ...VIDEO].join(",")}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void pick(f);
                }}
              />
            </>
          )}
        </FormField>
        <FormField
          field="same-title"
          label="한 줄 소개"
          description="40자 · 어떤 입력으로 했는지 적어 주세요"
          errors={errors}
        >
          <TextInput
            {...ariaFor("same-title", errors)}
            value={title}
            maxLength={40}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 우리 가게 메뉴로 해 봤어요"
          />
        </FormField>
        <FormField
          field="same-alt"
          label="대체 텍스트"
          description="선택 · 화면 읽기 프로그램이 읽어요"
          errors={errors}
        >
          <TextInput
            {...ariaFor("same-alt", errors)}
            value={alt}
            maxLength={120}
            onChange={(e) => setAlt(e.target.value)}
          />
        </FormField>
        {formError && (
          <p
            role="alert"
            style={{ margin: 0, fontSize: 14, color: "var(--sp-fg-danger)" }}
          >
            {formError}
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" color="secondary" onClick={onClose}>
          닫기
        </Button>
        <Button color="primary" disabled={busy} onClick={() => void submit()}>
          올리기
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
