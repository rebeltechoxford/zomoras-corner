-- Email addresses never share a table with public comment data.
create table public.story_comments (
  id uuid primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  body text not null check (length(trim(body)) between 1 and 3000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create index story_comments_post_status_idx on public.story_comments(post_id,status,created_at);
alter table public.story_comments enable row level security;
revoke all on public.story_comments from public, anon, authenticated;
grant select on public.story_comments to anon, authenticated;
grant update(status) on public.story_comments to authenticated;
grant all on public.story_comments to service_role;
create policy "Read approved comments on published stories" on public.story_comments for select to anon, authenticated
  using (status = 'approved' and exists(select 1 from public.posts p where p.id = post_id and p.status = 'published'));
create policy "Writers review comments" on public.story_comments for select to authenticated
  using ((select exists(select 1 from public.writers)));
create policy "Writers moderate comments" on public.story_comments for update to authenticated
  using ((select exists(select 1 from public.writers))) with check ((select exists(select 1 from public.writers)));

create table public.comment_contacts (
  comment_id uuid primary key references public.story_comments(id) on delete cascade,
  email text not null check (length(email) between 3 and 254),
  notification_status text not null default 'queued' check (notification_status in ('queued','sending','sent','failed','unconfigured')),
  notification_attempted_at timestamptz,
  notification_sent_at timestamptz
);
alter table public.comment_contacts enable row level security;
revoke all on public.comment_contacts from public, anon, authenticated;
grant select on public.comment_contacts to authenticated;
grant all on public.comment_contacts to service_role;
create policy "Only writers read commenter email" on public.comment_contacts for select to authenticated
  using ((select exists(select 1 from public.writers)));

create table public.comment_challenges (
  id uuid primary key, ip_hash text not null, answer_hash text not null,
  created_at timestamptz not null default now(), used boolean not null default false
);
create index comment_challenges_ip_idx on public.comment_challenges(ip_hash,created_at);
create table public.comment_limits (
  id bigint generated always as identity primary key, ip_hash text not null, email_hash text not null,
  created_at timestamptz not null default now()
);
create index comment_limits_ip_idx on public.comment_limits(ip_hash,created_at);
create index comment_limits_email_idx on public.comment_limits(email_hash,created_at);
alter table public.comment_challenges enable row level security;
alter table public.comment_limits enable row level security;
revoke all on public.comment_challenges, public.comment_limits from public, anon, authenticated;
grant all on public.comment_challenges, public.comment_limits to service_role;
grant usage, select on sequence public.comment_limits_id_seq to service_role;

-- Service-only SECURITY INVOKER RPCs. The lock makes limits and one-use
-- challenges atomic across concurrent Edge Function instances.
create function public.issue_comment_challenge(p_id uuid, p_ip text, p_answer text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(828104);
  delete from public.comment_challenges where created_at < now() - interval '1 hour';
  delete from public.comment_limits where created_at < now() - interval '1 day';
  if (select count(*) from public.comment_challenges) >= 1000 or
     (select count(*) from public.comment_challenges where ip_hash = p_ip) >= 30 then return false; end if;
  insert into public.comment_challenges(id,ip_hash,answer_hash) values(p_id,p_ip,p_answer);
  return true;
end $$;
revoke all on function public.issue_comment_challenge(uuid,text,text) from public, anon, authenticated;
grant execute on function public.issue_comment_challenge(uuid,text,text) to service_role;

create function public.submit_story_comment(p_id uuid, p_ip text, p_answer text, p_post uuid, p_name text, p_email text, p_email_hash text, p_body text)
returns text language plpgsql security invoker set search_path = '' as $$
declare challenge public.comment_challenges;
begin
  perform pg_advisory_xact_lock(828104);
  select * into challenge from public.comment_challenges where id = p_id;
  if challenge.id is null or challenge.ip_hash <> p_ip then return 'challenge'; end if;
  -- A lost HTTP response can be retried without a second insert or email.
  if challenge.used then
    if challenge.answer_hash = p_answer and exists(select 1 from public.story_comments where id = p_id) then return 'accepted'; end if;
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

-- SMTP credentials are encrypted at rest in Vault, never shipped to a browser.
-- The RPC runs as the service role and is not callable by either client role.
grant usage on schema vault to service_role;
grant select on vault.decrypted_secrets to service_role;
create function public.comment_mail_settings() returns jsonb
language sql security invoker set search_path = '' as $$
  select decrypted_secret::jsonb from vault.decrypted_secrets where name = 'zomora_comment_mail';
$$;
revoke all on function public.comment_mail_settings() from public, anon, authenticated;
grant execute on function public.comment_mail_settings() to service_role;
