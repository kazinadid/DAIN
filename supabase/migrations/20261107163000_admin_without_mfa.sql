-- Owner requested administrator access without authenticator MFA.
begin;
create or replace function private.is_editor() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from private.staff where user_id=auth.uid() and role='admin'
 );
$$;
-- Retain the same checked RPCs and privileges; only update their obsolete messages.
do $$declare f regprocedure;begin
 foreach f in array array['private.review_story(uuid,text,text)'::regprocedure,'private.unpublish_story(uuid,text)'::regprocedure,'private.admin_verification(uuid)'::regprocedure] loop
  execute replace(pg_get_functiondef(f),'Administrator access with MFA is required.','Administrator access is required.');
 end loop;
end$$;
commit;
