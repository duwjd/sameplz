# 12 관리자 접근

MVP 관리자는 운영자 1명이다(D23). 판정은 서버가 `profiles.role = 'admin'`으로 한다(`requireAdmin`·`getAdmin`), 관리 RPC는 service_role 전용이고 `private.assert_admin`이 다시 확인한다. JWT `admin` 클레임·Supabase MFA는 출시 뒤(관리자가 늘거나 유료 전환 전).

## 관리자 주고 빼기
1. Supabase 대시보드(운영) → **Authentication → Users**에서 대상 계정의 User UID를 찾는다. 이 값이 `profiles.id`다.
2. **SQL Editor**에서:
   ```sql
   update public.profiles set role = 'admin' where id = '<id>';   -- 주기
   update public.profiles set role = 'user'  where id = '<id>';   -- 빼기
   ```
3. 같은 자리에서 기록을 남긴다(아래 「수기 기록」, `action = 'role_grant'` / `'role_revoke'`).
4. 대상이 다시 로그인해 `/admin`이 열리는지(주기) / 안 열리는지(빼기) 확인한다.

- 관리자 계정에는 제재를 걸 수 없다(`CANNOT_SANCTION_ADMIN`). 문제가 생기면 먼저 `role = 'user'`로 내린다.
- 탈퇴한 관리자는 자동으로 권한이 없다(`deleted_at` 확인).

## 계정 보안
- 관리자 Google 계정은 **2단계 인증 필수**(D23). 남은 위험이 이 계정 탈취다.
- 관리자 계정은 개인 브라우저 프로필에서만 쓰고, 공용 PC에서 `/admin`을 열지 않는다.
- Supabase·Vercel·GitHub·fal 계정도 2단계 인증을 켠다.

## 기록 (`admin_actions`)
- 관리 화면의 모든 조치(심사·신고·레시피 상태·제재·생성 다시 열기·크레딧 조정)와 `admin_set_budget`은 사유와 함께 `admin_actions`에 자동으로 남는다.
- `admin_actions`는 insert만 된다(수정·삭제·truncate 거부).

## Studio·SQL Editor는 비상용
- 쓰는 때: 관리 화면에 없는 일(관리자 지정, 예산 변경, 갤러리 글 숨김 해제, 사고 대응).
- Studio에서 고친 내용은 앱의 감사 로그와 회원 알림을 건너뛴다. 회원에게 알려야 하면 고객센터 메일로 따로 알린다.
- 스키마(DDL)는 바꾸지 않는다. 마이그레이션 → `deploy-db`로만 간다.
- 원장(`credit_ledger`)·동의 기록은 append-only라 고치지 않는다. 크레딧은 「크레딧 조정하기」로만.

### 수기 기록
손으로 고쳤으면 **같은 세션에서** 남긴다.
```sql
insert into public.admin_actions (actor_id, action, target_type, target_id, reason, detail)
values ('<내 profiles.id>', 'manual_fix', '<테이블>', '<대상 id>', '<왜 고쳤나>',
        jsonb_build_object('sql', '<실행한 문장 요약>'));
```
- `action`은 40자 이내, `reason`은 비울 수 없다.
