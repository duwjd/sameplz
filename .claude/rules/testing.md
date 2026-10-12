---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "e2e/**"
  - "supabase/tests/**"
---
# 테스트 규칙

- 돈 경로(수수료·로열티·원천징수·크레딧·환불·정산)는 테스트를 먼저 쓴다. 실패를 확인하고 커밋(`tests: <ID> …`)한 뒤 구현한다.
- 테스트를 지우거나, 건너뛰거나(`.skip`, `test.fixme`), 기대값을 약하게 고쳐 통과시키지 않는다. 테스트가 틀렸다고 판단되면 멈추고 이유를 보고한다.
- 테스트 이름에 아이템 ID 또는 요구사항 ID: `it('F3-6 열기 전 7일 안이면 환불된다', …)`.
- 단위(Vitest): `src/**/*.test.ts`. 금액 계산은 경계값(1,000원, 쿠폰 후 0원 근처, 반올림)을 표로.
- DB(pgTAP): `supabase/tests/<area>.test.sql`. 템플릿은 `.claude/skills/rls-policy/pgtap-template.sql`. 정책마다 "B는 A의 비밀·주문·초안을 못 읽는다"를 포함.
- 경합: 열기 vs 환불, 같은 셀 이중 정산, 같은 웹훅 이중 수신을 pgTAP으로.
- e2e(Playwright): `e2e/scenarios/<scn-name>.spec.ts`. 이름 규약과 시드 사용자는 `e2e/CLAUDE.md`.
- 생성 공급자는 테스트에서 항상 `GENERATION_PROVIDER=mock`. 실제 API를 부르지 않는다.
- 결제는 토스 sandbox 키만.
