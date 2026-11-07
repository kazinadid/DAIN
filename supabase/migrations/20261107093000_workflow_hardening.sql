-- Apply only in local/staging during development. Release owner reviews production application.
begin;
drop trigger if exists dain_approved_admin on auth.users;
drop function if exists private.assign_approved_admin();
drop table if exists private.admin_bootstrap;
-- Retire the inactive editor role without promoting anyone.
delete from private.staff where role='editor';
alter table private.staff drop constraint if exists staff_role_check;
alter table private.staff add constraint staff_role_check check(role='admin');
create or replace function private.is_editor() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal','aal1')='aal2'
 and exists(select 1 from private.staff where user_id=auth.uid() and role='admin');
$$;
create or replace function private.is_admin_role() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.staff where user_id=auth.uid() and role='admin');
$$;
revoke all on function private.is_admin_role() from public,anon;
grant execute on function private.is_admin_role() to authenticated;
create or replace function public.admin_session() returns boolean language sql stable security invoker set search_path='' as $$select private.is_editor();$$;
revoke all on function public.admin_session() from public,anon;
grant execute on function public.admin_session() to authenticated;
create or replace function private.is_member() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null
 and (lower(email) ~ '^[^@]+@([a-z0-9-]+\.)*du\.ac\.bd$' or private.is_admin_role()));
$$;

alter table public.submissions add column if not exists client_request_id uuid default gen_random_uuid();
alter table public.submissions add column if not exists certified_at timestamptz;
create unique index if not exists submissions_request_unique on public.submissions(owner_id,client_request_id);
create table if not exists private.submission_events(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 story_id uuid not null unique, created_at timestamptz not null default now()
);
alter table private.submission_events enable row level security;
revoke all on private.submission_events from public,anon,authenticated;
create index if not exists submission_events_user_day on private.submission_events(user_id,created_at);
-- Seed the ledger once for existing rows; deleting drafts never resets daily usage.
insert into private.submission_events(user_id,story_id,created_at) select owner_id,id,created_at from public.submissions on conflict(story_id) do nothing;
create or replace function private.enforce_submission_quota() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform id from auth.users where id=new.owner_id for update;
 if not exists(select 1 from private.staff where user_id=new.owner_id and role='admin') and
 (select count(*) from private.submission_events where user_id=new.owner_id and (created_at at time zone 'Asia/Dhaka')::date=(now() at time zone 'Asia/Dhaka')::date)>=15
 then raise exception 'Daily limit reached: normal accounts can create 15 stories per Bangladesh calendar day.';end if;
 insert into private.submission_events(user_id,story_id) values(new.owner_id,new.id) on conflict(story_id) do nothing;
 return new;
end $$;
revoke all on function private.enforce_submission_quota() from public,anon,authenticated;
drop trigger if exists dain_submission_quota on public.submissions;
create trigger dain_submission_quota before insert on public.submissions for each row execute function private.enforce_submission_quota();

create or replace function private.create_and_submit_story(request_id uuid,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if auth.uid() is null or not private.is_member() then raise exception 'A confirmed DU institutional email is required to submit.';end if;
 if request_id is null then raise exception 'A submission request ID is required.';end if;
 perform id from auth.users where id=auth.uid() for update;
 select id into sid from public.submissions where owner_id=auth.uid() and client_request_id=request_id;
 if found then return sid;end if;
 if coalesce((payload->>'certified')::boolean,false) is not true then raise exception 'Please certify that your story is authentic.';end if;
 if length(trim(coalesce(payload->>'narrative',''))) not between 80 and 20000 then raise exception 'The full story must contain 80 to 20000 characters.';end if;
 insert into public.submissions(client_request_id,owner_id,headline,summary,narrative,sector,achievement_date,evidence_url,author_name,institution,classification,impact,syndication_consent,certified_at,status)
 values(request_id,auth.uid(),trim(payload->>'headline'),trim(payload->>'summary'),trim(payload->>'narrative'),payload->>'sector',(payload->>'achievement_date')::date,
 coalesce(payload->>'evidence_url',''),trim(payload->>'author_name'),trim(payload->>'institution'),coalesce(payload->>'classification',''),coalesce(payload->>'impact',''),coalesce((payload->>'syndication_consent')::boolean,false),now(),'submitted') returning id into sid;
 insert into public.reviews(submission_id,reviewer_id,decision,note) values(sid,auth.uid(),'submitted','Submitted for review.');
 return sid;
end $$;
create or replace function private.delete_own_draft(story_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 delete from public.submissions where id=story_id and owner_id=auth.uid() and status='draft';
 if not found then raise exception 'Only your own drafts can be deleted.';end if;
end $$;
create or replace function private.resubmit_story(story_id uuid,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_member() then raise exception 'A confirmed DU institutional email is required.';end if;
 if length(trim(coalesce(payload->>'narrative',''))) not between 80 and 20000 then raise exception 'The full story must contain 80 to 20000 characters.';end if;
 if coalesce((payload->>'certified')::boolean,false) is not true then raise exception 'Please certify your story.';end if;
 update public.submissions set headline=trim(payload->>'headline'),summary=trim(payload->>'summary'),narrative=trim(payload->>'narrative'),
 sector=payload->>'sector',achievement_date=(payload->>'achievement_date')::date,evidence_url=coalesce(payload->>'evidence_url',''),
 author_name=trim(payload->>'author_name'),institution=trim(payload->>'institution'),classification=coalesce(payload->>'classification',''),impact=coalesce(payload->>'impact',''),
 syndication_consent=coalesce((payload->>'syndication_consent')::boolean,false),certified_at=now(),verification=null,status='submitted',updated_at=now()
 where id=story_id and owner_id=auth.uid() and status in ('draft','changes_requested');
 if not found then raise exception 'Only your own draft or returned story can be resubmitted.';end if;
 insert into public.reviews(submission_id,reviewer_id,decision,note) values(story_id,auth.uid(),'submitted','Author resubmitted after editing.');
end $$;
create or replace function private.unpublish_story(story_id uuid,review_note text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_editor() then raise exception 'Administrator access with MFA is required.';end if;
 if length(trim(review_note)) not between 5 and 4000 then raise exception 'A takedown explanation of 5 to 4000 characters is required.';end if;
 perform id from public.submissions where id=story_id and status='published' for update;
 if not found then raise exception 'Only published stories can be taken down.';end if;
 delete from public.stories where id=story_id;
 update public.submissions set status='approved',updated_at=now() where id=story_id;
 insert into public.reviews(submission_id,reviewer_id,decision,note) values(story_id,auth.uid(),'unpublished',review_note);
end $$;
create or replace function private.admin_verification(story_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_editor() then raise exception 'Administrator access with MFA is required.';end if;
 return (select verification from public.submissions where id=story_id);
end $$;
-- Explicit API wrappers; private implementations have empty search paths and checked identities.
create or replace function public.create_and_submit_story(request_id uuid,payload jsonb) returns uuid language sql security invoker set search_path='' as $$select private.create_and_submit_story(request_id,payload);$$;
create or replace function public.delete_own_draft(story_id uuid) returns void language sql security invoker set search_path='' as $$select private.delete_own_draft(story_id);$$;
create or replace function public.resubmit_story(story_id uuid,payload jsonb) returns void language sql security invoker set search_path='' as $$select private.resubmit_story(story_id,payload);$$;
create or replace function public.unpublish_story(story_id uuid,review_note text) returns void language sql security invoker set search_path='' as $$select private.unpublish_story(story_id,review_note);$$;
create or replace function public.admin_verification(story_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$select private.admin_verification(story_id);$$;
revoke all on function private.create_and_submit_story(uuid,jsonb),private.delete_own_draft(uuid),private.resubmit_story(uuid,jsonb),private.unpublish_story(uuid,text),private.admin_verification(uuid) from public,anon;
revoke all on function public.create_and_submit_story(uuid,jsonb),public.delete_own_draft(uuid),public.resubmit_story(uuid,jsonb),public.unpublish_story(uuid,text),public.admin_verification(uuid) from public,anon;
grant execute on function private.create_and_submit_story(uuid,jsonb),private.delete_own_draft(uuid),private.resubmit_story(uuid,jsonb),private.unpublish_story(uuid,text),private.admin_verification(uuid) to authenticated;
grant execute on function public.create_and_submit_story(uuid,jsonb),public.delete_own_draft(uuid),public.resubmit_story(uuid,jsonb),public.unpublish_story(uuid,text),public.admin_verification(uuid) to authenticated;

create or replace function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,display_name,department) values(new.id,case when length(trim(coalesce(new.raw_user_meta_data->>'display_name','')))>=2 then left(trim(new.raw_user_meta_data->>'display_name'),100) else 'Member' end,left(coalesce(new.raw_user_meta_data->>'department',''),200)) on conflict(id) do nothing;
 return new;
end $$;
revoke all on function private.create_profile() from public,anon,authenticated;
drop trigger if exists dain_create_profile on auth.users;
create trigger dain_create_profile after insert on auth.users for each row execute function private.create_profile();
insert into public.profiles(id,display_name) select id,'Member' from auth.users on conflict(id) do nothing;

-- Erasure policy: delete private/public story records; retain reviews only with their surviving story, anonymizing erased reviewers.
alter table public.submissions drop constraint if exists submissions_owner_id_fkey;
alter table public.submissions add constraint submissions_owner_id_fkey foreign key(owner_id) references auth.users(id) on delete cascade;
alter table public.stories drop constraint if exists stories_id_fkey;
alter table public.stories add constraint stories_id_fkey foreign key(id) references public.submissions(id) on delete cascade;
alter table public.reviews drop constraint if exists reviews_reviewer_id_fkey;
alter table public.reviews add constraint reviews_reviewer_id_fkey foreign key(reviewer_id) references auth.users(id) on delete set null;
alter table public.verification_runs drop constraint if exists verification_runs_user_id_fkey;
alter table public.verification_runs add constraint verification_runs_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
alter table public.verification_runs drop constraint if exists verification_runs_submission_id_fkey;
alter table public.verification_runs add constraint verification_runs_submission_id_fkey foreign key(submission_id) references public.submissions(id) on delete cascade;
alter table public.distribution_jobs drop constraint if exists distribution_jobs_story_id_fkey;
alter table public.distribution_jobs add constraint distribution_jobs_story_id_fkey foreign key(story_id) references public.stories(id) on delete cascade;

-- Owners see status/history, never the AI assessment payload. Admins use a checked RPC for the AI panel.
revoke select on public.submissions from authenticated;
grant select(id,owner_id,headline,summary,narrative,sector,achievement_date,evidence_url,author_name,institution,status,created_at,updated_at,classification,impact,syndication_consent,certified_at,client_request_id) on public.submissions to authenticated;
revoke select on public.verification_runs from authenticated;
grant select(id,user_id,submission_id,status,created_at,completed_at) on public.verification_runs to authenticated;

create or replace function private.reserve_verification(member_id uuid,story_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;admin_member boolean;
begin
 perform id from auth.users where id=member_id for update;
 if not exists(select 1 from public.submissions where id=story_id and owner_id=member_id and status='submitted') then raise exception 'Submission is not eligible for verification.';end if;
 admin_member:=exists(select 1 from private.staff where user_id=member_id and role='admin');
 if not admin_member and (select count(*) from public.verification_runs where user_id=member_id and created_at>now()-interval '60 seconds')>=5 then raise exception 'rate_limited';end if;
 if not admin_member and (select count(*) from public.verification_runs where user_id=member_id and (created_at at time zone 'Asia/Dhaka')::date=(now() at time zone 'Asia/Dhaka')::date)>=45 then raise exception 'daily_verification_limit';end if;
 if (select count(*) from public.verification_runs where submission_id=story_id)>=3 then raise exception 'story_verification_limit';end if;
 if exists(select 1 from public.verification_runs where submission_id=story_id and status in ('running','queued') and created_at>now()-interval '90 seconds') then raise exception 'verification_in_progress';end if;
 insert into public.verification_runs(user_id,submission_id,status) values(member_id,story_id,'queued') returning id into rid;return rid;
end $$;
create or replace function private.review_story(story_id uuid,decision text,review_note text default '') returns void language plpgsql security definer set search_path='' as $$
declare s public.submissions;
begin
 if not private.is_editor() then raise exception 'Administrator access with MFA is required.';end if;
 if coalesce(length(trim(review_note)),0) not between 5 and 4000 then raise exception 'Explain your decision in 5 to 4000 characters.';end if;
 select * into s from public.submissions where id=story_id for update;
 if not found then raise exception 'Story not found.';end if;
 if s.owner_id=auth.uid() then raise exception 'Another administrator must review your story.';end if;
 if decision in ('approved','rejected','changes_requested') and s.status='submitted' then
  null;
 elsif decision='published' and s.status='approved' then
  insert into public.stories(id,headline,summary,narrative,sector,author_name,institution,achievement_date)
  values(s.id,s.headline,s.summary,s.narrative,s.sector,s.author_name,s.institution,s.achievement_date);
 else raise exception 'Invalid editorial transition.';end if;
 update public.submissions set status=decision,updated_at=now() where id=story_id;
 insert into public.reviews(submission_id,reviewer_id,decision,note) values(story_id,auth.uid(),decision,trim(review_note));
end $$;
-- Retain the legacy RPC name without permitting the old uncertified/short-story path.
create or replace function private.submit_story(story_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_member() then raise exception 'A confirmed author account is required.';end if;
 update public.submissions set status='submitted',updated_at=now()
 where id=story_id and owner_id=auth.uid() and status in ('draft','changes_requested')
 and certified_at is not null and length(trim(narrative)) between 80 and 20000;
 if not found then raise exception 'Use Edit and resubmit to certify a complete story.';end if;
 insert into public.reviews(submission_id,reviewer_id,decision,note) values(story_id,auth.uid(),'submitted','Submitted for editorial review.');
end $$;
commit;
