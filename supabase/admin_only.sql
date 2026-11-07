create or replace function private.is_editor() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.staff where user_id=(select auth.uid()) and role='admin');
$$;
