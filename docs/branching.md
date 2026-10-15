# 브랜치 규칙

2026-10-14 사용자 결정. 상시 브랜치는 셋뿐이고, 기능마다 짧은 작업 브랜치를 쓴다.

| 브랜치 | 역할 | 배포 | DB |
|---|---|---|---|
| `main` (= prd) | 운영 | Vercel Production `https://sameplz.vercel.app` | 머지 때 `deploy-db`(승인 뒤 운영 반영) |
| `stg` | 운영 직전 확인 | Vercel Preview(브랜치 고정 주소) | **운영 DB에 연결**(Supabase Free 단일 프로젝트, D14). 스키마는 반영하지 않는다 |
| `dev` | 작업 모으기 | Vercel Preview | 연결 없음(빈 데이터). 개발은 로컬 Supabase |
| `feat/<CODE>-<slug>`, `fix/…`, `chore/…`, `docs/…` | 작업 1개 | PR 미리보기 | — |

## 흐름

1. `dev`에서 작업 브랜치를 딴다: `git switch -c feat/UP-schema origin/dev`
2. PR은 `dev`로 연다: `gh pr create --base dev`. CI(`checks`·`db`·`e2e`) 통과 뒤 머지하면 GitHub이 작업 브랜치를 지운다(`delete_branch_on_merge`).
3. 묶어서 확인할 때 `dev → stg` PR을 연다. stg 미리보기에서 화면을 확인한다.
4. 운영에 낼 때 `stg → main` PR을 연다. 머지하면 Vercel 운영 배포, 마이그레이션이 있으면 `deploy-db`가 승인을 기다린다.

- 승격 PR(`dev → stg`, `stg → main`)은 **머지 커밋**으로 합친다. 스쿼시·리베이스를 쓰면 브랜치 이력이 갈라져 다음 승격에서 충돌이 난다. 강제 push는 훅이 막는다.
- 운영 긴급 수정(hotfix)도 `dev`에서 따서 같은 길로 올린다. 급하면 `stg → main`을 바로 이어서 연다.
- 머지 안 된 실험 코드는 지우기 전에 `archive/<이름>` 태그로 남긴다(예: `archive/spike-naver-login`).

## stg가 운영 DB를 쓸 때 주의

- **새 마이그레이션은 `main` 머지 때만 운영 DB에 간다.** 그래서 stg에는 "새 코드 + 옛 스키마"가 함께 돈다. 새 테이블·RPC를 쓰는 화면은 stg에서 비어 보이거나 실패한다. 공개 읽기는 `degradeCachedRead`가 빈 값으로 버틴다.
  - 스키마가 바뀐 기능은 `stg → main` 머지 + deploy-db 승인 뒤 운영에서 확인한다.
- stg에서 하는 쓰기(로그인·받기·좋아요·올리기)는 **운영 데이터**다. 시험 계정으로만 하고, 쓴 것은 운영에 남는다.
- stg에도 운영과 같은 키가 필요하다. Vercel → Settings → Environment Variables에서 Preview 환경, 브랜치 `stg`로 범위를 정해 넣는다: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, 카카오·네이버 키, 올리기 검사 2층 키 `OPENAI_API_KEY`·`ANTHROPIC_API_KEY`(없으면 모든 올리기가 사람 확인으로 가요).
- 로그인: Supabase Redirect URLs에 stg 주소(`https://sameplz-git-stg-<팀>.vercel.app/**`)를 더하고, 카카오·네이버 콘솔에도 stg 콜백을 등록해야 stg에서 로그인된다.
