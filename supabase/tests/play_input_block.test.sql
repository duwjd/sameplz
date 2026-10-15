-- F4-7 / D13: input moderation blocks count toward the generation stop (record_play_input_block).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000b10c1', 'block@example.test');
-- The auth trigger creates the profile row.
update public.profiles set terms_accepted_at = now(), adult_confirmed_at = now()
 where id = '00000000-0000-0000-0000-0000000b10c1';

select is(public.record_play_input_block('00000000-0000-0000-0000-0000000b10c1'), false,
          'D13 first input block only records a signal');
select is(public.record_play_input_block('00000000-0000-0000-0000-0000000b10c1'), false,
          'D13 second input block only records a signal');
select is(public.record_play_input_block('00000000-0000-0000-0000-0000000b10c1'), true,
          'D13 third input block in 24h stops generation');
select ok((select generation_suspended_at is not null from public.credit_accounts
            where user_id = '00000000-0000-0000-0000-0000000b10c1'),
          'D13 the account is suspended for generation');
select is(public.record_play_input_block('00000000-0000-0000-0000-00000000dead'), false,
          'F4-7 unknown user records nothing');

set local role authenticated;
select throws_ok($$ select public.record_play_input_block('00000000-0000-0000-0000-0000000b10c1') $$,
                 '42501', null, 'F4-7 clients cannot record blocks');
reset role;

select * from finish();
rollback;
