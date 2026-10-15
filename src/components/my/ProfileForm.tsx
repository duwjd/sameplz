"use client";
// PRF (F7-4): nickname, handle (checked when asked and again on save), bio, up to two jobs.
// Saving refreshes the page so the GNB and the account menu show the new name right away.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { checkHandle, updateProfile } from "@/actions/account";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button, Chip, TextInput } from "@/components/ds";
import {
  FormField,
  ariaFor,
  fid,
  type Errors,
} from "@/components/upload/fields";
import type { ProfileDTO } from "@/data/account";

const HANDLE_COPY: Record<string, string> = {
  OK: "쓸 수 있는 핸들이에요.",
  TAKEN: "이미 쓰고 있는 핸들이에요. 다른 핸들을 골라 주세요.",
  INVALID: "영문 소문자·숫자·밑줄로 3~15자예요.",
  RATE_LIMITED: "잠시 뒤에 다시 확인해 주세요.",
};

export function ProfileForm({
  profile,
  jobs,
}: {
  profile: ProfileDTO;
  jobs: { code: string; label: string }[];
}) {
  const router = useRouter();
  const { notify } = useAuth();
  const [nickname, setNickname] = useState(profile.nickname);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio);
  const [jobCodes, setJobCodes] = useState<string[]>(profile.jobCodes);
  const [handleNote, setHandleNote] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [jobNote, setJobNote] = useState<string | null>(null);
  const dirty =
    nickname !== profile.nickname ||
    handle !== profile.handle ||
    bio !== profile.bio ||
    jobCodes.join() !== profile.jobCodes.join();

  const revert = () => {
    setNickname(profile.nickname);
    setHandle(profile.handle);
    setBio(profile.bio);
    setJobCodes(profile.jobCodes);
    setHandleNote(null);
    setJobNote(null);
    setErrors({});
  };

  const check = async () => {
    const r = await checkHandle({ handle });
    if (r === "OK") {
      setHandleNote(HANDLE_COPY.OK);
      setErrors((e) => ({ ...e, handle: "" }));
    } else {
      setHandleNote(null);
      setErrors((e) => ({
        ...e,
        handle: HANDLE_COPY[r] ?? HANDLE_COPY.INVALID,
      }));
    }
  };

  const save = async () => {
    const e: Errors = {};
    if (nickname.trim().length < 2 || nickname.trim().length > 12)
      e.nickname = "닉네임은 2~12자예요.";
    if (!/^[a-z0-9_]{3,15}$/.test(handle)) e.handle = HANDLE_COPY.INVALID;
    if (bio.length > 60) e.bio = "소개는 60자까지예요.";
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) return document.getElementById(fid(first))?.focus();
    setBusy(true);
    let r: Awaited<ReturnType<typeof updateProfile>>;
    try {
      r = await updateProfile({ nickname, handle, bio, jobCodes });
    } catch {
      r = { ok: false, reason: "FAILED" };
    } finally {
      setBusy(false);
    }
    if (!r.ok) {
      const field = r.field ?? "nickname";
      // Server error keeps what was typed (F7-4).
      setErrors({
        [field]:
          r.reason === "FAILED"
            ? "저장하지 못했어요. 잠시 뒤에 다시 눌러 주세요."
            : (HANDLE_COPY[r.reason] ?? HANDLE_COPY.INVALID),
      });
      document.getElementById(fid(field))?.focus();
      return;
    }
    notify("프로필을 저장했어요.");
    window.dispatchEvent(new Event("sameplz:viewer"));
    router.refresh();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        maxWidth: 520,
      }}
    >
      <FormField
        field="nickname"
        label="닉네임"
        description="2~12자 · 레시피와 갤러리에 보여요"
        errors={errors}
      >
        <TextInput
          {...ariaFor("nickname", errors)}
          value={nickname}
          maxLength={12}
          onChange={(e) => setNickname(e.target.value)}
        />
      </FormField>
      <FormField
        field="handle"
        label="핸들"
        description={
          handleNote ?? "영문 소문자·숫자·밑줄로 3~15자 · 프로필 주소에 쓰여요"
        }
        errors={errors}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <TextInput
            {...ariaFor("handle", errors)}
            value={handle}
            maxLength={15}
            onChange={(e) => {
              setHandle(e.target.value.toLowerCase());
              setHandleNote(null);
            }}
            style={{ flex: 1 }}
          />
          <Button
            variant="outline"
            color="secondary"
            onClick={() => void check()}
          >
            중복 확인하기
          </Button>
        </div>
      </FormField>
      <FormField
        field="bio"
        label="소개"
        description={`60자까지 · ${bio.length}/60`}
        errors={errors}
      >
        <TextInput
          {...ariaFor("bio", errors)}
          value={bio}
          maxLength={60}
          onChange={(e) => setBio(e.target.value)}
        />
      </FormField>
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
          직무 · 2개까지
        </legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {jobs.map((j) => {
            const on = jobCodes.includes(j.code);
            return (
              <Chip
                key={j.code}
                selected={on}
                onClick={() => {
                  if (!on && jobCodes.length >= 2) {
                    setJobNote(
                      "직무는 2개까지 고를 수 있어요. 하나를 먼저 빼 주세요.",
                    );
                    return;
                  }
                  setJobNote(null);
                  setJobCodes((cur) =>
                    on ? cur.filter((c) => c !== j.code) : [...cur, j.code],
                  );
                }}
              >
                {j.label}
              </Chip>
            );
          })}
        </div>
        {jobNote && (
          <p
            id="profile-job-note"
            role="alert"
            style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-danger)" }}
          >
            {jobNote}
          </p>
        )}
      </fieldset>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Button
          color="primary"
          disabled={busy || !dirty}
          onClick={() => void save()}
        >
          저장하기
        </Button>
        {dirty && (
          <>
            <Button
              variant="ghost"
              color="secondary"
              disabled={busy}
              onClick={revert}
            >
              되돌리기
            </Button>
            <span
              role="status"
              style={{ fontSize: 13, color: "var(--sp-fg-secondary)" }}
            >
              저장하지 않은 변경이 있어요
            </span>
          </>
        )}
      </div>
    </div>
  );
}
