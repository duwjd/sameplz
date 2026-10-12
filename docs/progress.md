# 진행 로그

Anthropic 장기 실행 하네스 패턴의 진행 파일. 세션을 마칠 때마다 **맨 아래에 한 줄**을 덧붙인다(위쪽을 고치지 않는다).
SessionStart 훅이 `- YYYY-MM-DD`로 시작하는 로그 줄 중 마지막 5개를 세션 컨텍스트로 보여 준다.

형식: `- YYYY-MM-DD <ID>: <한 일> · 테스트 <통과/실패/없음> · 다음: <다음 작업>`

- 기능 목록: `docs/features.json` (수용 기준이 테스트로 통과한 항목만 `"passes": true`)
- 계획: `docs/plans/<CODE>.md`
- 결정: `docs/decisions.md`

## 로그

- 2026-10-03 HARNESS: 하네스·문서 스캐폴드 커밋(앱 없음) · 테스트 없음 · 다음: W1 첫 세션 — Next.js 스캐폴드(README 'W1 첫 세션 프롬프트')
