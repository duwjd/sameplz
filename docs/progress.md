# 진행 로그

Anthropic 장기 실행 하네스 패턴의 진행 파일. 세션을 마칠 때마다 **맨 아래에 한 줄**을 덧붙인다(위쪽을 고치지 않는다).
SessionStart 훅이 `- YYYY-MM-DD`로 시작하는 로그 줄 중 마지막 5개를 세션 컨텍스트로 보여 준다.

형식: `- YYYY-MM-DD <ID>: <한 일> · 테스트 <통과/실패/없음> · 다음: <다음 작업>`

- 기능 목록: `docs/features.json` (수용 기준이 테스트로 통과한 항목만 `"passes": true`)
- 계획: `docs/plans/<CODE>.md`
- 결정: `docs/decisions.md`

## 로그

- 2026-10-03 HARNESS: 하네스·문서 스캐폴드 커밋(앱 없음) · 테스트 없음 · 다음: W1 첫 세션 — Next.js 스캐폴드(README 'W1 첫 세션 프롬프트')
- 2026-10-12 W1-scaffold: Next.js 16.3.8 · pnpm 11.28.2(corepack) · Node 22(fnm, .node-version) · shadcn(sonner) · Supabase init · Vitest/Playwright 스모크 · typecheck·lint·test·build 통과, supabase start·test db는 Docker 미기동으로 미확인 · 다음: Docker 복구 후 supabase start·db reset·test db, W1 스파이크
- 2026-10-12 D14: Supabase Free 단일 프로젝트 구성(로컬 개발, deploy-db 워크플로·production 환경 승인), 하네스 문서 정리, Docker 복구 후 로컬 supabase start·db reset·test db·check-rls 통과 · 테스트 통과 · 다음: .mcp.json supabase-dev 제거·prod-ref·production 시크릿(사용자), W1 스파이크
- 2026-10-12 HOME/DS: SAMEPLZ 디자인 시스템(Vapor 기반) 이식 — 토큰·Pretendard·아이콘 159·컴포넌트 61개(src/components/ds), shadcn 제거, 홈(/) 구현(샘플 데이터) · typecheck·lint·test·build 통과, 브라우저 콘솔 오류 없음 · 다음: 로그인 스파이크, 홈 DAL 연결
- 2026-10-12 SPIKE-pgroonga: 로컬 PGroonga 3.2.5로 F1-5 확인(보고·세무·엑셀 4칸 모두 걸림), RLS 직접 검색은 Seq Scan 2.4초 → SECURITY DEFINER RPC 9~19ms, 입력은 query_escape 필수 · 결과 docs/spikes/W1-pgroonga-korean.md · 다음: 카카오 로그인 스파이크
- 2026-10-13 SPIKE-kakao: 개인 앱 카카오 로그인 성공(이메일 없음, auth.users.id 키) — Supabase 기본 OAuth는 account_email 고정 요청으로 KOE205, 카카오 OIDC 직접 + signInWithIdToken으로 해결, 재로그인 같은 id · 결과 docs/spikes/W1-kakao-login.md · 다음: 네이버 로그인 스파이크(D4)
- 2026-10-13 SPIKE-naver(D4): A(커스텀 OAuth)는 중첩 응답 매핑 불가로 제외(소스), B(라우트 + Admin API + 매직링크)로 가입·재로그인 성공 — 자리표시 이메일·provider=email 기록이 비용 · D4 근거 기록, 상태는 사용자 결정 대기 · 다음: fal vs Replicate(D8)
- 2026-10-13 SPIKE-google: Supabase 기본 구글 OAuth로 가입·재로그인 성공(실제 이메일, 기본 범위만 → 검수 없음, 도메인 없이 설정) · W1 로그인 3종 확인 · 다음: W2 스키마 v1
- 2026-10-13 W2-schema-v1: 마이그레이션 6개(계정·카탈로그·권리·소셜·인기·검색), RLS 전 테이블, pgTAP 81개 통과, seed(레시피 17·사용자 11), DB 타입 생성, 직무 9개(D16) · 테스트 통과 · 다음: HOME·MKT DAL 연결 + 로그인 팝업
- 2026-10-13 MKT-search: /market·카테고리 3종·컬렉션 읽기, GNB 검색 연결, 필터·정렬·적용 칩·0건 안내(인기 검색어 10), SCN 10 e2e 통과(F1-4·5·6 passes) · Vitest 12·e2e 5 통과 · 다음: 홈 DB 연결(PR 2)
- 2026-10-13 HOME-db: 홈 RPC 4개(이번 주·TOP 10 ▲▼/NEW·결과물·크리에이터) + 홈 DB 연결, 샘플 데이터 제거, 빈 DB 대응 · pgTAP 99·e2e 7 통과(F1-1·2·3 passes) · 다음: 로그인 팝업
- 2026-10-13 AUTH-login: 로그인 팝업(카카오·네이버·구글), 하던 일 이어서(팔로우), /welcome 약관·18+ 가입 마무리, 헤더 로그인·로그아웃, Dialog 접근성 보강, e2e 로그인 픽스처 · Vitest 28·e2e 12 통과(F7-1·F7-9 passes) · 다음: 운영 키 설정 후 W3(상세·받기)
- 2026-10-13 FIX-build-race: deploy-db 승인 전 Vercel 빌드가 새 RPC를 못 찾아 실패하던 문제 → 빌드 때 공개 캐시 읽기 실패 시 빈 값 + 수 분 뒤 재시도 · e2e 12 통과 · 다음: W3
- 2026-10-13 F2-detail-schema: W3 스키마(첨부·공유 링크·클릭·업데이트 이력·중지 사유), RPC 9개(상세 공개·비슷한·보는 사람 상태·무료 받기·클릭 기록·라이브러리·원문 열기·업데이트·파일 경로), private 버킷 recipe-files, seed 보강(public_meta·v2·비공개·반려·Midjourney 전용) · pgTAP 163 통과 · 다음: 상세 화면(PR B)
- 2026-10-13 F2-detail: /r/[id] 상세(PRM·AGT·SKL·STOP)·NF 404, 상태별 주 버튼·무료 받기(로그인 뒤 이어서 받기), ?ref 유입 띠·클릭 기록, 규제 고지 띠, Midjourney 전용 실행 비활성, JSON-LD·sitemap·robots, 가입 마무리 가드 무한 재요청 수정 · Vitest 43·e2e 24 통과(F1-7·F2-1~6 passes) · 다음: 라이브러리(PR C)
- 2026-10-13 F3-library: /my/library(받은 레시피·열기 전/열어 봄/판매 종료, 원문 열기 + 받은 사람 표시, 줄마다 업데이트, 첨부 파일 60초 서명 URL), 상세 「라이브러리에서 열기」 바로 열기, GNB 계정 메뉴에 라이브러리 · Vitest 45·e2e 35 통과(F3-5·F3-8 passes) · W3 게이트 SCN 1·9 통과 · 다음: W4
- 2026-10-14 F4-credit-ledger: D10~D13 확정·D17(크레딧 단위 1C≈3.7원, 월 270C·하루 135C) 기록, 크레딧 원장 SQL(지급·홀드·정산·만료·실행 전 검사·예산·레이트 리밋·남용 신호·admin_actions), 가입 지급은 서버 경로만(complete_signup_credits), 매일 00:00 KST cron · pgTAP 238(원장 75, 테스트 먼저) · e2e 35 통과 · 다음: UP 스키마(PR B)
