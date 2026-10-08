-- Only the latest daily readings are retained, not an archive of scripture.
create table public.daily_inspiration (
  id integer primary key default 1 check (id = 1),
  quote jsonb,
  verse jsonb,
  refresh_after timestamptz not null default '1970-01-01T00:00:00Z'
);
alter table public.daily_inspiration enable row level security;
revoke all on public.daily_inspiration from anon, authenticated;
grant select on public.daily_inspiration to anon, authenticated;
grant all on public.daily_inspiration to service_role;
create policy "Read daily inspiration" on public.daily_inspiration for select to anon, authenticated using (true);
insert into public.daily_inspiration(id) values (1);
