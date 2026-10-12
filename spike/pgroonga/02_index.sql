-- Search document: [title, summary, tags joined, creator_nickname] as text[] so weights can boost title.
create or replace function public.spike_search_doc(title text, summary text, tags text[], nick text)
returns text[] language sql immutable parallel safe
as $$ select array[title, summary, array_to_string(tags, ' '), nick] $$;

-- Variant B lives on a copy so A and B are queried on identical data.
create table public.spike_recipes_b (like public.spike_recipes including all);
insert into public.spike_recipes_b (title, summary, tags, creator_nickname, is_public, synthetic)
  overriding system value
  select title, summary, tags, creator_nickname, is_public, synthetic from public.spike_recipes;

\timing on
-- A: defaults (TokenBigram + NormalizerAuto)
create index spike_a_idx on public.spike_recipes
  using pgroonga (public.spike_search_doc(title, summary, tags, creator_nickname));

-- B: TokenNgram that keeps latin/digits as bigrams too, NFKC normalizer (full/half width, case)
create index spike_b_idx on public.spike_recipes_b
  using pgroonga (public.spike_search_doc(title, summary, tags, creator_nickname))
  with (tokenizer = 'TokenNgram("unify_alphabet", false, "unify_digit", false, "unify_symbol", false)',
        normalizers = 'NormalizerNFKC150');
\timing off

analyze public.spike_recipes;
analyze public.spike_recipes_b;
select relname, pg_size_pretty(pg_relation_size(oid)) as size
from pg_class where relname in ('spike_a_idx', 'spike_b_idx', 'spike_recipes');
