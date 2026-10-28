import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { commentRequest, readReceipts, saveReceipts } from './comment-api';
import type { Comment, Receipt } from './comment-api';
import { formatDate, messageOf } from './model';

export function Comments({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>(readReceipts);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [body, setBody] = useState('');
  const [website, setWebsite] = useState(''); const [answer, setAnswer] = useState('');
  const [challenge, setChallenge] = useState<{ id: string; question: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false); const [limit, setLimit] = useState(50);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('story_comments').select('id,post_id,name,body,status,created_at').eq('post_id', postId).eq('status', 'approved').order('created_at', { ascending: false }).limit(limit);
    if (error) { setLoadError('The conversation couldn’t load. Please try again.'); return; }
    setComments(data || []); setLoadError(''); setLoaded(true);
    const saved = readReceipts();
    const mine = saved.filter(r => r.post_id === postId);
    if (mine.length) {
      try {
        const result = await commentRequest<{ statuses: Record<string, string> }>({ action: 'status', receipts: mine.map(({ id, receipt }) => ({ id, receipt })) });
        const next = readReceipts().filter(r => result.statuses[r.id] !== 'approved' && result.statuses[r.id] !== 'removed').map(r => ({ ...r, status: result.statuses[r.id] === 'rejected' ? 'rejected' as const : r.status }));
        saveReceipts(next); setReceipts(next);
      } catch { /* A status check failure must not discard a local receipt. */ }
    }
  }, [postId, limit]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setReady(false); if (!challenge) return; const timer = setTimeout(() => setReady(true), 2100); return () => clearTimeout(timer); }, [challenge]);
  async function newChallenge() {
    setBusy(true); setError('');
    try { setChallenge(await commentRequest({ action: 'challenge' })); setAnswer(''); }
    catch (e) { setError(messageOf(e)); } finally { setBusy(false); }
  }
  async function submit() {
    if (!ready) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await commentRequest<{ id: string; receipt: string; created_at: string }>({ action: 'submit', post_id: postId, name, email, body, website, challenge_id: challenge?.id, answer });
      const next = [...readReceipts().filter(r => r.id !== result.id), { ...result, post_id: postId, name: name.trim(), body: body.trim(), status: 'pending' as const }];
      const saved = saveReceipts(next); setReceipts(next);
      setBody(''); setEmail(''); setChallenge(null); setAnswer('');
      setNotice(saved ? 'Thank you. Your comment is with Zomora for a little care and review.' : 'Your comment was received. This browser couldn’t save a receipt, so its pending status won’t survive a reload.');
    } catch (e) { setError(messageOf(e)); }
    finally { setBusy(false); }
  }
  const mine = receipts.filter(r => r.post_id === postId && !comments.some(c => c.id === r.id));
  return <section className="comments-section" aria-labelledby="comments-title">
    <div className="section-heading"><div><p className="eyebrow">A LITTLE CONVERSATION</p><h2 id="comments-title">Leave a little kindness.</h2></div><button className="quiet-button" onClick={() => void load()}>Refresh comments</button></div>
    <p>Thoughts, encouragement, and a little grace are welcome. Zomora reads each comment before it appears here.</p>
    {loadError && <p className="notice error" role="alert">{loadError}</p>}
    {loaded && !comments.length && <p className="meta">There’s room for the first kind word.</p>}
    <div className="comment-list">{comments.map(c => <article className="comment-card" key={c.id}><header><strong>{c.name}</strong><time dateTime={c.created_at}>{formatDate(c.created_at)}</time></header><p>{c.body}</p></article>)}</div>
    {comments.length >= limit && <button className="quiet-button" onClick={() => setLimit(limit + 50)}>Read earlier comments</button>}
    {mine.map(c => <article key={c.id} className="comment-card comment-pending"><header><strong>{c.name}</strong><span className="status-pill">{c.status === 'rejected' ? 'Not published' : 'Pending approval'} · only on this device</span></header><p>{c.body}</p>{c.status === 'rejected' && <small>This comment wasn’t approved. You’re welcome to send a gentler version.</small>}<button className="quiet-button" onClick={() => { const next = receipts.filter(r => r.id !== c.id); saveReceipts(next); setReceipts(next); }}>Dismiss local receipt</button></article>)}
    <form className="comment-form" onSubmit={e => { e.preventDefault(); if (challenge) void submit(); else void newChallenge(); }}>
      <fieldset disabled={busy}><div className="comment-fields"><label>Your name<input autoComplete="name" required maxLength={100} value={name} onChange={e => setName(e.target.value)}/></label><label>Your email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)}/></label></div>
        <label>Your comment<textarea aria-label="Your comment" required rows={5} maxLength={3000} value={body} onChange={e => setBody(e.target.value)} aria-describedby="comment-privacy"/></label>
        <p id="comment-privacy" className="meta">Text only, up to 3,000 characters. Your name and comment may be published. Your email stays private and is shared only with Zomora so she can reply. A pending receipt is saved on this device for up to 30 days.</p>
        <div className="comment-honeypot" aria-hidden="true"><label>Leave this website field empty<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)}/></label></div>
        {challenge && <div className="comment-check"><label>A little human check: {challenge.question}<input required inputMode="numeric" pattern="[0-9]{1,3}" maxLength={3} autoComplete="off" value={answer} onChange={e => setAnswer(e.target.value)}/></label><button type="button" className="quiet-button" onClick={() => void newChallenge()}>Get a new question</button><small>Take a breath, answer, then send. This question lasts 10 minutes.</small></div>}
        <button className="button" type="submit" disabled={busy || (!!challenge && !ready)}>{busy ? 'One little moment…' : challenge ? 'Send for approval' : 'Continue to human check'}</button>
      </fieldset>
      {error && <p className="notice error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    </form>
  </section>;
}
