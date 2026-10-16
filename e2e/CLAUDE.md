# e2e — Playwright 규약

- 실행: `pnpm exec playwright test e2e/scenarios/<name>.spec.ts`
- 대상: 로컬 앱(`http://localhost:3000`) + 로컬 Supabase(`supabase start`, `supabase db reset`으로 `seed.sql` 적용)
- 생성 공급자는 `GENERATION_PROVIDER=mock`. mock 어댑터가 로컬 생성 웹훅(`/api/webhooks/generation/mock`)을 직접 호출해 결과를 결정적으로 만든다. 실패 유형(모델 오류·안전 필터·시간 초과)은 입력 플래그로 고른다.
- 결제는 토스페이먼츠 sandbox 키. 실키를 쓰지 않는다. **MVP(무료 출시)에는 결제 단계가 없다** — SCN 2·3·4는 유료 전환 단계이고 SCN 1·6·7·9·11·12는 결제·체험·충전·본인인증 단계를 뺀 MVP 흐름으로 쓴다(`docs/specs/SCN.md`).
- 예산·한도 검사는 `generation_budget`·일일 한도 시드 값을 바꿔 결정적으로 만든다(킬 스위치·`DAILY_LIMIT` 경로).

## 시드 사용자

| 사용자 | 상태 |
|---|---|
| guest | 비로그인 |
| jiwoo | 구매자. 무료 1개 받음, 이번 달 무료 크레딧(`monthly_grant`)만 보유, 18+ 자기 확인 완료. (유료 전환 단계: 유료 1개 받음·열기 전) |
| creator | 공개 중 무료 레시피 3개(프롬프트·스킬·에이전트), 판매 중지 1, 심사 중 1, 대기 명단 미신청. (유료 전환 단계: 판매자 등록 완료) |
| admin | `admin` 클레임 |

## SCN ↔ 파일

| SCN | 파일 | 통과 목표 주 |
|---|---|---|
| 비회원으로 구경하다 SAME 하기 | `scenarios/guest-to-same.spec.ts` | W3 |
| 유료 SAME · 쿠폰 · 원문 열기 | `scenarios/paid-same-coupon-open.spec.ts` | 유료 전환 |
| 열기 전 환불 | `scenarios/refund-before-open.spec.ts` | 유료 전환 |
| 열어 본 뒤엔 환불 대신 신고 | `scenarios/report-after-open.spec.ts` | 유료 전환 |
| SAME 인증이 갤러리로 | `scenarios/same-cert-to-gallery.spec.ts` | W6 |
| 체험 → SAME → 충전 → 생성 → 인증 (MVP: 무료 받기 → 월 크레딧 → 생성 → 인증) | `scenarios/trial-to-certify.spec.ts` | W7 |
| 첫 판매 등록(본인인증) | `scenarios/first-sale-registration.spec.ts` | W4 |
| 갤러리에서 포크 → 무료 공유 | `scenarios/fork-free-share.spec.ts` | W6 |
| 판매 중지된 레시피 | `scenarios/stopped-recipe.spec.ts` | W3 |
| 검색 결과 없음 → 인기 검색어로 | `scenarios/zero-result-search.spec.ts` | W2 |
| 마이페이지 한 바퀴 | `scenarios/my-page-tour.spec.ts` | W6 |
| 회원 탈퇴 → 다시 가입 | `scenarios/withdraw-rejoin.spec.ts` | W6 |

## 규칙

- 테스트 이름에 아이템 ID나 요구사항 ID를 넣는다: `test('PAY-03 동의 전 결제 버튼 비활성', …)`.
- EX(예외) 항목은 해당 SCN 파일 안의 `test.describe('EX', …)` 또는 컴포넌트 테스트로 옮긴다.
- 원문 비노출 검사: 익명·안 받은 회원으로 상세 HTML, RSC 페이로드, `/api/*` 응답에 시드 원문의 고유 샘플 문자열(`SAMEPLZ-SECRET-SAMPLE-…`)이 없는지 확인한다.
- 테스트를 지우거나 기대값을 약하게 고쳐 통과시키지 않는다.
