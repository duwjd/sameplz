-- Accuracy: which realistic rows each query hits, on A (TokenBigram) and B (TokenNgram + NFKC).
set enable_seqscan = off;  -- make sure the pgroonga index answers, not a seq scan

with q(term) as (values
  ('보고'), ('세무'), ('엑셀'), ('노션'), ('카피'),
  ('보고서'), ('세무사'),
  ('글'),
  ('seo'), ('SEO'), ('notion'), ('Notion'),
  ('블로그 상위'), ('9:16'), ('HWPX'), ('hwpx'), ('C++'), ('A/B'),
  ('상세장인'), ('체크리스트'), ('#N/A')
)
select 'A' as v, q.term,
       count(r.id) filter (where not r.synthetic) as hits,
       string_agg(r.title, ' | ' order by r.id) filter (where not r.synthetic) as titles
from q left join public.spike_recipes r
  on public.spike_search_doc(r.title, r.summary, r.tags, r.creator_nickname) &@~ pgroonga_query_escape(q.term)
group by q.term
union all
select 'B', q.term,
       count(r.id) filter (where not r.synthetic),
       string_agg(r.title, ' | ' order by r.id) filter (where not r.synthetic)
from q left join public.spike_recipes_b r
  on public.spike_search_doc(r.title, r.summary, r.tags, r.creator_nickname) &@~ pgroonga_query_escape(q.term)
group by q.term
order by term, v;
