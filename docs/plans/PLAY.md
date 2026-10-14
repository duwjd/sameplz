# PLAY 계획 (W5)

명세: `docs/specs/PLAY.md`, `docs/specs/F4-playground-credits.md`
파이프라인: `.claude/skills/generation-pipeline/` (`SKILL.md`, `failure-matrix.md`, `models.md`)
결정: D8(fal), D11, D12(상한 $50 ≈ 40,250C), D13, D17, D19(저장 안 한 결과물 30일)

PR은 세 개다. 앞 PR이 머지된 뒤 다음을 시작한다.

| PR | 브랜치 | 범위 |
|---|---|---|
| E | `feat/PLAY-schema` | 모델·가격·실행 SQL, pgTAP |
| F | `feat/PLAY-pipeline` | 어댑터(mock·fal), `POST /api/play/runs`, 웹훅, sweeper, 모더레이션 |
| G | `feat/PLAY-screen` | `/play`, `/my/credits`, 상세 진입점, e2e |

## PR E — SQL 인터페이스 (`create_playground` 마이그레이션)

### 모델과 가격
- **`public.models`**
  - 컬럼: `id text pk`, `provider text`(`fal`·`mock`), `endpoint text`, `kind image|video`, `label`, `params jsonb`, `accepts_reference boolean`, `deadline_seconds int`, `enabled`, `sort`
  - `anon`·`authenticated`는 `enabled` 행만 select한다.
  - **`params`** 형식: `{ "<name>": { "values": [...], "default": v } }`
    - 예: `{"image_size":{"values":["square_hd","portrait_4_3"],"default":"square_hd"},"quality":{"values":["low","medium","high"],"default":"medium"}}`
    - 영상 예: `{"duration":{"values":[5,10],"default":5},"resolution":{"values":["480p","720p"],"default":"480p"},"generate_audio":{"values":[false,true],"default":false}}`
  - 한 셀은 이미지 1장 또는 영상 1편이다. 장 수는 `count`로 셀을 여러 개 만든다(영상은 1).
- **`public.model_prices`**
  - 컬럼: `model_id`, `price_version int`, `rule jsonb`, `active`, `created_at`
  - 키는 `pk(model_id, price_version)`이고, 모델당 active는 1행뿐이다.
  - 클라이언트는 읽지 않는다. 견적 RPC로만 본다.
  - **`rule`** 형식: `{ "unit": "image"|"second", "keys": ["quality","image_size"], "usd": { "medium|square_hd": 0.053, ... }, "per_reference_usd": 0.01? }`
    - `usd`의 키는 `keys` 순서대로 파라미터 값을 `|`로 이어 붙인다. 불리언은 `true`·`false`로 쓴다.
    - `unit = second`이면 `params.duration`(초)를 곱한다.
- **`private.quote_cell(p_model text, p_params jsonb, p_refs int default 0) → table(credits int, price_version int)`**
  - 파라미터 검증
    - 모르는 키, 허용되지 않은 값, 비활성 모델은 `INVALID_PARAMS`를 낸다.
    - 빠진 키는 `default`로 채운다.
  - 계산
    - `usd = lookup × (unit=second ? duration : 1) + per_reference_usd × refs`
    - `credits = ceil(usd × 805)`(D17), 최소 1
- **`public.quote_play(p_cells jsonb) → jsonb`**
  - 권한: `authenticated`
  - 입력: `[{model, params, count}]`
  - 출력: `{total, cells:[{model, params(채워진 값), credits, count}], price_versions:{model: v}}`
  - 모델은 최대 3개, 셀 합계는 최대 12개다. 넘으면 `INVALID_PARAMS`다.

### 실행
- **`public.play_runs`**
  - 컬럼: `id`, `user_id`, `mode own|free|blank`, `recipe_version_id null`, `client_request_id uuid`, `variables jsonb`(이름 → 사용자 입력 값), `reference_ids uuid[]`, `face_consent_at`, `created_at`
  - `unique(user_id, client_request_id)`
  - 본인만 select한다.
- **`public.play_cells`**
  - 컬럼: `id`, `run_id`, `user_id`, `model_id`, `params jsonb`, `price_credits`, `price_version`, `status`, `error_code`, `provider_request_id unique`, `webhook_token_hash`, `attempts`, `next_attempt_at`, `submitted_at`, `deadline_at`, `finished_at`, `result_path`, `saved_at`, `delete_after`, `created_at`
  - `status`: `queued → submitted → running → {succeeded | failed | blocked | canceled | expired}`
  - 본인만 select하고, 쓰기는 definer뿐이다.
  - `credit_holds.cell_id`에 `play_cells(id)` FK를 건다.
- **`private.play_prompts(run_id pk, rendered text)`**
  - 클라이언트 권한은 없다.
  - 읽기는 `public.play_prompt_for_submit(p_cell)`(service_role)뿐이고, 앱에서는 `src/data/secrets.ts`만 부른다.
- **`public.play_refs`**
  - 컬럼: `id`, `user_id`, `path`(`{user}/{uuid}.{ext}`), `mime`, `size`, `created_at`, `delete_after = created_at + 24h`
  - 본인만 select한다.
- **`public.face_consents(run_id, ref_id, user_id, consented_at)`**: 실행마다 남긴다(F4-8).
- **`public.generation_webhook_inbox(provider, event_key, cell_id, received_at)`**: `pk(provider, event_key)`
- **`profiles.ai_notice_ack_at`** + **`public.ack_ai_notice()`**(authenticated)
- **버킷**
  - `play-refs`: 비공개, 10MB, 이미지
  - `play-results`: 비공개, 이미지·영상, 200MB

### 서버 전용 RPC (service_role만, `complete_signup_credits` 패턴)
- **`public.start_run(p_user, p_client_request_id, p_mode, p_recipe_version_id, p_variables, p_cells, p_price_versions, p_reference_ids, p_face_consent, p_rendered_prompt, p_ip_hash, p_device_hash) → jsonb`**
  - 같은 `(user, client_request_id)`가 있으면 `{ok:true, run_id, existing:true}`를 돌려준다(FM-18).
  - **사전 검사**(실패하면 `{ok:false, reason}`, 행은 남지 않는다)
    1. `AI_NOTICE_REQUIRED`: 고지 확인이 없다.
    2. `NOT_ENTITLED`
       - `own`: 버전이 본인 레시피가 아니다.
       - `free`: 그 레시피 권리가 없다.
       - `blank`: 버전이 있으면 안 된다.
    3. `INVALID_REFERENCE`: 레퍼런스가 본인 것이 아니거나 만료됐거나, 레퍼런스를 받지 않는 모델에 붙였다.
    4. `FACE_CONSENT_REQUIRED`: 레퍼런스가 있는데 `p_face_consent`가 아니다.
    5. `INVALID_PARAMS`: 견적 계산이 실패했다.
    6. `PRICE_CHANGED`: `p_price_versions`가 지금 active 버전과 다르다(FM-20).
    7. `check_run_allowed(total)`의 코드
       - 대상: `ADULT_REQUIRED`, `GENERATION_SUSPENDED`, `DAILY_LIMIT`, `RATE_LIMITED`, `BUDGET_EXHAUSTED`, `INSUFFICIENT_CREDITS`(+ `shortfall`)
       - 레이트 버킷 증가는 남는다.
  - **본문**: run → 셀(모델 × count, `queued`) → 프롬프트 → `face_consents` → 셀마다 `place_hold`
    - 하나라도 `ok:false`면 블록 전체를 되돌린다. 실행·셀·홀드·원장·예산 어느 것도 남지 않는다.
  - **반환**: `{ok:true, run_id, cell_ids:[...], total}`
- **`public.claim_cell_submit(p_cell) → jsonb`**
  - `queued`이고 `next_attempt_at <= now()`이며 `attempts < 3`일 때만 진행한다.
  - 하는 일: 새 웹훅 토큰을 만들고(해시만 저장), `attempts + 1`을 한다.
  - 반환: `{ok, token, endpoint, provider, model_id, kind, params, run_id, user_id}`
  - 시도를 다 썼으면 `finish_cell(cell, 'failed', 'PROVIDER_UNAVAILABLE')`를 부르고 `{ok:false, reason:'EXHAUSTED'}`를 돌려준다(FM-21).
  - 아직 때가 아니거나 queued가 아니면 `{ok:false, reason:'NOT_QUEUED'}`다.
- **`public.mark_cell_submitted(p_cell, p_provider_request_id)`**
  - `queued`일 때만 `submitted`로 바꾸고, `deadline_at = now() + models.deadline_seconds`를 넣는다.
  - 이미 종료된 셀이면 noop이다.
- **`public.requeue_cell(p_cell, p_error_code)`**
  - `queued`를 유지하고 `next_attempt_at = now() + 1분 × attempts`로 미룬다(429·제출 실패).
- **`public.mark_cell_running(p_cell)`**: `submitted`만 `running`으로 바꾼다.
- **`public.finish_cell(p_cell, p_status, p_error_code, p_result_path) → jsonb`**
  - **claim**: 종료 상태가 아닐 때만 `update … returning`으로 바꾼다. 아니면 `{finished:false}`(FM-9 noop)를 돌려준다.
  - **outcome 대응**
    - `succeeded` → `success`
    - `failed`·`expired` → `model_error`
    - `blocked` → `safety_blocked`
    - `canceled` → `canceled`
  - **이어지는 일**
    - `settle_cell`
    - `succeeded`면 `delete_after = created_at + 30일`(D19)
    - `blocked`면 `record_moderation_block(user)`
    - `realtime.send({cell_id, status, error_code}, 'cell', 'run:'||run_id, true)`
  - **반환**: `{finished:true, captured}`
- **`public.verify_cell_token(p_cell, p_token) → jsonb`**: 해시가 맞으면 `{ok:true, status, provider_request_id, run_id, user_id, model_id, kind}`, 아니면 `{ok:false}`(FM-11)
- **`public.attach_provider_request(p_cell, p_provider_request_id)`**: id가 아직 없으면 채운다(FM-10, 웹훅이 먼저 온 경우).
- **`public.record_webhook_event(p_provider, p_event_key, p_cell) → boolean`**: 처음이면 true를 돌려준다(FM-9).
- **`public.sweep_targets() → jsonb`**
  - `resubmit`: 다시 낼 셀(`queued`, 때가 됨)
  - `poll`: 마감이 지난 셀(`submitted`·`running`이고 `deadline_at < now()`) — `{cell, provider_request_id, endpoint, provider}`
  - `stale`: 10분 넘게 `queued`인 셀은 SQL이 바로 `failed` / `PROVIDER_UNAVAILABLE`로 끝낸다(FM-17·21).
  - `expired_refs`: `[{id, path}]` 만료된 레퍼런스. 이 함수는 행을 지우지 않는다.
  - `expired_results`: `[{id, path}]` 저장하지 않았고 `delete_after`가 지난 결과. `result_path`는 그대로 둔다.
- **`public.purge_play_files(p_ref_ids uuid[], p_cell_ids uuid[])`**: 앱이 Storage에서 파일을 지운 **뒤에** 부른다. 만료된 레퍼런스 행을 지우고, 만료된 결과의 `result_path`를 null로 바꾼다. 아직 만료 전이거나 저장된 것은 건드리지 않는다. 두 단계라서 Storage 삭제가 실패해도 경로를 잃지 않는다.
- **`public.create_play_ref(p_user, p_ext, p_mime, p_size) → jsonb`**: 서버가 `{user}/{uuid}.{ext}` 경로를 만들고 행을 넣는다. 사용자당 시간당 30개, 넘으면 `RATE_LIMITED`. 확장자가 png·jpg·jpeg·webp가 아니면 `INVALID_FILE`.
- **`public.play_prompt_for_submit(p_cell) → text`**: `secrets.ts` 전용
- **`public.save_play_cell(p_cell, p_saved boolean)`**(authenticated, 본인이고 성공한 셀만)
  - 저장하면 `saved_at = now()`, `delete_after = null`이다.
  - 저장을 풀면 `saved_at = null`, `delete_after = created_at + 30일`이다.

### Realtime
- `realtime.messages`에 select 정책을 건다.
  - 대상: `authenticated`
  - 조건: `realtime.topic() = 'run:' || id`인 본인 `play_runs`가 있을 때만
- 페이로드는 `cell_id`, `status`, `error_code`만 싣는다. 결과 URL은 클라이언트가 서버에서 다시 읽는다(화이트리스트 4필드 안).

### cron
- **`sameplz-play-sweeper`**(매분): `private.call_play_sweeper()`
  - Vault 비밀 `sameplz_site_url`·`sameplz_cron_secret`을 읽고 `net.http_post`로 `/api/cron/play-sweeper`를 부른다.
  - 비밀이 없으면 아무것도 하지 않는다(로컬).

### 운영 예산
- 이번 KST 달과 다음 달 `generation_budget` 행을 40,250C로 만든다.
  - 행이 이미 있으면 그대로 둔다.
  - `admin_actions`에 기록한다.
- seed의 로컬 행은 100,000C upsert로 덮는다.

## PR E 수용 테스트 (`supabase/tests/play.test.sql`, 이름에 FM 번호)

| 영역 | 확인할 것 |
|---|---|
| 견적 | 이미지 크기×품질 값, 영상 초×해상도×오디오 값, `ceil(USD×805)`, 기본값 채움, 모르는 값은 `INVALID_PARAMS`, 4번째 모델은 거절 |
| 사전 검사 | `AI_NOTICE_REQUIRED`, `NOT_ENTITLED`(own·free·blank), `INVALID_REFERENCE`(남의 레퍼런스·만료), `FACE_CONSENT_REQUIRED`, `PRICE_CHANGED`(FM-20), `DAILY_LIMIT`, `INSUFFICIENT_CREDITS` + shortfall(FM-1), `BUDGET_EXHAUSTED`(상한 0, paused) — 모두 play_runs·play_cells·credit_holds·ledger·budget에 변화 없음 |
| 레이트 | 같은 사용자 분당 6번째는 `RATE_LIMITED` |
| 멱등 | 같은 `client_request_id` 두 번이면 실행 1개, 홀드 1회(FM-18) |
| 원자성 | 셀 3개 중 하나가 홀드에 실패하면(합계가 하루 한도 초과) 아무것도 남지 않음 |
| 정산 | succeeded → capture, `available` 감소. failed → release(FM-5), blocked → release(FM-4·6) + `abuse_signals`. 두 번째 `finish_cell`은 noop(FM-9). 부분 성공이면 셀마다 따로 정산(FM-14) |
| 원장 불변식 | 매 시나리오 뒤 `Σ ledger.delta = available`, `held = 활성 홀드 합`, `budget.reserved = held 홀드 합` |
| 제출 | `claim_cell_submit`이 토큰을 돌려주고 해시만 저장, 3회 넘으면 `PROVIDER_UNAVAILABLE`로 release(FM-21). `requeue_cell` 백오프 |
| 웹훅 | `verify_cell_token`이 틀린 토큰은 거절(FM-11). `record_webhook_event` 중복은 false(FM-9). `attach_provider_request`(FM-10) |
| sweeper | 마감 지난 셀이 poll 대상(FM-7·8), 10분 넘은 queued는 실패 + release(FM-17), 만료 레퍼런스·결과 경로가 목록에 나옴, `purge_play_files` 뒤에야 행 삭제·경로 null(만료 전·저장된 것은 그대로), `create_play_ref` 경로·한도 |
| 보관 | 성공하면 `delete_after = +30일`, 저장하면 null, 저장을 풀면 되돌림. 남의 셀은 저장 불가 |
| 권한 | anon·authenticated는 서버 RPC·`private.play_prompts`·`model_prices`를 못 씀. 본인 run·cell만 보임. 남의 `run:` 토픽 메시지는 안 보임 |
| Realtime | `finish_cell` 뒤 `realtime.messages` 페이로드 키가 정확히 `cell_id`·`status`·`error_code` |
