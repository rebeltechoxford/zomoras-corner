create table public.writer_setup (
  id integer primary key check (id = 1),
  code_hash text not null,
  expires_at timestamptz not null
);
alter table public.writer_setup enable row level security;
revoke all on public.writer_setup from anon, authenticated;
grant all on public.writer_setup to service_role;
-- No public policies: only the activation function's service client can read this table.
