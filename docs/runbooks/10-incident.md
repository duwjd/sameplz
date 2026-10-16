# 10 장애

알림은 운영 웹후크(`OPS_ALERT_WEBHOOK_URL`, Slack·Discord)로 온다. 1분 sweeper(`/api/cron/play-sweeper`, pg_cron `sameplz-play-sweeper`)가 보낸다. **sweeper가 멈추면 알림도 멈춘다**(아래 「크론」).

## 알림별 첫 조치

| 알림 | 등급 | 첫 조치 |
|---|---|---|
| 생성 예산 80% | P1 | 이번 달 남은 날과 사용 추세를 본다. 올릴지 정한다(아래 「예산」) |
| 생성 마감(100%, 예산 소진 / 수동 정지) | P0 | 킬 스위치가 선 상태. 기다리면 다음 달 1일 자동 재개. 올리려면 「예산」 |
| 24시간 넘은 심사 N건 | P1 | 런북 04 |
| 20시간 넘게 답하지 않은 신고 N건 | P1 | 런북 03 |
| 크레딧 원장 불일치 | P0 | 아래 「원장 불일치」 |
| 최근 1시간 공급자 실패율 30% 초과 | P0 | 아래 「공급자 장애」 |

- 원장 불일치·공급자 실패율 알림은 스위퍼가 1분마다 `public.ops_health()`를 보고, 종류마다 시간당 한 번만 보내요(`[SAMEPLZ][P0] …`).

## 예산·킬 스위치 (D12)
- 상한은 `public.generation_budget`(월별 `cap_credits`, `reserved`, `spent`, `state = open | paused`). 운영 상한은 월 40,250C(≈ $50).
- `reserved + spent + 이번 홀드 > cap` 이거나 `state = 'paused'`면 `start_run`이 `BUDGET_EXHAUSTED`로 거절한다. 이미 제출된 셀은 끝까지 정산된다.
- **올리기·재개·수동 정지**: Supabase SQL Editor(운영)에서
  ```sql
  -- 서명: private.admin_set_budget(p_actor uuid, p_month date, p_cap integer, p_state text, p_reason text)
  select private.admin_set_budget('<관리자 profiles.id>', private.kst_month(), 60000, 'open', '사유');
  ```
  - `admin_actions`(`budget_update`)에 자동으로 남는다. 사유가 비면 거절된다.
  - 상한을 바꾸면 80% 알림이 다시 울릴 수 있게 초기화된다.
  - 다음 달 행은 이미 만들어져 있을 수 있다(`prepare_budget_months`는 있는 행을 덮지 않는다). 다음 달도 바꾸려면 `(private.kst_month() + interval '1 month')::date`로 한 번 더 부른다.
  - 수동 정지는 `'paused'`, 재개는 `'open'`.
- **fal 지출 한도도 같이 올린다.** 앱 상한보다 fal 한도가 낮으면 fal이 거절해 셀이 실패한다(크레딧은 돌아감).

## 원장 불일치 (P0)
- `public.ops_health()`의 `ledger_mismatch`: `available < 0`·`held < 0`, `available ≠ Σ원장`, `available + held ≠ Σ로트 remaining`인 계정 수예요(`20261016063829_ops_health_alerts.sql`).
1. 생성을 멈출지 정한다: 피해가 퍼지면 `admin_set_budget(..., 'paused', '원장 불일치 조사')`.
2. 해당 계정의 원장을 `/admin/users/<id>` 「최근 원장」과 SQL로 본다. 원장은 append-only라 고치지 않는다.
3. 회원 손해는 「크레딧 조정하기」(±1000C, 사유는 회원에게 보임)로 보상한다.
4. 원인(코드·마이그레이션)은 forward-fix 마이그레이션으로 고친다(아래 「배포 되돌리기」). payment-auditor 감사를 받는다.

## 공급자 장애 (fal)
- 증상: 셀이 「지금 모델이 붐벼서 만들지 못했어요 · N C를 돌려드렸어요」로 끝난다.
  - 제출이 일시 실패하면 큐로 돌아가 다시 시도(`PROVIDER_BUSY`). 3번 넘거나 10분 넘게 큐에 있으면 `PROVIDER_UNAVAILABLE`로 실패.
  - **크레딧은 자동으로 돌아간다.** 회원에게 따로 보상할 필요가 없다.
  - 결과를 모르는 제출(`PROVIDER_ERROR`)은 다시 제출하지 않는다(이중 과금 방지). 크레딧은 돌아가고 예산은 쓴 것으로 잡는다.
- 확인: fal 상태 페이지·대시보드, 동시 요청 한도(신규 계정 2건, D8), 지출 한도 도달 여부, `FAL_KEY`·`FAL_USER_ID`.
- 길어지면 `paused`로 막아 실패 셀이 쌓이지 않게 하고, 복구 뒤 `open`.

## 크론
| 작업 | 시각 | 확인 |
|---|---|---|
| `sameplz-play-sweeper` | 매분 | Vault `sameplz_site_url`·`sameplz_cron_secret`이 없으면 조용히 아무것도 안 한다. Vercel 로그에 `/api/cron/play-sweeper` 200이 매분 찍히는지, 401이면 `CRON_SECRET`과 Vault 값이 다름 |
| `sameplz-monthly-grant` | 매일 00:00 KST | 지급 실패는 `abuse_signals.kind = 'grant_failed'` |
| `sameplz-play-expire` | 5분 | 오래된 셀 만료 |
| `sameplz-prune-abuse`·`sameplz-purge-withdrawn` 등 | 매일 | 보관 기간 정리(D20·D22) |

- 상태: SQL Editor에서 `select jobname, status, start_time from cron.job_run_details order by start_time desc limit 50;`

## 월초 리셋 (매월 1일 00:00 KST)
- `run_monthly_grants`가 먼저 `expire_bonus()`로 지난 달 로트를 소멸시킨다. 이때 **만료 로트가 있는 모든 계정을 한 트랜잭션에서 잠근다.** 1일에는 거의 모든 계정이 해당한다.
- 그동안 실행·홀드가 잠깐 기다린다. **짧은 지연이고 데드락이 아니다.** 커밋 뒤 회원별 지급은 한 명씩 커밋된다.
- 1일 아침에 `grant_failed` 신호와 예산 행(이번 달 `open`)을 확인한다.

## 배포 되돌리기
- **앱(Vercel)**: Deployments에서 직전 정상 배포를 Promote(Instant Rollback)한다. 그다음 `dev`에서 고쳐 정상 흐름(`dev → stg → main`)으로 다시 낸다.
- **DB**: 적용된 마이그레이션은 고치지 않는다. 되돌리는 내용을 **새 마이그레이션(forward-fix)**으로 쓴다. `main` 머지 → `deploy-db`가 `production` 환경 승인을 기다린다 → 승인하면 `supabase db push`.
  - 앱만 되돌리면 옛 코드가 새 스키마에서 돈다. 마이그레이션은 이전 앱과 호환되게 쓴다(추가 → 다음 PR에서 삭제, D14).
  - 운영 DB에 직접 DDL을 치지 않는다. 비상 데이터 수정은 런북 12.
- Supabase Free는 일일 백업·PITR이 없다(D14). 데이터 복구는 기대하지 않는다.

## 용량 기준
`scripts/load/run.mjs`(로컬 전용, 운영 주소는 거부)로 2026-10-16에 잰 값이에요. 로컬 prod 빌드 + 로컬 Supabase + mock 공급자라 운영(Vercel icn1 + Supabase Free)과 숫자가 같지는 않고, 병목이 어디인지 보는 기준선이에요.

| 시나리오 | 조건 | 결과 |
|---|---|---|
| 공개 페이지 읽기 | 동시 20, 30초, `/`·마켓·갤러리·상세·이용 안내 | 4,694건, p50 144ms · p95 210ms · 오류 0% |
| 생성 실행 | 회원 10명 × 3회 동시, 셀 3개(33C) | 30건 모두 201, p50 263ms · p95 375ms, 끝난 뒤 `ops_health` 원장 불일치 0 |
| 한도 초과 | 회원 3명 × 7회 동시 | 12건 201, 9건 403 `DAILY_LIMIT`(하루 135C), 5xx 0, 원장 불일치 0 |

- 실제 한계는 서버가 아니라 **공급자 동시성(fal)과 월 예산**이에요. fal 동시 처리 수를 넘는 셀은 큐에 남고 스위퍼가 다시 보내요.
- Supabase Free의 DB 연결 수가 먼저 찰 수 있어요. 5xx가 늘면 Supabase 대시보드의 연결 수를 먼저 봐요.
- 다시 재려면:

```bash
node scripts/load/run.mjs read --concurrency 20 --seconds 30
node scripts/load/run.mjs play --users 10 --runs 3
```
