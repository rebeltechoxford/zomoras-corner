import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabase';
import { useBlog } from './blog';
import { commentRequest } from './comment-api';
import type { Comment } from './comment-api';
import { formatDate, messageOf } from './model';

type Review = Comment & { comment_contacts: { email: string; notification_status: string } | null };
export function CommentModeration() {
  const { posts } = useBlog();
  const [tab, setTab] = useState('pending'); const [rows, setRows] = useState<Review[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    setBusy(true); setError(''); setLoaded(false);
    const { data, error } = await supabase.from('story_comments').select('id,post_id,name,body,status,created_at,comment_contacts(email,notification_status)').eq('status', tab).order('created_at').limit(100);
    if (error) setError('Couldn’t load comments. Please refresh to try again.');
    else { setRows((data || []) as unknown as Review[]); setLoaded(true); }
    setBusy(false);
  }, [tab]);
  useEffect(() => { void load(); }, [load]);
  async function moderate(row: Review, status: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      const { data, error } = await supabase.from('story_comments').update({ status }).eq('id', row.id).eq('status', row.status).select('id');
      if (error || !data?.length) throw new Error('This comment changed or couldn’t be saved. Refresh and try again.');
      setRows(previous => previous.filter(c => c.id !== row.id));
      setNotice(status === 'approved' ? 'Comment approved. It appears publicly while its story is published.' : status === 'rejected' ? 'Comment declined. It is not public.' : 'Comment returned to private review.');
    } catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  async function retry(id: string) {
    setBusy(true); setError('');
    try { await commentRequest({ action: 'notify', id }); setNotice('Notification request completed. Check its delivery status below.'); await load(); }
    catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  return <section className="comment-moderation" aria-labelledby="review-comments-title"><div className="section-heading"><div><p className="eyebrow">KIND WORDS, AT YOUR PACE</p><h2 id="review-comments-title">The comment basket.</h2></div><button className="quiet-button" disabled={busy} onClick={() => void load()}>Refresh basket</button></div>
    <p>Only approved comments appear on your stories. Email addresses stay here with you. “Reply by email” opens your mail app; declining doesn’t send a reply automatically.</p>
    <div className="filter-pills">{[['pending','Awaiting approval'],['approved','Approved comments'],['rejected','Declined comments']].map(([id,label]) => <button key={id} disabled={busy} aria-pressed={tab === id} onClick={() => { setNotice(''); setRows([]); setTab(id); }}>{label}</button>)}</div>
    {error && <p role="alert" className="notice error">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    {loaded && !rows.length && <p className="meta">All quiet in this basket.</p>}
    {rows.map(c => { const post = posts.find(p => p.id === c.post_id); const contact = c.comment_contacts; return <article className="comment-card" key={c.id}><header><strong>{c.name}</strong><time dateTime={c.created_at}>{formatDate(c.created_at)}</time></header><small>On {post?.status === 'published' ? <Link className="text-link" to={`/blog/${post.slug}`}>{post.title}</Link> : post?.title || 'a story'}</small><p>{c.body}</p>
      {contact && <p className="meta">Private email: {contact.email}<br/>Email notice: {({ sent:'accepted by mail server', sending:'delivery uncertain — check your inbox before resending', failed:'not sent', unconfigured:'mail setup needed', queued:'waiting to send' } as Record<string,string>)[contact.notification_status] || contact.notification_status}</p>}
      <div className="row-actions">{c.status !== 'approved' && <button className="button" disabled={busy} onClick={() => void moderate(c, 'approved')}>Approve comment</button>}{c.status !== 'rejected' && <button className="button secondary" disabled={busy} onClick={() => void moderate(c, 'rejected')}>Decline comment</button>}{c.status !== 'pending' && <button className="quiet-button" disabled={busy} onClick={() => void moderate(c, 'pending')}>Return to review</button>}
        {contact && <a className="quiet-button" href={`mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent('Your comment on Zomora’s Corner')}`}>Reply by email</a>}
        {contact && ['queued','failed','unconfigured'].includes(contact.notification_status) && <button className="quiet-button" disabled={busy} onClick={() => void retry(c.id)}>Retry email notice</button>}
      </div></article>; })}
    {rows.length === 100 && <p className="meta">Showing the oldest 100. Review these, then refresh for the next batch.</p>}
  </section>;
}
