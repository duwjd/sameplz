"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { TERMS_VERSION } from "@/lib/auth/account";
import { safeNext } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";

export async function signOut(next?: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(safeNext(next));
}

const SignupTerms = z.object({
  terms: z.literal("on", { error: "이용약관에 동의해야 가입할 수 있어요." }),
  privacy: z.literal("on", {
    error: "개인정보 수집·이용에 동의해야 가입할 수 있어요.",
  }),
  adult: z.literal("on", { error: "만 18세 이상만 가입할 수 있어요." }),
  next: z.string().optional(),
});

export interface SignupTermsState {
  errors?: Partial<Record<"terms" | "privacy" | "adult" | "form", string>>;
}

/** F7-9: terms + privacy + 18+ self-check, recorded once in consent_events, then back to `next`. */
export async function acceptSignupTerms(
  _prev: SignupTermsState,
  formData: FormData,
): Promise<SignupTermsState> {
  const parsed = SignupTerms.safeParse({
    terms: formData.get("terms") ?? undefined,
    privacy: formData.get("privacy") ?? undefined,
    adult: formData.get("adult") ?? undefined,
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    const errors: SignupTermsState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "terms" | "privacy" | "adult";
      if (key && !errors[key]) errors[key] = issue.message;
    }
    return { errors };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub)
    return { errors: { form: "로그인이 풀렸어요. 다시 로그인해 주세요." } };

  const { error } = await supabase.rpc("accept_signup_terms", {
    p_terms_version: TERMS_VERSION,
  });
  if (error)
    return { errors: { form: "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요." } };

  redirect(safeNext(parsed.data.next));
}

/** Viewer for client chrome (header, follow buttons). Public-safe fields only. */
export async function fetchViewer() {
  const { getViewer } = await import("@/lib/auth/account");
  const v = await getViewer();
  return v
    ? {
        nickname: v.nickname,
        handle: v.handle,
        avatarUrl: v.avatarUrl,
        signupComplete: v.signupComplete,
      }
    : null;
}
