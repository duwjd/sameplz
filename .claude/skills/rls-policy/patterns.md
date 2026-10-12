# RLS 패턴 SQL

아래는 형태를 보여 주는 예시다. 컬럼 이름은 `docs/architecture.md`의 테이블 묶음을 따른다. 실제 마이그레이션에서 그대로 복사하기 전에 테이블 정의와 맞춘다.

## 0. 도우미 함수 (private)

```sql
create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'admin')::boolean, false)
$$;

create or replace function private.has_entitlement(p_recipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = (select auth.uid())
      and e.recipe_id = p_recipe_id
      and e.revoked_at is null
  )
$$;

revoke execute on function private.is_admin() from public, anon;
revoke execute on function private.has_entitlement(uuid) from public, anon;
grant execute on function private.has_entitlement(uuid) to authenticated;  -- 정책 평가용
```

> 정책 안에서 부르는 도우미는 `authenticated`가 실행할 수 있어야 한다. 돈을 움직이는 RPC와 혼동하지 않는다(그쪽은 authenticated 실행 권한을 뺀다).

## 1. 공개 카탈로그

```sql
alter table public.recipes enable row level security;

create policy recipes_select_public on public.recipes
  for select to anon, authenticated
  using (status = 'live' or status = 'stopped');   -- stopped: 상세는 STOP 화면으로 보임, 목록 쿼리는 status='live'로 거른다

create policy recipes_select_owner on public.recipes
  for select to authenticated
  using (owner_id = (select auth.uid()));

create index if not exists recipes_owner_id_idx on public.recipes (owner_id);
```

## 2. 소유자 전용

```sql
alter table public.recipe_drafts enable row level security;

create policy drafts_select_own on public.recipe_drafts
  for select to authenticated using (user_id = (select auth.uid()));
create policy drafts_insert_own on public.recipe_drafts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy drafts_update_own on public.recipe_drafts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy drafts_delete_own on public.recipe_drafts
  for delete to authenticated using (user_id = (select auth.uid()));
```

## 3. 판매자 전용 (읽기만, 쓰기는 RPC)

```sql
alter table public.seller_earnings enable row level security;

create policy earnings_select_seller on public.seller_earnings
  for select to authenticated using (seller_id = (select auth.uid()));
-- INSERT/UPDATE/DELETE 정책 없음 → private RPC(security definer)만 쓴다.
```

## 4. 원문 (정책 0개)

```sql
alter table public.recipe_version_secrets enable row level security;
-- 정책을 만들지 않는다. anon/authenticated는 0행.
-- 접근은 private.open_original(...) 같은 security definer 함수와 src/data/secrets.ts 만.
```

## 5. 소셜 + 권리

```sql
alter table public.gallery_posts enable row level security;

create policy posts_select_visible on public.gallery_posts
  for select to anon, authenticated
  using (status = 'visible' or author_id = (select auth.uid()));

create policy posts_insert_original on public.gallery_posts
  for insert to authenticated
  with check (author_id = (select auth.uid()) and kind = 'original'
              and exists (select 1 from public.recipes r where r.id = recipe_id and r.owner_id = (select auth.uid())));

create policy posts_insert_same_cert on public.gallery_posts
  for insert to authenticated
  with check (author_id = (select auth.uid()) and kind = 'same_cert'
              and (select private.has_entitlement(recipe_id)));

create policy posts_delete_own on public.gallery_posts
  for delete to authenticated using (author_id = (select auth.uid()));
```

## 6. 관리자

```sql
alter table public.review_queue enable row level security;

create policy review_queue_admin_all on public.review_queue
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- admin_actions: insert만, 수정·삭제는 트리거로 거부
create policy admin_actions_insert on public.admin_actions
  for insert to authenticated with check ((select private.is_admin()) and actor_id = (select auth.uid()));
create policy admin_actions_select on public.admin_actions
  for select to authenticated using ((select private.is_admin()));
```

## 뷰

```sql
create view public.seller_profiles_masked
with (security_invoker = true) as
select user_id, legal_name, business_type,
       '****' || account_no_last4 as account_masked,   -- 평문 계좌번호 컬럼은 두지 않는다(account_no_encrypted)
       toss_seller_status
from public.seller_profiles;
```

## 체크리스트 (Supabase 공식 agent-skills에서 옮김)

- `user_metadata`로 인가 금지
- 뷰는 `security_invoker = true`
- UPDATE에는 SELECT 정책도 필요
- `auth.role()` 대신 `TO` 절
- `TO authenticated`만으로는 인가가 아님
- UPDATE는 `USING`과 `WITH CHECK` 둘 다
