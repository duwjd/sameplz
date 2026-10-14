---
paths:
  - "src/data/**"
  - "src/app/**/r/**"
  - "src/app/**/play/**"
  - "src/app/api/**"
  - "src/lib/generation/**"
---
# 원문 비노출 규칙

원문(프롬프트 본문, SKILL.md 본문·참고 파일, 에이전트 설정, 렌더링된 프롬프트)은 받은 사람이 「원문 보기」를 누를 때만, 서버에서 한 번 꺼낸다. 아래를 어기면 판매 상품이 새어 나간다.

1. `recipe_version_secrets`와 `private.play_prompts`는 `src/data/secrets.ts` 안에서만 select 한다. 다른 파일에서 테이블 이름이 보이면 PostToolUse 훅이 경고한다.
2. 클라이언트 컴포넌트(`'use client'`)에 원문을 props로 넘기지 않는다. RSC 페이로드도 브라우저로 간다.
   - 예외: 작성자 본인이 쓰는 중인 원문(올리기 초안 `recipe_drafts`, 「새 버전 올리기」·「고쳐서 다시 제출」 미리 채우기)은 본인에게만 간다. 초안은 본인 RLS로만 읽고, 지난 버전 원문은 `loadOwnOriginal` 서버 액션 → `src/data/secrets.ts`로만 꺼낸다. 캐시하지 않는다.
3. 레시피 키만으로 사용자별 결과를 캐시하지 않는다(`"use cache"`, `unstable_cache`, fetch 캐시 모두).
4. 공급자 응답 객체를 그대로 반환하지 않는다. 필요한 필드만 DTO로 매핑한다.
5. Sentry `beforeSend`에서 `prompt`, `input`, `variables`, `body` 필드를 지운다. PostHog 이벤트 속성에도 넣지 않는다.
6. `realtime.send()` 페이로드는 화이트리스트(`cell_id`, `status`, `error_code`, `signed_url`)만.
7. 체험 실행은 본문을 서버에서 렌더링해 공급자에게만 보낸다. 응답·로그·DB(`play_cells`)에 렌더링 결과를 남기지 않는다.
8. 원문 응답(`open_original`)에는 받은 사람 식별 정보(워터마크 텍스트)를 넣는다.
9. 파일은 `/api/files/[versionId]`에서 권리를 확인한 뒤 약 60초 서명 URL로 리다이렉트한다. 공개 버킷에 두지 않는다.
10. 비공개·심사 중 레시피는 남에게 `notFound()`. 존재 여부도 알리지 않는다.

검증: e2e에서 익명·안 받은 회원으로 상세 HTML, RSC 페이로드, `/api/*` 응답에 시드 원문 샘플 문자열이 없는지 본다(`e2e/CLAUDE.md`).
