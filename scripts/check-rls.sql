-- CI 검사: public·private 스키마에 RLS가 꺼진 테이블이 하나라도 있으면 실패한다.
-- 실행(로컬 스택): psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/check-rls.sql
--   DB_URL 은 `supabase status -o env` 의 DB_URL (로컬 127.0.0.1:54322) — 원격 DB에 쓰지 않는다.
do $$
declare
  bad text;
begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ' order by schemaname, tablename)
    into bad
  from pg_tables
  where schemaname in ('public', 'private')
    and rowsecurity = false;

  if bad is not null then
    raise exception 'RLS disabled on: %', bad;
  end if;
  raise notice 'check-rls: every table in public/private has RLS enabled';
end
$$;
