"use client";
// F7-9 signup completion: terms + privacy + 18+ self-check, all required, none pre-checked.
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  acceptSignupTerms,
  signOut,
  type SignupTermsState,
} from "@/actions/auth";
import { Button, Checkbox } from "@/components/ds";

type Field = "terms" | "privacy" | "adult";
const FIELDS: { name: Field; label: React.ReactNode }[] = [
  {
    name: "terms",
    label: (
      <>
        [필수]{" "}
        <Link href="/terms" target="_blank">
          이용약관
        </Link>
        에 동의해요
      </>
    ),
  },
  {
    name: "privacy",
    label: (
      <>
        [필수]{" "}
        <Link href="/privacy" target="_blank">
          개인정보 수집·이용
        </Link>
        에 동의해요
      </>
    ),
  },
  { name: "adult", label: "[필수] 만 18세 이상이에요" },
];

export function WelcomeForm({
  nickname,
  next,
}: {
  nickname: string;
  next: string;
}) {
  const [state, formAction, pending] = useActionState<
    SignupTermsState,
    FormData
  >(acceptSignupTerms, {});
  const [checked, setChecked] = useState<Record<Field, boolean>>({
    terms: false,
    privacy: false,
    adult: false,
  });
  const all = checked.terms && checked.privacy && checked.adult;

  // Move focus to the first field with an error (ux-copy-a11y).
  useEffect(() => {
    const first = FIELDS.find((f) => state.errors?.[f.name]);
    if (first) document.getElementById(`${first.name}-input`)?.focus();
  }, [state]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <form
        action={formAction}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <input type="hidden" name="next" value={next} />
        <Checkbox
          checked={all}
          label={<b>모두 동의해요</b>}
          onChange={(e) =>
            setChecked({
              terms: e.target.checked,
              privacy: e.target.checked,
              adult: e.target.checked,
            })
          }
        />
        <div
          role="group"
          aria-label="필수 동의"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingLeft: 4,
          }}
        >
          {FIELDS.map((f) => {
            const err = state.errors?.[f.name];
            return (
              <div
                key={f.name}
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <Checkbox
                  id={`${f.name}-input`}
                  name={f.name}
                  value="on"
                  checked={checked[f.name]}
                  invalid={Boolean(err)}
                  aria-invalid={Boolean(err) || undefined}
                  aria-describedby={err ? `${f.name}-error` : undefined}
                  label={f.label}
                  onChange={(e) =>
                    setChecked((c) => ({ ...c, [f.name]: e.target.checked }))
                  }
                />
                {err && (
                  <p
                    id={`${f.name}-error`}
                    style={{
                      margin: "0 0 0 28px",
                      fontSize: 13,
                      color: "var(--sp-fg-danger)",
                    }}
                  >
                    {err}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {state.errors?.form && (
          <p
            role="alert"
            style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-danger)" }}
          >
            {state.errors.form}
          </p>
        )}
        <Button type="submit" size="xl" stretch disabled={pending}>
          동의하고 시작하기
        </Button>
      </form>
      <form action={signOut.bind(null, "/")}>
        <Button
          type="submit"
          size="lg"
          variant="ghost"
          color="secondary"
          stretch
        >
          나중에 할게요
        </Button>
      </form>
      <p style={{ margin: 0, fontSize: 12, color: "var(--sp-fg-hint)" }}>
        {nickname}님, 동의하지 않으면 로그아웃돼요. 언제든 다시 로그인해서
        이어서 할 수 있어요.
      </p>
    </div>
  );
}
