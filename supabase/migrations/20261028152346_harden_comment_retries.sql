-- No client needs the internal counter, even when table access is denied.
revoke all on sequence public.comment_limits_id_seq from public, anon, authenticated;

create or replace function public.submit_story_comment(p_id uuid, p_ip text, p_answer text, p_post uuid, p_name text, p_email text, p_email_hash text, p_body text)
returns text language plpgsql security invoker set search_path = '' as $$
declare challenge public.comment_challenges;
begin
  perform pg_advisory_xact_lock(828104);
  select * into challenge from public.comment_challenges where id = p_id;
  if challenge.id is null or challenge.ip_hash <> p_ip then return 'challenge'; end if;
  -- A lost HTTP response can be retried without a second insert or email.
  if challenge.used then
    if challenge.answer_hash = p_answer and exists(select 1 from public.story_comments c join public.comment_contacts e on e.comment_id=c.id where c.id = p_id and c.post_id = p_post and c.name = p_name and c.body = p_body and e.email = p_email) then return 'accepted'; end if;
    return 'challenge';
  end if;
  update public.comment_challenges set used = true where id = p_id;
  if challenge.answer_hash <> p_answer or challenge.created_at < now() - interval '10 minutes'
     or challenge.created_at > now() - interval '2 seconds' then return 'challenge'; end if;
  if not exists(select 1 from public.posts where id = p_post and status = 'published') then return 'post'; end if;
  if (select count(*) from public.comment_limits where created_at > now() - interval '1 day') >= 100 or
     (select count(*) from public.comment_limits where ip_hash = p_ip and created_at > now() - interval '1 hour') >= 5 or
     (select count(*) from public.comment_limits where email_hash = p_email_hash and created_at > now() - interval '1 day') >= 5 then return 'limited'; end if;
  insert into public.comment_limits(ip_hash,email_hash) values(p_ip,p_email_hash);
  insert into public.story_comments(id,post_id,name,body) values(p_id,p_post,p_name,p_body);
  insert into public.comment_contacts(comment_id,email) values(p_id,p_email);
  return 'accepted';
end $$;
revoke all on function public.submit_story_comment(uuid,text,text,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_story_comment(uuid,text,text,uuid,text,text,text,text) to service_role;
