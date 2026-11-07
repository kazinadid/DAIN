begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('20000000-0000-4000-8000-000000000001','distribution-member@du.ac.bd',now()),
 ('20000000-0000-4000-8000-000000000002','distribution-editor@du.ac.bd',now());
insert into private.staff values('20000000-0000-4000-8000-000000000002','admin');
insert into public.submissions(id,owner_id,headline,summary,narrative,sector,achievement_date,author_name,status,syndication_consent)
values('20000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000001','A distribution test achievement','A verified summary for distribution integration testing.',repeat('A factual achievement story. ',5),'Academic & Research','2026-01-01','Test Author','published',true);
insert into public.stories(id,headline,summary,narrative,sector,author_name,institution,achievement_date)
select id,headline,summary,narrative,sector,author_name,institution,achievement_date from public.submissions where id='20000000-0000-4000-8000-000000000010';
insert into public.newsrooms(name,email,active,approved_at) values('Approved test desk','approved@example.org',true,now()),('Unapproved desk','unapproved@example.org',true,null),('Inactive desk','inactive@example.org',false,now());
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
do $$ declare denied boolean:=false; begin
 begin update public.submissions set verification='{"status":"verified"}' where id='20000000-0000-4000-8000-000000000010';exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'FAIL: client forged AI result';end if;
 denied:=false;
 begin perform public.queue_distribution('20000000-0000-4000-8000-000000000010');exception when others then denied:=true;end;
 if not denied then raise exception 'FAIL: member queued distribution';end if;
 if (select count(*) from public.newsrooms)>0 then raise exception 'FAIL: member can read newsroom contacts';end if;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
do $$ begin
 if public.queue_distribution('20000000-0000-4000-8000-000000000010')<>1 then raise exception 'FAIL: recipient approval filter';end if;
 if public.queue_distribution('20000000-0000-4000-8000-000000000010')<>0 then raise exception 'FAIL: duplicate distribution jobs';end if;
 if (select count(*) from public.distribution_jobs where story_id='20000000-0000-4000-8000-000000000010')<>1 then raise exception 'FAIL: job count';end if;
end $$;
reset role;
set local role service_role;
do $$ declare i integer;denied boolean:=false;jid uuid;begin
 for i in 1..5 loop
  perform public.reserve_verification('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000010');
  update public.verification_runs set status='needs_review' where user_id='20000000-0000-4000-8000-000000000001';
 end loop;
 begin perform public.reserve_verification('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000010');exception when others then denied:=true;end;
 if not denied then raise exception 'FAIL: verification quota';end if;
 select id into jid from public.distribution_jobs where story_id='20000000-0000-4000-8000-000000000010';
 if not public.claim_distribution(jid) then raise exception 'FAIL: first delivery claim';end if;
 if public.claim_distribution(jid) then raise exception 'FAIL: duplicate delivery claim';end if;
end $$;
reset role;
select 'PASS: AI result write protection, quota, approved recipients, idempotent queue and exclusive delivery claims' as result;
rollback;
