# 후보 모델과 단가

D8 closed(2026-10-15): fal 기본, 어댑터 뒤. 모델 목록은 사용자 지정(「8개 이하」 권고보다 넓다). 출시 체험은 없다(D6). 실제 목록·단가의 출처는 마이그레이션 `create_playground`의 `models`·`model_prices`이고, 이 문서는 요약이다.

## 단가 공식

```
크레딧 ≈ 공급자 USD × 1,450 × 1.8 ÷ 8.75 ÷ 0.37 ≈ USD × 805   → 정수로 반올림(일부러 둥근 숫자를 쓰지 않음)
```

- **D17(2026-10-13)**: 1C ≈ 3.7원(이전 1C=10원의 0.37배). 화면에 원화 환산을 쓰지 않는다. 아래 원 단가는 내부 원가 확인용이다.

- 8.75원: 가장 싼 팩(30,000원 = 3,300C)의 크레딧당 매출 9.09원에서 카드 수수료 3.4% + 부가세를 뺀 값
- 1,450원: 2026-09-10 종가 1,339.2원에 약 8% 원화 약세 여유
- 1.8배 가산: 최악의 경우 마진 약 44%
- 가격은 `model_prices(model_id, unit, credits, price_version)`에 두고 바꿀 때마다 `price_version`을 올린다. 코드에 박지 않는다.

## 출시 목록 (2026-10-15, fal 모델 페이지 기준)

기본값 1셀 크레딧은 `ceil(USD × 805)`. 하루 한도 135C(D11)를 넘는 설정은 견적에서 막힌다.

| id | 엔드포인트(레퍼런스 있을 때) | 가격 규칙 | 기본값 1셀 |
|---|---|---|---|
| gpt-image-2 | `openai/gpt-image-2` (`/edit`) | 장당, 품질×크기(low $0.005~ / medium $0.037~0.053 / high $0.145~0.211) | medium 1024² 43C |
| gpt-image-2.5-flare · -sunburst | `openai/gpt-image-2.5/{flare,sunburst}/text-to-image` (`/edit`) | 장당, 1024² 품질별 $0.00588 / 0.01317 / 0.05268 / 0.09366 | medium 11C |
| nano-banana-2 | `fal-ai/nano-banana-2` (`/edit`) | 장당 $0.08 × 해상도(0.5K ×0.75, 2K ×1.5, 4K ×2) | 1K 65C |
| nano-banana-pro | `fal-ai/nano-banana-pro` (`/edit`) | 장당 $0.15, 4K ×2 | 1K 121C |
| grok-imagine-image-2 | `xai/grok-imagine-image/v2.0/text-to-image` (`/edit`, 레퍼런스당 +$0.01) | 장당 1k low $0.04 ~ 2k medium $0.08 | 1k low 33C |
| grok-imagine-video-1.5-lite | `xai/grok-imagine-video/v1.5/lite/text-to-video` (`image-to-video`) | 초당 480p $0.02 / 720p $0.03 / 1080p $0.14 | 480p 5초 81C |
| grok-imagine-video-1.5 | `xai/grok-imagine-video/v1.5/text-to-video` (`image-to-video`) | 초당 480p $0.08 / 720p $0.14 / 1080p $0.25 | 480p 3초 194C |
| kling-v3-standard | `fal-ai/kling-video/v3/standard/text-to-video` (`image-to-video`) | 초당 오디오 끔 $0.084 / 켬 $0.126 | 3초 203C |
| kling-v3-pro | `fal-ai/kling-video/v3/pro/text-to-video` (`image-to-video`) | 초당 $0.112 / $0.168 | 3초 271C |
| seedance-2.0-fast | `bytedance/seedance-2.0/fast/text-to-video` (`image-to-video`) | 토큰 과금 → 16:9 면적 기준 초당 480p 약 $0.108 / 720p 약 $0.2419 | 480p 4초 348C |
| seedance-2.5 | `bytedance/seedance-2.5/text-to-video` (`image-to-video`) | 토큰 과금 → 초당 480p 약 $0.2205 / 720p $0.473 / 1080p $1.164 | 480p 4초 711C |

- 요청에 있었지만 fal에 없는 것: **Grok Imagine Image 1.5**(1.5는 영상만 있다). 넣지 않았다.
- GPT Image는 토큰 과금이라 표 값은 추정이다(긴 프롬프트는 더 든다). Seedance는 프레임 면적 기준이라 가장 넓은 16:9로 잡았다. 운영 키가 들어오면 fal 가격 API(`/v1/models/pricing`)로 다시 맞추고 `price_version`을 올린다.
- 현재 하루 한도 135C 안에 드는 영상은 Grok Video 1.5 Lite뿐이다(480p 최대 8초, 720p 5초). Grok Video 1.5(480p 3초 194C)·Kling·Seedance는 목록에 보이지만 견적에서 막힌다. D11을 바꿀지는 창업자 판단이다.

## 공급자 메모

- fal: 신규 계정 동시 실행 2건(초과분은 거절되지 않고 대기열), 최근 4주 결제액에 따라 자동 상향(셀프서브 최대 40). 웹훅 ED25519 서명(JWKS `https://rest.fal.ai/.well-known/jwks.json`, 메시지 = request_id·user_id·timestamp·sha256(body) hex를 줄바꿈으로, ±300초). 첫 전달 타임아웃 15초, 이후 재시도 120초·최대 31회, 3xx는 영구 실패 → 이미지 finalize는 그 안에, 영상은 기록 후 200 반환하고 후속 작업. 안전 차단은 HTTP 422 `content_policy_violation`(재시도 불가), 과금될 수 있다고 본다. 결과 파일은 fal CDN에 최소 7일.
- Replicate: 입출력이 1시간 뒤 삭제 → sweeper는 1시간 안에 조회. 웹훅 HMAC.
- 공통: 지연 p50/p95, 안전 차단 과금 여부는 W1 스파이크로 측정(미확인).

## 지표

실행 성공률, 누수율(공급자는 과금, 사용자에겐 반환) — 지출의 3% 초과 시 알림, 모델별 실현 마진 30% 미만 시 알림, 체험→구매 전환, 첫 결과까지 시간 중앙값.
