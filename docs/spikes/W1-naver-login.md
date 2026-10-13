# W1 스파이크 · 네이버 로그인 (D4)

- 날짜: 2026-10-13
- 대상: D4 「네이버 로그인을 어떻게 붙이나」
- 실험 코드: `spike/naver-login` 브랜치(머지하지 않음)
- 환경: 로컬 Supabase + `pnpm dev`, 네이버 개발자센터 앱(제공 정보: 별명 필수, 프로필 사진 선택, 이메일 없음)

## 결론

| 선택지 | 결과 |
|---|---|
| A. Supabase 커스텀 OAuth2 `custom:naver` | ✗ **소스 분석으로 불가 판단** |
| B. 라우트 핸들러 + Admin API + 매직링크 `verifyOtp` | ✓ 가입·로그인·재로그인 성공 |

### A가 안 되는 이유

Supabase Auth `internal/api/provider/custom_oauth.go` 기준이다.

- 매핑 규칙: `applyAttributeMapping`은 `claimsMap[source]`처럼 **맨 위 키만** 찾는다. 점 경로(`response.id`)를 지원하지 않는다.
- 매핑 입력: 원본 응답이 아니라 이미 `Claims` 구조체로 바뀐 값을 매핑한다. 그래서 원본의 `response` 객체에 닿을 수 없다(허용 목록으로 `custom_claims`에 넣어도 객체째라 `sub` 문자열이 되지 않는다).
- 네이버 사용자 정보는 `{"resultcode":"00","response":{"id":…,"nickname":…}}`처럼 `response` 안에 있다. 그래서 `sub`(사용자 식별자)를 채울 수 없다.
- 로컬 Auth에는 기능이 있다(`auth.custom_oauth_providers`). 다만 실제 시험에는 Client Secret을 Claude가 Admin API에 넣어야 해서 하지 않았다.

### B가 되는 근거 (로컬 DB 실측)

| 항목 | 결과 |
|---|---|
| 가입 | `auth.users` 1행. 이메일은 자리표시 `n_<sha256(naver id) 앞 32자>@naver.users.sameplz.invalid` |
| 네이버 식별자 | `app_metadata.naver_id`에 저장. 사용자가 고칠 수 없는 필드라 식별에 쓸 수 있다 |
| 별명·프로필 사진 | `user_metadata.name`, `avatar_url` 들어옴(사진 동의한 경우) |
| 로그아웃 → 재로그인 | 같은 `auth.users.id`, `last_sign_in_at`만 갱신, 계정 중복 없음 |
| 로그인 수단 표시 | ⚠ GoTrue가 `app_metadata.provider`를 `email`로 덮어쓴다. `providers = ["email"]`, `auth.identities.provider = email`. 네이버 사용자는 `naver_id`로 구분한다 |

## 동작 방식 (B)

1. `GET /auth/naver?next=/…` — `state`를 httpOnly 쿠키(`path=/auth/naver`, 10분)에 두고 `nid.naver.com/oauth2.0/authorize`로 보낸다.
2. `GET /auth/naver/callback`
   - `state`를 대조한다.
   - `oauth2.0/token`으로 액세스 토큰을 받는다.
   - `openapi.naver.com/v1/nid/me`로 프로필을 받는다.
3. Admin API(secret 키, 서버 전용 `src/lib/supabase/admin.ts`)로 계정을 처리한다.
   - `createUser({ email: 자리표시, email_confirm: true, app_metadata: { naver_id } })`를 부른다. 이미 있으면 `email_exists`가 오고, 그대로 진행한다.
   - `generateLink({ type: "magiclink" })`로 `hashed_token`을 받는다.
   - 서버 클라이언트로 `verifyOtp({ type: "magiclink", token_hash })`를 불러 세션 쿠키를 만든다. 메일은 보내지 않는다.
4. 실패하면 `?auth_error=<코드>`로 돌아간다. 사용자가 취소하면 `access_denied`다.

키 위치:
- `.env.local`(로컬)과 Vercel(운영)에 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`
- `SUPABASE_SECRET_KEY`도 서버에 필요하다
- 이 방식은 `supabase/.env`의 `SUPABASE_AUTH_EXTERNAL_NAVER_*`를 쓰지 않는다(A용이었음)

네이버 개발자센터 Callback URL:
- 로컬: `http://localhost:3000/auth/naver/callback`
- 운영 출시 때 `https://<도메인>/auth/naver/callback` 추가

## B의 비용과 위험 (D4를 닫기 전에 볼 것)

- **자리표시 이메일**
  - `.invalid`는 메일이 배달되지 않는 예약 도메인이다(RFC 2606).
  - 앱 전체에서 이 도메인을 "이메일 없음"으로 다뤄야 한다. 표시·알림·내보내기에서 숨기고, 이메일 로그인·비밀번호 재설정 대상에서 뺀다.
  - 헬퍼 하나(`isPlaceholderEmail`)로 묶는다.
- **로그인 수단 표시**: Supabase가 이 계정을 "이메일 로그인"으로 안다. ACC-01(로그인 수단 목록)과 F7-5(마지막 로그인 수단 해제 금지)는 `app_metadata.naver_id`를 보고 「네이버」로 표시하고 계산해야 한다. Supabase의 identity 연결·해제 API로는 네이버를 다룰 수 없다.
- **secret 키를 쓰는 경로**: `/auth/naver/callback`은 Admin API를 부른다. 경로는 `state` 검증 뒤에만 계정을 만들고, secret 키는 서버 전용 모듈에만 둔다. security-auditor 검토 대상이다.
- **계정 이전**: 나중에 Supabase가 네이버를 정식 지원하거나 커스텀 매핑이 중첩 경로를 지원하면, `naver_id`로 찾아 identity를 옮기는 작업이 필요하다.
- **같은 사람의 카카오·네이버**: 이메일로 자동 연결되지 않는다(카카오는 이메일이 없고 네이버는 자리표시). 서로 다른 계정이 된다. 계정 합치기는 MVP 범위 밖이다.

## 함께 발견한 것

- 스파이크 중 버튼 추가가 적용되지 않았다. 원인은 포매터가 바꾼 줄바꿈과 문자열 치환이 맞지 않은 것이다. 화면 변경은 렌더 결과(HTML)까지 확인한다.
