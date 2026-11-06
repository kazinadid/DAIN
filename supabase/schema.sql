-- DAIN baseline. Applied once to an empty hosted project through apply_migration.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table private.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('editor','admin'))
);
alter table private.staff enable row level security;
revoke all on private.staff from public, anon, authenticated;

-- Deliberately privileged, bounded helper: resolves roles from a protected table.
create function private.is_editor() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.staff where user_id = (select auth.uid()) and role in ('editor','admin'));
$$;
create function private.is_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id = (select auth.uid()) and email_confirmed_at is not null
    and lower(email) ~ '^[^@]+@([a-z0-9-]+\.)*du\.ac\.bd$');
$$;
revoke all on function private.is_editor(), private.is_member() from public, anon;
grant execute on function private.is_editor(), private.is_member() to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 100),
  department text not null default '' check (length(department) <= 200)
);
alter table public.profiles enable row level security;
create policy "Read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()) or (select private.is_editor()));
create policy "Create own profile" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "Update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
grant select,insert,update on public.profiles to authenticated;
revoke all on public.profiles from anon;

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  headline text not null check (length(trim(headline)) between 10 and 120),
  summary text not null check (length(trim(summary)) between 30 and 600),
  narrative text not null check (length(trim(narrative)) between 80 and 20000),
  sector text not null check (sector in ('Academic & Research','Professional & Corporate','Entrepreneurship & Startups','Social Impact & Community','Personal Milestones')),
  achievement_date date not null check (achievement_date <= current_date),
  evidence_url text not null default '' check (evidence_url = '' or (length(evidence_url) <= 2048 and evidence_url ~ '^https?://[^[:space:]]+$')),
  author_name text not null check (length(trim(author_name)) between 2 and 100),
  institution text not null default 'University of Dhaka' check (length(institution) between 1 and 200),
  status text not null default 'draft' check (status in ('draft','submitted','changes_requested','approved','rejected','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index submissions_owner_idx on public.submissions(owner_id);
create index submissions_status_idx on public.submissions(status,created_at desc);
alter table public.submissions enable row level security;
create policy "Read permitted submissions" on public.submissions for select to authenticated using (owner_id = (select auth.uid()) or (select private.is_editor()));
create policy "Create own draft" on public.submissions for insert to authenticated with check (owner_id = (select auth.uid()) and status = 'draft' and (select private.is_member()));
create policy "Edit own draft" on public.submissions for update to authenticated using (owner_id = (select auth.uid()) and status in ('draft','changes_requested') and (select private.is_member())) with check (owner_id = (select auth.uid()) and status in ('draft','changes_requested'));
revoke all on public.submissions from anon, authenticated;
grant select on public.submissions to authenticated;
grant insert (headline,summary,narrative,sector,achievement_date,evidence_url,author_name,institution) on public.submissions to authenticated;
grant update (headline,summary,narrative,sector,achievement_date,evidence_url,author_name,institution) on public.submissions to authenticated;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  reviewer_id uuid references auth.users(id),
  decision text not null,
  note text not null check (length(note) <= 4000),
  created_at timestamptz not null default now()
);
create index reviews_submission_idx on public.reviews(submission_id);
create index reviews_reviewer_idx on public.reviews(reviewer_id);
alter table public.reviews enable row level security;
create policy "Read own review history" on public.reviews for select to authenticated using (
  (select private.is_editor()) or exists(select 1 from public.submissions s where s.id = submission_id and s.owner_id = (select auth.uid()))
);
grant select on public.reviews to authenticated;
revoke all on public.reviews from anon;

-- Public projection intentionally excludes account IDs, private evidence and review notes.
create table public.stories (
  id uuid primary key references public.submissions(id),
  headline text not null, summary text not null, narrative text not null,
  sector text not null, author_name text not null, institution text not null,
  achievement_date date not null, published_at timestamptz not null default now()
);
alter table public.stories enable row level security;
create policy "Read published stories" on public.stories for select to anon,authenticated using (true);
grant select on public.stories to anon,authenticated;

create function public.my_role() returns text language sql stable security definer set search_path = '' as $$
 select coalesce((select role from private.staff where user_id = (select auth.uid())), 'member');
$$;
create function public.submit_story(story_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not private.is_member() then raise exception 'A confirmed DU institutional email is required.'; end if;
 update public.submissions set status = 'submitted', updated_at = now()
 where id = story_id and owner_id = auth.uid() and status in ('draft','changes_requested');
 if not found then raise exception 'Submission cannot be submitted.'; end if;
 insert into public.reviews(submission_id,reviewer_id,decision,note) values(story_id,auth.uid(),'submitted','Submitted for editorial review.');
end; $$;
-- Only this checked transaction can change editorial status or write public stories.
create function public.review_story(story_id uuid, decision text, review_note text default '') returns void language plpgsql security definer set search_path = '' as $$
declare s public.submissions;
begin
 if auth.uid() is null or not private.is_editor() then raise exception 'Editorial access required.'; end if;
 select * into s from public.submissions where id = story_id for update;
 if not found then raise exception 'Story not found.'; end if;
 if s.owner_id = auth.uid() then raise exception 'Another editor must review your story.'; end if;
 if length(review_note) > 4000 then raise exception 'Review note is too long.'; end if;
 if decision in ('approved','rejected','changes_requested') and s.status = 'submitted' then
   if decision <> 'approved' and length(trim(review_note)) < 5 then raise exception 'Explain your decision to the author.'; end if;
 elsif decision = 'published' and s.status = 'approved' then
   insert into public.stories(id,headline,summary,narrative,sector,author_name,institution,achievement_date)
   values(s.id,s.headline,s.summary,s.narrative,s.sector,s.author_name,s.institution,s.achievement_date);
 else raise exception 'Invalid editorial transition.';
 end if;
 update public.submissions set status = decision,updated_at = now() where id = story_id;
 insert into public.reviews(submission_id,reviewer_id,decision,note) values(story_id,auth.uid(),decision,review_note);
end; $$;
revoke all on function public.my_role(), public.submit_story(uuid), public.review_story(uuid,text,text) from public, anon;
grant execute on function public.my_role(), public.submit_story(uuid), public.review_story(uuid,text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('evidence','evidence',false,5242880,array['application/pdf','image/jpeg','image/png','image/webp']);
-- Object path: {user_id}/{submission_id}/{random-id}. Read access follows the submission.
create policy "Upload own draft evidence" on storage.objects for insert to authenticated with check (
 bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text
 and (select private.is_member()) and exists(select 1 from public.submissions s
 where s.id::text = (storage.foldername(name))[2] and s.owner_id = (select auth.uid()) and s.status in ('draft','changes_requested')));
create policy "Read permitted evidence" on storage.objects for select to authenticated using (
 bucket_id = 'evidence' and exists(select 1 from public.submissions s where s.id::text = (storage.foldername(name))[2]
 and (s.owner_id = (select auth.uid()) or (select private.is_editor()))));
create policy "Remove own draft evidence" on storage.objects for delete to authenticated using (
 bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text and exists(select 1 from public.submissions s
 where s.id::text = (storage.foldername(name))[2] and s.owner_id = (select auth.uid()) and s.status in ('draft','changes_requested')));
