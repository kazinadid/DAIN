-- Repeatable integration test. All fixtures are rolled back, leaving the project empty.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001','dain-test-owner@du.ac.bd',now()),
 ('10000000-0000-4000-8000-000000000002','dain-test-editor@du.ac.bd',now()),
 ('10000000-0000-4000-8000-000000000003','dain-test-other@du.ac.bd',now()),
 ('10000000-0000-4000-8000-000000000004','dain-test-outsider@example.com',now());
insert into private.staff values('10000000-0000-4000-8000-000000000002','admin');
set local role authenticated;
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into public.submissions(headline,summary,narrative,sector,achievement_date,author_name)
 values('Integration test achievement','An evidence-based summary of a university achievement.',repeat('A detailed and verifiable story. ',8),'Academic & Research','2026-01-01','Test Author');
do $$ declare sid uuid; denied boolean := false; begin
 select id into sid from public.submissions limit 1;
 begin update public.submissions set status='published' where id=sid; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL: member changed status directly'; end if;
 denied:=false;
 begin perform public.review_story(sid,'approved','Forged approval'); exception when others then denied:=true; end;
 if not denied then raise exception 'FAIL: member performed editorial review'; end if;
 perform public.resubmit_story(sid,jsonb_build_object('headline','Integration test achievement','summary','An evidence-based summary of a university achievement.','narrative',repeat('A detailed and verifiable story. ',8),'sector','Academic & Research','achievement_date','2026-01-01','author_name','Test Author','institution','University of Dhaka','certified',true));
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin if (select count(*) from public.submissions) <> 0 then raise exception 'FAIL: another member can see private submissions'; end if; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
do $$ declare denied boolean := false; begin
 begin insert into public.submissions(headline,summary,narrative,sector,achievement_date,author_name)
 values('Unauthorized submission','This user does not have an institutional address.',repeat('Non-institutional submission. ',8),'Academic & Research','2026-01-01','Outsider');
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL: non-DU account can submit'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ declare sid uuid; denied boolean := false; begin
 if public.my_role() <> 'admin' then raise exception 'FAIL: editor role not found'; end if;
 select id into sid from public.submissions limit 1;
 begin perform public.review_story(sid,'published','Skip approval'); exception when others then denied:=true; end;
 if not denied then raise exception 'FAIL: publication skipped approval'; end if;
 perform public.review_story(sid,'approved','Evidence checked.');
 perform public.review_story(sid,'published','Approved for publication.');
 if (select count(*) from public.reviews where submission_id=sid) <> 3 then raise exception 'FAIL: missing audit history'; end if;
end $$;
set local role anon;
do $$ declare denied boolean := false; begin
 if (select count(*) from public.stories) <> 1 then raise exception 'FAIL: published story unavailable'; end if;
 begin perform count(*) from public.submissions; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'FAIL: anonymous can access submissions'; end if;
end $$;
reset role;
select 'PASS: ownership, DU eligibility, editorial transitions, audit history and public isolation' as result;
rollback;
