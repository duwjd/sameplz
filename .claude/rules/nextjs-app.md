---
paths:
  - "src/app/**/*.ts"
  - "src/app/**/*.tsx"
  - "src/actions/**"
  - "src/data/**"
  - "src/proxy.ts"
---
# Next.js 16 규칙

## 함정

- `middleware.ts`는 `proxy.ts`(Node 런타임)로 바뀌었다. 세션 갱신만 한다.
- `params`, `searchParams`, `cookies()`, `headers()`는 비동기다. `await` 한다.
- `revalidateTag(tag, 'max')`처럼 cacheLife 프로필을 넘긴다. 쓰기 직후 반영은 `updateTag(tag)`.
- 병렬 라우트에는 `default.js`가 필요하다.
- 외부 이미지는 `images.remotePatterns`에 등록한다(Supabase Storage 도메인).
- 서버에서는 `supabase.auth.getClaims()`. `getSession()`은 쿠키를 그대로 믿으므로 인가에 쓰지 않는다.
- 캐시된 응답에 `Set-Cookie`가 섞이지 않게 사용자별 화면은 동적으로 둔다.

## 서버 액션 5단계

서버 액션은 직접 POST로 닿는 공개 엔드포인트다. 액션마다 다시 확인한다.

```ts
'use server'
export async function requestRefund(input: unknown) {
  const { orderId } = RefundInput.parse(input)            // 1 zod
  const claims = await getClaimsOrThrow()                  // 2 getClaims()
  await assertOwnsOrder(claims.sub, orderId)               // 3 소유권 (IDOR 방지)
  const result = await rpc('refund_order', { p_order_id: orderId }) // 4 RPC (돈 계산은 SQL)
  updateTag(`user:${claims.sub}:orders`)                   // 5 updateTag
  return toRefundDTO(result)
}
```

- 반환값은 DTO. DB 행이나 공급자 객체를 그대로 반환하지 않는다.
- 비싼 액션은 레이트 리밋: `createRun`, `requestRefund`, `checkHandle`, `createReport`.
- 폼 스키마는 zod 하나를 클라이언트(react-hook-form)와 서버 액션이 같이 쓴다(`src/lib/validation`).
- DAL(`src/data/*`)은 파일 맨 위에 `import 'server-only'`.
- 라우트 핸들러는 OAuth 콜백, 결제 웹훅, `POST /api/play/runs`, 생성 웹훅, 파일 리다이렉트, 크론 6곳만. 웹훅은 원본 body(`await req.text()`)로 서명 검증한 뒤 파싱. 라우트 핸들러는 기본이 Node 런타임이다 — `export const runtime`은 `cacheComponents: true`와 함께 쓸 수 없어 빌드 오류가 나므로 쓰지 않는다.
- 함수 리전은 `vercel.json`의 `icn1`. 4.5MB 넘는 업로드는 서명 업로드 URL로 Storage 직행.
