# W1 스파이크 · PGroonga 한국어 검색

- 날짜: 2026-10-12 · 대상: F1-5(두 글자 한국어 검색, P0, W2) · 실험 코드: `spike/pgroonga-korean` 브랜치(`spike/pgroonga/*.sql`, 머지하지 않음)
- 환경: 로컬 Supabase, PostgreSQL 17.11, **pgroonga 3.2.5**. 운영 DB는 건드리지 않았다. 클라우드는 Supabase 문서 기준으로 지원된다(`create extension pgroonga with schema extensions;`).
- 데이터: 실제와 비슷한 레시피 33행 + 합성 2만 행(10%는 비공개)

## 결론

**된다.** 단, 아래 두 가지를 지켜야 한다.

1. **검색은 RLS 테이블에 직접 걸지 말고 `search_recipes` RPC(SECURITY DEFINER)로 한다.**
   - RLS가 켜진 테이블을 `authenticated`로 직접 검색하면 인덱스를 쓰지 않고 전체를 훑는다. 2만 행에서 **2,366ms**였다.
   - 원인: PGroonga 연산자가 LEAKPROOF가 아니라서, 보안 조건(RLS)보다 먼저 인덱스 조건으로 쓰이지 못한다.
   - RPC 안에서 공개 조건을 직접 걸면 인덱스를 쓴다. 같은 데이터에서 **9~19ms**였다.
2. **사용자 입력은 `pgroonga_query_escape()`로 감싼 뒤 `&@~`에 넘긴다.**
   - 감싸지 않으면 쿼리 문법으로 해석된다. 예: "-세무"가 "세무 제외"가 되어 20,029건이 나왔다.

## 정확도 (TokenBigram 기본값 = TokenNgram + NFKC, 두 설정 결과 동일)

F1-5의 세 단어는 네 칸 모두에서 걸렸다. 합성 행에서 잘못 걸린 건 0건이다.

| 검색어 | 제목 | 요약 | 태그 | 닉네임 | 붙은 말 |
|---|---|---|---|---|---|
| 보고 | 「주간 보고서 요약」 | "…보고할 형태로" | `{보고}` | 보고왕 | "보고서를" ✓ |
| 세무 | — | "세무사가 보기 전에" | `{세무}` | 세무도우미 | "세무사가" ✓ |
| 엑셀 | 「엑셀 수식…」 | "엑셀이나 시트로" | `{엑셀}` | 엑셀천재 | 「엑셀매크로」 ✓ |

그 밖의 질의(모두 기대대로 걸림):
- 노션: 한글 "노션"만 걸린다. 영문 "Notion"과 같은 단어로 묶지 않는다. 동의어는 W2 범위 밖이다.
- seo/SEO, notion/Notion, hwpx/HWPX: 대소문자를 무시한다.
- 9:16, C++, A/B, #N/A: 기호가 섞여도 걸린다.
- "블로그 상위": 띄어 쓰면 AND로 묶인다.
- 상세장인: 닉네임으로만 걸려도 결과에 나온다.
- 체크리스트, 카피: 정상.
- 한 글자 "글": "구글"처럼 단어 일부도 걸린다(6건). 한 글자 검색은 노이즈가 많으니, 화면에서 2글자 미만이면 인기 검색어를 보여 주는 쪽을 권한다.

## 입력 안전성 (오류 0건)

| 입력 | `&@~` 그대로 | `pgroonga_query_escape` + `&@~` | `&@` |
|---|---|---|---|
| `세무 OR 엑셀` | 9 (OR 해석) | 9 (OR은 그대로 해석됨) | 0 (통째로 한 구절) |
| `-세무` | 20,029 (NOT 해석) | 0 | 0 |
| `"` `(` `보고)` `title:@x` `*` `\` 빈 문자열 | 0 | 0 | 0 |
| `엑셀 -수식` | 4 | 0 | 0 |

- `&@`는 띄어쓰기를 AND로 나누지 않아서 "블로그 상위" 같은 검색이 안 된다. 그래서 **escape + `&@~`**로 간다.
- `OR`가 연산자로 남는 건 결과가 넓어질 뿐 오류나 노출 문제는 없다. 그대로 둔다.

## 정렬

`pgroonga_condition(query, weights => array[제목, 요약, 태그, 닉네임])`로 열 가중치가 동작한다. `[10, 1, 3, 2]`를 주면 제목 일치(10) > 태그(3) > 닉네임(2) > 요약(1) 순으로 정렬됐다. 가중치가 없으면 모두 1점이라 순서 구분이 안 된다. 인기 점수와 섞는 비율은 W2에 정한다.

## 성능 (2만 행, 로컬)

| 항목 | 값 |
|---|---|
| 인덱스 만들기 | 약 0.3초 |
| 드문 단어(엑셀), 인덱스 스캔 | 0.25ms |
| 흔한 단어(정리, 4,010건 중 상위 20) | 5.4ms |
| RLS 테이블에 직접 검색(`authenticated`) | **2,366ms, Seq Scan** ✗ |
| RPC(`authenticated`) 드문 / 흔한 단어 | 9ms / 19ms |
| INSERT 1천 행 / UPDATE 1천 행 | 60ms / 54ms, 바로 검색됨 |
| 인덱스 파일(두 설정 합계, 2.1만 행) | 약 19MB(Postgres 밖 `pgrn*` 파일) |

## 막힌 지점과 W2에서 지킬 것

- **`search_path = ''` 불가.** `pgroonga_condition()`이 내부에서 타입을 스키마 없이 찾는다. 하네스 규칙은 SECURITY DEFINER 함수에 `search_path = ''`를 요구하지만, 이 함수에서는 `extensions`(pgroonga 스키마)로 둬야 한다. 돈 RPC가 아니므로 예외로 적는다.
- **확장 스키마.** 로컬에서 `create extension pgroonga`만 하면 `public`에 깔린다. 마이그레이션에서는 `with schema extensions`로 맞춘다.
- **비회원도 검색한다.** SCN 「검색 결과 없음」은 guest다. 그래서 RPC 실행 권한은 `anon`, `authenticated` 둘 다에 준다. 결과는 공개 필드만 담은 DTO로 돌려준다(원문 테이블은 건드리지 않음).
- **인덱스 식은 IMMUTABLE 함수.** `array_to_string`이 들어간 식을 바로 인덱스하지 말고, 감싼 함수를 IMMUTABLE로 선언한다.
- 운영 DB의 Free 플랜 디스크(500MB)에서 인덱스는 행 1만 개당 약 5MB로 잡는다(이번 측정 기준 추정).

## W2 `search_recipes` 초안

```sql
create extension if not exists pgroonga with schema extensions;

create or replace function public.recipe_search_doc(title text, summary text, tags text[], nickname text)
returns text[] language sql immutable parallel safe
as $$ select array[title, summary, array_to_string(tags, ' '), nickname] $$;

-- recipes에 요약·태그·크리에이터 닉네임을 비정규화해 둔 열이 있다고 가정(W2 스키마에서 확정)
create index recipes_search_idx on public.recipes
  using pgroonga (public.recipe_search_doc(title, summary, search_tags, creator_nickname));

create or replace function public.search_recipes(p_query text, p_category text default null, p_limit int default 20)
returns table (public_id text, score double precision)
language sql stable security definer
set search_path = extensions, public   -- pgroonga_condition()이 '' 에서 동작하지 않음
as $$
  select r.public_id, extensions.pgroonga_score(r.tableoid, r.ctid)
  from public.recipes r
  where public.recipe_search_doc(r.title, r.summary, r.search_tags, r.creator_nickname)
          &@~ extensions.pgroonga_condition(extensions.pgroonga_query_escape(p_query),
                                            weights => array[10, 1, 3, 2])
    and r.status = 'live'
    and (p_category is null or r.category = p_category)
  order by 2 desc, r.popularity_score desc
  limit least(greatest(p_limit, 1), 50)
$$;

revoke execute on function public.search_recipes(text, text, int) from public;
grant execute on function public.search_recipes(text, text, int) to anon, authenticated;
```

화면 쪽: 2글자 미만이면 RPC를 부르지 않고 인기 검색어를 보여 준다. 0건이면 카테고리 없이 다시 세어 「마켓 전체에 N개」 칩을 띄운다(F1-6).
