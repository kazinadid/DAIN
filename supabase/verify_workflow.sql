-- Local/staging assertions only. Fixtures and helper functions are rolled back.
begin;
create schema test;
grant usage on schema test to authenticated,anon,service_role;
create function test.assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is not true then raise exception 'FAIL: %',label;end if;end$$;
create function test.denied(statement text,pattern text) returns void language plpgsql as $$
declare rejected boolean:=false;
begin
 begin execute statement;exception when others then
  if sqlerrm not ilike pattern then raise exception 'Unexpected rejection: % (wanted %)',sqlerrm,pattern;end if;
  rejected:=true;
 end;
 if not rejected then raise exception 'FAIL: unauthorized operation succeeded: %',statement;end if;
end$$;
create function test.payload() returns jsonb language sql as $$select jsonb_build_object('headline','A genuine university achievement','summary','An evidence-based summary of a real achievement for editorial review.','narrative',repeat('Detailed evidence and context of this university achievement. ',4),'sector','Academic & Research','achievement_date',current_date,'evidence_url','https://cphof.org/profile/icpc:Yeamin%20Kaiser','author_name','Test Author','institution','University of Dhaka','certified',true,'syndication_consent',false);$$;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('30000000-0000-4000-8000-000000000001','owner@du.ac.bd',now(),'{"display_name":"A","department":"Mathematics"}'),
 ('30000000-0000-4000-8000-000000000002','administrator@example.org',now(),'{}'),
 ('30000000-0000-4000-8000-000000000003','other@dept.du.ac.bd',now(),'{}'),
 ('30000000-0000-4000-8000-000000000004','unconfirmed@du.ac.bd',null,'{}'),
 ('30000000-0000-4000-8000-000000000005','outsider@evil-du.ac.bd',now(),'{}');
insert into private.staff values('30000000-0000-4000-8000-000000000002','admin');
select test.assert((select display_name='Member' and department='Mathematics' from public.profiles where id='30000000-0000-4000-8000-000000000001'),'profile trigger and short-name fallback');
select test.assert(to_regclass('private.admin_bootstrap') is null,'bootstrap table removed');
select test.assert(not exists(select from pg_trigger where tgname='dain_approved_admin'),'bootstrap trigger removed');
select test.denied($q$insert into private.staff values('30000000-0000-4000-8000-000000000003','editor')$q$,'%staff_role_check%');
update auth.users set email='changed@example.org' where id='30000000-0000-4000-8000-000000000005';
select test.assert(not exists(select from private.staff where user_id='30000000-0000-4000-8000-000000000005'),'email changes never grant admin');
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000004',true);
select test.denied($q$select public.create_and_submit_story(gen_random_uuid(),test.payload())$q$,'%confirmed%');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000005',true);
select test.denied($q$select public.create_and_submit_story(gen_random_uuid(),test.payload())$q$,'%confirmed%');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
select test.denied($q$select public.create_and_submit_story(gen_random_uuid(),test.payload()||'{"certified":false}')$q$,'%certify%');
select test.denied($q$select public.create_and_submit_story(gen_random_uuid(),test.payload()||'{"narrative":"Too short"}')$q$,'%full story%');
select test.assert((select count(*)=0 from public.submissions),'failed atomic save leaves no draft');
select public.create_and_submit_story('30000000-0000-4000-8000-000000000010',test.payload());
select public.create_and_submit_story('30000000-0000-4000-8000-000000000010',test.payload());
select test.assert((select count(*)=1 from public.submissions),'retry is idempotent');
select test.assert((select count(*)=1 from public.reviews),'retry creates one timeline event');
select test.assert((select status='submitted' and certified_at is not null and not syndication_consent from public.submissions limit 1),'atomic submission and separate certification/consent');
select test.denied($q$select verification from public.submissions$q$,'%permission denied%');
select test.denied($q$select public.admin_verification((select id from public.submissions limit 1))$q$,'%MFA%');
select test.denied($q$select public.delete_own_draft((select id from public.submissions limit 1))$q$,'%own drafts%');
select test.denied($q$select public.resubmit_story((select id from public.submissions limit 1),test.payload())$q$,'%own draft%');
select test.denied($q$select public.reserve_verification(auth.uid(),(select id from public.submissions limit 1))$q$,'%permission denied%');
do $$begin for i in 2..15 loop perform public.create_and_submit_story(gen_random_uuid(),test.payload());end loop;end$$;
select test.assert((select count(*)=15 from public.submissions),'normal account may create exactly 15 stories');
select test.denied($q$select public.create_and_submit_story(gen_random_uuid(),test.payload())$q$,'%Daily limit%');
select public.create_and_submit_story('30000000-0000-4000-8000-000000000010',test.payload());
select test.assert((select count(*)=15 from public.submissions),'retry at quota does not consume another slot');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',true);
select test.assert((select count(*)=0 from public.submissions),'another member cannot read stories');
insert into public.submissions(headline,summary,narrative,sector,achievement_date,author_name)
select 'A deletable draft story','A sufficiently detailed draft summary for this test.',repeat('Long form draft text. ',8),'Academic & Research',current_date,'Other Author';
select public.delete_own_draft((select id from public.submissions limit 1));
select test.assert((select count(*)=0 from public.submissions),'owner can delete draft');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
select test.assert(not private.is_editor(),'admin aal1 denied editorial access');
select test.denied($q$select public.review_story(gen_random_uuid(),'approved','Evidence checked')$q$,'%MFA%');
-- A confirmed administrator may submit with a non-DU address and has no submission cap.
do $$begin for i in 1..17 loop perform public.create_and_submit_story(gen_random_uuid(),test.payload());end loop;end$$;
select test.assert((select count(*)=17 from public.submissions),'admin submission limit exemption');
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select test.assert(private.is_editor(),'admin aal2 permits editorial access');
select test.denied($q$select public.review_story((select id from public.submissions where owner_id=auth.uid() limit 1),'approved','Checked evidence')$q$,'%Another administrator%');
select test.denied($q$select public.review_story((select id from public.submissions where client_request_id='30000000-0000-4000-8000-000000000010'),'approved','')$q$,'%Explain your decision%');
select public.review_story((select id from public.submissions where client_request_id='30000000-0000-4000-8000-000000000010'),'changes_requested','Please add dates and context.');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
select test.assert((select count(*)=1 from public.reviews where decision='changes_requested' and note='Please add dates and context.'),'author can read reviewer notes');
select public.resubmit_story((select id from public.submissions where client_request_id='30000000-0000-4000-8000-000000000010'),test.payload()||'{"syndication_consent":true}');
select test.assert((select syndication_consent from public.submissions where client_request_id='30000000-0000-4000-8000-000000000010'),'author can change consent on resubmission');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
select public.review_story((select id from public.submissions where client_request_id='30000000-0000-4000-8000-000000000010'),'approved','Evidence checked and approved.');
select test.assert((select count(*)=0 from public.stories),'approve is not publish');
select public.review_story((select id from public.submissions where client_request_id='30000000-0000-4000-8000-000000000010'),'published','Publication separately confirmed.');
select test.assert((select count(*)=1 from public.stories),'separate publication succeeds');
select test.denied($q$select public.unpublish_story((select id from public.stories limit 1),'')$q$,'%explanation%');
select public.unpublish_story((select id from public.stories limit 1),'Taken down pending further evidence.');
select test.assert((select count(*)=0 from public.stories),'takedown removes public story');
select test.assert((select count(*)=1 from public.reviews where decision='unpublished'),'takedown audited');
reset role;
-- Worker-only reservation and limits, with no provider requests.
do $$declare sid uuid;rid uuid;begin
 select id into sid from public.submissions where owner_id='30000000-0000-4000-8000-000000000001' and status='submitted' limit 1;
 rid:=public.reserve_verification('30000000-0000-4000-8000-000000000001',sid);
 perform test.denied(format('select public.reserve_verification(%L,%L)','30000000-0000-4000-8000-000000000001',sid),'%in_progress%');
 update public.verification_runs set status='needs_review',completed_at=now() where id=rid;
 for i in 2..3 loop
  rid:=public.reserve_verification('30000000-0000-4000-8000-000000000001',sid);
  update public.verification_runs set status='needs_review',completed_at=now() where id=rid;
 end loop;
 perform test.denied(format('select public.reserve_verification(%L,%L)','30000000-0000-4000-8000-000000000001',sid),'%story_verification_limit%');
 perform test.denied(format('select public.reserve_verification(%L,%L)','30000000-0000-4000-8000-000000000003',sid),'%not eligible%');
end$$;
select test.assert((select count(*)=3 from public.verification_runs),'three worker runs recorded');
delete from auth.users where id='30000000-0000-4000-8000-000000000001';
select test.assert(not exists(select from public.submissions where owner_id='30000000-0000-4000-8000-000000000001'),'user erasure cascades submissions');
select test.assert((select count(*)=0 from public.verification_runs),'user erasure cascades runs');
select test.assert(not exists(select from public.profiles where id='30000000-0000-4000-8000-000000000001'),'user erasure cascades profile');
set local role anon;
select test.denied($q$select public.create_and_submit_story(gen_random_uuid(),test.payload())$q$,'%permission denied%');
select test.denied($q$select public.admin_verification(gen_random_uuid())$q$,'%permission denied%');
select test.assert((select count(*)=0 from public.stories),'anonymous sees only surviving published records');
reset role;
select 'PASS: workflow, quota, bootstrap removal, MFA, roles, AI isolation and erasure' as result;
rollback;
