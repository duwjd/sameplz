-- 모든 public·private 테이블에 RLS가 켜져 있어야 한다 (CLAUDE.md 절대 규칙 5, scripts/check-rls.sql과 같은 기준).
begin;
create extension if not exists pgtap with schema extensions;

select plan(1);

select is_empty(
  $$
    select format('%I.%I', schemaname, tablename)
    from pg_tables
    where schemaname in ('public', 'private')
      and rowsecurity = false
  $$,
  'RLS: public·private 스키마에 RLS가 꺼진 테이블이 없다'
);

select * from finish();
rollback;
