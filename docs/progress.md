# 진행 로그

Anthropic 장기 실행 하네스 패턴의 진행 파일. 세션을 마칠 때마다 **맨 아래에 한 줄**을 덧붙인다(위쪽을 고치지 않는다).
SessionStart 훅이 `- YYYY-MM-DD`로 시작하는 로그 줄 중 마지막 5개를 세션 컨텍스트로 보여 준다.

형식: `- YYYY-MM-DD <ID>: <한 일> · 테스트 <통과/실패/없음> · 다음: <다음 작업>`

- 기능 목록: `docs/features.json` (수용 기준이 테스트로 통과한 항목만 `"passes": true`)
- 계획: `docs/plans/<CODE>.md`
- 결정: `docs/decisions.md`

## 로그

- 2026-10-03 HARNESS: 하네스·문서 스캐폴드 커밋(앱 없음) · 테스트 없음 · 다음: W1 첫 세션 — Next.js 스캐폴드(README 'W1 첫 세션 프롬프트')
- 2026-10-12 W1-scaffold: Next.js 16.3.8 · pnpm 11.28.2(corepack) · Node 22(fnm, .node-version) · shadcn(sonner) · Supabase init · Vitest/Playwright 스모크 · typecheck·lint·test·build 통과, supabase start·test db는 Docker 미기동으로 미확인 · 다음: Docker 복구 후 supabase start·db reset·test db, W1 스파이크
- 2026-10-12 D14: Supabase Free 단일 프로젝트 구성(로컬 개발, deploy-db 워크플로·production 환경 승인), 하네스 문서 정리, Docker 복구 후 로컬 supabase start·db reset·test db·check-rls 통과 · 테스트 통과 · 다음: .mcp.json supabase-dev 제거·prod-ref·production 시크릿(사용자), W1 스파이크
- 2026-10-12 HOME/DS: SAMEPLZ 디자인 시스템(Vapor 기반) 이식 — 토큰·Pretendard·아이콘 159·컴포넌트 61개(src/components/ds), shadcn 제거, 홈(/) 구현(샘플 데이터) · typecheck·lint·test·build 통과, 브라우저 콘솔 오류 없음 · 다음: 로그인 스파이크, 홈 DAL 연결
- 2026-10-12 SPIKE-pgroonga: 로컬 PGroonga 3.2.5로 F1-5 확인(보고·세무·엑셀 4칸 모두 걸림), RLS 직접 검색은 Seq Scan 2.4초 → SECURITY DEFINER RPC 9~19ms, 입력은 query_escape 필수 · 결과 docs/spikes/W1-pgroonga-korean.md · 다음: 카카오 로그인 스파이크
- 2026-10-13 SPIKE-kakao: 개인 앱 카카오 로그인 성공(이메일 없음, auth.users.id 키) — Supabase 기본 OAuth는 account_email 고정 요청으로 KOE205, 카카오 OIDC 직접 + signInWithIdToken으로 해결, 재로그인 같은 id · 결과 docs/spikes/W1-kakao-login.md · 다음: 네이버 로그인 스파이크(D4)
- 2026-10-13 SPIKE-naver(D4): A(커스텀 OAuth)는 중첩 응답 매핑 불가로 제외(소스), B(라우트 + Admin API + 매직링크)로 가입·재로그인 성공 — 자리표시 이메일·provider=email 기록이 비용 · D4 근거 기록, 상태는 사용자 결정 대기 · 다음: fal vs Replicate(D8)
- 2026-10-13 SPIKE-google: Supabase 기본 구글 OAuth로 가입·재로그인 성공(실제 이메일, 기본 범위만 → 검수 없음, 도메인 없이 설정) · W1 로그인 3종 확인 · 다음: W2 스키마 v1
- 2026-10-13 W2-schema-v1: 마이그레이션 6개(계정·카탈로그·권리·소셜·인기·검색), RLS 전 테이블, pgTAP 81개 통과, seed(레시피 17·사용자 11), DB 타입 생성, 직무 9개(D16) · 테스트 통과 · 다음: HOME·MKT DAL 연결 + 로그인 팝업
- 2026-10-13 MKT-search: /market·카테고리 3종·컬렉션 읽기, GNB 검색 연결, 필터·정렬·적용 칩·0건 안내(인기 검색어 10), SCN 10 e2e 통과(F1-4·5·6 passes) · Vitest 12·e2e 5 통과 · 다음: 홈 DB 연결(PR 2)
- 2026-10-13 HOME-db: 홈 RPC 4개(이번 주·TOP 10 ▲▼/NEW·결과물·크리에이터) + 홈 DB 연결, 샘플 데이터 제거, 빈 DB 대응 · pgTAP 99·e2e 7 통과(F1-1·2·3 passes) · 다음: 로그인 팝업
- 2026-10-13 AUTH-login: 로그인 팝업(카카오·네이버·구글), 하던 일 이어서(팔로우), /welcome 약관·18+ 가입 마무리, 헤더 로그인·로그아웃, Dialog 접근성 보강, e2e 로그인 픽스처 · Vitest 28·e2e 12 통과(F7-1·F7-9 passes) · 다음: 운영 키 설정 후 W3(상세·받기)
- 2026-10-13 FIX-build-race: deploy-db 승인 전 Vercel 빌드가 새 RPC를 못 찾아 실패하던 문제 → 빌드 때 공개 캐시 읽기 실패 시 빈 값 + 수 분 뒤 재시도 · e2e 12 통과 · 다음: W3
- 2026-10-13 F2-detail-schema: W3 스키마(첨부·공유 링크·클릭·업데이트 이력·중지 사유), RPC 9개(상세 공개·비슷한·보는 사람 상태·무료 받기·클릭 기록·라이브러리·원문 열기·업데이트·파일 경로), private 버킷 recipe-files, seed 보강(public_meta·v2·비공개·반려·Midjourney 전용) · pgTAP 163 통과 · 다음: 상세 화면(PR B)
- 2026-10-13 F2-detail: /r/[id] 상세(PRM·AGT·SKL·STOP)·NF 404, 상태별 주 버튼·무료 받기(로그인 뒤 이어서 받기), ?ref 유입 띠·클릭 기록, 규제 고지 띠, Midjourney 전용 실행 비활성, JSON-LD·sitemap·robots, 가입 마무리 가드 무한 재요청 수정 · Vitest 43·e2e 24 통과(F1-7·F2-1~6 passes) · 다음: 라이브러리(PR C)
- 2026-10-13 F3-library: /my/library(받은 레시피·열기 전/열어 봄/판매 종료, 원문 열기 + 받은 사람 표시, 줄마다 업데이트, 첨부 파일 60초 서명 URL), 상세 「라이브러리에서 열기」 바로 열기, GNB 계정 메뉴에 라이브러리 · Vitest 45·e2e 35 통과(F3-5·F3-8 passes) · W3 게이트 SCN 1·9 통과 · 다음: W4
- 2026-10-14 F4-credit-ledger: D10~D13 확정·D17(크레딧 단위 1C≈3.7원, 월 270C·하루 135C) 기록, 크레딧 원장 SQL(지급·홀드·정산·만료·실행 전 검사·예산·레이트 리밋·남용 신호·admin_actions), 가입 지급은 서버 경로만(complete_signup_credits), 매일 00:00 KST cron · pgTAP 238(원장 75, 테스트 먼저) · e2e 35 통과 · 다음: UP 스키마(PR B)
- 2026-10-14 UP-schema: 올리기·심사 스키마(초안·검사 결과·사람 확인 큐·조회 수·결과물 공개 버킷), 서버 전용 올리기 RPC(검증·R01·심사 라우팅·새 버전 헤더는 승인 때만 반영), 심사 결정·공개 전환·공유 링크·내 레시피 RPC · pgTAP 301(올리기 63) · 다음: 올리기 화면(PR C) · D18 open
- 2026-10-14 UP-upload: /my/seller/upload 5단계 무료 올리기(카테고리·내용·결과물·공개 범위·검사, [변수] 자동 인식, 칸 아래 오류 + 포커스, 초안 이어서/새로 시작), 검사 1층(숨은 문자·주입 문구·키·변수 불일치)·2층(omni-moderation + Haiku 판정, mock·키 없음·오류는 사람 확인), 스킬 zip 검사(크기·CRC·링크·스크립트, 판매용 zip은 서버가 다시 만듦), 서명 업로드 + 파일 형식 대조, 제출·업로드 URL 한도, 상세에 실제 결과물·OG 이미지 · Vitest 161·pgTAP 318·e2e 42 통과(F5-1~5 passes), 보안 검토 2회 반영 · 다음: 내 레시피·대기 명단·SCN 7(PR D) · D18 open
- 2026-10-14 SELL-my-recipes: /my/seller 「내 레시피」(반려 → 사람 확인 중 → 비공개 → 공개 중, 7·30·90일 조회·받은 사람·SAME·링크 클릭, 공개 전환, 공유 링크 만들기·칸 아래 오류), 「유료 판매 오픈 알림 신청」(SELL·UP 4단계), 「고쳐서 다시 제출」·「새 버전 올리기」(최신 버전 미리 채우기, 원문은 본인만 secrets.ts로, 바뀐 점 필수), 조회 수 서버 기록, 상세 버튼·계정 메뉴 연결, 검토 3종 반영 · Vitest 161·pgTAP 339·e2e 50 통과(F5-6·7·10·14 passes, W4 게이트 SCN 7 통과) · 다음: W5(D8 생성 공급자·플레이그라운드) · D18 open
- 2026-10-15 PLAY-schema: D8 fal·D12 상한 $50(40,250C)·D19 결과물 30일 기록, fal 모델 12개·가격표(price_version 불변, ceil(USD×805)), 견적(하루 한도 초과 표시), start_run(사전 검사·견적 총액 대조·전부 아니면 없음 홀드·멱등), finish_cell 단일 출구(정산 1회·공급자 과금분 예산 반영·프롬프트 삭제·비공개 채널 방송), 제출 lease·웹훅 토큰·inbox·sweeper 목록(셀마다 따로 정산), 비공개 버킷 2개, pg_net 1분 sweeper · pgTAP 584(플레이 245, 테스트 먼저) · 다음: 어댑터·라우트(PR F) · D18 open
- 2026-10-15 PLAY-pipeline: fal·mock 어댑터(큐 제출·ED25519 웹훅·조회·취소·CDN만 내려받기), POST /api/play/runs(사전 한도 → 서버 렌더 → 입력·레퍼런스 모더레이션 → start_run → 제출), 생성 웹훅(서명·셀 토큰·셀 하나씩 정산, 일시 장애는 재시도), 1분 sweeper(셀마다 정산·만료 전 조회와 취소·파일 정리) + SQL 안전장치(5분), 입력 차단도 생성 정지 집계, 견적·AI 고지·레퍼런스 업로드 액션 · Vitest 196·pgTAP 604·e2e 66 통과(F4-2~5 passes) · 다음: /play 화면·/my/credits(PR G) · D18 open
- 2026-10-15 PLAY-screen: /play(빈 프롬프트·내 레시피·받은 무료 레시피, [변수] + 예시로 채우기, 모델 3개까지 모델별 설정, 서버 견적 「만들기 · NC」, 레퍼런스 + 얼굴 동의, 첫 실행 AI 고지, 결과 그리드 비공개 채널 + 폴링, 저장·비교 고정, 실패 문구, 오프라인 안내), /my/credits(잔액·리셋일·오늘 남은 한도·내역·잔액 열·규칙), 상세 「바로 만들어 보기」·계정 메뉴 크레딧·GNB 잔액 · Vitest 191·pgTAP 606·e2e 72 통과(F4-1·7·8·14·16 passes; F4-9 얼굴 결과 표시·F4-15 80% 운영자 알림은 남음) · 다음: W6(GAL·SAME 인증, ADM) · D18 open
