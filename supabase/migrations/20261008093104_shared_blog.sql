-- A dedicated project: no dependency on Rebel Tech Portal.
create table public.writers (email text primary key check (email = lower(email)));
alter table public.writers enable row level security;
revoke all on public.writers from anon, authenticated;
grant select on public.writers to authenticated;
create policy "Writer can check own access" on public.writers for select to authenticated
  using (email = lower((select auth.jwt()->>'email')));

create function public.valid_story_photos(photos jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(photos) <> 'array' then false else
    jsonb_array_length(photos) <= 8 and not exists (
      select 1 from jsonb_array_elements(photos) p
      where jsonb_typeof(p) <> 'object'
        or coalesce(jsonb_typeof(p->'path') <> 'string', true)
        or coalesce(jsonb_typeof(p->'alt') <> 'string', true)
        or coalesce(jsonb_typeof(p->'caption') <> 'string', true)
        or (p->>'path') !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg$'
        or length(p->>'alt') > 300 or length(p->>'caption') > 500
    ) end;
$$;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 120),
  title text not null default '' check (length(title) <= 160),
  summary text not null default '' check (length(summary) <= 500),
  body text not null default '' check (length(body) <= 50000),
  category text not null default 'Little joys' check (category in ('Little joys','Slow mornings','Life lately','Notes to self')),
  status text not null default 'draft' check (status in ('draft','published')),
  photos jsonb not null default '[]' check (public.valid_story_photos(photos)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint published_story_has_content check (status = 'draft' or (length(trim(title)) > 0 and length(trim(summary)) > 0 and length(trim(body)) > 0))
);
create index posts_public_date_idx on public.posts (published_at desc) where status = 'published';
create index posts_photo_paths_idx on public.posts using gin (photos jsonb_path_ops);
alter table public.posts enable row level security;
grant select on public.posts to anon;
grant select, insert, update, delete on public.posts to authenticated;
create policy "Read published stories" on public.posts for select to anon, authenticated using (status = 'published');
create policy "Writers manage stories" on public.posts for all to authenticated
  using ((select exists(select 1 from public.writers)))
  with check ((select exists(select 1 from public.writers)));

create function public.stamp_story() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  if TG_OP = 'UPDATE' then new.created_at = old.created_at; end if;
  if new.status = 'published' then
    if TG_OP = 'INSERT' then new.published_at = now();
    elsif old.published_at is null then new.published_at = now();
    else new.published_at = old.published_at; end if;
  end if;
  return new;
end;
$$;
create trigger stamp_story before insert or update on public.posts for each row execute function public.stamp_story();

create table public.site_settings (
  id integer primary key default 1 check (id = 1),
  title text not null default 'Zomora’s Corner' check (length(title) between 1 and 80),
  tagline text not null default 'Little joys. Honest stories. Room to breathe.' check (length(tagline) <= 200),
  about text not null default 'A little corner for everyday stories, slow mornings, and the good things tucked into ordinary days.' check (length(about) <= 5000),
  email text not null default '' check (length(email) <= 254),
  instagram text not null default '' check (instagram = '' or instagram ~ '^[a-zA-Z0-9_.]{1,30}$')
);
alter table public.site_settings enable row level security;
grant select on public.site_settings to anon;
grant select, update on public.site_settings to authenticated;
create policy "Public site introduction" on public.site_settings for select to anon, authenticated using (true);
create policy "Writers update introduction" on public.site_settings for update to authenticated
  using ((select exists(select 1 from public.writers))) with check ((select exists(select 1 from public.writers)));
insert into public.site_settings (id) values (1);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-photos', 'story-photos', false, 3145728, array['image/jpeg']);
create policy "Writers read photos" on storage.objects for select to authenticated
  using (bucket_id = 'story-photos' and (select exists(select 1 from public.writers)));
create policy "Readers see published photos" on storage.objects for select to anon, authenticated
  using (bucket_id = 'story-photos' and exists (
    select 1 from public.posts p where p.status = 'published' and p.photos @> jsonb_build_array(jsonb_build_object('path', name))
  ));
create policy "Writers upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'story-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and (select exists(select 1 from public.writers)));
create policy "Writers remove photos" on storage.objects for delete to authenticated
  using (bucket_id = 'story-photos' and (select exists(select 1 from public.writers)));
