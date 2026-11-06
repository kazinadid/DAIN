alter table public.submissions drop constraint submissions_narrative_check;
alter table public.submissions add constraint submissions_narrative_check check(length(trim(narrative)) between 30 and 20000);
alter table public.submissions add column classification text not null default '' check(length(classification)<=120);
alter table public.submissions add column impact text not null default '' check(length(impact)<=200);
alter table public.submissions add column syndication_consent boolean not null default false;
alter table public.submissions add column verification jsonb;
grant insert(classification,impact,syndication_consent) on public.submissions to authenticated;
grant update(classification,impact,syndication_consent) on public.submissions to authenticated;

create table public.verification_runs(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 submission_id uuid not null references public.submissions(id), status text not null default 'running',
 result jsonb, created_at timestamptz not null default now(), completed_at timestamptz
);
create index verification_runs_user_time on public.verification_runs(user_id,created_at);
create index verification_runs_submission on public.verification_runs(submission_id);
alter table public.verification_runs enable row level security;
revoke all on public.verification_runs from anon,authenticated;
grant select on public.verification_runs to authenticated;
create policy "Read permitted verification runs" on public.verification_runs for select to authenticated using(user_id=(select auth.uid()) or (select private.is_editor()));
create function private.reserve_verification(member_id uuid,story_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
 perform id from auth.users where id=member_id for update;
 if (select count(*) from public.verification_runs where user_id=member_id and created_at>now()-interval '60 seconds')>=5 then raise exception 'rate_limited'; end if;
 if exists(select 1 from public.verification_runs where submission_id=story_id and status='running' and created_at>now()-interval '60 seconds') then raise exception 'verification_in_progress'; end if;
 insert into public.verification_runs(user_id,submission_id) values(member_id,story_id) returning id into result_id;
 return result_id;
end $$;
revoke all on function private.reserve_verification(uuid,uuid) from public,anon,authenticated;
create function public.reserve_verification(member_id uuid,story_id uuid) returns uuid language sql security invoker set search_path='' as $$select private.reserve_verification(member_id,story_id);$$;
revoke all on function public.reserve_verification(uuid,uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.reserve_verification(uuid,uuid),public.reserve_verification(uuid,uuid) to service_role;

create table public.newsrooms(
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 200),
 email text not null unique check(email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
 tier smallint not null default 1 check(tier between 1 and 4), active boolean not null default false,
 approved_at timestamptz, created_at timestamptz not null default now()
);
alter table public.newsrooms enable row level security;
revoke all on public.newsrooms from anon,authenticated;
grant select on public.newsrooms to authenticated;
create policy "Staff can inspect approved newsroom list" on public.newsrooms for select to authenticated using((select private.is_editor()));
create table public.distribution_jobs(
 id uuid primary key default gen_random_uuid(), story_id uuid not null references public.stories(id),
 newsroom_id uuid not null references public.newsrooms(id), status text not null default 'queued' check(status in ('queued','sending','accepted','failed','blocked')),
 provider_id text, attempts integer not null default 0, last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(story_id,newsroom_id)
);
create index distribution_jobs_newsroom on public.distribution_jobs(newsroom_id);
alter table public.distribution_jobs enable row level security;
revoke all on public.distribution_jobs from anon,authenticated;
grant select on public.distribution_jobs to authenticated;
create policy "Staff can read distribution receipts" on public.distribution_jobs for select to authenticated using((select private.is_editor()));
create function private.queue_distribution(story_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 if auth.uid() is null or not private.is_editor() then raise exception 'Editorial access required';end if;
 if not exists(select 1 from public.stories p join public.submissions s on p.id=s.id where p.id=story_id and s.syndication_consent) then raise exception 'A published story with syndication consent is required';end if;
 insert into public.distribution_jobs(story_id,newsroom_id) select story_id,id from public.newsrooms where active and approved_at is not null on conflict do nothing;
 get diagnostics inserted=row_count;return inserted;
end $$;
revoke all on function private.queue_distribution(uuid) from public,anon;
grant execute on function private.queue_distribution(uuid) to authenticated;
create function public.queue_distribution(story_id uuid) returns integer language sql security invoker set search_path='' as $$select private.queue_distribution(story_id);$$;
revoke all on function public.queue_distribution(uuid) from public,anon;
grant execute on function public.queue_distribution(uuid) to authenticated;

create function private.claim_distribution(job_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.distribution_jobs set status='sending',attempts=attempts+1,updated_at=now()
 where id=job_id and status in ('queued','failed','blocked') and attempts<3;
 return found;
end $$;
revoke all on function private.claim_distribution(uuid) from public,anon,authenticated;
grant execute on function private.claim_distribution(uuid) to service_role;
create function public.claim_distribution(job_id uuid) returns boolean language sql security invoker set search_path='' as $$select private.claim_distribution(job_id);$$;
revoke all on function public.claim_distribution(uuid) from public,anon,authenticated;
grant execute on function public.claim_distribution(uuid) to service_role;
