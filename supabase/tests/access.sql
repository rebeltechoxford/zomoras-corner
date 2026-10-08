-- Run as postgres in this project's SQL editor. Fixtures are rolled back.
begin;
insert into public.writers(email) values ('access-test@example.invalid');
insert into public.posts(id,slug,title,summary,body,status,photos) values
('00000000-0000-4000-8000-000000000101','access-test-public','Test','Test','Test','published','[{"path":"00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000101.jpg","alt":"Test","caption":""}]'),
('00000000-0000-4000-8000-000000000102','access-test-private','Test','Test','Test','draft','[{"path":"00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000102.jpg","alt":"Test","caption":""}]');
-- Storage metadata fixtures only; no objects are created outside this transaction.
insert into storage.objects(bucket_id,name) values
('story-photos','00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000101.jpg'),
('story-photos','00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000102.jpg');
set local role anon;
do $$ begin
  if (select count(*) from public.posts where slug like 'access-test-%') <> 1 then raise exception 'Anonymous draft access'; end if;
  if (select count(*) from storage.objects where name like '00000000-0000-4000-8000-000000000001/%') <> 1 then raise exception 'Anonymous draft photo access'; end if;
  begin
    perform * from public.writer_setup;
    raise exception 'Setup secret table accessible';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.posts(slug) values ('access-test-forbidden');
    raise exception 'Anonymous write succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","email":"stranger@example.invalid","role":"authenticated"}',true);
do $$ declare affected integer; begin
  if exists(select 1 from public.writers) then raise exception 'Writer allowlist leaked'; end if;
  if (select count(*) from public.posts where slug like 'access-test-%') <> 1 then raise exception 'Stranger draft access'; end if;
  update public.posts set title='Forbidden' where slug='access-test-public';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stranger edited post'; end if;
  update public.site_settings set title='Forbidden';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Stranger edited settings'; end if;
  begin
    insert into storage.objects(bucket_id,name) values ('story-photos','00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000103.jpg');
    raise exception 'Stranger uploaded photo';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","email":"access-test@example.invalid","role":"authenticated"}',true);
do $$ declare affected integer; begin
  if (select count(*) from public.posts where slug like 'access-test-%') <> 2 then raise exception 'Writer cannot read drafts'; end if;
  if (select count(*) from storage.objects where name like '00000000-0000-4000-8000-000000000001/%') <> 2 then raise exception 'Writer cannot read photos'; end if;
  update public.posts set title='Edited' where slug='access-test-private';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Writer cannot edit'; end if;
  insert into storage.objects(bucket_id,name) values ('story-photos','00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000103.jpg');
  delete from public.posts where slug='access-test-private';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Writer cannot delete'; end if;
end $$;
reset role;
rollback;
select 'PASS: reader, stranger, writer, setup secret, and photo access checks' as result;

