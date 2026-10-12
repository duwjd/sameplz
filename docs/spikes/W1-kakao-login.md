# W1 스파이크 · 카카오 로그인 (개인 앱, 이메일 없음)

- 날짜: 2026-10-13
- 대상: plan-12w W1 「카카오 개인 앱 로그인(이메일 없음, `auth.users.id` 키)」
- 실험 코드: `spike/kakao-login` 브랜치(머지하지 않음)
- 환경: 로컬 Supabase + `pnpm dev`, 카카오 개인 앱(비즈 앱 아님, 사업자 정보 없음)

## 결론

**된다. 단, Supabase 기본 카카오 로그인으로는 안 되고, 카카오 OIDC를 직접 돌린 뒤 ID 토큰으로 Supabase에 로그인해야 한다.**

| 방식 | 결과 |
|---|---|
| A. Supabase 기본 `signInWithOAuth({ provider: "kakao" })` | ✗ 카카오 **KOE205** — 설정하지 않은 동의 항목 `account_email` 요청 |
| B. 카카오 OIDC 직접 요청(`openid profile_nickname profile_image`) → `signInWithIdToken({ provider: "kakao" })` | ✓ 가입·로그인·재로그인 성공 |

A가 안 되는 이유:
- Supabase Auth 소스(`internal/api/provider/kakao.go`)가 기본 스코프에 `account_email`을 고정해 둔다.
- 옵션으로 넘긴 `scopes`는 이 기본값에 **덧붙기만** 한다.
- 개인 앱은 이메일 동의 항목을 켤 수 없다(비즈 앱 = 사업자 정보 필요).

B가 되는 근거:
- Supabase Auth의 ID 토큰 로그인이 카카오 발급자를 지원한다(`token_oidc.go`, issuer `https://kauth.kakao.com`).
- 허용 audience는 `[auth.external.kakao] client_id`(= REST API 키)다.
- `email_optional = true`면 이메일 없는 토큰도 받는다.

## 확인한 것 (로컬 DB)

| 항목 | 결과 |
|---|---|
| 가입 | `auth.users` 1행, `email` 없음, `provider = kakao` |
| 로그인 수단 | `auth.identities` 1행(`kakao`), 카카오 sub 저장 |
| 닉네임 | `raw_user_meta_data.name`, `preferred_username`에 들어옴 |
| 프로필 사진 | 사용자가 선택 동의를 하지 않아 없음(동의하면 ID 토큰 `picture`로 들어옴 — 소스 기준, 실측은 못 함) |
| 로그아웃 → 재로그인 | 같은 `auth.users.id`, `last_sign_in_at`만 갱신, 신원 중복 없음, 이전 세션 정리됨 |
| 계정 키 | 계획대로 `auth.users.id`. 이메일은 키로 쓰지 않는다 |

## 동작 방식 (B)

1. `GET /auth/kakao?next=/…`
   - `state`와 원본 `nonce`를 httpOnly 쿠키(`path=/auth/kakao`, 10분)에 둔다.
   - 카카오 인가 주소로 보낸다: `scope=openid profile_nickname profile_image`, `nonce=sha256(원본)`.
2. `GET /auth/kakao/callback`
   - `state`를 대조한다.
   - 서버에서 `POST kauth.kakao.com/oauth/token`(client secret 포함)으로 `id_token`을 받는다.
   - `supabase.auth.signInWithIdToken({ provider: "kakao", token, nonce: 원본 })`으로 Supabase 세션 쿠키를 만든다.
   - `next`로 돌아간다. 같은 사이트 경로만 허용한다.
3. 실패하면 `?auth_error=<코드>`로 돌아간다. 사용자가 취소하면 `access_denied`, 카카오 오류면 KOE 코드다.

키는 두 곳에 같은 값을 둔다.
- `supabase/.env`(로컬 Auth의 audience 검증용): `SUPABASE_AUTH_EXTERNAL_KAKAO_CLIENT_ID`, `_SECRET`
- `.env.local`(Next 서버의 토큰 교환용): `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`
- 운영에서는 Vercel 환경 변수 두 개와 Supabase 대시보드 Kakao provider(Client ID, 「Allow users without an email」)에 같은 값을 넣는다.

## 카카오 콘솔 설정 (현재 콘솔 메뉴 이름)

| 메뉴 | 설정 |
|---|---|
| [카카오 로그인] > [사용 설정] | 상태 ON |
| [카카오 로그인] > [OpenID Connect] | 상태 ON |
| [카카오 로그인] > [동의항목] | 닉네임 필수, 프로필 사진 선택. 이메일은 개인 앱이라 설정 불가 |
| [앱] > [플랫폼 키] > [REST API 키] > [카카오 로그인 리다이렉트 URI] | `http://localhost:3000/auth/kakao/callback`, `http://127.0.0.1:3000/auth/kakao/callback`. 운영 출시 때 `https://<도메인>/auth/kakao/callback` 추가 |
| 같은 화면 > [클라이언트 시크릿] | 코드 생성, 활성화 ON |

방식 A용으로 넣었던 `…:54321/auth/v1/callback` 주소는 B에서 쓰지 않는다.

## W2 로그인 작업에서 지킬 것

- `supabase/config.toml`에 `[auth.external.kakao] enabled = true`를 둔다.
  - `client_id`와 `secret`은 `env(SUPABASE_AUTH_EXTERNAL_KAKAO_*)`로 넣는다.
  - `email_optional = true`로 둔다.
  - 버튼이 `signInWithOAuth("kakao")`를 부르지 않게 한다(KOE205).
- 로그인 경로 `/auth/kakao`, `/auth/kakao/callback`은 하네스의 "라우트 핸들러 6곳" 중 OAuth 콜백 묶음으로 본다(`/auth/naver/*`와 같은 자리).
- 이메일이 없으므로 영수증·알림 메일이 필요한 기능은 이메일을 따로 받는다. 현재 MVP는 결제가 없어 해당 없음.
- 닉네임은 가입 때 `profiles.nickname` 기본값으로만 쓰고, 사용자가 고칠 수 있게 한다(PRF).
- 구글 계정 연결·해제(identity linking)는 구글 OAuth 설정이 없어 이번에 확인하지 못했다. 구글 로그인을 붙일 때 확인한다.

## 함께 발견한 것

- **`cacheComponents: true`에서는 라우트 파일에 `export const runtime = "nodejs"`를 쓸 수 없다.** 빌드 오류가 난다.
- 라우트 핸들러는 기본이 Node 런타임이라 줄을 빼도 같다. `.claude/rules/nextjs-app.md`의 웹훅 문구를 고쳤다.
