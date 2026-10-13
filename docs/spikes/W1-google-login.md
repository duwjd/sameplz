# W1 스파이크 · 구글 로그인

- 날짜: 2026-10-13
- 실험 코드: `spike/google-login` 브랜치(머지하지 않음)
- 환경: 로컬 Supabase + `pnpm dev`
- 비용: 0원(Google OAuth 무료, 도메인 없음)

## 결론

**된다. Supabase 기본 `signInWithOAuth({ provider: "google" })` 그대로 쓴다.** 카카오·네이버와 달리 우회가 필요 없다.

| 항목 | 결과 |
|---|---|
| 가입 | `auth.users` 1행, `provider = google`, 실제 이메일 + `email_confirmed_at` |
| 이름·프로필 사진 | `user_metadata`에 들어옴 |
| 로그아웃 → 재로그인 | 같은 계정(구글 사용자 1명 유지) |
| 요청 범위 | `email profile`(+ `openid`) — 기본 범위라 Google 검수 없음 |
| 참고 | 로컬에서 구글 사용자의 `last_sign_in_at`이 비어 있었다. 로그인에는 영향 없음. 로그인 기록이 필요하면 앱에서 따로 남긴다 |

## Google Cloud 설정 (도메인 없이)

- Google Auth Platform: 대상 **외부**, 게시 상태 **테스트**(테스트 사용자만 로그인). 출시 때 **앱 게시**를 누른다(기본 범위만이라 검수 없음).
- 브랜딩: **로고를 올리지 않는다**(올리면 브랜드 검수). 홈페이지 `https://sameplz.vercel.app`
- 데이터 액세스: `openid`, `userinfo.email`, `userinfo.profile`만
- 클라이언트(웹)
  - JS 원본: `http://localhost:3000`, `https://sameplz.vercel.app`
  - 리디렉션 URI: `http://127.0.0.1:54321/auth/v1/callback`, `http://localhost:54321/auth/v1/callback`, `https://<운영 ref>.supabase.co/auth/v1/callback`
- 키: 로컬 `supabase/.env`(`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `_SECRET`). 운영은 Supabase 대시보드 → Authentication → Providers → Google에 같은 값을 넣는다(W2 로그인 작업 때).

## 로그인 3종 비교 (W1 게이트 「로그인 2종 동작」 → 3종)

| 수단 | 방식 | 이메일 | Supabase `provider` | 문서 |
|---|---|---|---|---|
| 구글 | Supabase 기본 OAuth | 있음(확인됨) | `google` | 이 문서 |
| 카카오 | 카카오 OIDC 직접 → `signInWithIdToken` | 없음 | `kakao` | `W1-kakao-login.md` |
| 네이버 | 서버 OAuth + Admin API + 매직링크 | 자리표시(`.invalid`) | `email`(→ `app_metadata.naver_id`로 구분) | `W1-naver-login.md` |

같은 사람이 여러 수단으로 들어오면 자동으로 합쳐지지 않는다. 이메일 기준 자동 연결이 일어나는 건 구글뿐인데, 카카오에는 이메일이 없고 네이버는 자리표시라 서로 겹치지 않는다. 그래서 서로 다른 계정이 된다. 계정 합치기는 MVP 범위 밖이다.
