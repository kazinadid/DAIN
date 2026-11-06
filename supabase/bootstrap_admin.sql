-- Approved owner configuration. Email verification is mandatory before assignment.
create table private.admin_bootstrap(email text primary key);
alter table private.admin_bootstrap enable row level security;
revoke all on private.admin_bootstrap from public, anon, authenticated;
insert into private.admin_bootstrap(email) values('nadid450hossain@gmail.com');
create function private.assign_approved_admin() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.email_confirmed_at is not null and exists(select 1 from private.admin_bootstrap where email=lower(new.email)) then
   insert into private.staff(user_id,role) values(new.id,'admin') on conflict(user_id) do update set role='admin';
   delete from private.admin_bootstrap where email=lower(new.email);
 end if;
 return new;
end; $$;
revoke all on function private.assign_approved_admin() from public, anon, authenticated;
create trigger dain_approved_admin after insert or update of email_confirmed_at,email on auth.users for each row execute function private.assign_approved_admin();
