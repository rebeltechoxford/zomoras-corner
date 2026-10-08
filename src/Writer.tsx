import { Icon } from './Icon';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBlog } from './blog';
import { Login } from './Login';
import { Editor } from './Editor';
import { emptyPost, formatDate, messageOf } from './model';
import type { Post, SiteSettings } from './model';
import { parseDraft } from './drafts';
import { cleanUnusedPhotos, deletePost, savePost, saveSettings } from './publishing';
import { resolvePhotos, uploadPhoto } from './photos';

export function Writer() {
  const blog = useBlog();
  const [editing, setEditing] = useState<Post | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [tab, setTab] = useState('all'); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [recovery, setRecovery] = useState(() => {
    try { return Object.keys(localStorage).some(key => key.startsWith('corner.recovery.')); } catch { return false; }
  });
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); setNotice(''); try { await action(); } catch (e) { setError(messageOf(e)); } finally { setBusy(false); } }
  async function restore() {
    const raw = localStorage.getItem(`corner.recovery.${blog.session!.user.id}`);
    if (!raw) { setRecovery(false); setNotice('No recovery copy on this device for this account.'); return; }
    const post = JSON.parse(raw) as Post;
    if (!post || typeof post.id !== 'string' || typeof post.title !== 'string' || typeof post.body !== 'string' || !Array.isArray(post.photos)) throw new Error('This recovery copy cannot be opened. Your original data has not been removed.');
    setRecovered(true); setEditing({ ...post, photos: await resolvePhotos(post.photos) });
  }
  async function importFile(file: File) {
    if (file.size > 40 * 1024 * 1024) throw new Error('Please choose a draft JSON file smaller than 40 MB.');
    const imported = parseDraft(await file.text());
    const post = { ...emptyPost(), title: imported.title, summary: imported.summary, body: imported.body, category: imported.category || 'Little joys' };
    for (const image of imported.images || []) {
      const blob = await (await fetch(image.data)).blob();
      const photo = await uploadPhoto(new File([blob], 'draft-photo', { type: blob.type }), blog.session!.user.id);
      post.photos.push({ ...photo, alt: image.alt, caption: image.caption });
    }
    post.photos = await resolvePhotos(post.photos); setEditing(post);
  }
  async function importLegacy() {
    const raw = localStorage.getItem('corner.posts.v1');
    if (!raw) { setNotice('No old browser stories found on this address. You can still import your JSON draft files.'); return; }
    const old: unknown = JSON.parse(raw);
    if (!Array.isArray(old) || !old.every(p => ['title', 'summary', 'body', 'slug'].every(k => typeof p?.[k] === 'string'))) throw new Error('The old stories could not be read; the original browser data is untouched.');
    let count = 0;
    for (const p of old) {
      const slug = `legacy-${p.slug}`;
      if (blog.posts.some(post => post.slug === slug)) continue;
      await savePost({ ...emptyPost(), title: p.title, summary: p.summary, body: p.body, slug }, 'draft'); count++;
    }
    await blog.refresh(); setNotice(`${count} old stories brought over as private drafts. Your original browser data is untouched.`);
  }
  if (blog.loading) return null;
  if (!blog.session || blog.recovery) return <section className="section"><Login/></section>;
  if (!blog.isWriter) return <section className="empty-state"><h1>This desk is reserved.</h1><p>You’re signed in, but this account doesn’t have writer access.</p><button className="button" onClick={() => void run(blog.logout)}>Sign out</button>{error && <p role="alert">{error}</p>}</section>;
  if (changingPassword) return <section className="section"><Login changePassword done={() => setChangingPassword(false)}/></section>;
  const list = blog.posts.filter(p => tab === 'all' || p.status === tab);
  return <section className="section writing-desk">
    <div className="section-heading"><div><p className="eyebrow">YOUR LITTLE SPACE</p><h1>The writing desk.</h1><p className="lead">A fresh page, a warm cup, and no hurry.</p></div><button className="quiet-button" disabled={busy} onClick={() => void run(blog.logout)}>Log out <Icon name="outward"/></button></div>
    <div className="desk-stats"><div><strong>{blog.posts.filter(p => p.status === 'published').length}</strong><span>stories out in the world</span></div><div><strong>{blog.posts.filter(p => p.status === 'draft').length}</strong><span>thoughts still unfolding</span></div><div><strong><Icon name="coffee"/></strong><span>always time for a break</span></div></div>
    {error && <p className="notice error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    {recovery && <div className="recovery-note"><span>Picking up where you left off?</span><button className="quiet-button" disabled={busy} onClick={() => void run(restore)}>Recover device draft <Icon name="outward"/></button></div>}
    <div className="desk-toolbar"><button className="button" disabled={busy} onClick={() => setEditing(emptyPost())}><Icon name="add"/> Write a story</button><button className="button secondary" disabled={busy} onClick={() => fileInput.current?.click()}>Load JSON draft <Icon name="upload"/></button><button className="quiet-button" disabled={busy} onClick={() => setSettings({ ...blog.settings })}>Edit my corner</button></div>
    <input hidden type="file" ref={fileInput} accept=".json,application/json" aria-label="Load draft JSON file" onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (file) void run(() => importFile(file)); }}/>
    {settings && <form className="editor settings-editor" onSubmit={e => { e.preventDefault(); void run(async () => { await saveSettings(settings); await blog.refresh(); setSettings(null); setNotice('Your corner has been updated.'); }); }}><h2>Make this corner yours.</h2><p>Your words here appear on the home and about pages.</p><fieldset disabled={busy}>
      <label>Site name<input required maxLength={80} value={settings.title} onChange={e => setSettings({ ...settings, title: e.target.value })}/></label>
      <label>A little tagline<input maxLength={200} value={settings.tagline} onChange={e => setSettings({ ...settings, tagline: e.target.value })}/></label>
      <label>About this corner<textarea rows={7} maxLength={5000} value={settings.about} onChange={e => setSettings({ ...settings, about: e.target.value })}/></label>
      <label>Public contact email <small>(optional, visible to everyone)</small><input type="email" value={settings.email} onChange={e => setSettings({ ...settings, email: e.target.value })}/></label>
      <label>Instagram username <small>(optional, without @)</small><input pattern="[a-zA-Z0-9_.]{1,30}" maxLength={30} value={settings.instagram} onChange={e => setSettings({ ...settings, instagram: e.target.value })}/></label>
      <div className="row-actions"><button className="button">Save my corner</button><button type="button" className="quiet-button" onClick={() => setSettings(null)}>Cancel</button></div>
    </fieldset></form>}
    <div className="filter-pills">{[['all','All stories'],['draft','Drafts'],['published','Published']].map(([id,label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
    <div className="desk-list">{list.map(post => <article key={post.id} className="desk-story"><div className="desk-thumbnail">{post.photos[0]?.url ? <img src={post.photos[0].url} alt=""/> : <span><Icon name="flower"/></span>}</div><div><span className={`status-pill ${post.status}`}>{post.status}</span><h2>{post.title || 'An untitled thought'}</h2><p className="meta">{post.category} · Saved {formatDate(post.updated_at)}</p></div><div className="row-actions"><button className="button secondary" disabled={busy} onClick={() => setEditing(post)}>Edit<span className="sr-only"> {post.title}</span></button>{post.status === 'published' && <Link className="quiet-button" to={`/blog/${post.slug}`}>Read</Link>}<button className="quiet-button danger" disabled={busy} onClick={() => { if (window.confirm(`Delete “${post.title || 'Untitled'}”? This cannot be undone. Download a backup first if you want to keep it.`)) void run(async () => { await deletePost(post); await blog.refresh(); setNotice('Story deleted.'); }); }}>Delete<span className="sr-only"> {post.title}</span></button></div></article>)}</div>
    {!list.length && <div className="empty-state"><span><Icon name="write"/></span><h2>A blank page is a beginning.</h2><p>Your words don’t need to be perfect. Start with one small thought.</p></div>}
    <details className="desk-help"><summary>A little help & housekeeping</summary><ol><li>Write a title, introduction, and story. Choose a category.</li><li>Add photos, descriptions, and captions. Make your favorite the cover.</li><li>Save draft for later. Preview, then Publish when you’re ready.</li><li>Download a JSON backup to keep the words and photos outside the site.</li></ol><button className="quiet-button" disabled={busy} onClick={() => void run(importLegacy)}>Bring over old browser stories</button><button className="quiet-button" onClick={() => setChangingPassword(true)}>Change my password</button><button className="quiet-button" disabled={busy} onClick={() => { if (window.confirm('Remove your photos older than 24 hours that aren’t used in any saved story? Save any device-only drafts online first.')) void run(async () => { const count = await cleanUnusedPhotos(); setNotice(`${count} unused photos removed.`); }); }}>Clean up unused photo uploads</button></details>
    {editing && <Editor key={editing.id} initial={editing} recovered={recovered} close={() => { setEditing(null); setRecovered(false); setRecovery(true); }}/>} 
  </section>;
}
