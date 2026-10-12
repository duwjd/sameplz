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
