---
paths:
  - "supabase/**"
  - "**/*.sql"
---
# Supabase SQL 보안 체크리스트

출처: Supabase 공식 agent-skills 체크리스트와 RLS 문서. 클라우드 세션에는 플러그인이 설치되지 않으므로 여기에 옮겨 둔다.

- `user_metadata` 클레임으로 인가하지 않는다(사용자가 바꿀 수 있다). 관리자 판정은 커스텀 액세스 토큰 훅이 넣은 `admin` 클레임과 `authorize()`/`is_admin()`.
- 뷰는 기본적으로 RLS를 우회한다. `create view … with (security_invoker = true)`.
- UPDATE 정책에는 SELECT 정책도 필요하다.
- `auth.role()`은 폐기됐다. 정책의 `TO` 절을 쓴다.
- `TO authenticated`만으로는 인증일 뿐 인가가 아니다(BOLA/IDOR). 소유권 조건을 붙인다.
- UPDATE 정책은 `USING`과 `WITH CHECK` 둘 다.
- `auth.uid()`는 `(select auth.uid())`로 감싸 행마다 다시 부르지 않게 한다. 정책에 쓰는 컬럼에 인덱스.
- secret 키(`sb_secret_…`)는 서버에서만. `NEXT_PUBLIC_*` 값은 브라우저로 간다.
- `security definer` 함수는 `private` 스키마, `set search_path = ''`, 객체 이름을 스키마로 한정, `revoke execute … from public, anon, authenticated`.
- 원장 테이블은 UPDATE·DELETE 금지 트리거. 승인된 `recipe_versions` 내용 컬럼 UPDATE도 트리거로 거부.
- 새 테이블은 같은 마이그레이션에서 `enable row level security`와 정책·인덱스까지.
- 확장: 한국어 검색은 PGroonga(`&@~`, `extensions` 스키마). `pg_bigm`은 쓸 수 없다. 검색은 `search_recipes` RPC로만(D15) — RLS 테이블에 직접 걸면 Seq Scan.
- 이미 `origin/main`에 있는 마이그레이션 파일은 고치지 않는다(훅이 막는다). 고칠 것은 새 마이그레이션으로.
- 원격 DB 대상 명령(`--linked`, `--db-url`, `db push`, `migration repair`)은 쓰지 않는다. 로컬만.
