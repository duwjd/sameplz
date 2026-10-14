-- SAMEPLZ seed — local `supabase db reset` and CI (db / e2e jobs) only. Never applied to production
-- (deploy-db pushes migrations only). No real personal data or keys.
-- Users: jiwoo (member, signup complete), creators, SAMEPLZ 운영팀 (staff), admin.
-- W4 adds generation_budget + jiwoo's monthly_grant credits here (credit tables come in W4).

-- ---------------------------------------------------------------- users (profiles via signup trigger)
-- Token columns are '' (not NULL): GoTrue fails to load users with NULL tokens (e2e signs in as seed users).
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
                        phone_change, phone_change_token, reauthentication_token)
select v.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       v.email, now(), '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('name', v.name), now() - interval '30 days', now(),
       '', '', '', '', '', '', '', ''
from (values
  ('00000000-0000-0000-0000-000000000001', 'jiwoo@sameplz.test',      '지우'),
  ('00000000-0000-0000-0000-000000000002', 'sangse@sameplz.test',     '상세장인'),
  ('00000000-0000-0000-0000-000000000003', 'munjang@sameplz.test',    '문장공방'),
  ('00000000-0000-0000-0000-000000000004', 'bloglab@sameplz.test',    '블로그연구소'),
  ('00000000-0000-0000-0000-000000000005', 'photok@sameplz.test',     '사진관K'),
  ('00000000-0000-0000-0000-000000000006', 'moodlab@sameplz.test',    '무드랩'),
  ('00000000-0000-0000-0000-000000000007', 'shortform@sameplz.test',  '숏폼공장'),
  ('00000000-0000-0000-0000-000000000008', 'cardnews@sameplz.test',   '카드뉴스공방'),
  ('00000000-0000-0000-0000-000000000009', 'dongne@sameplz.test',     '동네사장'),
  ('00000000-0000-0000-0000-000000000010', 'ops@sameplz.test',        'SAMEPLZ 운영팀'),
  ('00000000-0000-0000-0000-000000000011', 'admin@sameplz.test',      '관리자')
) v(id, email, name);

update public.profiles set handle = 'jiwoo', job_codes = '{marketing}' where id = '00000000-0000-0000-0000-000000000001';
update public.profiles set handle = 'sangse', bio = '상세페이지 카피와 연출 컷을 만들어요', job_codes = '{commerce}' where id = '00000000-0000-0000-0000-000000000002';
update public.profiles set handle = 'munjang', bio = '어색한 문장을 자연스럽게 고쳐요', job_codes = '{office}' where id = '00000000-0000-0000-0000-000000000003';
update public.profiles set handle = 'bloglab', job_codes = '{marketing}' where id = '00000000-0000-0000-0000-000000000004';
update public.profiles set handle = 'photok', job_codes = '{design}' where id = '00000000-0000-0000-0000-000000000005';
update public.profiles set handle = 'moodlab', job_codes = '{design,content}' where id = '00000000-0000-0000-0000-000000000006';
update public.profiles set handle = 'shortform', job_codes = '{content}' where id = '00000000-0000-0000-0000-000000000007';
update public.profiles set handle = 'cardnews', job_codes = '{marketing}' where id = '00000000-0000-0000-0000-000000000008';
update public.profiles set handle = 'dongne', job_codes = '{commerce,cs}' where id = '00000000-0000-0000-0000-000000000009';
update public.profiles set handle = 'sameplz', role = 'staff', bio = 'SAMEPLZ 운영팀이 직접 만든 레시피예요' where id = '00000000-0000-0000-0000-000000000010';
update public.profiles set handle = 'admin', role = 'admin' where id = '00000000-0000-0000-0000-000000000011';

-- Every seed user finished signup (terms + privacy + 18+ self-check, F7-9). The RLS write gate
-- (private.signup_complete) applies to them like to real users.
insert into public.consent_events (user_id, kind, version)
select p.id, k, '2026-10-v1' from public.profiles p cross join unnest(array['terms', 'privacy', 'adult']) k;
update public.profiles
   set terms_version = '2026-10-v1', terms_accepted_at = now(), adult_confirmed_at = now();

-- ---------------------------------------------------------------- recipes (all free in MVP)
-- n: recipe a…n / version b…n. status live unless noted.
insert into public.recipes (id, public_id, owner_id, category, prompt_kind, title, summary, search_tags, status, job_codes, tool_codes, filters, published_at, fork_allowed)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'rlinkedin01', '00000000-0000-0000-0000-000000000005', 'prompt', 'image', '셀카 → 링크드인 프로필 사진', '셀카 한 장으로 단정한 프로필 사진을 만들어요', '{프로필,링크드인,사진}', 'live', '{hr}', '{chatgpt,gemini}', '{"ratio":"1/1"}', now() - interval '20 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'rtranslate1', '00000000-0000-0000-0000-000000000003', 'skill', null, '한국어 번역투 교정', '어색한 번역투 문장을 자연스러운 한국어로 고쳐요', '{교정,번역,글쓰기}', 'live', '{office}', '{claude,chatgpt,gemini_cli}', '{"format":"텍스트","files":3}', now() - interval '18 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'rcafetone01', '00000000-0000-0000-0000-000000000006', 'prompt', 'image', '감성 카페 메뉴 사진 톤', '메뉴 사진을 필름 톤으로 맞춰요', '{카페,메뉴,필름}', 'live', '{marketing}', '{chatgpt,gemini}', '{"ratio":"1/1"}', now() - interval '16 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'rdetailcopy', '00000000-0000-0000-0000-000000000002', 'prompt', 'text', '스마트스토어 상세페이지 카피', '상품 장점을 상세페이지 문단으로 써요', '{상세페이지,카피,셀러}', 'live', '{commerce}', '{chatgpt,claude}', '{}', now() - interval '15 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'rdetailcut6', '00000000-0000-0000-0000-000000000002', 'prompt', 'image', '제품 사진 → 상세 연출 컷 6종', '제품 사진 한 장으로 연출 컷 6종을 뽑아요', '{연출컷,제품사진,상세페이지}', 'live', '{commerce,design}', '{midjourney,seedream}', '{"ratio":"3/4"}', now() - interval '14 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'rcardnews10', '00000000-0000-0000-0000-000000000008', 'prompt', 'text', '인스타 카드뉴스 10장 기획', '주제 하나로 카드뉴스 10장 흐름을 만들어요', '{카드뉴스,인스타}', 'live', '{marketing}', '{chatgpt,claude}', '{}', now() - interval '12 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'runboxing08', '00000000-0000-0000-0000-000000000007', 'prompt', 'video', '9:16 제품 언박싱 숏폼 8초', '세로 영상 언박싱 컷을 장면별로 구성해요', '{숏폼,언박싱,영상}', 'live', '{content,commerce}', '{veo,kling}', '{"ratio":"9/16"}', now() - interval '10 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'rblogseo001', '00000000-0000-0000-0000-000000000004', 'skill', null, '네이버 블로그 SEO 글 구조', '블로그 상위노출을 노린 제목과 소제목 구조를 짜요', '{블로그,SEO,상위노출}', 'live', '{marketing}', '{claude,codex,cursor}', '{"format":"블로그 HTML","files":4}', now() - interval '9 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'rblognotion', '00000000-0000-0000-0000-000000000004', 'agent', null, '블로그 키워드 → 글감 노션 정리', '키워드로 글감을 모아 노션 표로 정리해요', '{블로그,노션,글감}', 'live', '{marketing}', '{claude,notion}', '{"runtime":"claude"}', now() - interval '7 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000010', 'rreviewbot1', '00000000-0000-0000-0000-000000000009', 'agent', null, '스마트스토어 리뷰 답글 초안 에이전트', '새 리뷰에 정중한 답글 초안을 달고 승인을 받아요', '{리뷰,답글,셀러}', 'live', '{cs,commerce}', '{claude,n8n,smartstore}', '{"runtime":"n8n"}', now() - interval '2 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000011', 'rperfume001', '00000000-0000-0000-0000-000000000006', 'prompt', 'video', '향수 무드 시네마틱 컷', '향수 제품을 안개 낀 시네마틱 컷으로 담아요', '{향수,시네마틱,영상}', 'live', '{content}', '{seedance,runway}', '{"ratio":"16/9"}', now() - interval '5 days', true),
  -- 운영팀 레시피 (F1-5 search seeds: 보고 / 세무 / 엑셀)
  ('aaaaaaaa-0000-0000-0000-000000000012', 'rweeklyrep1', '00000000-0000-0000-0000-000000000010', 'prompt', 'text', '주간 보고서 요약 프롬프트', '회의록을 붙여 넣으면 한 장짜리 보고서로 정리해요', '{보고서,요약,회의록}', 'live', '{office}', '{chatgpt,claude}', '{}', now() - interval '6 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000013', 'rtaxcheck01', '00000000-0000-0000-0000-000000000010', 'skill', null, '종합소득세 검토 보조 체크리스트', '세무사 상담 전에 빠진 서류를 확인하는 점검표예요', '{세무,종합소득세,체크리스트}', 'live', '{tax}', '{claude}', '{"format":"점검표","files":2}', now() - interval '4 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000014', 'rexcelfx001', '00000000-0000-0000-0000-000000000010', 'skill', null, '엑셀 수식 만들어 주는 스킬', 'VLOOKUP, SUMIFS 같은 수식을 말로 설명하면 만들어 줘요', '{엑셀,수식,시트}', 'live', '{office,dev}', '{claude,chatgpt}', '{"format":"수식","files":1}', now() - interval '3 days', true),
  -- 판매 중지 (STOP), 심사 중 (owner only), 포크 (forked from #4)
  ('aaaaaaaa-0000-0000-0000-000000000015', 'rstopped001', '00000000-0000-0000-0000-000000000002', 'prompt', 'text', '쿠팡 로켓 상세 문구', '쿠팡 상세 문구 초안을 써요', '{쿠팡,상세페이지}', 'stopped', '{commerce}', '{chatgpt}', '{}', now() - interval '25 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000016', 'rinreview01', '00000000-0000-0000-0000-000000000003', 'agent', null, '채용공고 작성 도우미 에이전트', '직무 설명과 자격 요건을 정리해요', '{채용,공고}', 'in_review', '{hr}', '{claude}', '{"runtime":"claude"}', null, true),
  ('aaaaaaaa-0000-0000-0000-000000000017', 'rforkbeauty', '00000000-0000-0000-0000-000000000008', 'prompt', 'text', '상세페이지 카피 (뷰티 버전)', '화장품 상세페이지에 맞게 말투를 바꿨어요', '{상세페이지,뷰티,카피}', 'live', '{commerce,marketing}', '{chatgpt}', '{}', now() - interval '1 days', true),
  -- W3: Midjourney only (F2-5 run disabled), private (owner 03) and rejected (owner 04) → 404 for others
  ('aaaaaaaa-0000-0000-0000-000000000018', 'rmjposter01', '00000000-0000-0000-0000-000000000005', 'prompt', 'image', '레트로 영화 포스터 스타일', '인물 사진을 80년대 영화 포스터처럼 바꿔요', '{포스터,레트로,미드저니}', 'live', '{design}', '{midjourney}', '{"ratio":"3/4"}', now() - interval '8 days', true),
  ('aaaaaaaa-0000-0000-0000-000000000019', 'rprivate001', '00000000-0000-0000-0000-000000000003', 'prompt', 'text', '사내 공지 말투 다듬기', '사내 공지문을 부드러운 말투로 바꿔요', '{공지,사내}', 'private', '{office}', '{chatgpt}', '{}', null, true),
  ('aaaaaaaa-0000-0000-0000-000000000020', 'rrejected01', '00000000-0000-0000-0000-000000000004', 'prompt', 'text', '블로그 체험단 후기 대량 생성', '체험단 후기를 여러 개 만들어요', '{후기,체험단}', 'rejected', '{marketing}', '{chatgpt}', '{}', null, true);

insert into public.recipe_versions (id, recipe_id, version_no, changelog, review_status, public_meta, has_scripts, approved_at, created_at)
select ('bbbbbbbb-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       ('aaaaaaaa-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid,
       1, '첫 버전',
       case n when 16 then 'pending_review' when 20 then 'rejected' else 'approved' end,
       coalesce(m.meta, '{}'::jsonb),
       n in (8, 16),
       case when n in (16, 20) then null else now() - interval '1 day' end,
       now() - interval '2 days'
from generate_series(1, 20) n
-- public_meta (detail page, never originals). prompt: variables + settings · skill: call examples,
-- before/after, install steps · agent: flow, sample run log, environment, does / does not.
-- regulated: tax | legal | medical → F2-6 notice band.
left join (values
  (1,  '{"variables":[{"name":"셀카","example":"정면 셀카 1장"},{"name":"옷 색","example":"네이비"},{"name":"배경","example":"밝은 회색 스튜디오"}],"settings":[{"label":"비율","value":"1:1"},{"label":"추천 모델","value":"ChatGPT 이미지"}]}'::jsonb),
  (2,  '{"examples":[{"user":"이 문장 번역투 좀 고쳐 줘: 그것은 매우 중요한 결정이 되어질 것이다.","reply":"아주 중요한 결정이 될 거예요."}],"before":"우리는 고객에게 최고의 경험을 제공하는 것을 목표로 하고 있습니다.","after":"고객에게 가장 좋은 경험을 드리는 게 목표예요.","install":[{"tool":"claude","steps":["파일을 받아요","Claude 설정 > 스킬에서 폴더를 올려요","대화에서 \"번역투 고쳐 줘\"라고 말해요"],"command":"unzip translate-ko.zip -d ~/.claude/skills/"},{"tool":"chatgpt","steps":["파일을 받아요","GPT 지침에 SKILL.md 내용을 붙여 넣어요","고칠 문장을 보내요"]}]}'),
  (3,  '{"variables":[{"name":"메뉴 사진","example":"라테 사진 1장"},{"name":"필름 톤","example":"코닥 포트라"}],"settings":[{"label":"비율","value":"1:1"},{"label":"추천 모델","value":"ChatGPT 이미지"}]}'),
  (4,  '{"variables":[{"name":"상품명","example":"저자극 수분크림"},{"name":"장점 3개","example":"무향, 끈적임 없음, 대용량"},{"name":"말투","example":"친근하게"}],"settings":[{"label":"출력","value":"문단 5개"}]}'),
  (5,  '{"variables":[{"name":"제품 사진","example":"흰 배경 제품 컷"},{"name":"분위기","example":"아침 햇살"}],"settings":[{"label":"비율","value":"3:4"},{"label":"추천 모델","value":"Midjourney v7, Seedream"}]}'),
  (6,  '{"variables":[{"name":"주제","example":"직장인 점심 다이어트"},{"name":"타깃","example":"20대 직장인"}],"settings":[{"label":"출력","value":"카드 10장 문구"}]}'),
  (7,  '{"variables":[{"name":"제품","example":"무선 이어폰"},{"name":"장면 수","example":"4"}],"settings":[{"label":"비율","value":"9:16"},{"label":"길이","value":"8초"}]}'),
  (8,  '{"examples":[{"user":"\"홈카페 원두 추천\"으로 블로그 글 구조 짜 줘","reply":"제목 후보 3개와 소제목 5개, 키워드 배치를 정리했어요."}],"before":"홈카페 원두 추천합니다","after":"홈카페 원두 추천 TOP 5 | 산미·바디감별로 골라 봤어요","install":[{"tool":"claude","steps":["파일을 받아요","Claude 설정 > 스킬에서 폴더를 올려요","\"블로그 구조 짜 줘\"라고 말해요"],"command":"unzip blog-seo.zip -d ~/.claude/skills/"},{"tool":"cursor","steps":["파일을 받아요","프로젝트 .cursor/skills에 넣어요","채팅에서 키워드를 알려 줘요"],"command":"unzip blog-seo.zip -d .cursor/skills/"}]}'),
  (9,  '{"flow":["키워드 입력","관련 검색어 모으기","글감 10개 고르기","노션 표에 정리"],"sample_log":["> 키워드: 홈카페","관련 검색어 24개를 모았어요","글감 10개를 골랐어요","노션 \"글감\" 표에 10줄을 추가했어요"],"runtime":"Claude Desktop","integrations":["Notion"],"prepare":["Notion 계정","글감을 담을 Notion 페이지"],"does":["검색어를 모아요","Notion 표에 줄을 추가해요"],"does_not":["글을 외부에 올리지 않아요","기존 페이지를 지우거나 고치지 않아요","결제하지 않아요"]}'),
  (10, '{"flow":["새 리뷰 확인","답글 초안 작성","승인 요청","승인되면 등록"],"sample_log":["새 리뷰 3개를 찾았어요","답글 초안 3개를 썼어요","슬랙으로 승인을 요청했어요"],"runtime":"n8n","integrations":["스마트스토어","Slack"],"prepare":["n8n 계정","스마트스토어 API 키"],"does":["리뷰를 읽어요","승인받은 답글만 등록해요"],"does_not":["승인 없이 자동 게시하지 않아요","리뷰를 지우지 않아요","결제하지 않아요"]}'),
  (11, '{"variables":[{"name":"향수 병","example":"투명 사각 병"},{"name":"배경","example":"안개 낀 숲"}],"settings":[{"label":"비율","value":"16:9"},{"label":"길이","value":"6초"}]}'),
  (12, '{"variables":[{"name":"회의록","example":"주간 회의 메모"},{"name":"분량","example":"한 장"}],"settings":[{"label":"출력","value":"요약·결정·할 일 3단"}]}'),
  (13, '{"examples":[{"user":"올해 종합소득세 신고 전에 빠진 서류 있는지 봐 줘","reply":"사업소득 지급명세서와 의료비 영수증이 아직 없어요."}],"before":"서류를 어디서부터 챙겨야 할지 모르겠어요","after":"필요 서류 12개 중 9개 준비, 3개 남음","install":[{"tool":"claude","steps":["파일을 받아요","Claude 설정 > 스킬에서 폴더를 올려요","\"종소세 서류 점검해 줘\"라고 말해요"]}],"regulated":"tax"}'),
  (14, '{"examples":[{"user":"B열 이름으로 시트2에서 가격 찾아 줘","reply":"=VLOOKUP(B2, 시트2!A:C, 3, FALSE)"}],"before":"이름으로 가격을 찾고 싶어요","after":"=VLOOKUP(B2, 시트2!A:C, 3, FALSE)","install":[{"tool":"claude","steps":["파일을 받아요","Claude 설정 > 스킬에서 폴더를 올려요","원하는 계산을 말로 설명해요"]},{"tool":"chatgpt","steps":["파일을 받아요","GPT 지침에 SKILL.md 내용을 붙여 넣어요","원하는 계산을 말로 설명해요"]}]}'),
  (15, '{"variables":[{"name":"상품명","example":"로켓배송 텀블러"}],"settings":[{"label":"출력","value":"문단 3개"}]}'),
  (16, '{"flow":["직무 입력","자격 요건 정리","공고 초안"],"does":["공고 초안을 써요"],"does_not":["외부에 게시하지 않아요"]}'),
  (17, '{"variables":[{"name":"상품명","example":"비건 립밤"},{"name":"피부 고민","example":"건조함"}],"settings":[{"label":"출력","value":"문단 5개"}]}'),
  (18, '{"variables":[{"name":"인물 사진","example":"상반신 사진"},{"name":"영화 장르","example":"SF"}],"settings":[{"label":"비율","value":"3:4"},{"label":"추천 모델","value":"Midjourney v7"}]}'),
  (19, '{"variables":[{"name":"공지 내용","example":"사무실 이전 안내"}]}'),
  (20, '{"variables":[{"name":"상품","example":"샴푸"}]}')
) m(n, meta) using (n);

update public.recipes r
   set current_version_id = ('bbbbbbbb-0000-0000-0000-' || right(r.id::text, 12))::uuid;

update public.recipes
   set forked_from_recipe_id = 'aaaaaaaa-0000-0000-0000-000000000004',
       forked_from_version_id = 'bbbbbbbb-0000-0000-0000-000000000004'
 where id = 'aaaaaaaa-0000-0000-0000-000000000017';

-- Hidden originals: unique marker per version so e2e can assert they never leak.
insert into public.recipe_version_secrets (version_id, prompt_body, skill_md, agent_config)
select v.id,
       case when r.category = 'prompt' then 'SAMEPLZ-SECRET-SAMPLE-' || right(v.id::text, 2) || ' [변수] 프롬프트 원문' end,
       case when r.category = 'skill' then '# SAMEPLZ-SECRET-SAMPLE-' || right(v.id::text, 2) || E'\nSKILL.md 원문' end,
       case when r.category = 'agent' then jsonb_build_object('marker', 'SAMEPLZ-SECRET-SAMPLE-' || right(v.id::text, 2)) end
from public.recipe_versions v
join public.recipes r on r.id = v.recipe_id;

-- ---------------------------------------------------------------- media + gallery
insert into public.media_assets (id, owner_id, storage_path, kind, ratio, is_ai_generated, source, alt_text)
values
  ('cccccccc-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'seed/linkedin.png', 'image', '1/1', true, 'upload', '링크드인 프로필 사진 결과물'),
  ('cccccccc-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000007', 'seed/unboxing.mp4', 'video', '9/16', true, 'upload', '이어폰 언박싱 8초 영상'),
  ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'seed/navy-shirt.png', 'image', '1/1', true, 'playground', '네이비 셔츠 프로필 사진'),
  ('cccccccc-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'seed/cream.png', 'image', '3/4', true, 'upload', '수분크림 아침 햇살 컷'),
  ('cccccccc-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', 'seed/perfume.mp4', 'video', '16/9', true, 'upload', '향수 안개 시네마틱 영상');

insert into public.recipe_version_media (version_id, media_id, role, sort) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'result', 0),
  ('bbbbbbbb-0000-0000-0000-000000000007', 'cccccccc-0000-0000-0000-000000000002', 'result', 0),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'cccccccc-0000-0000-0000-000000000004', 'result', 0),
  ('bbbbbbbb-0000-0000-0000-000000000011', 'cccccccc-0000-0000-0000-000000000005', 'result', 0);

-- ---------------------------------------------------------------- downloads (entitlements)
-- jiwoo got 감성 카페 메뉴 사진 톤 (free). Others claim deterministically for popularity numbers.
insert into public.entitlements (user_id, recipe_id, version_id, source, created_at)
select u.id, r.id, r.current_version_id, 'free',
       now() - (((abs(hashtext(u.id::text || r.id::text)) % 240) + 1) * interval '1 hour')
from public.profiles u
cross join public.recipes r
where r.status = 'live'
  and u.id <> r.owner_id
  and (u.id = '00000000-0000-0000-0000-000000000001' and r.id = 'aaaaaaaa-0000-0000-0000-000000000003'
       or (u.id <> '00000000-0000-0000-0000-000000000001'
           and abs(hashtext(u.id::text || r.id::text)) % 3 <> 0));

-- Owners hold their own recipes (never counted as downloads).
insert into public.entitlements (user_id, recipe_id, version_id, source)
select r.owner_id, r.id, r.current_version_id, 'owner' from public.recipes r where r.current_version_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------- W3: STOP, updates, files, share link
-- jiwoo claimed 쿠팡 로켓 상세 문구 before it was stopped (SCN 9: keeps using the pinned version).
insert into public.entitlements (user_id, recipe_id, version_id, source, created_at)
values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000015',
        'bbbbbbbb-0000-0000-0000-000000000015', 'free', now() - interval '30 days');
update public.recipes
   set stopped_reason = 'creator_request', stopped_at = now() - interval '3 days'
 where id = 'aaaaaaaa-0000-0000-0000-000000000015';

-- 감성 카페 메뉴 사진 톤 v2: everyone who claimed v1 sees 「새 버전 있어요」 (F3-8).
insert into public.recipe_versions (id, recipe_id, version_no, changelog, review_status, public_meta, approved_at, created_at)
select 'bbbbbbbb-0000-0000-0001-000000000003', recipe_id, 2, '야간 조명 톤을 추가했어요', 'approved',
       public_meta || '{"settings":[{"label":"비율","value":"1:1"},{"label":"추천 모델","value":"ChatGPT 이미지"},{"label":"새 옵션","value":"야간 조명"}]}',
       now() - interval '6 hours', now() - interval '12 hours'
from public.recipe_versions where id = 'bbbbbbbb-0000-0000-0000-000000000003';
insert into public.recipe_version_secrets (version_id, prompt_body)
values ('bbbbbbbb-0000-0000-0001-000000000003', 'SAMEPLZ-SECRET-SAMPLE-03v2 [변수] 프롬프트 원문 (야간 조명)');
update public.recipes set current_version_id = 'bbbbbbbb-0000-0000-0001-000000000003'
 where id = 'aaaaaaaa-0000-0000-0000-000000000003';

-- Attachment names (SKL-05 / AGT-04). Storage objects are uploaded by tests that need them.
-- Versions are already approved here, so bypass the freeze trigger for this seed-only insert.
set session_replication_role = replica;
insert into public.recipe_version_files (id, version_id, filename, storage_path, size_bytes, sort)
values
  ('eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'SKILL.md', 'seed/02/SKILL.md', 2400, 0),
  ('eeeeeeee-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'examples.md', 'seed/02/examples.md', 5100, 1),
  ('eeeeeeee-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'glossary.csv', 'seed/02/glossary.csv', 820, 2),
  ('eeeeeeee-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000008', 'SKILL.md', 'seed/08/SKILL.md', 3100, 0),
  ('eeeeeeee-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000008', 'scripts/keywords.py', 'seed/08/keywords.py', 1900, 1),
  ('eeeeeeee-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000009', 'agent.json', 'seed/09/agent.json', 1200, 0),
  ('eeeeeeee-0000-0000-0000-000000000007', 'bbbbbbbb-0000-0000-0000-000000000013', 'SKILL.md', 'seed/13/SKILL.md', 2800, 0),
  ('eeeeeeee-0000-0000-0000-000000000008', 'bbbbbbbb-0000-0000-0000-000000000014', 'SKILL.md', 'seed/14/SKILL.md', 1500, 0);
set session_replication_role = origin;

-- Share link (F2-3): /r/rlinkedin01?ref=demo01 → 「사진관K님 링크로 들어왔어요」
insert into public.share_links (id, recipe_id, creator_id, code)
values ('ffffffff-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000005', 'demo01');

insert into public.gallery_posts (id, author_id, recipe_id, version_id, kind, entitlement_id, generated_here, media_id, title, ratio, status)
values
  ('dddddddd-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'original', null, false, 'cccccccc-0000-0000-0000-000000000001', '링크드인 프로필 사진', '1/1', 'visible'),
  ('dddddddd-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000007', 'bbbbbbbb-0000-0000-0000-000000000007', 'original', null, false, 'cccccccc-0000-0000-0000-000000000002', '이어폰 언박싱 8초', '9/16', 'visible'),
  ('dddddddd-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000005', 'original', null, false, 'cccccccc-0000-0000-0000-000000000004', '수분크림 아침 햇살 컷', '3/4', 'visible'),
  ('dddddddd-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000011', 'bbbbbbbb-0000-0000-0000-000000000011', 'original', null, false, 'cccccccc-0000-0000-0000-000000000005', '향수 안개 시네마틱', '16/9', 'visible');

-- SAME 인증: jiwoo followed 감성 카페 메뉴 사진 톤 (has the entitlement).
insert into public.gallery_posts (id, author_id, recipe_id, version_id, kind, entitlement_id, generated_here, media_id, title, ratio, status)
select 'dddddddd-0000-0000-0000-000000000003', e.user_id, e.recipe_id, e.version_id, 'same_cert', e.id, true,
       'cccccccc-0000-0000-0000-000000000003', '저도 해 봤어요, 라떼 필름 톤', '1/1', 'visible'
from public.entitlements e
where e.user_id = '00000000-0000-0000-0000-000000000001' and e.recipe_id = 'aaaaaaaa-0000-0000-0000-000000000003';

-- More SAME 인증 from other claimers (popularity: SAME×4)
insert into public.gallery_posts (author_id, recipe_id, version_id, kind, entitlement_id, generated_here, title, ratio, status)
select e.user_id, e.recipe_id, e.version_id, 'same_cert', e.id, false, '따라 만든 결과', '1/1', 'visible'
from public.entitlements e
where e.source = 'free'
  and e.user_id <> '00000000-0000-0000-0000-000000000001'
  and abs(hashtext(e.id::text)) % 4 = 0;

-- Gallery likes: originals and jiwoo's SAME 인증 lead HOME-04.
insert into public.post_likes (user_id, post_id)
select u.id, g.id
from public.profiles u
cross join public.gallery_posts g
where g.id in ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002',
               'dddddddd-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000004',
               'dddddddd-0000-0000-0000-000000000005')
  and u.id <> g.author_id
  and abs(hashtext(u.id::text || g.id::text)) % 3 <> 0;

-- ---------------------------------------------------------------- likes + follows
insert into public.recipe_likes (user_id, recipe_id)
select u.id, r.id from public.profiles u cross join public.recipes r
where r.status = 'live' and u.id <> r.owner_id and abs(hashtext(r.id::text || u.id::text)) % 2 = 0;

insert into public.follows (follower_id, followee_id) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------- collections + banners (HOME-01)
insert into public.collections (id, slug, title, intro, reason, status, sort) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'smartstore-starter', '스마트스토어 셀러 시작 팩', '상세 카피부터 연출 컷·리뷰 답글 에이전트까지 한 번에 봐요', '처음 상품을 올리는 셀러에게', 'live', 1);
insert into public.collection_items (collection_id, recipe_id, sort) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000004', 1),
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000005', 2),
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000010', 3),
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000017', 4);

insert into public.banners (name, eyebrow, title, subtitle, cta_label, cta_href, alt_text, sort, active) values
  ('서비스', 'AI 레시피 플레이그라운드', '저거랑 같은 걸로 주세요.', '남이 만든 AI 결과물을 구경하다가 SAME을 누르면, 그걸 만든 프롬프트·에이전트·스킬을 그대로 받아요.', '갤러리 구경하기', '/gallery', '결과물 콜라주', 1, true),
  ('플레이그라운드', '플레이그라운드', '받기 전에 한 번 돌려 보세요', '무료 크레딧으로 모델 3개를 나란히 놓고 비교해요.', '플레이그라운드 열기', '/play', '모델 3개 결과 비교 화면', 2, true),
  ('컬렉션', '이번 주 컬렉션', '스마트스토어 셀러 시작 팩', '상세 카피부터 연출 컷·리뷰 답글 에이전트까지 한 번에 봐요.', '팩 보기', '/market/collections', '팩 표지', 3, true),
  ('크리에이터', '크리에이터 모집', '내 프롬프트가 누군가의 SAME이 돼요', '지금은 무료로 나누고, 유료 판매가 열리면 가장 먼저 알려 드려요.', '알림 신청하기', '/my/seller', '판매자 센터 미리보기', 4, true);

-- ---------------------------------------------------------------- credits (W4, D11 · D12 · D17)
-- Local budget for this KST month (production: 40,250C from the playground migration, D12) and jiwoo's 270C.
-- Next month too, so a reset run right at a month boundary still has a budget.
insert into public.generation_budget (month, cap_credits, state)
values (private.kst_month(), 100000, 'open'), ((private.kst_month() + interval '1 month')::date, 100000, 'open')
on conflict (month) do update set cap_credits = excluded.cap_credits, state = excluded.state;
-- Seed members count as having passed the signup checks (complete_signup_credits).
insert into public.credit_accounts (user_id, grant_eligible) select id, true from public.profiles
on conflict (user_id) do update set grant_eligible = true;
select private.grant_monthly_credits('00000000-0000-0000-0000-000000000001', private.kst_month());

-- ---------------------------------------------------------------- popularity
select private.refresh_popularity();
select private.snapshot_rankings();
