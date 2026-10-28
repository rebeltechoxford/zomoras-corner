-- All fixtures roll back. No email or real user records are touched.
begin;
insert into public.writers(email) values ('comments-test@example.invalid');
insert into public.posts(id,slug,title,summary,body,status) values
('10000000-0000-4000-8000-000000000901','comment-test-public','Test','Test','Test','published'),
('10000000-0000-4000-8000-000000000902','comment-test-private','Test','Test','Test','draft');
insert into public.story_comments(id,post_id,name,body,status) values
('20000000-0000-4000-8000-000000000901','10000000-0000-4000-8000-000000000901','Reader','Pending','pending'),
('20000000-0000-4000-8000-000000000902','10000000-0000-4000-8000-000000000901','Reader','Approved','approved'),
('20000000-0000-4000-8000-000000000903','10000000-0000-4000-8000-000000000902','Reader','Private story','approved');
insert into public.comment_contacts(comment_id,email) values ('20000000-0000-4000-8000-000000000901','private@example.invalid');
set local role anon;
do $$ begin
  if (select count(*) from public.story_comments where name='Reader') <> 1 then raise exception 'Public pending or draft leak'; end if;
  begin perform * from public.comment_contacts; raise exception 'Public email access'; exception when insufficient_privilege then null; end;
  begin perform public.comment_mail_settings(); raise exception 'Mail secrets public'; exception when insufficient_privilege then null; end;
  begin perform public.issue_comment_challenge(gen_random_uuid(),'test','test'); raise exception 'Direct challenge bypass'; exception when insufficient_privilege then null; end;
  begin insert into public.story_comments(id,post_id,name,body) values(gen_random_uuid(),'10000000-0000-4000-8000-000000000901','Bot','Bypass'); raise exception 'Direct insert bypass'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","email":"stranger@example.invalid","role":"authenticated"}',true);
do $$ declare changed integer; begin
  if exists(select 1 from public.comment_contacts) then raise exception 'Stranger email leak'; end if;
  if (select count(*) from public.story_comments where name='Reader') <> 1 then raise exception 'Stranger pending leak'; end if;
  update public.story_comments set status='approved' where id='20000000-0000-4000-8000-000000000901';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Stranger approved a comment'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000003","email":"comments-test@example.invalid","role":"authenticated"}',true);
do $$ declare changed integer; begin
  if not exists(select 1 from public.comment_contacts where email='private@example.invalid') then raise exception 'Writer cannot read contact'; end if;
  update public.story_comments set status='approved' where id='20000000-0000-4000-8000-000000000901';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'Writer cannot approve'; end if;
  begin update public.story_comments set body='Edited by writer'; raise exception 'Writer can alter visitor words'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ declare token uuid := '30000000-0000-4000-8000-000000000901'; result text; begin
  if not public.issue_comment_challenge(token,'test-ip','answer') then raise exception 'Could not issue challenge'; end if;
  update public.comment_challenges set created_at=now()-interval '3 seconds' where id=token;
  result := public.submit_story_comment(token,'test-ip','wrong','10000000-0000-4000-8000-000000000901','Check','check@example.invalid','test-email','Hello');
  if result <> 'challenge' then raise exception 'Wrong answer accepted'; end if;
  result := public.submit_story_comment(token,'test-ip','answer','10000000-0000-4000-8000-000000000901','Check','check@example.invalid','test-email','Hello');
  if result <> 'challenge' then raise exception 'Used failed challenge accepted'; end if;
  token := '30000000-0000-4000-8000-000000000902';
  perform public.issue_comment_challenge(token,'test-ip','answer');
  update public.comment_challenges set created_at=now()-interval '3 seconds' where id=token;
  result := public.submit_story_comment(token,'test-ip','answer','10000000-0000-4000-8000-000000000901','Check','check@example.invalid','test-email','Hello');
  if result <> 'accepted' then raise exception 'Valid submission failed'; end if;
  result := public.submit_story_comment(token,'test-ip','answer','10000000-0000-4000-8000-000000000901','Check','check@example.invalid','test-email','Hello');
  if result <> 'accepted' or (select count(*) from public.story_comments where id=token) <> 1 then raise exception 'Retry not idempotent'; end if;
  if public.submit_story_comment(token,'test-ip','answer','10000000-0000-4000-8000-000000000901','Check','check@example.invalid','test-email','Different words') <> 'challenge' then raise exception 'Replay accepted a different payload'; end if;
  if (select status from public.story_comments where id=token) <> 'pending' then raise exception 'Submission auto-approved'; end if;
  token := '30000000-0000-4000-8000-000000000903';
  perform public.issue_comment_challenge(token,'test-ip','answer');
  update public.comment_challenges set created_at=now()-interval '11 minutes' where id=token;
  if public.submit_story_comment(token,'test-ip','answer','10000000-0000-4000-8000-000000000901','Check','check@example.invalid','test-email','Hello') <> 'challenge' then raise exception 'Expired challenge accepted'; end if;
  token := '30000000-0000-4000-8000-000000000904';
  perform public.issue_comment_challenge(token,'test-ip','answer');
  update public.comment_challenges set created_at=now()-interval '3 seconds' where id=token;
  if public.submit_story_comment(token,'test-ip','answer','10000000-0000-4000-8000-000000000902','Check','check@example.invalid','test-email','Hello') <> 'post' then raise exception 'Draft accepted comment'; end if;
  insert into public.comment_limits(ip_hash,email_hash) select 'test-ip','test-email' from generate_series(1,5);
  token := '30000000-0000-4000-8000-000000000905';
  perform public.issue_comment_challenge(token,'test-ip','answer');
  update public.comment_challenges set created_at=now()-interval '3 seconds' where id=token;
  if public.submit_story_comment(token,'test-ip','answer','10000000-0000-4000-8000-000000000901','Check','check@example.invalid','test-email','Hello') <> 'limited' then raise exception 'Rate limit bypassed'; end if;
end $$;
reset role;
rollback;
select 'PASS: comment privacy, moderation, challenges, replay, expiry, drafts, and limits' as result;
