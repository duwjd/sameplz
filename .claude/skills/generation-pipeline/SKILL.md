---
name: generation-pipeline
description: 플레이그라운드 생성(공급자 어댑터, 웹훅, sweeper, Realtime, 워터마크, 모더레이션)을 구현할 때 쓴다.
---
# 생성 파이프라인 (PLAY)

참고: [failure-matrix.md](failure-matrix.md)(실패 24행), [models.md](models.md)(후보 모델·단가 공식). 크레딧은 `credit-ledger` 스킬, 원문은 `.claude/rules/hidden-content.md`.

모든 실패는 `settle_cell` 한 출구로 정산한다. 셀마다 정확히 한 번 capture 또는 release.

> **MVP(무료 출시)**: 체험 모드·워터마크(체험)·충전 창·본인인증이 없다. 2단계 사전 검사는 「인증 → 18+ 자기 확인(D5) → IP·기기 레이트 리밋(D13) → 모드 판정(내 레시피/받은 무료 레시피/빈 프롬프트)…」, 3단계 `start_run`은 계정 일일 한도(D11)와 전체 월 예산 예약(D12)을 홀드 전에 검사하고 걸리면 `DAILY_LIMIT`·`BUDGET_EXHAUSTED`로 아무것도 만들지 않는다. 잔액 부족은 충전 창 대신 「이번 달 크레딧을 다 썼어요 · 다음 리셋 날짜」. 모더레이션·AI 라벨·얼굴 동의·얼굴 결과물 표시는 그대로. 아래의 체험·충전 내용은 유료 전환 단계.

## 실행 시퀀스 10단계

1. **클라이언트 → `POST /api/play/runs`**: `recipe_version_id`, `variables{}`, `model_ids[≤3]`, `count`, `reference_upload_ids[]`, `face_consent`, `estimate_token`(price_version), `client_request_id`(「만들기」를 누를 때 만든 UUID = 멱등 키).
2. **서버 사전 검사**(아직 상태 없음): 인증 → 18+·본인인증(D5) → 모드 판정(체험/내 레시피/무료/빈 프롬프트 + 받음 여부) → 모델이 레시피 도구 목록에 있고 API가 있는지 → 변수 검증 → 레퍼런스가 본인 업로드인지 → 얼굴 동의 → **입력 모더레이션**(omni-moderation + 한국어 금지어) → **서버에서 프롬프트 렌더링** → `model_prices` 스냅숏. `estimate_token`이 낡았으면 409 "가격이 바뀌었어요".
3. **`private.start_run(...)`**(secret 키 클라이언트): 한 트랜잭션에 `play_runs`, 셀 행(모델×장), 체험이면 `trial_uses`, 셀별 홀드(보너스 먼저). 잔액 부족이면 아무것도 만들지 않고 부족분 반환 → 충전 창 → 같은 입력으로 재실행. 같은 `client_request_id`면 기존 실행 반환. 렌더링된 프롬프트는 `private.play_prompts`에만.
4. **공급자 제출(fan-out)**: `Promise.allSettled`. 웹훅 URL에 셀 id + 셀별 토큰(`/api/webhooks/generation/<provider>?cell=…&t=…`). `provider_request_id` 저장 → `submitted`. 제출 실패는 1회 즉시 재시도, 429면 `queued`로 두고 sweeper가 재시도, 영구 실패면 `settle_cell(fail)`.
5. **클라이언트**: 그리드 맨 위에 새 줄(자리표시), 비공개 채널 `run:{run_id}` 구독(`realtime.messages` RLS로 실행 주인만).
6. **웹훅 `/api/webhooks/generation/[provider]`**(Node): 원본 body 서명 검증(fal ED25519 / Replicate HMAC) → inbox unique(`provider`, `event_key`) → 비종료 이벤트 무시 → 종료 이벤트면 결과 내려받기 → 결과 모더레이션 → 체험·얼굴이면 워터마크 → 비공개 버킷 업로드 → `settle_cell(success)` → `realtime.send({cell_id, status, error_code, signed_url})`. 실패·안전 차단은 `settle_cell(fail, reason)`. 셀 상태 저장 뒤에만 2xx(5xx면 공급자가 재전송).
7. **Sweeper**(1분마다, `/api/cron/play-sweeper`): (a) `queued`이고 공급자 id 없음 → 제출·재시도 (b) `deadline_at` 지난 `submitted`/`running` → 공급자 조회 후 정산(Replicate는 1시간 안) (c) 만료 홀드 → 재확인 후 capture/release (d) 보존 기간 지난 레퍼런스 삭제.
8. **캡션·라벨**(P1): 성공 셀에 저가 비전 모델로 캡션. 크레딧과 무관, 실패해도 결과를 막지 않는다. 「AI 생성」 배지는 UI가 모든 칸에 그린다.
9. **취소**(P1): `queued`·`submitted`에서만. 공급자 취소 확인되면 release(`user_cancel`). `running`이면 취소 숨김.
10. **탭 닫음**: 서버는 그대로. 돌아오면 DB에서 그리드를 다시 읽고 재구독.

셀 상태: `queued → submitted → running → {succeeded | failed | blocked | canceled | expired}`. 종료 전이는 `settle_cell` 안에서만(원자적 claim). 실행 상태는 셀에서 파생(`running`/`succeeded`/`partial`/`failed`).

## 원문 비노출 체크리스트 7항목

1. 체험 실행에서도 프롬프트 렌더링은 서버에서만. 클라이언트에는 [변수] 이름·설명·예시만.
2. 렌더링 결과는 `private.play_prompts`에만 저장. `play_cells`·로그·Sentry·PostHog에 없음.
3. 공급자 요청·응답 객체를 클라이언트로 그대로 반환하지 않음. DTO 매핑.
4. Realtime 페이로드는 화이트리스트 4필드.
5. 체험 결과는 서버에서 워터마크를 박고 원본은 저장하지 않음. 워터마크 실패 시 워터마크 없는 파일로 대체하지 않음(실패로 정산).
6. 오류 메시지에 프롬프트 조각을 넣지 않음(공급자 오류 원문을 그대로 보여 주지 않고 사유 코드로).
7. 결과 파일은 비공개 버킷 + 짧은 서명 URL. 공급자 원본 URL을 클라이언트에 노출하지 않음.

## 어댑터

`src/lib/generation/providers/{fal,replicate,mock}.ts`가 같은 인터페이스(`submit`, `verifyWebhook`, `parseEvent`, `poll`, `cancel`)를 구현한다. `GENERATION_PROVIDER`로 고른다. 테스트와 e2e는 항상 `mock`(로컬 웹훅을 직접 호출, 실패 유형을 입력 플래그로 선택).

## 안전·고지 (F4-7~F4-9)

- 첫 실행 전 고지 팝업 확인 시각 저장("이 화면의 결과물은 생성형 AI로 만들었어요").
- 일반 결과물은 공급자 원본 바이트를 그대로 저장(C2PA·SynthID 유지). 체험·얼굴 결과물은 눈에 보이는 표시.
- 얼굴 사진: 실행마다 동의 체크, `play-refs/{user}/{upload}` 비공개 버킷, 공급자에는 10분 이하 서명 URL, 24시간~7일 뒤 삭제.
- 레퍼런스 이미지는 업로드 때, 결과 이미지는 방송 전에 모더레이션. `sexual/minors`는 텍스트 전용이라 이미지에는 다른 장치가 필요(열린 질문).
