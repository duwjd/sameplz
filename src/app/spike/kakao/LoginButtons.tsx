"use client";
// SPIKE ONLY (spike/kakao-login branch): throwaway login controls.
import { createClient } from "@/lib/supabase/client";

export function LoginButtons({ signedIn }: { signedIn: boolean }) {
  const supabase = createClient();

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        onClick={() =>
          supabase.auth.signInWithOAuth({
            provider: "kakao",
            options: {
              redirectTo: `${window.location.origin}/auth/callback?next=/spike/kakao`,
            },
          })
        }
      >
        카카오로 로그인 (Supabase 기본, KOE205)
      </button>
      <a href="/auth/kakao?next=/spike/kakao">
        카카오로 로그인 (OIDC + ID 토큰)
      </a>
      <a href="/auth/naver?next=/spike/kakao">
        네이버로 로그인 (B: 서버 + Admin API)
      </a>
      <button
        onClick={() =>
          supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: `${window.location.origin}/auth/callback?next=/spike/kakao`,
            },
          })
        }
      >
        구글로 로그인 (Supabase 기본)
      </button>
      {signedIn && (
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.reload();
          }}
        >
          로그아웃
        </button>
      )}
    </div>
  );
}
