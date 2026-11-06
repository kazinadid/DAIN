-- Keep privileged implementations outside the exposed Data API schema.
alter function public.my_role() set schema private;
alter function public.submit_story(uuid) set schema private;
alter function public.review_story(uuid,text,text) set schema private;
create function public.my_role() returns text language sql stable security invoker set search_path='' as $$ select private.my_role(); $$;
create function public.submit_story(story_id uuid) returns void language sql security invoker set search_path='' as $$ select private.submit_story(story_id); $$;
create function public.review_story(story_id uuid,decision text,review_note text default '') returns void language sql security invoker set search_path='' as $$ select private.review_story(story_id,decision,review_note); $$;
revoke all on function public.my_role(),public.submit_story(uuid),public.review_story(uuid,text,text) from public,anon;
grant execute on function public.my_role(),public.submit_story(uuid),public.review_story(uuid,text,text) to authenticated;
